# Serializers de FinTracker — convierten modelos a JSON y viceversa
import re

from django.utils import timezone
from rest_framework import serializers

from .tarjetas import estados_tarjetas
from .models import (
    Cuenta, Categoria, MensajeBanco, Transaccion, TransaccionCategoria, TransaccionRecurrente, UserCredential,
)

class UserCredentialSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserCredential
        fields = ['id', 'nickname', 'creado_en']

class WebAuthnRegistrationResponseSerializer(serializers.Serializer):
    """Serializador para la respuesta de registro de WebAuthn"""
    id = serializers.CharField()
    rawId = serializers.CharField()
    type = serializers.CharField()
    response = serializers.JSONField()

class WebAuthnAuthResponseSerializer(serializers.Serializer):
    """Serializador para la respuesta de autenticación de WebAuthn"""
    id = serializers.CharField()
    response = serializers.JSONField()
    signature = serializers.CharField()



class SoloDelUsuarioMixin:
    """
    Limita los campos relacionados a objetos del usuario autenticado.
    Sin esto, cualquiera podía enviar el id de una cuenta ajena.
    """
    campos_cuenta = ('cuenta_origen', 'cuenta_destino')

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        autenticado = bool(user and user.is_authenticated)
        for nombre in self.campos_cuenta:
            if nombre in fields:
                fields[nombre].queryset = (
                    Cuenta.objects.filter(usuario=user) if autenticado else Cuenta.objects.none()
                )
        if 'categoria' in fields:
            fields['categoria'].queryset = (
                Categoria.objects.filter(usuario=user) if autenticado else Categoria.objects.none()
            )
        return fields


def asignar_categorias(transaccion, categorias_ids, usuario):
    """Reemplaza las categorías de una transacción con 2 consultas en total."""
    ids = set(
        Categoria.objects.filter(id__in=categorias_ids, usuario=usuario).values_list('id', flat=True)
    )
    TransaccionCategoria.objects.bulk_create([
        TransaccionCategoria(transaccion=transaccion, categoria_id=cat_id) for cat_id in ids
    ])


class CuentaSerializer(serializers.ModelSerializer):
    # Campo calculado — solo lectura
    balance_actual = serializers.ReadOnlyField()
    # Solo tarjetas: corte, fecha límite, cuánto pagar. La vista lo calcula en lote.
    estado_tarjeta = serializers.SerializerMethodField()

    class Meta:
        model = Cuenta
        fields = [
            'id', 'nombre', 'tipo', 'balance_inicial',
            'balance_actual', 'color_hex', 'activa', 'creada_en',
            'cupo', 'dia_corte', 'dia_pago', 'estado_tarjeta', 'terminaciones',
        ]
        read_only_fields = ['creada_en']
        extra_kwargs = {
            'dia_corte': {'min_value': 1, 'max_value': 31},
            'dia_pago': {'min_value': 1, 'max_value': 31},
            'cupo': {'min_value': 0},
        }

    def get_estado_tarjeta(self, cuenta):
        estados = self.context.get('estados_tarjeta')
        if estados is None:
            estados = estados_tarjetas([cuenta], timezone.localdate())
        return estados.get(cuenta.id)

    def validate_terminaciones(self, valor):
        """'*8174, 5284 · Nequi' → '8174 5284 nequi' (últimos 4 dígitos o una palabra)."""
        fichas = []
        for t in re.split(r'[\s,;·*]+', valor or ''):
            t = t.lower()
            if t.isdigit() and len(t) >= 3:
                t = t[-4:]
            elif not t.isalpha():
                continue
            if t not in fichas:
                fichas.append(t)
        return ' '.join(fichas)

    def validate(self, data):
        tipo = data.get('tipo', getattr(self.instance, 'tipo', 'activo'))
        if tipo == 'credito':
            for campo, nombre in (('dia_corte', 'día de corte'), ('dia_pago', 'día de pago')):
                if data.get(campo, getattr(self.instance, campo, None)) is None:
                    raise serializers.ValidationError({campo: f'Indica el {nombre} de la tarjeta.'})
        else:
            # Los datos de tarjeta no aplican a otras cuentas
            data.update(cupo=None, dia_corte=None, dia_pago=None)
        return data

    def create(self, validated_data):
        # Asigna automáticamente el usuario autenticado
        validated_data['usuario'] = self.context['request'].user
        return super().create(validated_data)


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = [
            'id', 'nombre', 'tipo', 'presupuesto_mensual',
            'presupuesto_semanal', 'color_hex', 'activa'
        ]

    def create(self, validated_data):
        validated_data['usuario'] = self.context['request'].user
        return super().create(validated_data)


class TransaccionCategoriaSerializer(serializers.ModelSerializer):
    # Muestra id y nombre de la categoría en la transacción
    id = serializers.ReadOnlyField(source='categoria.id')
    nombre = serializers.ReadOnlyField(source='categoria.nombre')
    color_hex = serializers.ReadOnlyField(source='categoria.color_hex')

    class Meta:
        model = TransaccionCategoria
        fields = ['id', 'nombre', 'color_hex']


class TransaccionSerializer(SoloDelUsuarioMixin, serializers.ModelSerializer):
    # Categorías anidadas — lectura
    categorias = TransaccionCategoriaSerializer(
        source='transaccion_categorias',
        many=True,
        read_only=True,
    )
    # IDs de categorías — escritura
    categorias_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        default=list,
    )
    # Nombres de cuentas para mostrar en la UI
    cuenta_origen_nombre = serializers.CharField(
        source='cuenta_origen.nombre',
        read_only=True,
        default=None,
    )
    cuenta_destino_nombre = serializers.CharField(
        source='cuenta_destino.nombre',
        read_only=True,
        default=None,
    )
    # Id del SMS de la bandeja que se está registrando a mano
    mensaje_banco = serializers.IntegerField(write_only=True, required=False)
    origen = serializers.CharField(read_only=True)
    # Para mostrar "Pago de tarjeta" cuando una transferencia va a una deuda
    cuenta_destino_tipo = serializers.CharField(
        source='cuenta_destino.tipo',
        read_only=True,
        default=None,
    )

    class Meta:
        model = Transaccion
        fields = [
            'id', 'nombre', 'monto', 'fecha', 'tipo',
            'cuenta_origen', 'cuenta_destino',
            'cuenta_origen_nombre', 'cuenta_destino_nombre', 'cuenta_destino_tipo',
            'categorias', 'categorias_ids', 'origen', 'mensaje_banco',
            'notas', 'creada_en',
        ]
        read_only_fields = ['creada_en']

    def validate(self, data):
        # En un PATCH, lo que no viene se toma de la transacción guardada
        actual = lambda campo: data.get(campo, getattr(self.instance, campo, None))
        tipo = actual('tipo')
        cuenta_origen = actual('cuenta_origen')
        cuenta_destino = actual('cuenta_destino')

        if tipo == 'gasto' and not cuenta_origen:
            raise serializers.ValidationError('Un gasto requiere cuenta de origen.')
        if tipo == 'ingreso' and not cuenta_destino:
            raise serializers.ValidationError('Un ingreso requiere cuenta de destino.')
        if tipo in ('ahorro', 'transferencia'):
            if not (cuenta_origen and cuenta_destino):
                raise serializers.ValidationError('Se necesita cuenta de origen y de destino.')
            if cuenta_origen == cuenta_destino:
                raise serializers.ValidationError('La cuenta de origen y la de destino deben ser distintas.')
        return data

    def create(self, validated_data):
        categorias_ids = validated_data.pop('categorias_ids', [])
        mensaje_id = validated_data.pop('mensaje_banco', None)
        usuario = self.context['request'].user
        transaccion = Transaccion.objects.create(usuario=usuario, **validated_data)
        asignar_categorias(transaccion, categorias_ids, usuario)
        # Registrada a mano desde la bandeja: el SMS queda resuelto
        if mensaje_id:
            MensajeBanco.objects.filter(pk=mensaje_id, usuario=usuario, estado='pendiente').update(
                estado='registrado', transaccion=transaccion, motivo='',
            )
        return transaccion

    def update(self, instance, validated_data):
        categorias_ids = validated_data.pop('categorias_ids', None)
        validated_data.pop('mensaje_banco', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Actualizar categorías si se enviaron
        if categorias_ids is not None:
            instance.transaccion_categorias.all().delete()
            asignar_categorias(instance, categorias_ids, self.context['request'].user)

        return instance


class TransaccionRecurrenteSerializer(SoloDelUsuarioMixin, serializers.ModelSerializer):
    cuenta_origen_nombre = serializers.CharField(source='cuenta_origen.nombre', read_only=True, default=None)
    cuenta_destino_nombre = serializers.CharField(source='cuenta_destino.nombre', read_only=True, default=None)
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True, default=None)
    categoria_color = serializers.CharField(source='categoria.color_hex', read_only=True, default=None)

    class Meta:
        model = TransaccionRecurrente
        fields = [
            'id', 'nombre', 'monto', 'tipo', 'categoria', 'categoria_nombre', 'categoria_color',
            'cuenta_origen', 'cuenta_origen_nombre',
            'cuenta_destino', 'cuenta_destino_nombre',
            'frecuencia', 'dia_ejecucion', 'ultima_ejecucion', 'activa', 'creada_en'
        ]
        read_only_fields = ['creada_en']

    def create(self, validated_data):
        validated_data['usuario'] = self.context['request'].user
        return super().create(validated_data)

class MensajeBancoSerializer(serializers.ModelSerializer):
    transaccion_nombre = serializers.CharField(source='transaccion.nombre', read_only=True, default=None)
    # Cómo aparece la cuenta en el SMS (*7992, nequi): para preguntar cuál es
    identificador = serializers.SerializerMethodField()

    class Meta:
        model = MensajeBanco
        fields = [
            'id', 'remitente', 'texto', 'recibido_en', 'estado', 'metodo', 'datos', 'motivo',
            'transaccion', 'transaccion_nombre', 'identificador',
        ]
        read_only_fields = fields

    def get_identificador(self, msg):
        from .ingesta import billetera
        d = msg.datos.get('digitos') if isinstance(msg.datos, dict) else None
        if d:
            return d[-4:]
        return billetera(msg.remitente, msg.texto)

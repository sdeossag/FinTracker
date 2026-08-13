# Serializers de FinTracker — convierten modelos a JSON y viceversa
from rest_framework import serializers
from .models import Cuenta, Categoria, Transaccion, TransaccionCategoria, TransaccionRecurrente, UserCredential

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



class CuentaSerializer(serializers.ModelSerializer):
    # Campo calculado — solo lectura
    balance_actual = serializers.ReadOnlyField()

    class Meta:
        model = Cuenta
        fields = [
            'id', 'nombre', 'tipo', 'balance_inicial',
            'balance_actual', 'color_hex', 'activa', 'creada_en'
        ]
        read_only_fields = ['creada_en']

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


class TransaccionSerializer(serializers.ModelSerializer):
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
    )
    cuenta_destino_nombre = serializers.CharField(
        source='cuenta_destino.nombre',
        read_only=True,
    )

    class Meta:
        model = Transaccion
        fields = [
            'id', 'nombre', 'monto', 'fecha', 'tipo',
            'cuenta_origen', 'cuenta_destino',
            'cuenta_origen_nombre', 'cuenta_destino_nombre',
            'categorias', 'categorias_ids',
            'notas', 'creada_en',
        ]
        read_only_fields = ['creada_en']

    def validate(self, data):
        tipo = data.get('tipo')
        cuenta_origen = data.get('cuenta_origen')
        cuenta_destino = data.get('cuenta_destino')

        if tipo == 'gasto' and not cuenta_origen:
            raise serializers.ValidationError('Un gasto requiere cuenta de origen.')
        if tipo == 'ingreso' and not cuenta_destino:
            raise serializers.ValidationError('Un ingreso requiere cuenta de destino.')
        if tipo == 'ahorro' and not (cuenta_origen and cuenta_destino):
            raise serializers.ValidationError('Un ahorro requiere cuenta origen y destino.')
        return data

    def create(self, validated_data):
        categorias_ids = validated_data.pop('categorias_ids', [])
        transaccion = Transaccion.objects.create(**validated_data)

        # Crear relaciones many-to-many con categorías
        for cat_id in categorias_ids:
            try:
                categoria = Categoria.objects.get(
                    id=cat_id,
                    usuario=self.context['request'].user
                )
                TransaccionCategoria.objects.create(
                    transaccion=transaccion,
                    categoria=categoria,
                )
            except Categoria.DoesNotExist:
                pass

        return transaccion

    def update(self, instance, validated_data):
        categorias_ids = validated_data.pop('categorias_ids', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Actualizar categorías si se enviaron
        if categorias_ids is not None:
            instance.transaccion_categorias.all().delete()
            for cat_id in categorias_ids:
                try:
                    categoria = Categoria.objects.get(
                        id=cat_id,
                        usuario=self.context['request'].user
                    )
                    TransaccionCategoria.objects.create(
                        transaccion=instance,
                        categoria=categoria,
                    )
                except Categoria.DoesNotExist:
                    pass

        return instance


class TransaccionRecurrenteSerializer(serializers.ModelSerializer):
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
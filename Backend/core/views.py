# Vistas de FinTracker — endpoints de la API REST
from datetime import date

from django.db import IntegrityError, transaction as db_transaction
from django.db.models import BigIntegerField, Exists, OuterRef, Q, Subquery, Sum
from django.db.models.functions import Coalesce, TruncMonth
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import base64

import json
from webauthn import (
    generate_registration_options, verify_registration_response,
    generate_authentication_options, verify_authentication_response,
    options_to_json, base64url_to_bytes,
)
from webauthn.helpers import bytes_to_base64url
from webauthn.helpers.structs import PublicKeyCredentialDescriptor

from .models import Cuenta, Categoria, Transaccion, TransaccionCategoria, TransaccionRecurrente, UserCredential, PerfilUsuario
from .serializers import (
    CuentaSerializer,
    CategoriaSerializer,
    TransaccionSerializer,
    TransaccionRecurrenteSerializer,
    UserCredentialSerializer,
    WebAuthnRegistrationResponseSerializer,
    WebAuthnAuthResponseSerializer,
)


# Solo aplica a contraseñas nuevas; las actuales siguen funcionando
MIN_PASSWORD = 8


class RegistroView(APIView):
    """Crea una nueva cuenta de usuario"""
    permission_classes = [AllowAny]

    def post(self, request):
        from django.contrib.auth.models import User

        username = request.data.get('username', '').strip()
        email = request.data.get('email', '').strip()
        password = request.data.get('password', '')
        confirm = request.data.get('confirm_password', '')

        if not username:
            return Response({'error': 'El usuario es requerido.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(username) < 3:
            return Response({'error': 'El usuario debe tener al menos 3 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Ese nombre de usuario ya está en uso.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < MIN_PASSWORD:
            return Response({'error': f'La contraseña debe tener al menos {MIN_PASSWORD} caracteres.'}, status=status.HTTP_400_BAD_REQUEST)
        if password != confirm:
            return Response({'error': 'Las contraseñas no coinciden.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, email=email, password=password)
        return Response({'status': 'ok', 'username': user.username}, status=status.HTTP_201_CREATED)


def rango_mes(anio, mes):
    """[primer día del mes, primer día del mes siguiente) — filtro por rango, usa el índice."""
    inicio = date(anio, mes, 1)
    fin = date(anio + 1, 1, 1) if mes == 12 else date(anio, mes + 1, 1)
    return inicio, fin


def restar_meses(anio, mes, n):
    """Devuelve (año, mes) n meses antes."""
    total = anio * 12 + (mes - 1) - n
    return total // 12, total % 12 + 1


def sumas_por_tipo(qs):
    """Totales de ingresos, gastos y ahorros en una sola consulta."""
    return qs.aggregate(**{
        clave: Coalesce(Sum('monto', filter=Q(tipo=tipo)), 0)
        for clave, tipo in (('ingresos', 'ingreso'), ('gastos', 'gasto'), ('ahorros', 'ahorro'))
    })


class CuentaViewSet(viewsets.ModelViewSet):
    """CRUD completo de cuentas — solo las del usuario autenticado"""
    serializer_class = CuentaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Entradas y salidas de todas las cuentas en la misma consulta (antes: 2 por cuenta)
        def total(campo):
            return Coalesce(
                Subquery(
                    Transaccion.objects.filter(**{campo: OuterRef('pk')})
                    .order_by().values(campo).annotate(t=Sum('monto')).values('t'),
                    output_field=BigIntegerField(),
                ),
                0,
            )

        return Cuenta.objects.filter(
            usuario=self.request.user,
            activa=True,
        ).annotate(
            total_entradas=total('cuenta_destino'),
            total_salidas=total('cuenta_origen'),
        )


class CategoriaViewSet(viewsets.ModelViewSet):
    """CRUD completo de categorías — solo las del usuario autenticado"""
    serializer_class = CategoriaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Categoria.objects.filter(
            usuario=self.request.user,
            activa=True,
        )
        # Filtro opcional por tipo: /api/categorias/?tipo=gasto
        tipo = self.request.query_params.get('tipo')
        if tipo:
            qs = qs.filter(tipo=tipo)
        return qs

    @action(detail=False, methods=['get'], url_path='gastos-mes')
    def gastos_mes(self, request):
        """
        Retorna cuánto se gastó en cada categoría en el mes actual.
        Usado por la pantalla de presupuesto para las barras de progreso.
        Formato: { categoria_id: monto_gastado }
        """
        hoy = timezone.localdate()
        inicio, fin = rango_mes(hoy.year, hoy.month)
        filas = (
            TransaccionCategoria.objects.filter(
                transaccion__usuario=request.user,
                transaccion__tipo='gasto',
                transaccion__fecha__gte=inicio,
                transaccion__fecha__lt=fin,
            )
            .values('categoria_id')
            .annotate(total=Sum('transaccion__monto'))
        )
        return Response({f['categoria_id']: f['total'] for f in filas})


class TransaccionViewSet(viewsets.ModelViewSet):
    """CRUD completo de transacciones — solo las del usuario autenticado"""
    serializer_class = TransaccionSerializer
    permission_classes = [IsAuthenticated]

    LIMITE_MAXIMO = 200

    def get_queryset(self):
        # Cuentas y categorías en 2 consultas extra, no 3 por cada fila
        qs = (
            Transaccion.objects.filter(usuario=self.request.user)
            .select_related('cuenta_origen', 'cuenta_destino')
            .prefetch_related('transaccion_categorias__categoria')
            .order_by('-fecha', '-id')
        )
        params = self.request.query_params

        # Filtro opcional por tipo: /api/transacciones/?tipo=gasto
        tipo = params.get('tipo')
        if tipo:
            qs = qs.filter(tipo=tipo)

        # Filtro opcional por mes: /api/transacciones/?mes=2026-06
        mes = params.get('mes')
        if mes:
            try:
                anio, num = (int(x) for x in mes.split('-'))
                inicio, fin = rango_mes(anio, num)
                qs = qs.filter(fecha__gte=inicio, fecha__lt=fin)
            except ValueError:
                pass

        # Búsqueda por descripción o nombre de categoría: ?q=rappi
        q = params.get('q', '').strip()
        if q:
            qs = qs.filter(
                Q(nombre__icontains=q)
                | Exists(TransaccionCategoria.objects.filter(
                    transaccion=OuterRef('pk'), categoria__nombre__icontains=q,
                ))
            )

        return qs

    def list(self, request, *args, **kwargs):
        """
        Sin ?limite= devuelve la lista completa (compatibilidad).
        Con ?limite=N devuelve una página: { resultados, siguiente }.
        `siguiente` es el cursor para ?antes=, del tipo 2026-09-22_1534.
        """
        qs = self.get_queryset()
        limite = request.query_params.get('limite')
        if limite is None:
            return Response(self.get_serializer(qs, many=True).data)

        try:
            limite = max(1, min(int(limite), self.LIMITE_MAXIMO))
        except ValueError:
            limite = 50

        antes = request.query_params.get('antes')
        if antes:
            try:
                fecha_txt, id_txt = antes.split('_')
                fecha = date.fromisoformat(fecha_txt)
                qs = qs.filter(Q(fecha__lt=fecha) | Q(fecha=fecha, id__lt=int(id_txt)))
            except ValueError:
                return Response({'error': 'Cursor inválido.'}, status=status.HTTP_400_BAD_REQUEST)

        pagina = list(qs[:limite + 1])
        hay_mas = len(pagina) > limite
        pagina = pagina[:limite]
        ultima = pagina[-1] if pagina else None
        return Response({
            'resultados': self.get_serializer(pagina, many=True).data,
            'siguiente': f'{ultima.fecha.isoformat()}_{ultima.id}' if hay_mas else None,
        })

    @action(detail=False, methods=['get'], url_path='resumen-mes')
    def resumen_mes(self, request):
        """
        Retorna totales de ingresos, gastos y ahorros del mes actual.
        Usado por la pantalla de inicio.
        Formato: { ingresos: N, gastos: N, ahorros: N }
        """
        hoy = timezone.localdate()
        inicio, fin = rango_mes(hoy.year, hoy.month)
        return Response(sumas_por_tipo(Transaccion.objects.filter(
            usuario=request.user, fecha__gte=inicio, fecha__lt=fin,
        )))

    @action(detail=False, methods=['get'], url_path='analytics')
    def analytics(self, request):
        """
        Devuelve resumen, evolución mensual y gastos por categoría para el período dado.
        Param: periodo = mes | 3meses | 6meses | anio
        Todo se agrega en la base de datos: 3 consultas sin importar cuántas transacciones haya.
        """
        periodo = request.query_params.get('periodo', 'mes')
        hoy = timezone.localdate()
        n = {'mes': 1, '3meses': 3, '6meses': 6, 'anio': 12}.get(periodo, 1)

        fecha_inicio = date(*restar_meses(hoy.year, hoy.month, n - 1), 1)
        # Período anterior equivalente (misma duración, inmediatamente antes)
        prev_inicio = date(*restar_meses(fecha_inicio.year, fecha_inicio.month, n), 1)

        base = Transaccion.objects.filter(usuario=request.user)
        del_periodo = base.filter(fecha__gte=fecha_inicio, fecha__lte=hoy)

        # 1) Totales por mes y tipo
        filas = (
            del_periodo.annotate(m=TruncMonth('fecha'))
            .values('m', 'tipo').annotate(total=Sum('monto')).order_by()
        )
        por_mes = {(f['m'].year, f['m'].month, f['tipo']): f['total'] for f in filas}

        MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
        mensual = []
        for i in range(n):
            y, m = restar_meses(hoy.year, hoy.month, n - 1 - i)
            mensual.append({
                'mes': f'{y}-{str(m).zfill(2)}',
                'mes_corto': MESES[m - 1],
                'ingresos': por_mes.get((y, m, 'ingreso'), 0),
                'gastos':   por_mes.get((y, m, 'gasto'), 0),
                'ahorros':  por_mes.get((y, m, 'ahorro'), 0),
            })
        ingresos_t = sum(x['ingresos'] for x in mensual)
        gastos_t   = sum(x['gastos'] for x in mensual)
        ahorros_t  = sum(x['ahorros'] for x in mensual)

        # 2) Período anterior
        ant = sumas_por_tipo(base.filter(fecha__gte=prev_inicio, fecha__lt=fecha_inicio))

        # 3) Gasto por categoría
        cats = list(
            TransaccionCategoria.objects.filter(
                transaccion__usuario=request.user,
                transaccion__tipo='gasto',
                transaccion__fecha__gte=fecha_inicio,
                transaccion__fecha__lte=hoy,
            )
            .values('categoria_id', 'categoria__nombre', 'categoria__color_hex')
            .annotate(monto=Sum('transaccion__monto'))
            .order_by('-monto')
        )
        total_cat = sum(c['monto'] for c in cats)
        por_categoria = [
            {
                'nombre': c['categoria__nombre'],
                'color':  c['categoria__color_hex'],
                'monto':  c['monto'],
                'porcentaje': round(c['monto'] / total_cat * 100) if total_cat else 0,
            }
            for c in cats
        ]

        return Response({
            'resumen': {
                'ingresos': ingresos_t,
                'gastos':   gastos_t,
                'ahorros':  ahorros_t,
                'balance':  ingresos_t - gastos_t,
            },
            'resumen_anterior': {
                **ant,
                'balance': ant['ingresos'] - ant['gastos'],
            },
            'mensual': mensual,
            'por_categoria': por_categoria,
        })


class TransaccionRecurrenteViewSet(viewsets.ModelViewSet):
    """CRUD de transacciones recurrentes — sin datos precargados"""
    serializer_class = TransaccionRecurrenteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TransaccionRecurrente.objects.filter(
            usuario=self.request.user,
        ).select_related('cuenta_origen', 'cuenta_destino', 'categoria')

    @action(detail=False, methods=['post'], url_path='ejecutar')
    def ejecutar(self, request):
        """
        Revisa todas las recurrentes activas del usuario y crea transacciones
        reales para las que correspondan ejecutarse hoy.
        """
        # Fecha de Colombia, no la del servidor (UTC): a las 7 p. m. el servidor ya está en "mañana"
        hoy = timezone.localdate()
        creadas = 0

        for rec in self.get_queryset().filter(activa=True):
            if not self._es_hoy(rec, hoy):
                continue
            try:
                # La restricción única (recurrente, fecha) impide duplicados si la app
                # se abre en dos dispositivos al mismo tiempo.
                with db_transaction.atomic():
                    transaccion = Transaccion.objects.create(
                        usuario=request.user,
                        recurrente=rec,
                        nombre=rec.nombre,
                        monto=rec.monto,
                        tipo=rec.tipo,
                        fecha=hoy,
                        cuenta_origen=rec.cuenta_origen,
                        cuenta_destino=rec.cuenta_destino,
                        notas=f'Auto-registrada desde recurrente: {rec.nombre}',
                    )
                    if rec.categoria_id:
                        TransaccionCategoria.objects.create(
                            transaccion=transaccion,
                            categoria_id=rec.categoria_id,
                        )
                    rec.ultima_ejecucion = hoy
                    rec.save(update_fields=['ultima_ejecucion'])
            except IntegrityError:
                continue
            creadas += 1

        return Response({'creadas': creadas})

    def _es_hoy(self, rec, hoy):
        """Determina si la recurrente debe ejecutarse hoy."""
        ult = rec.ultima_ejecucion

        if rec.frecuencia == 'diaria':
            return ult != hoy

        if rec.frecuencia == 'semanal':
            if rec.dia_ejecucion is None:
                return False
            if hoy.isoweekday() != rec.dia_ejecucion:
                return False
            return ult is None or (hoy - ult).days >= 7

        if rec.frecuencia == 'quincenal':
            if rec.dia_ejecucion is None:
                return False
            dia_alt = rec.dia_ejecucion + 15
            if hoy.day not in (rec.dia_ejecucion, dia_alt):
                return False
            return ult is None or (hoy - ult).days >= 14

        if rec.frecuencia == 'mensual':
            if rec.dia_ejecucion is None:
                return False
            if hoy.day != rec.dia_ejecucion:
                return False
            return ult is None or not (ult.year == hoy.year and ult.month == hoy.month)

        return False

class PerfilView(APIView):
    """Retorna y actualiza el perfil del usuario autenticado"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        perfil, _ = PerfilUsuario.objects.get_or_create(usuario=request.user)
        return Response({
            'username': request.user.username,
            'email': request.user.email,
            'periodo_inicio': perfil.periodo_inicio,
        })

    def patch(self, request):
        from django.contrib.auth.models import User
        perfil, _ = PerfilUsuario.objects.get_or_create(usuario=request.user)

        # Actualizar username / email si vienen en el body
        nuevo_username = request.data.get('username', '').strip()
        nuevo_email    = request.data.get('email', '').strip()
        if nuevo_username:
            if len(nuevo_username) < 3:
                return Response({'error': 'El usuario debe tener al menos 3 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)
            if User.objects.filter(username=nuevo_username).exclude(pk=request.user.pk).exists():
                return Response({'error': 'Ese nombre de usuario ya está en uso.'}, status=status.HTTP_400_BAD_REQUEST)
            request.user.username = nuevo_username
            request.user.email    = nuevo_email
            request.user.save(update_fields=['username', 'email'])

        # Actualizar período de inicio
        periodo = request.data.get('periodo_inicio')
        if periodo is not None:
            try:
                periodo = int(periodo)
                if not (1 <= periodo <= 28):
                    return Response({'error': 'El período debe estar entre 1 y 28.'}, status=status.HTTP_400_BAD_REQUEST)
                perfil.periodo_inicio = periodo
                perfil.save()
            except (ValueError, TypeError):
                return Response({'error': 'Valor inválido.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'username': request.user.username,
            'email': request.user.email,
            'periodo_inicio': perfil.periodo_inicio,
        })


class CambiarPasswordView(APIView):
    """Cambia la contraseña del usuario autenticado"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current = request.data.get('current_password', '')
        nueva = request.data.get('new_password', '')

        if not request.user.check_password(current):
            return Response({'error': 'La contraseña actual es incorrecta.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(nueva) < MIN_PASSWORD:
            return Response({'error': f'La nueva contraseña debe tener al menos {MIN_PASSWORD} caracteres.'}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(nueva)
        request.user.save()
        return Response({'status': 'ok'})


class WebAuthnCredentialsView(APIView):
    """Lista y elimina las credenciales biométricas del usuario autenticado"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        credentials = UserCredential.objects.filter(
            usuario=request.user
        ).order_by('-creado_en')
        serializer = UserCredentialSerializer(credentials, many=True)
        return Response(serializer.data)

    def patch(self, request, pk=None):
        try:
            cred = UserCredential.objects.get(pk=pk, usuario=request.user)
            nickname = request.data.get('nickname', '').strip()
            if not nickname:
                return Response({'error': 'El nombre no puede estar vacío.'}, status=status.HTTP_400_BAD_REQUEST)
            cred.nickname = nickname
            cred.save()
            serializer = UserCredentialSerializer(cred)
            return Response(serializer.data)
        except UserCredential.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk=None):
        try:
            cred = UserCredential.objects.get(pk=pk, usuario=request.user)
            cred.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except UserCredential.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)


# --- WebAuthn Implementation ---
import os

RP_ID   = os.getenv('WEBAUTHN_RP_ID',   'localhost')
RP_NAME = 'FinTracker'
ORIGIN  = os.getenv('WEBAUTHN_ORIGIN',  'http://localhost:5173')


def _get_or_create_perfil(user):
    from .models import PerfilUsuario
    perfil, _ = PerfilUsuario.objects.get_or_create(usuario=user)
    return perfil


class WebAuthnRegisterOptionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        existing = UserCredential.objects.filter(usuario=user)

        options = generate_registration_options(
            rp_id=RP_ID,
            rp_name=RP_NAME,
            user_id=str(user.id).encode(),
            user_name=user.username,
            user_display_name=user.username,
            exclude_credentials=[
                PublicKeyCredentialDescriptor(id=bytes(c.credential_id))
                for c in existing
            ],
        )

        perfil = _get_or_create_perfil(user)
        perfil.webauthn_challenge = bytes_to_base64url(options.challenge)
        perfil.save(update_fields=['webauthn_challenge'])

        return Response(json.loads(options_to_json(options)))


class WebAuthnRegisterVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            perfil = _get_or_create_perfil(request.user)
            challenge_b64 = perfil.webauthn_challenge
            if not challenge_b64:
                return Response({'error': 'No challenge found'}, status=status.HTTP_400_BAD_REQUEST)

            verification = verify_registration_response(
                credential=dict(request.data),
                expected_challenge=base64url_to_bytes(challenge_b64),
                expected_rp_id=RP_ID,
                expected_origin=ORIGIN,
            )

            UserCredential.objects.create(
                usuario=request.user,
                credential_id=bytes(verification.credential_id),
                public_key=bytes(verification.credential_public_key),
                sign_count=verification.sign_count,
                nickname=request.data.get('nickname', 'Nuevo dispositivo'),
            )

            perfil.webauthn_challenge = ''
            perfil.save(update_fields=['webauthn_challenge'])

            return Response({'status': 'registered'}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class WebAuthnAuthOptionsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        username = request.query_params.get('username')
        if not username:
            return Response({'error': 'Username required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from django.contrib.auth.models import User
            user = User.objects.get(username=username)
            credentials = UserCredential.objects.filter(usuario=user)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        options = generate_authentication_options(
            rp_id=RP_ID,
            allow_credentials=[
                PublicKeyCredentialDescriptor(id=bytes(c.credential_id))
                for c in credentials
            ],
        )

        perfil = _get_or_create_perfil(user)
        perfil.webauthn_challenge = bytes_to_base64url(options.challenge)
        perfil.save(update_fields=['webauthn_challenge'])

        return Response(json.loads(options_to_json(options)))


class WebAuthnAuthVerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            data = request.data
            cred_id_bytes = base64url_to_bytes(data.get('id', ''))
            cred_obj = UserCredential.objects.get(credential_id=cred_id_bytes)

            perfil = _get_or_create_perfil(cred_obj.usuario)
            challenge_b64 = perfil.webauthn_challenge
            if not challenge_b64:
                return Response({'error': 'No challenge found'}, status=status.HTTP_400_BAD_REQUEST)

            verification = verify_authentication_response(
                credential=dict(data),
                expected_challenge=base64url_to_bytes(challenge_b64),
                expected_rp_id=RP_ID,
                expected_origin=ORIGIN,
                credential_public_key=bytes(cred_obj.public_key),
                credential_current_sign_count=cred_obj.sign_count,
            )

            cred_obj.sign_count = verification.new_sign_count
            cred_obj.save()

            perfil.webauthn_challenge = ''
            perfil.save(update_fields=['webauthn_challenge'])

            from rest_framework_simplejwt.tokens import RefreshToken
            refresh = RefreshToken.for_user(cred_obj.usuario)

            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            })
        except UserCredential.DoesNotExist:
            return Response({'error': 'Credencial no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

# Vistas de FinTracker — endpoints de la API REST
from django.db.models import Sum
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
        if len(password) < 4:
            return Response({'error': 'La contraseña debe tener al menos 4 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)
        if password != confirm:
            return Response({'error': 'Las contraseñas no coinciden.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, email=email, password=password)
        return Response({'status': 'ok', 'username': user.username}, status=status.HTTP_201_CREATED)


class CuentaViewSet(viewsets.ModelViewSet):
    """CRUD completo de cuentas — solo las del usuario autenticado"""
    serializer_class = CuentaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Cada usuario solo ve sus propias cuentas
        return Cuenta.objects.filter(
            usuario=self.request.user,
            activa=True,
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
        transacciones = Transaccion.objects.filter(
            cuenta_origen__usuario=request.user,
            tipo='gasto',
            fecha__year=hoy.year,
            fecha__month=hoy.month,
        )

        # Acumular gastos por categoría
        resultado = {}
        for t in transacciones:
            for tc in t.transaccion_categorias.all():
                cat_id = tc.categoria_id
                resultado[cat_id] = resultado.get(cat_id, 0) + t.monto

        return Response(resultado)


class TransaccionViewSet(viewsets.ModelViewSet):
    """CRUD completo de transacciones — solo las del usuario autenticado"""
    serializer_class = TransaccionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Transacciones donde el usuario es dueño de alguna de las cuentas
        qs = Transaccion.objects.filter(
            cuenta_origen__usuario=self.request.user,
        ) | Transaccion.objects.filter(
            cuenta_destino__usuario=self.request.user,
        )
        qs = qs.distinct().order_by('-fecha', '-creada_en')

        # Filtro opcional por tipo: /api/transacciones/?tipo=gasto
        tipo = self.request.query_params.get('tipo')
        if tipo:
            qs = qs.filter(tipo=tipo)

        # Filtro opcional por mes: /api/transacciones/?mes=2026-06
        mes = self.request.query_params.get('mes')
        if mes:
            try:
                year, month = mes.split('-')
                qs = qs.filter(fecha__year=int(year), fecha__month=int(month))
            except ValueError:
                pass

        return qs

    @action(detail=False, methods=['get'], url_path='resumen-mes')
    def resumen_mes(self, request):
        """
        Retorna totales de ingresos, gastos y ahorros del mes actual.
        Usado por la pantalla de inicio.
        Formato: { ingresos: N, gastos: N, ahorros: N }
        """
        hoy = timezone.localdate()

        # Base: transacciones del mes actual del usuario
        base = Transaccion.objects.filter(
            fecha__year=hoy.year,
            fecha__month=hoy.month,
        ).filter(
            cuenta_origen__usuario=request.user,
        ) | Transaccion.objects.filter(
            fecha__year=hoy.year,
            fecha__month=hoy.month,
        ).filter(
            cuenta_destino__usuario=request.user,
        )
        base = base.distinct()

        ingresos = base.filter(tipo='ingreso').aggregate(
            total=Sum('monto')
        )['total'] or 0

        gastos = base.filter(tipo='gasto').aggregate(
            total=Sum('monto')
        )['total'] or 0

        ahorros = base.filter(tipo='ahorro').aggregate(
            total=Sum('monto')
        )['total'] or 0

        return Response({
            'ingresos': ingresos,
            'gastos': gastos,
            'ahorros': ahorros,
        })

    @action(detail=False, methods=['get'], url_path='analytics')
    def analytics(self, request):
        """
        Devuelve resumen, evolución mensual y gastos por categoría para el período dado.
        Param: periodo = mes | 3meses | 6meses | anio
        """
        from datetime import date

        periodo = request.query_params.get('periodo', 'mes')
        hoy = date.today()

        n = {'mes': 1, '3meses': 3, '6meses': 6, 'anio': 12}.get(periodo, 1)

        start_month = hoy.month - (n - 1)
        start_year = hoy.year
        while start_month <= 0:
            start_month += 12
            start_year -= 1
        fecha_inicio = date(start_year, start_month, 1)

        qs = (
            Transaccion.objects.filter(
                fecha__gte=fecha_inicio, fecha__lte=hoy,
                cuenta_origen__usuario=request.user,
            ) | Transaccion.objects.filter(
                fecha__gte=fecha_inicio, fecha__lte=hoy,
                cuenta_destino__usuario=request.user,
            )
        ).distinct().prefetch_related('transaccion_categorias__categoria')

        transacciones = list(qs)

        ingresos_t = sum(t.monto for t in transacciones if t.tipo == 'ingreso')
        gastos_t   = sum(t.monto for t in transacciones if t.tipo == 'gasto')
        ahorros_t  = sum(t.monto for t in transacciones if t.tipo == 'ahorro')

        # Período anterior equivalente (misma duración, inmediatamente antes)
        import calendar
        prev_end_month = start_month - 1
        prev_end_year  = start_year
        if prev_end_month <= 0:
            prev_end_month += 12
            prev_end_year  -= 1
        prev_start_month = prev_end_month - (n - 1)
        prev_start_year  = prev_end_year
        while prev_start_month <= 0:
            prev_start_month += 12
            prev_start_year  -= 1
        prev_fecha_inicio = date(prev_start_year, prev_start_month, 1)
        prev_fecha_fin    = date(prev_end_year, prev_end_month,
                                 calendar.monthrange(prev_end_year, prev_end_month)[1])

        qs_ant = (
            Transaccion.objects.filter(
                fecha__gte=prev_fecha_inicio, fecha__lte=prev_fecha_fin,
                cuenta_origen__usuario=request.user,
            ) | Transaccion.objects.filter(
                fecha__gte=prev_fecha_inicio, fecha__lte=prev_fecha_fin,
                cuenta_destino__usuario=request.user,
            )
        ).distinct()
        trans_ant = list(qs_ant)
        ingresos_ant = sum(t.monto for t in trans_ant if t.tipo == 'ingreso')
        gastos_ant   = sum(t.monto for t in trans_ant if t.tipo == 'gasto')
        ahorros_ant  = sum(t.monto for t in trans_ant if t.tipo == 'ahorro')

        MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
        mensual = []
        for i in range(n):
            m = start_month + i
            y = start_year
            while m > 12:
                m -= 12
                y += 1
            mes_ts = [t for t in transacciones if t.fecha.year == y and t.fecha.month == m]
            mensual.append({
                'mes': f'{y}-{str(m).zfill(2)}',
                'mes_corto': MESES[m - 1],
                'ingresos': sum(t.monto for t in mes_ts if t.tipo == 'ingreso'),
                'gastos':   sum(t.monto for t in mes_ts if t.tipo == 'gasto'),
                'ahorros':  sum(t.monto for t in mes_ts if t.tipo == 'ahorro'),
            })

        cat_map = {}
        for t in transacciones:
            if t.tipo != 'gasto':
                continue
            for tc in t.transaccion_categorias.all():
                cat = tc.categoria
                if cat.id not in cat_map:
                    cat_map[cat.id] = {'nombre': cat.nombre, 'color': cat.color_hex, 'monto': 0}
                cat_map[cat.id]['monto'] += t.monto

        total_cat = sum(c['monto'] for c in cat_map.values())
        por_categoria = sorted(
            [
                {
                    'nombre': v['nombre'],
                    'color':  v['color'],
                    'monto':  v['monto'],
                    'porcentaje': round(v['monto'] / total_cat * 100) if total_cat else 0,
                }
                for v in cat_map.values()
            ],
            key=lambda x: -x['monto'],
        )

        return Response({
            'resumen': {
                'ingresos': ingresos_t,
                'gastos':   gastos_t,
                'ahorros':  ahorros_t,
                'balance':  ingresos_t - gastos_t,
            },
            'resumen_anterior': {
                'ingresos': ingresos_ant,
                'gastos':   gastos_ant,
                'ahorros':  ahorros_ant,
                'balance':  ingresos_ant - gastos_ant,
            },
            'mensual': mensual,
            'por_categoria': por_categoria,
        })


class TransaccionRecurrenteViewSet(viewsets.ModelViewSet):
    """CRUD de transacciones recurrentes — sin datos precargados"""
    serializer_class = TransaccionRecurrenteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TransaccionRecurrente.objects.filter(usuario=self.request.user)

    @action(detail=False, methods=['post'], url_path='ejecutar')
    def ejecutar(self, request):
        """
        Revisa todas las recurrentes activas del usuario y crea transacciones
        reales para las que correspondan ejecutarse hoy.
        """
        from datetime import date, timedelta
        hoy = date.today()
        recurrentes = self.get_queryset().filter(activa=True)
        creadas = 0

        for rec in recurrentes:
            if not self._es_hoy(rec, hoy):
                continue

            # Crear la transacción real
            transaccion = Transaccion.objects.create(
                nombre=rec.nombre,
                monto=rec.monto,
                tipo=rec.tipo,
                fecha=hoy,
                cuenta_origen=rec.cuenta_origen,
                cuenta_destino=rec.cuenta_destino,
                notas=f'Auto-registrada desde recurrente: {rec.nombre}',
            )
            if rec.categoria:
                TransaccionCategoria.objects.create(
                    transaccion=transaccion,
                    categoria=rec.categoria,
                )

            rec.ultima_ejecucion = hoy
            rec.save(update_fields=['ultima_ejecucion'])
            creadas += 1

        return Response({'creadas': creadas})

    def _es_hoy(self, rec, hoy):
        """Determina si la recurrente debe ejecutarse hoy."""
        from datetime import timedelta
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
        if len(nueva) < 4:
            return Response({'error': 'La nueva contraseña debe tener al menos 4 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)

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

RP_ID = 'localhost'
RP_NAME = 'FinTracker'
ORIGIN = 'http://localhost:5173'

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

        # Guardamos el challenge como string base64url (la sesión no serializa bytes)
        request.session['webauthn_challenge'] = bytes_to_base64url(options.challenge)
        request.session.modified = True

        return Response(json.loads(options_to_json(options)))


class WebAuthnRegisterVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            challenge_b64 = request.session.get('webauthn_challenge')
            if not challenge_b64:
                return Response({'error': 'No challenge found'}, status=status.HTTP_400_BAD_REQUEST)

            # py_webauthn 3.x acepta Dict directamente en formato WebAuthn JSON (base64url)
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

        request.session['webauthn_challenge'] = bytes_to_base64url(options.challenge)
        request.session.modified = True

        return Response(json.loads(options_to_json(options)))


class WebAuthnAuthVerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            challenge_b64 = request.session.get('webauthn_challenge')
            if not challenge_b64:
                return Response({'error': 'No challenge found'}, status=status.HTTP_400_BAD_REQUEST)

            data = request.data
            cred_id_bytes = base64url_to_bytes(data.get('id', ''))
            cred_obj = UserCredential.objects.get(credential_id=cred_id_bytes)

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

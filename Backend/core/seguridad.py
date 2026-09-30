# Cuentas y sesiones: reglas de usuario y contraseña, bloqueo tras intentos
# fallidos y cierre de las demás sesiones al cambiar la contraseña.
import math
import re
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError as ErrorDjango
from django.core.validators import validate_email
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import IntentoAcceso, PerfilUsuario

MIN_PASSWORD = 8
MAX_FALLIDOS = 5
BLOQUEO = timedelta(minutes=15)

USUARIO = re.compile(r'^[a-z0-9](?:[a-z0-9._]{1,28})[a-z0-9]$')
RESERVADOS = {'admin', 'administrador', 'root', 'soporte', 'fintracker', 'api', 'sistema'}


# ── Reglas ──────────────────────────────────────────────────────────

def error_password(password, username=''):
    """El primer requisito que falta, o '' si la contraseña sirve."""
    if len(password) < MIN_PASSWORD:
        return f'La contraseña debe tener al menos {MIN_PASSWORD} caracteres.'
    if not re.search(r'[A-ZÁÉÍÓÚÑ]', password):
        return 'La contraseña debe tener al menos una mayúscula.'
    if not re.search(r'\d', password):
        return 'La contraseña debe tener al menos un número.'
    if not re.search(r'[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]', password):
        return 'La contraseña debe tener al menos un símbolo, como ! ? # o *.'
    if username and username.lower() in password.lower():
        return 'La contraseña no puede contener tu usuario.'
    return ''


def error_usuario(username, excluir=None):
    if len(username) < 3 or len(username) > 30:
        return 'El usuario debe tener entre 3 y 30 caracteres.'
    if not USUARIO.match(username):
        return 'El usuario solo puede tener letras sin tildes, números, punto y guion bajo, y no puede empezar ni terminar en punto.'
    if '..' in username:
        return 'El usuario no puede tener dos puntos seguidos.'
    if username in RESERVADOS:
        return 'Ese nombre de usuario no está disponible.'
    if User.objects.filter(username__iexact=username).exclude(pk=getattr(excluir, 'pk', None)).exists():
        return 'Ese nombre de usuario ya está en uso.'
    return ''


def error_email(email, excluir=None):
    if not email:
        return 'El correo es obligatorio.'
    try:
        validate_email(email)
    except ErrorDjango:
        return 'Escribe un correo válido.'
    if User.objects.filter(email__iexact=email).exclude(pk=getattr(excluir, 'pk', None)).exists():
        return 'Ya hay una cuenta con ese correo.'
    return ''


def cerrar_otras_sesiones(usuario):
    """Las sesiones abiertas hasta ahora dejan de renovarse. Devuelve tokens nuevos para esta."""
    PerfilUsuario.objects.update_or_create(usuario=usuario, defaults={'sesiones_desde': timezone.now()})
    refresh = RefreshToken.for_user(usuario)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


def _error(mensaje, codigo=status.HTTP_400_BAD_REQUEST):
    return Response({'error': mensaje}, status=codigo)


# ── Vistas ──────────────────────────────────────────────────────────

class RegistroView(APIView):
    """Crea una nueva cuenta de usuario"""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'registro'

    def post(self, request):
        # El usuario se guarda en minúsculas: 'Ana' y 'ana' son la misma persona
        username = str(request.data.get('username', '')).strip().lower()
        email = str(request.data.get('email', '')).strip().lower()
        password = str(request.data.get('password', ''))
        confirm = str(request.data.get('confirm_password', ''))

        motivo = error_usuario(username) or error_email(email) or error_password(password, username)
        if motivo:
            return _error(motivo)
        if password != confirm:
            return _error('Las contraseñas no coinciden.')

        user = User.objects.create_user(username=username, email=email, password=password)
        return Response({'status': 'ok', 'username': user.username}, status=status.HTTP_201_CREATED)


class LoginView(TokenObtainPairView):
    """
    Inicio de sesión. El usuario no distingue mayúsculas. Tras 5 intentos fallidos
    seguidos, ese usuario queda bloqueado 15 minutos (aunque la contraseña sea la correcta).
    """
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request, *args, **kwargs):
        nombre = str(request.data.get('username', '')).strip()
        clave = nombre.lower()[:150]
        ahora = timezone.now()

        intento = IntentoAcceso.objects.filter(usuario_clave=clave).first()
        if intento and intento.bloqueado_hasta and intento.bloqueado_hasta > ahora:
            minutos = math.ceil((intento.bloqueado_hasta - ahora).total_seconds() / 60)
            return _error(
                f'Demasiados intentos fallidos. Por seguridad, espera {minutos} min y vuelve a intentarlo.',
                status.HTTP_429_TOO_MANY_REQUESTS,
            )

        real = (User.objects.filter(username=nombre).values_list('username', flat=True).first()
                or User.objects.filter(username__iexact=nombre).values_list('username', flat=True).first())
        serializer = self.get_serializer(data={
            'username': real or nombre,
            'password': str(request.data.get('password', '')),
        })
        try:
            serializer.is_valid(raise_exception=True)
        except (AuthenticationFailed, ValidationError):
            intento = intento or IntentoAcceso(usuario_clave=clave)
            intento.fallidos += 1
            if intento.fallidos >= MAX_FALLIDOS:
                intento.fallidos = 0
                intento.bloqueado_hasta = ahora + BLOQUEO
                intento.save()
                return _error(
                    'Demasiados intentos fallidos. Por seguridad, espera 15 min y vuelve a intentarlo.',
                    status.HTTP_429_TOO_MANY_REQUESTS,
                )
            intento.save()
            quedan = MAX_FALLIDOS - intento.fallidos
            aviso = f' Te queda{"n" if quedan > 1 else ""} {quedan} intento{"s" if quedan > 1 else ""}.' if quedan <= 2 else ''
            return _error(f'Usuario o contraseña incorrectos.{aviso}', status.HTTP_401_UNAUTHORIZED)

        if intento:
            intento.delete()
        return Response(serializer.validated_data)


class RefreshView(TokenRefreshView):
    """Renueva la sesión, salvo que se haya cambiado la contraseña después de abrirla."""

    def post(self, request, *args, **kwargs):
        try:
            token = RefreshToken(str(request.data.get('refresh', '')))
        except TokenError:
            return Response({'detail': 'Sesión vencida.', 'code': 'token_not_valid'}, status=status.HTTP_401_UNAUTHORIZED)
        desde = PerfilUsuario.objects.filter(usuario_id=token.get('user_id')).values_list('sesiones_desde', flat=True).first()
        if desde and token.get('iat', 0) < int(desde.timestamp()):
            return Response({'detail': 'La contraseña cambió: inicia sesión de nuevo.', 'code': 'token_not_valid'},
                            status=status.HTTP_401_UNAUTHORIZED)
        return super().post(request, *args, **kwargs)


class CambiarPasswordView(APIView):
    """Cambia la contraseña y cierra la sesión en los demás dispositivos."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        actual = str(request.data.get('current_password', ''))
        nueva = str(request.data.get('new_password', ''))

        if not request.user.check_password(actual):
            return _error('La contraseña actual es incorrecta.')
        motivo = error_password(nueva, request.user.username)
        if motivo:
            return _error(motivo.replace('La contraseña', 'La nueva contraseña', 1))
        if actual == nueva:
            return _error('La nueva contraseña debe ser distinta de la actual.')

        request.user.set_password(nueva)
        request.user.save()
        return Response({'status': 'ok', **cerrar_otras_sesiones(request.user)})

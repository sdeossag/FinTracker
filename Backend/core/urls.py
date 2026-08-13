# URLs de la API de FinTracker
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CuentaViewSet,
    CategoriaViewSet,
    TransaccionViewSet,
    TransaccionRecurrenteViewSet,
    WebAuthnRegisterOptionsView, WebAuthnRegisterVerifyView,
    WebAuthnAuthOptionsView, WebAuthnAuthVerifyView,
    WebAuthnCredentialsView,
    PerfilView,
    CambiarPasswordView,
    RegistroView,
)

# El router genera automáticamente todos los endpoints CRUD
router = DefaultRouter()
router.register(r'cuentas', CuentaViewSet, basename='cuenta')
router.register(r'categorias', CategoriaViewSet, basename='categoria')
router.register(r'transacciones', TransaccionViewSet, basename='transaccion')
router.register(r'recurrentes', TransaccionRecurrenteViewSet, basename='recurrente')

urlpatterns = [
    path('', include(router.urls)),
    path('webauthn/register-options/', WebAuthnRegisterOptionsView.as_view(), name='webauthn-reg-options'),
    path('webauthn/register-verify/', WebAuthnRegisterVerifyView.as_view(), name='webauthn-reg-verify'),
    path('webauthn/auth-options/', WebAuthnAuthOptionsView.as_view(), name='webauthn-auth-options'),
    path('webauthn/auth-verify/', WebAuthnAuthVerifyView.as_view(), name='webauthn-auth-verify'),
    path('webauthn/credentials/', WebAuthnCredentialsView.as_view(), name='webauthn-credentials'),
    path('webauthn/credentials/<int:pk>/', WebAuthnCredentialsView.as_view(), name='webauthn-credentials-detail'),
    path('perfil/', PerfilView.as_view(), name='perfil'),
    path('cambiar-password/', CambiarPasswordView.as_view(), name='cambiar-password'),
    path('registro/', RegistroView.as_view(), name='registro'),
]
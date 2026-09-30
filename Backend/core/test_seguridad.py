from datetime import timedelta

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import IntentoAcceso
from .seguridad import error_password

CLAVE = 'Segura#2026'


class Base(TestCase):
    def setUp(self):
        cache.clear()   # los límites por IP viven en caché
        self.api = APIClient()

    def registrar(self, **cambios):
        datos = {'username': 'ana.maria', 'email': 'ana@correo.com', 'password': CLAVE, 'confirm_password': CLAVE}
        datos.update(cambios)
        return self.api.post('/api/registro/', datos, format='json')

    def entrar(self, username='ana', password=CLAVE):
        return self.api.post('/api/token/', {'username': username, 'password': password}, format='json')


class RegistroTests(Base):
    def test_reglas_de_contrasena(self):
        self.assertIn('8 caracteres', error_password('Ab1!'))
        self.assertIn('mayúscula', error_password('segura#2026'))
        self.assertIn('número', error_password('Segura#abc'))
        self.assertIn('símbolo', error_password('Segura2026'))
        self.assertIn('usuario', error_password('Ana.maria#1', 'ana.maria'))
        self.assertEqual(error_password(CLAVE, 'ana'), '')

    def test_registro_valido_guarda_en_minusculas(self):
        r = self.registrar(username='Ana.Maria', email='Ana@Correo.com')
        self.assertEqual(r.status_code, 201)
        u = User.objects.get()
        self.assertEqual((u.username, u.email), ('ana.maria', 'ana@correo.com'))

    def test_usuario_invalido(self):
        for malo in ('ab', 'ana maria', '.ana', 'ana..m', 'añá', 'admin'):
            self.assertEqual(self.registrar(username=malo).status_code, 400, malo)

    def test_usuario_repetido_sin_importar_mayusculas(self):
        User.objects.create_user('Ana.Maria', password='x')
        self.assertIn('en uso', self.registrar().data['error'])

    def test_correo_obligatorio_valido_y_unico(self):
        self.assertIn('obligatorio', self.registrar(email='').data['error'])
        self.assertIn('válido', self.registrar(email='ana@').data['error'])
        User.objects.create_user('otra', email='ANA@correo.com', password='x')
        self.assertIn('correo', self.registrar().data['error'])


class LoginTests(Base):
    def setUp(self):
        super().setUp()
        self.ana = User.objects.create_user('ana', password=CLAVE)

    def test_usuario_sin_distinguir_mayusculas(self):
        self.assertEqual(self.entrar('ANA').status_code, 200)

    def test_bloqueo_tras_cinco_fallos(self):
        for _ in range(4):
            self.assertEqual(self.entrar(password='mala').status_code, 401)
        self.assertEqual(self.entrar(password='mala').status_code, 429)
        # Bloqueado: ni con la contraseña correcta
        self.assertEqual(self.entrar().status_code, 429)
        # Pasados los 15 minutos entra, y el contador se borra
        IntentoAcceso.objects.update(bloqueado_hasta=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.entrar().status_code, 200)
        self.assertFalse(IntentoAcceso.objects.exists())

    def test_aviso_de_intentos_restantes(self):
        self.entrar(password='mala')
        self.assertEqual(self.entrar(password='mala').data['error'], 'Usuario o contraseña incorrectos.')
        self.assertIn('Te quedan 2 intentos', self.entrar(password='mala').data['error'])
        self.assertIn('Te queda 1 intento', self.entrar(password='mala').data['error'])

    def test_usuario_inexistente_responde_igual(self):
        r = self.entrar('nadie', 'mala')
        self.assertEqual((r.status_code, r.data['error']), (401, 'Usuario o contraseña incorrectos.'))

    def test_faceid_no_revela_si_el_usuario_existe(self):
        r = self.api.get('/api/webauthn/auth-options/', {'username': 'nadie'})
        self.assertEqual(r.status_code, 200)


class CambiarPasswordTests(Base):
    def setUp(self):
        super().setUp()
        self.ana = User.objects.create_user('ana', password=CLAVE)

    def test_cierra_las_otras_sesiones(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        viejo = RefreshToken.for_user(self.ana)
        viejo['iat'] = int(timezone.now().timestamp()) - 60   # sesión abierta hace un minuto en otro teléfono
        self.api.force_authenticate(self.ana)
        r = self.api.post('/api/cambiar-password/', {'current_password': CLAVE, 'new_password': 'Nueva#2027'},
                          format='json')
        self.assertEqual(r.status_code, 200)
        self.api.force_authenticate(None)
        # El otro teléfono ya no puede renovar; este sigue con los tokens nuevos
        self.assertEqual(self.api.post('/api/token/refresh/', {'refresh': str(viejo)}).status_code, 401)
        self.assertEqual(self.api.post('/api/token/refresh/', {'refresh': r.data['refresh']}).status_code, 200)

    def test_exige_las_reglas(self):
        self.api.force_authenticate(self.ana)
        r = self.api.post('/api/cambiar-password/', {'current_password': CLAVE, 'new_password': 'sinmayus1!'})
        self.assertIn('mayúscula', r.data['error'])

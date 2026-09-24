# Registro automático por SMS. Los textos imitan los formatos reales de
# Bancolombia y Nequi, con nombres y números inventados.
from datetime import date
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .ingesta import a_pesos, con_patrones, enmascarar, leer_fecha, limpiar_comercio
from .models import Categoria, Cuenta, MensajeBanco, PerfilUsuario, Transaccion, TransaccionCategoria

HOY = date(2026, 9, 22)

SMS = {
    'credito': 'Bancolombia: COmpraste COP6.345,00 en Didi con tu T.Cred *1111, el 21/09/2026 a las 17:28. '
               'Si tienes dudas encuentranos aquí: 6045109095 o 018000931987. Estamos cerca',
    'debito': 'Bancolombia: Compraste $4.500,00 en LAS HERMOSAS COFFEE con tu T.Deb *2222, el 21/09/20206 a las 19:33. '
              'Si tienes dudas encuentranos aquí: 6045109095 o 018000931987. Estamos cerca',
    'recibida': 'Bancolombia: ANA, recibiste una transferencia de PEDRO PEREZ GOMEZ por $2,250.00 en tu cuenta *3333 '
                'conectada a la llave 3001234567 el 21/09/26 a las 20:14. Con llaves es de una y gratis. Dudas al 018000912345',
    'enviada': 'Bancolombia: Transferiste $132,800.00 desde tu cuenta *3333 a la cuenta *9876543210 el 19/09/26 a las 10:58. '
               '¿Dudas? Llamanos al 018000931987. Estamos cerca.',
    'internet': 'Bancolombia: Compraste COP2.818,00 en TEMU COM con tu T.Cred *1111, el 17/09/2026 a las 18:01. '
                'Si tienes dudas, encuentranos aqui: 6045109095 o 018000931987. Estamos cerca.',
    'nequi': 'NEQUI: Pagaste 20.799,84 en EPC*EPIC GAMES STORE',
}


class ParserTests(TestCase):
    def test_montos_en_los_dos_formatos(self):
        self.assertEqual(a_pesos('6.345,00'), 6345)
        self.assertEqual(a_pesos('2,250.00'), 2250)
        self.assertEqual(a_pesos('132,800.00'), 132800)
        self.assertEqual(a_pesos('4.500'), 4500)
        self.assertEqual(a_pesos('20.799,84'), 20800)
        self.assertEqual(a_pesos('1.250.000'), 1250000)

    def test_entiende_los_seis_formatos(self):
        esperado = {
            'credito': ('compra', 6345, 'Didi', '1111'),
            'debito': ('compra', 4500, 'Las Hermosas Coffee', '2222'),
            'recibida': ('recibida', 2250, '', '3333'),
            'enviada': ('enviada', 132800, '', '3333'),
            'internet': ('compra', 2818, 'Temu Com', '1111'),
            'nequi': ('compra', 20800, 'Epic Games Store', ''),
        }
        for clave, (clase, monto, comercio, digitos) in esperado.items():
            d = con_patrones(SMS[clave])
            self.assertEqual((d['clase'], d['monto'], d['comercio'], d['digitos']),
                             (clase, monto, comercio, digitos), clave)
        self.assertEqual(con_patrones(SMS['recibida'])['contraparte'], 'Pedro Perez Gomez')
        self.assertEqual(con_patrones(SMS['enviada'])['destino'], '3210')

    def test_fechas(self):
        self.assertEqual(leer_fecha('21/09/2026', HOY), date(2026, 9, 21))
        self.assertEqual(leer_fecha('21/09/26', HOY), date(2026, 9, 21))
        self.assertIsNone(leer_fecha('21/09/20206', HOY))     # error del banco → se usa hoy
        self.assertIsNone(leer_fecha('01/01/2020', HOY))      # demasiado vieja

    def test_enmascara_numeros_largos(self):
        self.assertIn('******4567', enmascarar(SMS['recibida']))
        self.assertNotIn('3001234567', enmascarar(SMS['recibida']))
        self.assertEqual(limpiar_comercio('EPC*EPIC GAMES STORE'), 'Epic Games Store')


class IngestaTests(TestCase):
    def setUp(self):
        self.ana = User.objects.create_user('ana', password='clave-segura')
        self.banco = Cuenta.objects.create(usuario=self.ana, nombre='Bancolombia', terminaciones='2222 3333',
                                           balance_inicial=1_000_000)
        self.visa = Cuenta.objects.create(usuario=self.ana, nombre='Visa', tipo='credito', dia_corte=15, dia_pago=30)
        self.nequi = Cuenta.objects.create(usuario=self.ana, nombre='Nequi')
        self.api = APIClient()
        self.api.force_authenticate(self.ana)
        self.token = self.api.post('/api/ingesta/token/').data['token']
        self.atajo = APIClient()

    def enviar(self, clave, remitente='85540', token=None):
        with patch('core.ingesta.timezone.localdate', return_value=HOY):
            return self.atajo.post('/api/ingesta/sms/', {'texto': SMS[clave], 'remitente': remitente},
                                   format='json', HTTP_X_TOKEN_INGESTA=token or self.token)

    def test_token_invalido(self):
        self.assertEqual(self.enviar('debito', token='x' * 40).status_code, 401)
        self.assertEqual(self.atajo.post('/api/ingesta/sms/', {'texto': 'x'}).status_code, 401)

    def test_solo_se_guarda_el_hash_del_token(self):
        perfil = PerfilUsuario.objects.get(usuario=self.ana)
        self.assertNotEqual(perfil.token_ingesta, self.token)
        self.assertEqual(len(perfil.token_ingesta), 64)

    def test_compra_con_debito_se_registra(self):
        r = self.enviar('debito')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['estado'], 'registrado')
        self.assertEqual(r.data['mensaje'], 'Registrado: $4.500 · Las Hermosas Coffee')
        t = Transaccion.objects.get(origen='sms')
        self.assertEqual((t.tipo, t.monto, t.cuenta_origen, t.fecha), ('gasto', 4500, self.banco, HOY))

    def test_mismo_sms_no_se_registra_dos_veces(self):
        self.enviar('debito')
        r = self.enviar('debito')
        self.assertEqual((r.status_code, r.data['repetido']), (200, True))
        self.assertEqual(Transaccion.objects.count(), 1)

    def test_cuenta_desconocida_queda_por_revisar_y_se_asigna(self):
        self.enviar('credito')
        self.enviar('internet')
        pendientes = self.api.get('/api/mensajes/?estado=pendiente').data
        self.assertEqual(len(pendientes), 2)
        self.assertEqual(pendientes[0]['identificador'], '1111')
        self.assertIn('*1111', pendientes[0]['motivo'])

        r = self.api.post(f"/api/mensajes/{pendientes[0]['id']}/asignar-cuenta/", {'cuenta': self.visa.id})
        self.assertEqual(r.data['registrados'], 2)          # los dos SMS de esa tarjeta
        self.visa.refresh_from_db()
        self.assertEqual(self.visa.terminaciones, '1111')
        self.assertEqual(Transaccion.objects.filter(cuenta_origen=self.visa).count(), 2)
        self.enviar('credito')                              # repetido: no duplica
        self.assertEqual(Transaccion.objects.filter(cuenta_origen=self.visa).count(), 2)

    def test_nequi_por_nombre_de_cuenta(self):
        r = self.enviar('nequi', remitente='890706')
        self.assertEqual(r.data['estado'], 'registrado')
        t = Transaccion.objects.get(origen='sms')
        self.assertEqual((t.nombre, t.monto, t.cuenta_origen), ('Epic Games Store', 20800, self.nequi))

    def test_transferencia_recibida_y_enviada(self):
        self.enviar('recibida')
        self.enviar('enviada')
        recibida = Transaccion.objects.get(tipo='ingreso')
        self.assertEqual((recibida.nombre, recibida.cuenta_destino), ('Transferencia de Pedro Perez Gomez', self.banco))
        enviada = Transaccion.objects.get(tipo='gasto')     # la cuenta destino no es mía
        self.assertEqual(enviada.nombre, 'Transferencia a *3210')

    def test_enviada_a_cuenta_propia_es_transferencia(self):
        self.nequi.terminaciones = '3210'
        self.nequi.save()
        self.enviar('enviada')
        t = Transaccion.objects.get()
        self.assertEqual((t.tipo, t.cuenta_origen, t.cuenta_destino), ('transferencia', self.banco, self.nequi))

    def test_las_dos_mitades_de_una_transferencia_propia_se_unen(self):
        # Sale de Bancolombia hacia una cuenta sin terminación conocida…
        self.enviar('enviada')
        # …y a los minutos Nequi avisa que entró el mismo monto
        texto = 'NEQUI: recibiste de ANA por $132.800,00'
        with patch('core.ingesta.timezone.localdate', return_value=HOY):
            self.atajo.post('/api/ingesta/sms/', {'texto': texto, 'remitente': '890706'},
                            format='json', HTTP_X_TOKEN_INGESTA=self.token)
        self.assertEqual(Transaccion.objects.count(), 1)
        t = Transaccion.objects.get()
        self.assertEqual((t.tipo, t.cuenta_origen, t.cuenta_destino), ('transferencia', self.banco, self.nequi))

    def test_aprende_la_categoria_del_comercio(self):
        cafe = Categoria.objects.create(usuario=self.ana, nombre='Café', tipo='gasto')
        previa = Transaccion.objects.create(usuario=self.ana, nombre='Las Hermosas Coffee', monto=1, tipo='gasto',
                                            fecha=HOY, cuenta_origen=self.banco)
        TransaccionCategoria.objects.create(transaccion=previa, categoria=cafe)
        self.enviar('debito')
        nueva = Transaccion.objects.get(origen='sms')
        self.assertEqual(list(nueva.categorias.all()), [cafe])

    def test_codigos_de_seguridad_no_se_guardan(self):
        with patch('core.ingesta.timezone.localdate', return_value=HOY):
            self.atajo.post('/api/ingesta/sms/', {'texto': 'Bancolombia: tu clave dinamica es 123456', 'remitente': '85540'},
                            format='json', HTTP_X_TOKEN_INGESTA=self.token)
        msg = MensajeBanco.objects.get()
        self.assertEqual(msg.estado, 'descartado')
        self.assertNotIn('123456', msg.texto)

    def test_registrar_a_mano_resuelve_el_mensaje(self):
        self.enviar('credito')
        msg = MensajeBanco.objects.get()
        r = self.api.post('/api/transacciones/', {
            'nombre': 'Didi', 'monto': 6345, 'tipo': 'gasto', 'fecha': '2026-09-21',
            'cuenta_origen': self.visa.id, 'mensaje_banco': msg.id,
        }, format='json')
        self.assertEqual(r.status_code, 201)
        msg.refresh_from_db()
        self.assertEqual((msg.estado, msg.transaccion_id), ('registrado', r.data['id']))

    def test_no_ve_mensajes_ajenos(self):
        self.enviar('credito')
        otro = APIClient()
        otro.force_authenticate(User.objects.create_user('beto', password='clave-segura'))
        self.assertEqual(otro.get('/api/mensajes/').data, [])
        msg = MensajeBanco.objects.get()
        self.assertEqual(otro.post(f'/api/mensajes/{msg.id}/asignar-cuenta/', {'cuenta': self.visa.id}).status_code, 404)

    def test_probar_no_guarda_nada(self):
        r = self.api.post('/api/ingesta/probar/', {'texto': SMS['debito']}, format='json')
        self.assertEqual(r.data['registro']['cuenta_origen'], 'Bancolombia')
        self.assertEqual(MensajeBanco.objects.count() + Transaccion.objects.count(), 0)

    def test_revocar_token(self):
        self.api.delete('/api/ingesta/token/')
        self.assertEqual(self.enviar('debito').status_code, 401)

    def test_terminaciones_se_normalizan(self):
        r = self.api.patch(f'/api/cuentas/{self.banco.id}/', {'terminaciones': '*8174, 1234565284 · Nequi'}, format='json')
        self.assertEqual(r.data['terminaciones'], '8174 5284 nequi')


class IATests(TestCase):
    """Formato desconocido: la IA ayuda, pero el monto debe estar en el texto."""

    def setUp(self):
        self.ana = User.objects.create_user('ana', password='clave-segura')
        Cuenta.objects.create(usuario=self.ana, nombre='Bancolombia', terminaciones='3333')
        self.texto = 'Bancolombia: Retiraste $200.000 en cajero ESTACION PRIMAVERA de tu cuenta *3333 el 21/09/26.'

    def groq(self, contenido):
        resp = MagicMock()
        resp.json.return_value = {'choices': [{'message': {'content': contenido}}]}
        resp.raise_for_status.return_value = None
        return patch('core.ingesta.requests.post', return_value=resp)

    def procesar(self):
        from .ingesta import procesar_sms
        with patch('core.ingesta.timezone.localdate', return_value=HOY):
            return procesar_sms(self.ana, '85540', self.texto)[0]

    @patch.dict('os.environ', {'GROQ_API_KEY': 'prueba'})
    def test_ia_registra_formato_nuevo(self):
        with self.groq('{"es_movimiento": true, "clase": "compra", "monto": "$200.000", '
                       '"comercio": "Retiro cajero", "digitos": "3333", "fecha": "21/09/2026"}'):
            msg = self.procesar()
        self.assertEqual((msg.estado, msg.metodo, msg.transaccion.monto), ('registrado', 'ia', 200000))

    @patch.dict('os.environ', {'GROQ_API_KEY': 'prueba'})
    def test_ia_no_puede_inventar_el_monto(self):
        with self.groq('{"es_movimiento": true, "clase": "compra", "monto": "2.000.000", "digitos": "3333"}'):
            msg = self.procesar()
        self.assertEqual(msg.estado, 'pendiente')
        self.assertEqual(Transaccion.objects.count(), 0)

    @patch.dict('os.environ', {}, clear=True)
    def test_sin_clave_queda_por_revisar(self):
        msg = self.procesar()
        self.assertEqual((msg.estado, msg.metodo), ('pendiente', 'ninguno'))

from datetime import date, datetime
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import AvisoEnviado, Cuenta, SuscripcionPush, Transaccion
from .notificaciones import enviar_recordatorios

SUSCRIPCION = {'endpoint': 'https://web.push.apple.com/abc', 'keys': {'p256dh': 'BPx', 'auth': 'k1'}}


class RecordatoriosTests(TestCase):
    """Visa: corte el 15, pago el 30."""

    def setUp(self):
        self.ana = User.objects.create_user('ana', password='x')
        self.visa = Cuenta.objects.create(usuario=self.ana, nombre='Visa', tipo='credito', dia_corte=15, dia_pago=30)
        Cuenta.objects.filter(pk=self.visa.pk).update(creada_en=timezone.make_aware(datetime(2026, 1, 1)))
        self.debito = Cuenta.objects.create(usuario=self.ana, nombre='Débito', balance_inicial=1_000_000)
        SuscripcionPush.objects.create(usuario=self.ana, endpoint=SUSCRIPCION['endpoint'], p256dh='BPx', auth='k1')
        # Compra del ciclo que cerró el 15 de septiembre
        Transaccion.objects.create(usuario=self.ana, nombre='Mercado', monto=250_000, tipo='gasto',
                                   fecha=date(2026, 9, 10), cuenta_origen=self.visa)

    def correr(self, hoy):
        with patch('core.notificaciones.enviar', return_value=1) as enviar:
            enviar_recordatorios(hoy)
        return [(c.args[1], c.args[2]) for c in enviar.call_args_list]

    def test_dia_antes_del_corte(self):
        titulos = [t for t, _ in self.correr(date(2026, 10, 14))]
        self.assertIn('Mañana es el corte de tu Visa', titulos)

    def test_extracto_cerrado(self):
        avisos = self.correr(date(2026, 9, 16))
        self.assertIn(('Cerró el extracto de tu Visa', 'Pagas $250.000 hasta el miércoles 30 de septiembre.'), avisos)

    def test_pago_proximo_y_vencido(self):
        self.assertEqual(self.correr(date(2026, 9, 27))[0][0], 'Paga tu Visa en 3 días')
        self.assertEqual(self.correr(date(2026, 9, 29))[0][0], 'Mañana vence el pago de tu Visa')
        self.assertEqual(self.correr(date(2026, 9, 30))[0][0], 'Hoy vence el pago de tu Visa')
        self.assertEqual(self.correr(date(2026, 10, 1))[0][0], 'Se venció el pago de tu Visa')
        self.assertEqual(self.correr(date(2026, 9, 28)), [])   # días sin aviso

    def test_si_ya_pagaste_no_avisa(self):
        Transaccion.objects.create(usuario=self.ana, nombre='Pago', monto=250_000, tipo='transferencia',
                                   fecha=date(2026, 9, 20), cuenta_origen=self.debito, cuenta_destino=self.visa)
        self.assertEqual(self.correr(date(2026, 9, 29)), [])

    def test_cada_aviso_sale_una_sola_vez(self):
        self.assertEqual(len(self.correr(date(2026, 9, 29))), 1)
        self.assertEqual(self.correr(date(2026, 9, 29)), [])
        self.assertEqual(AvisoEnviado.objects.count(), 1)

    def test_sin_suscripcion_no_calcula_nada(self):
        SuscripcionPush.objects.all().delete()
        self.assertEqual(self.correr(date(2026, 9, 29)), [])


class PushApiTests(TestCase):
    def setUp(self):
        self.ana = User.objects.create_user('ana', password='x')
        self.api = APIClient()
        self.api.force_authenticate(self.ana)

    def test_suscribir_y_desuscribir(self):
        self.assertEqual(self.api.post('/api/push/', SUSCRIPCION, format='json').status_code, 201)
        self.api.post('/api/push/', SUSCRIPCION, format='json')   # el mismo teléfono no se duplica
        self.assertEqual(self.api.get('/api/push/').data['dispositivos'], 1)
        self.api.delete('/api/push/', {'endpoint': SUSCRIPCION['endpoint']}, format='json')
        self.assertFalse(SuscripcionPush.objects.exists())

    def test_rechaza_endpoints_raros(self):
        r = self.api.post('/api/push/', {**SUSCRIPCION, 'endpoint': 'http://localhost/x'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_el_cron_necesita_su_token(self):
        cron = APIClient()
        with patch.dict('os.environ', {'RECORDATORIOS_TOKEN': 'secreto'}):
            self.assertEqual(cron.post('/api/recordatorios/enviar/').status_code, 403)
            self.assertEqual(cron.post('/api/recordatorios/enviar/', HTTP_X_CRON_TOKEN='otro').status_code, 403)
            r = cron.post('/api/recordatorios/enviar/', HTTP_X_CRON_TOKEN='secreto')
        self.assertEqual((r.status_code, r.data['avisos']), (200, 0))

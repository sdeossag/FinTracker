from datetime import date
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import (
    AvisoEnviado, Categoria, Cuenta, PerfilUsuario, SuscripcionPush, Transaccion, TransaccionCategoria,
)
from .semana import estado_semana, resumen_semana_pasada, revisar_tope

# Jueves 22 de octubre de 2026: la semana va del lunes 19 al domingo 25
HOY = date(2026, 10, 22)
LUNES = date(2026, 10, 19)


class Base(TestCase):
    def setUp(self):
        self.ana = User.objects.create_user('ana', password='x')
        self.debito = Cuenta.objects.create(usuario=self.ana, nombre='Débito', balance_inicial=5_000_000)
        self.visa = Cuenta.objects.create(usuario=self.ana, nombre='Visa', tipo='credito', dia_corte=15, dia_pago=30)
        self.comida = Categoria.objects.create(usuario=self.ana, nombre='Comida', tipo='gasto', color_hex='#FF9F0A')
        self.arriendo = Categoria.objects.create(usuario=self.ana, nombre='Arriendo', tipo='gasto', en_tope_semanal=False)
        PerfilUsuario.objects.create(usuario=self.ana, tope_semanal=300_000)
        self.api = APIClient()
        self.api.force_authenticate(self.ana)

    def gasto(self, monto, fecha, categoria=None, cuenta=None, cuotas=1, tipo='gasto'):
        t = Transaccion.objects.create(usuario=self.ana, nombre='x', monto=monto, tipo=tipo, fecha=fecha,
                                       cuenta_origen=cuenta or self.debito, cuotas=cuotas,
                                       cuenta_destino=self.visa if tipo == 'transferencia' else None)
        if categoria:
            TransaccionCategoria.objects.create(transaccion=t, categoria=categoria)
        return t


class SemanaTests(Base):
    def test_cuenta_lo_de_esta_semana_y_nada_mas(self):
        self.gasto(50_000, LUNES, self.comida)
        self.gasto(20_000, HOY)                                         # sin categoría también cuenta
        self.gasto(1_200_000, HOY, cuenta=self.visa, cuotas=12)         # solo la cuota: 100.000
        self.gasto(900_000, LUNES, self.arriendo)                       # fijo: fuera del tope
        self.gasto(400_000, HOY, tipo='transferencia')                  # pagar la tarjeta no es gasto
        self.gasto(70_000, date(2026, 10, 18))                          # domingo de la semana pasada
        e = estado_semana(self.ana, HOY)
        self.assertEqual(e['gastado'], 170_000)
        self.assertEqual(e['queda'], 130_000)
        self.assertEqual(e['estado'], 'bien')
        self.assertEqual(e['por_dia'], [50_000, 0, 0, 120_000, 0, 0, 0])
        self.assertEqual((e['inicio'], e['fin'], e['dia']), ('2026-10-19', '2026-10-25', 3))
        self.assertEqual(e['semana_pasada'], 70_000)
        self.assertEqual(sum(c['total'] for c in e['por_categoria']), e['gastado'])

    def test_estados(self):
        self.gasto(250_000, HOY)
        self.assertEqual(estado_semana(self.ana, HOY)['estado'], 'cerca')
        self.gasto(60_000, HOY)
        self.assertEqual(estado_semana(self.ana, HOY)['estado'], 'pasado')

    def test_sugerido_es_el_promedio_de_las_semanas_con_gasto(self):
        PerfilUsuario.objects.filter(usuario=self.ana).update(tope_semanal=None)
        self.gasto(212_000, date(2026, 10, 14))
        self.gasto(268_000, date(2026, 10, 7))
        e = estado_semana(self.ana, HOY)
        self.assertEqual((e['estado'], e['sugerido']), ('sin_tope', 240_000))

    def test_cambiar_y_quitar_el_tope(self):
        r = self.api.patch('/api/semana/', {'tope': 450_000}, format='json')
        self.assertEqual(r.data['tope'], 450_000)
        self.assertEqual(self.api.patch('/api/semana/', {'tope': 'mucho'}, format='json').status_code, 400)
        self.assertIsNone(self.api.patch('/api/semana/', {'tope': None}, format='json').data['tope'])

    def test_historial_de_esta_semana(self):
        self.gasto(10_000, LUNES)
        self.gasto(10_000, date(2026, 10, 18))
        with patch('core.views.timezone.localdate', return_value=HOY):
            r = self.api.get('/api/transacciones/', {'semana': 'actual'})
        self.assertEqual(len(r.data), 1)


class AvisosSemanaTests(Base):
    def setUp(self):
        super().setUp()
        SuscripcionPush.objects.create(usuario=self.ana, endpoint='https://web.push.apple.com/x', p256dh='p', auth='a')

    def revisar(self):
        with patch('core.notificaciones.enviar', return_value=1) as enviar:
            nivel = revisar_tope(self.ana, HOY, HOY)
        return nivel, [c.args[1] for c in enviar.call_args_list]

    def test_avisa_al_80_y_al_pasarse_una_vez_cada_uno(self):
        self.gasto(100_000, HOY)
        self.assertEqual(self.revisar(), (None, []))
        self.gasto(150_000, HOY)
        self.assertEqual(self.revisar(), ('tope-80', ['Vas llegando al tope de la semana']))
        self.assertEqual(self.revisar(), (None, []))                     # no se repite
        self.gasto(100_000, HOY)
        self.assertEqual(self.revisar(), ('tope-100', ['Te pasaste del tope de la semana']))
        self.assertEqual(self.revisar(), (None, []))

    def test_pasarse_de_una_no_manda_despues_el_80(self):
        self.gasto(400_000, HOY)
        self.assertEqual(self.revisar()[0], 'tope-100')
        self.assertEqual(AvisoEnviado.objects.count(), 2)

    def test_un_gasto_de_otra_semana_no_avisa(self):
        self.gasto(400_000, date(2026, 10, 12))
        with patch('core.notificaciones.enviar') as enviar:
            revisar_tope(self.ana, HOY, date(2026, 10, 12))
        enviar.assert_not_called()

    def test_el_api_revisa_al_crear_un_gasto(self):
        with patch('core.views.timezone.localdate', return_value=HOY), \
             patch('core.notificaciones.enviar', return_value=1) as enviar:
            self.api.post('/api/transacciones/', {'nombre': 'Mercado', 'monto': 320_000, 'tipo': 'gasto',
                                                  'fecha': HOY.isoformat(), 'cuenta_origen': self.debito.id},
                          format='json')
        self.assertEqual(enviar.call_args.args[1], 'Te pasaste del tope de la semana')

    def test_resumen_del_lunes(self):
        self.gasto(280_000, date(2026, 10, 14))
        clave, titulo, cuerpo = resumen_semana_pasada(self.ana, LUNES)
        self.assertEqual(clave, 'semana:2026-10-12')
        self.assertIn('te sobraron $20.000', cuerpo)
        self.assertIsNone(resumen_semana_pasada(self.ana, HOY))   # solo los lunes

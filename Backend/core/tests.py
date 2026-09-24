from datetime import date, datetime, timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Categoria, Cuenta, Transaccion, TransaccionCategoria, TransaccionRecurrente


class Base(TestCase):
    def setUp(self):
        self.ana = User.objects.create_user('ana', password='clave-segura')
        self.beto = User.objects.create_user('beto', password='clave-segura')
        self.debito = Cuenta.objects.create(usuario=self.ana, nombre='Débito', balance_inicial=1_000_000)
        self.cuenta_beto = Cuenta.objects.create(usuario=self.beto, nombre='Beto', balance_inicial=500_000)
        self.comida = Categoria.objects.create(usuario=self.ana, nombre='Comida', tipo='gasto')
        self.api = APIClient()
        self.api.force_authenticate(self.ana)

    def gasto(self, monto, fecha=None, cuenta=None, categorias=()):
        t = Transaccion.objects.create(
            usuario=self.ana, nombre='g', monto=monto, tipo='gasto',
            fecha=fecha or date.today(), cuenta_origen=cuenta or self.debito,
        )
        for c in categorias:
            TransaccionCategoria.objects.create(transaccion=t, categoria=c)
        return t


class SeguridadTests(Base):
    def test_no_puede_usar_cuenta_ajena(self):
        r = self.api.post('/api/transacciones/', {
            'nombre': 'x', 'monto': 1000, 'tipo': 'gasto',
            'fecha': '2026-09-01', 'cuenta_origen': self.cuenta_beto.id,
        }, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Transaccion.objects.filter(cuenta_origen=self.cuenta_beto).exists())

    def test_recurrente_no_puede_usar_cuenta_ajena(self):
        r = self.api.post('/api/recurrentes/', {
            'nombre': 'x', 'monto': 1000, 'tipo': 'ingreso', 'frecuencia': 'mensual',
            'cuenta_destino': self.cuenta_beto.id,
        }, format='json')
        self.assertEqual(r.status_code, 400)

    def test_crear_asigna_usuario_y_categorias_propias(self):
        ajena = Categoria.objects.create(usuario=self.beto, nombre='Ajena', tipo='gasto')
        r = self.api.post('/api/transacciones/', {
            'nombre': 'Almuerzo', 'monto': 20000, 'tipo': 'gasto', 'fecha': '2026-09-01',
            'cuenta_origen': self.debito.id, 'categorias_ids': [self.comida.id, ajena.id],
        }, format='json')
        self.assertEqual(r.status_code, 201)
        t = Transaccion.objects.get(pk=r.data['id'])
        self.assertEqual(t.usuario, self.ana)
        self.assertEqual([c['id'] for c in r.data['categorias']], [self.comida.id])

    def test_no_ve_transacciones_ajenas(self):
        Transaccion.objects.create(usuario=self.beto, nombre='b', monto=1, tipo='gasto',
                                   fecha=date.today(), cuenta_origen=self.cuenta_beto)
        self.gasto(5)
        r = self.api.get('/api/transacciones/')
        self.assertEqual(len(r.data), 1)


class DatosTests(Base):
    def test_borrar_cuenta_conserva_historial(self):
        self.gasto(10_000)
        self.api.delete(f'/api/cuentas/{self.debito.id}/')
        r = self.api.get('/api/transacciones/')
        self.assertEqual(len(r.data), 1)
        self.assertIsNone(r.data[0]['cuenta_origen_nombre'])

    def test_balance_pasivo_es_deuda(self):
        tarjeta = Cuenta.objects.create(usuario=self.ana, nombre='Visa', tipo='pasivo', balance_inicial=100_000)
        self.gasto(50_000, cuenta=tarjeta)                     # compra: la deuda sube
        Transaccion.objects.create(usuario=self.ana, nombre='pago', monto=30_000, tipo='ahorro',
                                   fecha=date.today(), cuenta_origen=self.debito, cuenta_destino=tarjeta)
        cuentas = {c['nombre']: c['balance_actual'] for c in self.api.get('/api/cuentas/').data}
        self.assertEqual(cuentas['Visa'], 120_000)
        self.assertEqual(cuentas['Débito'], 970_000)


class RecurrentesTests(Base):
    def setUp(self):
        super().setUp()
        self.rec = TransaccionRecurrente.objects.create(
            usuario=self.ana, nombre='Arriendo', monto=900_000, tipo='gasto',
            frecuencia='diaria', cuenta_origen=self.debito, categoria=self.comida,
        )

    def test_no_duplica_el_mismo_dia(self):
        self.assertEqual(self.api.post('/api/recurrentes/ejecutar/').data['creadas'], 1)
        self.rec.refresh_from_db()
        self.rec.ultima_ejecucion = None           # simula dos dispositivos a la vez
        self.rec.save()
        self.assertEqual(self.api.post('/api/recurrentes/ejecutar/').data['creadas'], 0)
        self.assertEqual(Transaccion.objects.filter(recurrente=self.rec).count(), 1)

    def test_usa_fecha_de_colombia(self):
        with patch('core.views.timezone.localdate', return_value=date(2026, 3, 9)):
            self.api.post('/api/recurrentes/ejecutar/')
        self.assertEqual(Transaccion.objects.get(recurrente=self.rec).fecha, date(2026, 3, 9))


class RendimientoTests(Base):
    def consultas(self, url):
        with CaptureQueriesContext(connection) as q:
            r = self.api.get(url)
        self.assertEqual(r.status_code, 200)
        return len(q)

    def test_consultas_no_crecen_con_los_datos(self):
        urls = ['/api/transacciones/', '/api/transacciones/?limite=20', '/api/cuentas/',
                '/api/categorias/gastos-mes/', '/api/transacciones/resumen-mes/',
                '/api/transacciones/analytics/?periodo=anio', '/api/recurrentes/']
        for i in range(3):
            self.gasto(1000, categorias=[self.comida])
        antes = {u: self.consultas(u) for u in urls}
        otra = Cuenta.objects.create(usuario=self.ana, nombre='Nequi')
        for i in range(30):
            self.gasto(1000, cuenta=otra, categorias=[self.comida])
        despues = {u: self.consultas(u) for u in urls}
        self.assertEqual(antes, despues)
        self.assertLessEqual(max(despues.values()), 4)


class PaginacionTests(Base):
    def test_cursor_recorre_todo_sin_repetir(self):
        hoy = date.today()
        creadas = {self.gasto(i, fecha=hoy - timedelta(days=i % 4)).id for i in range(25)}
        vistos, cursor = [], None
        while True:
            params = {'limite': 7, **({'antes': cursor} if cursor else {})}
            r = self.api.get('/api/transacciones/', params)
            vistos += [t['id'] for t in r.data['resultados']]
            cursor = r.data['siguiente']
            if not cursor:
                break
        self.assertEqual(len(vistos), 25)
        self.assertEqual(set(vistos), creadas)

    def test_busqueda_por_categoria(self):
        self.gasto(1, categorias=[self.comida])
        self.gasto(2)
        r = self.api.get('/api/transacciones/', {'q': 'comi', 'limite': 10})
        self.assertEqual(len(r.data['resultados']), 1)


class AnalyticsTests(Base):
    def test_totales_y_categorias(self):
        hoy = date.today()
        self.gasto(40_000, categorias=[self.comida])
        self.gasto(10_000)
        Transaccion.objects.create(usuario=self.ana, nombre='sueldo', monto=2_000_000, tipo='ingreso',
                                   fecha=hoy, cuenta_destino=self.debito)
        mes_pasado = hoy.replace(day=1) - timedelta(days=1)
        self.gasto(7_000, fecha=mes_pasado)
        d = self.api.get('/api/transacciones/analytics/?periodo=mes').data
        self.assertEqual(d['resumen'], {'ingresos': 2_000_000, 'gastos': 50_000, 'ahorros': 0, 'balance': 1_950_000})
        self.assertEqual(d['resumen_anterior']['gastos'], 7_000)
        self.assertEqual(d['por_categoria'], [{'nombre': 'Comida', 'color': self.comida.color_hex,
                                                'monto': 40_000, 'porcentaje': 100}])
        self.assertEqual(len(d['mensual']), 1)


class TarjetaCreditoTests(Base):
    """Corte el 15, pago el 30. Hoy: 24 de septiembre de 2026."""
    HOY = date(2026, 9, 24)

    def setUp(self):
        super().setUp()
        self.visa = Cuenta.objects.create(usuario=self.ana, nombre='Visa', tipo='credito',
                                          cupo=1_000_000, dia_corte=15, dia_pago=30)
        Cuenta.objects.filter(pk=self.visa.pk).update(creada_en=timezone.make_aware(datetime(2026, 1, 1)))
        self.gasto(300_000, fecha=date(2026, 9, 10), cuenta=self.visa)   # entra al extracto del 15
        self.gasto(100_000, fecha=date(2026, 9, 20), cuenta=self.visa)   # ciclo abierto
        Transaccion.objects.create(usuario=self.ana, nombre='Pago Visa', monto=120_000, tipo='transferencia',
                                   fecha=date(2026, 9, 22), cuenta_origen=self.debito, cuenta_destino=self.visa)

    def estado(self, hoy=HOY):
        with patch('core.views.timezone.localdate', return_value=hoy):
            cuentas = self.api.get('/api/cuentas/').data
        return next(c for c in cuentas if c['nombre'] == 'Visa')

    def test_estado_de_cuenta(self):
        visa = self.estado()
        self.assertEqual(visa['balance_actual'], 280_000)
        e = visa['estado_tarjeta']
        self.assertEqual(e['ultimo_corte'], '2026-09-15')
        self.assertEqual(e['fecha_limite'], '2026-09-30')
        self.assertEqual(e['proximo_corte'], '2026-10-15')
        self.assertEqual(e['saldo_al_corte'], 300_000)
        self.assertEqual(e['por_pagar'], 180_000)          # 300 del extracto − 120 abonados
        self.assertEqual(e['compras_del_ciclo'], 100_000)  # se pagan el otro mes
        self.assertEqual(e['cupo_disponible'], 720_000)
        self.assertEqual(e['dias_para_pagar'], 6)
        self.assertEqual(e['situacion'], 'pendiente')

    def test_vencida_y_al_dia(self):
        self.assertEqual(self.estado(date(2026, 10, 5))['estado_tarjeta']['situacion'], 'vencida')
        Transaccion.objects.create(usuario=self.ana, nombre='Pago', monto=180_000, tipo='transferencia',
                                   fecha=date(2026, 9, 25), cuenta_origen=self.debito, cuenta_destino=self.visa)
        e = self.estado(date(2026, 10, 5))['estado_tarjeta']
        self.assertEqual((e['por_pagar'], e['situacion']), (0, 'al_dia'))

    def test_pagar_tarjeta_no_es_gasto(self):
        with patch('core.views.timezone.localdate', return_value=self.HOY):
            r = self.api.get('/api/transacciones/resumen-mes/').data
        self.assertEqual(r['gastos'], 400_000)             # las compras sí; el pago no
        debito = next(c for c in self.api.get('/api/cuentas/').data if c['nombre'] == 'Débito')
        self.assertEqual(debito['balance_actual'], 880_000)

    def test_transferencia_valida_cuentas(self):
        base = {'nombre': 'x', 'monto': 1, 'tipo': 'transferencia', 'fecha': '2026-09-01'}
        self.assertEqual(self.api.post('/api/transacciones/', {**base, 'cuenta_origen': self.debito.id},
                                       format='json').status_code, 400)
        self.assertEqual(self.api.post('/api/transacciones/', {**base, 'cuenta_origen': self.debito.id,
                                       'cuenta_destino': self.debito.id}, format='json').status_code, 400)

    def test_tarjeta_exige_dias(self):
        r = self.api.post('/api/cuentas/', {'nombre': 'MC', 'tipo': 'credito'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('dia_corte', r.data)
        r = self.api.post('/api/cuentas/', {'nombre': 'Ahorros', 'tipo': 'activo', 'dia_corte': 5}, format='json')
        self.assertIsNone(r.data['dia_corte'])

    def test_corte_fin_de_mes(self):
        from .tarjetas import siguiente_fecha, ultimo_corte
        self.assertEqual(ultimo_corte(date(2026, 3, 10), 31), date(2026, 2, 28))
        self.assertEqual(siguiente_fecha(date(2026, 2, 28), 31), date(2026, 3, 31))
        self.assertEqual(ultimo_corte(date(2026, 9, 15), 15), date(2026, 8, 15))  # el día del corte sigue abierto

    def test_una_consulta_extra_para_todas_las_tarjetas(self):
        Cuenta.objects.create(usuario=self.ana, nombre='Master', tipo='credito', dia_corte=5, dia_pago=20)
        with CaptureQueriesContext(connection) as q:
            self.api.get('/api/cuentas/')
        self.assertEqual(len(q), 2)


class SesionTests(TestCase):
    def test_refresh_rota_y_dura_30_dias(self):
        User.objects.create_user('ana', password='clave-segura')
        api = APIClient()
        tokens = api.post('/api/token/', {'username': 'ana', 'password': 'clave-segura'}).data
        r = api.post('/api/token/refresh/', {'refresh': tokens['refresh']})
        self.assertEqual(r.status_code, 200)
        self.assertIn('refresh', r.data)                  # rotación: sesión que se renueva con el uso
        from rest_framework_simplejwt.tokens import RefreshToken
        vida = RefreshToken(r.data['refresh'])['exp'] - RefreshToken(r.data['refresh'])['iat']
        self.assertEqual(vida, 30 * 24 * 3600)


class DisponibleTests(Base):
    """Hoy: jueves 24 de septiembre de 2026. Sueldo el 30 → 6 días."""
    HOY = date(2026, 9, 24)

    def setUp(self):
        super().setUp()
        Cuenta.objects.create(usuario=self.ana, nombre='Ahorros', balance_inicial=5_000_000, incluir_en_disponible=False)
        self.visa = Cuenta.objects.create(usuario=self.ana, nombre='Visa', tipo='credito', dia_corte=15, dia_pago=30,
                                          balance_inicial=200_000)
        TransaccionRecurrente.objects.create(usuario=self.ana, nombre='Sueldo', monto=3_000_000, tipo='ingreso',
                                             frecuencia='mensual', dia_ejecucion=30, cuenta_destino=self.debito)
        TransaccionRecurrente.objects.create(usuario=self.ana, nombre='Netflix', monto=45_000, tipo='gasto',
                                             frecuencia='mensual', dia_ejecucion=27, cuenta_origen=self.visa)
        TransaccionRecurrente.objects.create(usuario=self.ana, nombre='Arriendo', monto=900_000, tipo='gasto',
                                             frecuencia='mensual', dia_ejecucion=1, cuenta_origen=self.debito)
        self.gasto(30_000, fecha=self.HOY)                       # débito
        self.gasto(20_000, fecha=self.HOY, cuenta=self.visa)     # tarjeta

    def pedir(self):
        with patch('core.views.timezone.localdate', return_value=self.HOY):
            return self.api.get('/api/disponible/').data

    def test_calculo(self):
        d = self.pedir()
        self.assertEqual(d['proximo_ingreso'], {'fecha': '2026-09-30', 'nombre': 'Sueldo', 'fuente': 'recurrente'})
        self.assertEqual(d['dias_restantes'], 6)
        self.assertEqual(d['desglose']['cuentas'], 970_000)      # los ahorros no cuentan
        self.assertEqual(d['desglose']['tarjetas'], 220_000)
        self.assertEqual(d['desglose']['pendientes'], 45_000)    # Netflix sí; el arriendo es después del sueldo
        self.assertEqual(d['disponible'], 705_000)
        self.assertEqual(d['gastado_hoy'], 50_000)
        self.assertEqual(d['por_dia'], 755_000 // 6)             # lo de hoy se devuelve para fijar la cifra
        self.assertEqual(d['queda_hoy'], 755_000 // 6 - 50_000)
        self.assertEqual(d['estado'], 'bien')

    def test_sin_sueldo_usa_el_periodo(self):
        TransaccionRecurrente.objects.filter(tipo='ingreso').delete()
        d = self.pedir()
        self.assertEqual((d['proximo_ingreso']['fecha'], d['proximo_ingreso']['fuente']), ('2026-10-01', 'periodo'))
        self.assertEqual(d['dias_restantes'], 7)

    def test_compromisos_mayores_que_la_plata(self):
        self.gasto(900_000, fecha=date(2026, 9, 20))
        d = self.pedir()
        self.assertEqual(d['estado'], 'negativo')
        self.assertEqual(d['por_dia'], 0)

    def test_quincena(self):
        from .disponible import ocurre
        rec = TransaccionRecurrente(frecuencia='quincenal', dia_ejecucion=15)
        self.assertTrue(ocurre(rec, date(2026, 9, 30)))
        self.assertTrue(ocurre(rec, date(2026, 2, 28)))         # 30 de febrero → 28
        self.assertFalse(ocurre(rec, date(2026, 9, 29)))

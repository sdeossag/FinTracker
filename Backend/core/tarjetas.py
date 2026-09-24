# Estado de cuenta de las tarjetas de crédito: corte, fecha límite y cuánto pagar
import calendar
from datetime import date, timedelta

from django.db.models import Q
from django.utils import timezone

from .models import Transaccion


def _dia(anio, mes, dia):
    """El día pedido o el último del mes si no existe (corte el 31 en febrero → 28/29)."""
    return date(anio, mes, min(dia, calendar.monthrange(anio, mes)[1]))


def _mes_siguiente(anio, mes):
    return (anio + 1, 1) if mes == 12 else (anio, mes + 1)


def _mes_anterior(anio, mes):
    return (anio - 1, 12) if mes == 1 else (anio, mes - 1)


def ultimo_corte(hoy, dia_corte):
    """Último corte ya cerrado. El día del corte todavía pertenece al ciclo abierto."""
    c = _dia(hoy.year, hoy.month, dia_corte)
    if c >= hoy:
        c = _dia(*_mes_anterior(hoy.year, hoy.month), dia_corte)
    return c


def siguiente_fecha(despues_de, dia):
    """Primera fecha posterior a `despues_de` que cae en `dia` del mes."""
    f = _dia(despues_de.year, despues_de.month, dia)
    if f <= despues_de:
        f = _dia(*_mes_siguiente(despues_de.year, despues_de.month), dia)
    return f


def cuotas_facturadas(fecha_compra, cuotas, corte, dia_corte):
    """
    Cuántas cuotas de una compra ya se facturaron hasta el `corte` dado.
    La primera cuota entra en el corte que cierra el ciclo de la compra; luego una por mes.
    """
    primer_corte = siguiente_fecha(fecha_compra - timedelta(days=1), dia_corte)
    if primer_corte > corte:
        return 0
    meses = (corte.year * 12 + corte.month) - (primer_corte.year * 12 + primer_corte.month)
    return min(meses + 1, cuotas)


def facturado(monto, cuotas, k):
    """Parte del monto ya facturada tras k cuotas (la última cuota absorbe el redondeo)."""
    return monto if k >= cuotas else round(monto * k / cuotas)


def estados_tarjetas(cuentas, hoy):
    """
    Calcula el estado de todas las tarjetas con UNA consulta.
    Se leen los movimientos posteriores al último corte (un ciclo) y las compras a cuotas.
    El saldo al corte se deduce del saldo actual: saldo_al_corte = deuda − (compras − abonos) del ciclo.
    Las compras a cuotas solo cobran la cuota del mes: lo no facturado queda diferido.
    """
    tarjetas = [c for c in cuentas if c.tipo == 'credito' and c.dia_corte and c.dia_pago]
    if not tarjetas:
        return {}

    cortes = {t.id: ultimo_corte(hoy, t.dia_corte) for t in tarjetas}
    por_id = {t.id: t for t in tarjetas}
    ids = list(cortes)
    movs = Transaccion.objects.filter(
        Q(cuenta_origen_id__in=ids) | Q(cuenta_destino_id__in=ids),
        Q(fecha__gt=min(cortes.values())) | Q(tipo='gasto', cuotas__gt=1),
    ).values_list('cuenta_origen_id', 'cuenta_destino_id', 'fecha', 'monto', 'cuotas', 'tipo', 'nombre')

    compras = dict.fromkeys(ids, 0)       # cargos a la tarjeta en el ciclo abierto
    abonos = dict.fromkeys(ids, 0)        # pagos o devoluciones en el ciclo abierto
    diferido_corte = dict.fromkeys(ids, 0)   # cuotas aún no facturadas al último corte
    diferido_proximo = dict.fromkeys(ids, 0) # … y al próximo corte (lo que no se paga este ciclo)
    a_cuotas = {i: [] for i in ids}
    for origen, destino, fecha, monto, cuotas, tipo, nombre in movs:
        if origen in cortes and fecha > cortes[origen]:
            compras[origen] += monto
        if destino in cortes and fecha > cortes[destino]:
            abonos[destino] += monto
        if origen in cortes and tipo == 'gasto' and cuotas > 1:
            t = por_id[origen]
            corte = cortes[origen]
            k_corte = cuotas_facturadas(fecha, cuotas, corte, t.dia_corte)
            k_prox = cuotas_facturadas(fecha, cuotas, siguiente_fecha(corte, t.dia_corte), t.dia_corte)
            if fecha <= corte:
                diferido_corte[origen] += monto - facturado(monto, cuotas, k_corte)
            diferido_proximo[origen] += monto - facturado(monto, cuotas, k_prox)
            if k_corte < cuotas:
                a_cuotas[origen].append({
                    'nombre': nombre,
                    'monto': monto,
                    'cuotas': cuotas,
                    'cuota': round(monto / cuotas),
                    'facturadas': k_corte,
                    'fecha': fecha.isoformat(),
                })

    estados = {}
    for t in tarjetas:
        corte = cortes[t.id]
        deuda = t.balance_actual
        limite = siguiente_fecha(corte, t.dia_pago)
        siguiente = siguiente_fecha(corte, t.dia_corte)

        saldo_al_corte = deuda - compras[t.id] + abonos[t.id]
        # Tarjeta registrada después de la fecha límite: su deuda inicial no puede ser
        # un extracto vencido que no conocemos; entra al próximo corte.
        if t.creada_en and timezone.localtime(t.creada_en).date() > limite:
            saldo_al_corte = 0
        # Del extracto se paga lo facturado; las cuotas futuras no. Lo abonado descuenta primero.
        por_pagar = max(0, saldo_al_corte - diferido_corte[t.id] - abonos[t.id])

        if por_pagar == 0:
            situacion = 'al_dia'
        elif limite < hoy:
            situacion = 'vencida'
        else:
            situacion = 'pendiente'

        estados[t.id] = {
            'deuda': deuda,
            'cupo_disponible': (t.cupo - max(deuda, 0)) if t.cupo is not None else None,
            'ultimo_corte': corte.isoformat(),
            'proximo_corte': siguiente.isoformat(),
            'fecha_limite': limite.isoformat(),
            'dias_para_pagar': (limite - hoy).days,
            'saldo_al_corte': max(saldo_al_corte, 0),
            'por_pagar': por_pagar,
            'compras_del_ciclo': compras[t.id],
            'abonos_del_ciclo': abonos[t.id],
            # Cuotas que todavía no se cobran: deuda, pero no de este mes
            'diferido': diferido_proximo[t.id],
            'compras_a_cuotas': sorted(a_cuotas[t.id], key=lambda c: c['fecha'], reverse=True),
            'situacion': situacion,
        }
    return estados

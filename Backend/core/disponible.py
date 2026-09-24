# "Puedes gastar $X al día hasta tu próximo ingreso".
#
# Plata para gastar = saldo de las cuentas que cuentan (las de ahorro se pueden excluir)
#                     − lo que se debe en tarjetas de crédito (sin las cuotas de meses futuros)
#                     − gastos recurrentes que faltan antes del próximo ingreso.
# Por día = esa plata al empezar el día ÷ días hasta el próximo ingreso.
# Así lo gastado hoy no cambia la cifra diaria, solo lo que queda de hoy.
import calendar
from datetime import timedelta

from django.db.models import F, Q, Sum

from .models import PerfilUsuario, Transaccion, TransaccionRecurrente
from .tarjetas import estados_tarjetas


def _dia(anio, mes, dia):
    return min(dia, calendar.monthrange(anio, mes)[1])


def ocurre(rec, fecha):
    """¿La recurrente se ejecuta en esta fecha? (misma regla que el auto-registro)."""
    d = rec.dia_ejecucion
    if rec.frecuencia == 'diaria':
        return True
    if d is None:
        return False
    if rec.frecuencia == 'semanal':
        return fecha.isoweekday() == d
    if rec.frecuencia == 'quincenal':
        return fecha.day in (_dia(fecha.year, fecha.month, d), _dia(fecha.year, fecha.month, d + 15))
    if rec.frecuencia == 'mensual':
        return fecha.day == _dia(fecha.year, fecha.month, d)
    return False


def proximo_ingreso(recurrentes, perfil, hoy):
    """La siguiente fecha (después de hoy) en que entra plata. Máximo a 62 días."""
    ingresos = [r for r in recurrentes if r.tipo == 'ingreso']
    for n in range(1, 63):
        f = hoy + timedelta(days=n)
        for r in ingresos:
            if ocurre(r, f):
                return f, r.nombre, 'recurrente'
    # Sin sueldo programado: el inicio del próximo período de presupuesto
    inicio = perfil.periodo_inicio if perfil else 1
    anio, mes = (hoy.year, hoy.month)
    f = hoy.replace(day=_dia(anio, mes, inicio))
    if f <= hoy:
        anio, mes = (anio + 1, 1) if mes == 12 else (anio, mes + 1)
        f = f.replace(year=anio, month=mes, day=_dia(anio, mes, inicio))
    return f, None, 'periodo'


def calcular(usuario, cuentas, hoy):
    """`cuentas`: las del usuario con balance_actual ya anotado (una sola consulta)."""
    recurrentes = list(
        TransaccionRecurrente.objects.filter(usuario=usuario, activa=True).select_related('cuenta_destino')
    )
    perfil = PerfilUsuario.objects.filter(usuario=usuario).first()
    fecha_ingreso, nombre_ingreso, fuente = proximo_ingreso(recurrentes, perfil, hoy)
    dias = max((fecha_ingreso - hoy).days, 1)

    en_cuentas = sum(c.balance_actual for c in cuentas if c.tipo == 'activo' and c.incluir_en_disponible)
    # Las compras a cuotas se cobran mes a mes: solo cuenta lo que no está diferido
    estados = estados_tarjetas(cuentas, hoy)
    en_tarjetas = sum(
        max(c.balance_actual - (estados.get(c.id) or {}).get('diferido', 0), 0)
        for c in cuentas if c.tipo == 'credito'
    )

    # Lo que ya está comprometido antes del próximo ingreso: gastos y pagos programados
    pendientes = []
    for r in recurrentes:
        sale_plata = r.tipo == 'gasto' or (
            r.tipo == 'transferencia' and r.cuenta_destino and r.cuenta_destino.tipo == 'pasivo'
        )
        if not sale_plata:
            continue
        for n in range(dias):
            f = hoy + timedelta(days=n)
            if f == hoy and r.ultima_ejecucion == hoy:
                continue   # la de hoy ya se registró y ya está en el saldo
            if ocurre(r, f):
                pendientes.append({'nombre': r.nombre, 'monto': r.monto, 'fecha': f.isoformat()})
    en_pendientes = sum(p['monto'] for p in pendientes)

    disponible = en_cuentas - en_tarjetas - en_pendientes

    # Gastado hoy (con débito o crédito): se devuelve al disponible para fijar la cifra del día.
    # Una compra a cuotas solo pesa hoy lo de su primera cuota.
    gastado_hoy = Transaccion.objects.filter(
        usuario=usuario, tipo='gasto', fecha=hoy,
    ).filter(
        Q(cuenta_origen__tipo='credito')
        | Q(cuenta_origen__tipo='activo', cuenta_origen__incluir_en_disponible=True)
    ).aggregate(t=Sum(F('monto') / F('cuotas')))['t'] or 0

    por_dia = max(disponible + gastado_hoy, 0) // dias
    queda_hoy = por_dia - gastado_hoy

    if disponible < 0:
        estado = 'negativo'
    elif queda_hoy < 0:
        estado = 'pasado'
    elif por_dia and queda_hoy < por_dia * 0.25:
        estado = 'justo'
    else:
        estado = 'bien'

    return {
        'por_dia': por_dia,
        'gastado_hoy': gastado_hoy,
        'queda_hoy': queda_hoy,
        'disponible': disponible,
        'dias_restantes': dias,
        'proximo_ingreso': {'fecha': fecha_ingreso.isoformat(), 'nombre': nombre_ingreso, 'fuente': fuente},
        'desglose': {
            'cuentas': en_cuentas,
            'tarjetas': en_tarjetas,
            'pendientes': en_pendientes,
            'lista_pendientes': sorted(pendientes, key=lambda p: p['fecha'])[:12],
        },
        'estado': estado,
    }

# Presupuesto semanal: un tope de gasto de lunes a domingo.
#
# Cuenta lo que sale de verdad esta semana:
# — Solo gastos (las transferencias y los pagos de tarjeta no son gasto nuevo).
# — Una compra a cuotas pesa solo su cuota, no el total.
# — Los gastos de categorías marcadas fuera del tope (arriendo, colegio…) no cuentan.
# Lo que sobra no pasa a la semana siguiente: cada lunes arranca de cero.
from datetime import timedelta

from django.db.models import Exists, F, OuterRef, Q, Sum

from .models import PerfilUsuario, Transaccion, TransaccionCategoria

CERCA = 0.8   # a partir de aquí la semana se pone en amarillo y llega el aviso


def inicio_semana(fecha):
    return fecha - timedelta(days=fecha.weekday())


def gastos_del_tope(usuario):
    """Los gastos que cuentan para el tope (sin filtrar fechas)."""
    fuera = TransaccionCategoria.objects.filter(transaccion=OuterRef('pk'), categoria__en_tope_semanal=False)
    return Transaccion.objects.filter(usuario=usuario, tipo='gasto').exclude(Exists(fuera))


def gastado_entre(usuario, desde, hasta):
    """Suma de [desde, hasta) contando solo la cuota de las compras a cuotas."""
    return gastos_del_tope(usuario).filter(fecha__gte=desde, fecha__lt=hasta).aggregate(
        t=Sum(F('monto') / F('cuotas')))['t'] or 0


def situacion(gastado, tope):
    if not tope:
        return 'sin_tope'
    if gastado > tope:
        return 'pasado'
    if gastado >= tope * CERCA:
        return 'cerca'
    return 'bien'


def redondear(n, paso=10_000):
    return int(round(n / paso) * paso)


def estado_semana(usuario, hoy):
    """Todo lo que muestran Inicio y Presupuesto, en 3 consultas."""
    inicio = inicio_semana(hoy)
    fin = inicio + timedelta(days=7)
    tope = PerfilUsuario.objects.filter(usuario=usuario).values_list('tope_semanal', flat=True).first()

    movimientos = list(
        gastos_del_tope(usuario).filter(fecha__gte=inicio, fecha__lt=fin)
        .prefetch_related('transaccion_categorias__categoria')
    )
    por_dia = [0] * 7
    por_categoria = {}
    for t in movimientos:
        valor = t.monto // t.cuotas
        por_dia[(t.fecha - inicio).days] += valor
        # Con varias categorías, cuenta en la primera: así la suma del desglose es el total
        tc = next(iter(t.transaccion_categorias.all()), None)
        c = tc.categoria if tc else None
        clave = c.id if c else 0
        fila = por_categoria.setdefault(clave, {
            'id': clave or None,
            'nombre': c.nombre if c else 'Sin categoría',
            'color_hex': c.color_hex if c else '#8E8E93',
            'total': 0,
        })
        fila['total'] += valor
    gastado = sum(por_dia)

    # Las 4 semanas anteriores en una sola consulta: la pasada y el promedio sugerido
    semanas = {f's{i}': Sum(F('monto') / F('cuotas'), filter=Q(
        fecha__gte=inicio - timedelta(weeks=i), fecha__lt=inicio - timedelta(weeks=i - 1)))
        for i in range(1, 5)}
    anteriores = gastos_del_tope(usuario).filter(
        fecha__gte=inicio - timedelta(weeks=4), fecha__lt=inicio).aggregate(**semanas)
    totales = [anteriores[f's{i}'] or 0 for i in range(1, 5)]
    con_gasto = [t for t in totales if t]

    return {
        'tope': tope,
        'inicio': inicio.isoformat(),
        'fin': (fin - timedelta(days=1)).isoformat(),
        'dia': hoy.weekday(),                  # 0 = lunes
        'gastado': gastado,
        'queda': (tope - gastado) if tope else None,
        'estado': situacion(gastado, tope),
        'por_dia': por_dia,
        'por_categoria': sorted(por_categoria.values(), key=lambda f: -f['total']),
        'movimientos': len(movimientos),
        'semana_pasada': totales[0],
        # Para la primera vez: el promedio de las semanas con gasto, redondeado
        'sugerido': redondear(sum(con_gasto) / len(con_gasto)) if con_gasto else None,
    }


# ── Avisos ──────────────────────────────────────────────────────────

def revisar_tope(usuario, hoy, fecha=None):
    """
    Tras registrar un gasto: avisa una sola vez por semana al llegar al 80 % del tope
    y otra al pasarlo. No hace nada si el gasto no es de esta semana, si no hay tope
    o si el usuario no tiene notificaciones.
    """
    from .models import AvisoEnviado, SuscripcionPush
    from .notificaciones import enviar, pesos

    inicio = inicio_semana(hoy)
    if fecha and not (inicio <= fecha < inicio + timedelta(days=7)):
        return None
    tope = PerfilUsuario.objects.filter(usuario=usuario).values_list('tope_semanal', flat=True).first()
    if not tope or not SuscripcionPush.objects.filter(usuario=usuario).exists():
        return None

    gastado = gastado_entre(usuario, inicio, inicio + timedelta(days=7))
    estado = situacion(gastado, tope)
    if estado == 'pasado':
        nuevo = ['tope-80', 'tope-100']   # pasarse cubre también el 80 %: no llega después
        titulo, cuerpo = 'Te pasaste del tope de la semana', f'Vas {pesos(gastado - tope)} por encima de {pesos(tope)}.'
    elif estado == 'cerca':
        nuevo = ['tope-80']
        titulo, cuerpo = 'Vas llegando al tope de la semana', f'Llevas {pesos(gastado)} de {pesos(tope)}. Te quedan {pesos(tope - gastado)}.'
    else:
        return None

    ya = set(AvisoEnviado.objects.filter(usuario=usuario, clave__in=[f'{n}:{inicio}' for n in nuevo])
             .values_list('clave', flat=True))
    pendientes = [f'{n}:{inicio}' for n in nuevo if f'{n}:{inicio}' not in ya]
    if f'{nuevo[-1]}:{inicio}' not in pendientes:
        return None   # el aviso de este nivel ya salió esta semana
    AvisoEnviado.objects.bulk_create([AvisoEnviado(usuario=usuario, clave=c) for c in pendientes],
                                     ignore_conflicts=True)
    enviar(usuario, titulo, cuerpo, url='/presupuesto?vista=semana', etiqueta='tope-semanal')
    return nuevo[-1]


def resumen_semana_pasada(usuario, hoy):
    """Los lunes: cómo terminó la semana anterior. (clave, título, cuerpo) o None."""
    from .notificaciones import pesos

    tope = PerfilUsuario.objects.filter(usuario=usuario).values_list('tope_semanal', flat=True).first()
    if hoy.weekday() != 0 or not tope:
        return None
    inicio = inicio_semana(hoy) - timedelta(days=7)
    gastado = gastado_entre(usuario, inicio, inicio + timedelta(days=7))
    if gastado > tope:
        cuerpo = f'Gastaste {pesos(gastado)}: te pasaste {pesos(gastado - tope)} del tope. Esta semana arranca de cero.'
    else:
        cuerpo = f'Gastaste {pesos(gastado)} de {pesos(tope)} y te sobraron {pesos(tope - gastado)}. ¡Bien!'
    return f'semana:{inicio}', 'Así cerró tu semana', cuerpo

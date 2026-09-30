# Notificaciones push (Web Push): llegan aunque la app esté cerrada.
#
# El teléfono se suscribe desde Configuración y guarda su suscripción aquí.
# Una vez al día, GitHub Actions llama a /api/recordatorios/enviar/ (con el token
# RECORDATORIOS_TOKEN) y se avisan los cortes y pagos de las tarjetas.
# Cada aviso sale una sola vez (AvisoEnviado), aunque el cron corra de nuevo.
#
# Variables de entorno: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…),
# RECORDATORIOS_TOKEN. Las llaves VAPID se generan con `manage.py generar_vapid`.
import json
import logging
import os
from datetime import date, timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import AvisoEnviado, SuscripcionPush
from .tarjetas import estados_tarjetas

log = logging.getLogger(__name__)

DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
         'septiembre', 'octubre', 'noviembre', 'diciembre']


def push_configurado():
    return bool(os.getenv('VAPID_PUBLIC_KEY') and os.getenv('VAPID_PRIVATE_KEY'))


def pesos(n):
    return f'${n:,.0f}'.replace(',', '.')


def fecha_texto(f):
    """'el martes 5 de octubre'"""
    return f'el {DIAS[f.weekday()]} {f.day} de {MESES[f.month - 1]}'


# ── Envío ───────────────────────────────────────────────────────────

def enviar(usuario, titulo, cuerpo, url='/', etiqueta=''):
    """Manda la notificación a todos los dispositivos del usuario. Devuelve cuántos la recibieron."""
    if not push_configurado():
        return 0
    from pywebpush import WebPushException, webpush

    datos = json.dumps({'title': titulo, 'body': cuerpo, 'url': url, 'tag': etiqueta})
    enviados = 0
    for s in SuscripcionPush.objects.filter(usuario=usuario):
        try:
            webpush(
                subscription_info={'endpoint': s.endpoint, 'keys': {'p256dh': s.p256dh, 'auth': s.auth}},
                data=datos,
                vapid_private_key=os.environ['VAPID_PRIVATE_KEY'],
                vapid_claims={'sub': os.getenv('VAPID_SUBJECT', 'mailto:soporte@fintracker.app')},
                ttl=12 * 3600,
                timeout=10,
            )
            enviados += 1
        except WebPushException as e:
            codigo = getattr(e.response, 'status_code', None)
            if codigo in (404, 410):
                s.delete()   # el teléfono borró la app o quitó el permiso
            else:
                log.warning('Push falló (%s): %s', codigo, str(e)[:200])
        except Exception as e:  # red, llave mal configurada…
            log.warning('Push falló: %s', e)
    return enviados


# ── Recordatorios de tarjetas ───────────────────────────────────────

def avisos_de_tarjeta(tarjeta, e, hoy):
    """Los avisos que tocan hoy para una tarjeta: [(clave, título, cuerpo)]."""
    nombre = tarjeta.nombre
    proximo_corte = date.fromisoformat(e['proximo_corte'])
    ultimo_corte = date.fromisoformat(e['ultimo_corte'])
    limite = date.fromisoformat(e['fecha_limite'])
    dias = e['dias_para_pagar']
    pagar = e['por_pagar']
    avisos = []

    if proximo_corte == hoy + timedelta(days=1):
        cuerpo = 'Lo que compres hasta mañana entra en este extracto.'
        if e['compras_del_ciclo'] > 0:
            cuerpo += f' En este ciclo llevas {pesos(e["compras_del_ciclo"])}.'
        avisos.append((f'corte:{tarjeta.id}:{proximo_corte}', f'Mañana es el corte de tu {nombre}', cuerpo))

    if ultimo_corte == hoy - timedelta(days=1) and pagar > 0:
        avisos.append((f'extracto:{tarjeta.id}:{ultimo_corte}', f'Cerró el extracto de tu {nombre}',
                       f'Pagas {pesos(pagar)} hasta {fecha_texto(limite)}.'))

    if e['situacion'] == 'pendiente' and pagar > 0:
        if dias == 3:
            avisos.append((f'pago-3:{tarjeta.id}:{limite}', f'Paga tu {nombre} en 3 días',
                           f'{pesos(pagar)} hasta {fecha_texto(limite)}.'))
        elif dias == 1:
            avisos.append((f'pago-1:{tarjeta.id}:{limite}', f'Mañana vence el pago de tu {nombre}',
                           f'Te faltan {pesos(pagar)}. Págalo hoy o mañana para evitar intereses de mora.'))
        elif dias == 0:
            avisos.append((f'pago-0:{tarjeta.id}:{limite}', f'Hoy vence el pago de tu {nombre}',
                           f'Te faltan {pesos(pagar)}.'))

    if e['situacion'] == 'vencida' and dias == -1:
        avisos.append((f'vencida:{tarjeta.id}:{limite}', f'Se venció el pago de tu {nombre}',
                       f'Quedaron {pesos(pagar)} sin pagar. Si ya pagaste, regístralo en FinTracker.'))
    return avisos


def enviar_recordatorios(hoy=None):
    """Recorre a quien tenga notificaciones activas. Devuelve {'usuarios', 'avisos'}."""
    from .views import cuentas_con_saldo   # evita la importación circular

    hoy = hoy or timezone.localdate()
    usuarios = {s.usuario for s in SuscripcionPush.objects.select_related('usuario')}
    total = 0
    for usuario in usuarios:
        cuentas = list(cuentas_con_saldo(usuario))
        estados = estados_tarjetas(cuentas, hoy)
        for tarjeta in (c for c in cuentas if c.id in estados):
            for clave, titulo, cuerpo in avisos_de_tarjeta(tarjeta, estados[tarjeta.id], hoy):
                try:
                    with transaction.atomic():
                        AvisoEnviado.objects.create(usuario=usuario, clave=clave)
                except IntegrityError:
                    continue   # ya se mandó
                enviar(usuario, titulo, cuerpo, url='/cuentas', etiqueta=clave.rsplit(':', 1)[0])
                total += 1
    # Lo enviado hace más de 3 meses ya no puede repetirse: se limpia
    AvisoEnviado.objects.filter(enviado_en__lt=timezone.now() - timedelta(days=100)).delete()
    return {'usuarios': len(usuarios), 'avisos': total}

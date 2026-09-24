# Registro automático desde los SMS del banco.
#
# 1. Patrones conocidos (Bancolombia, Nequi): gratis e instantáneo.
# 2. Si ninguno aplica, IA en Groq (si hay GROQ_API_KEY). El monto que devuelva
#    se verifica contra los números del texto: la IA nunca inventa una cifra.
# 3. Con la terminación (*7992) se busca la cuenta. Si no se sabe cuál es, el
#    mensaje queda por revisar hasta que el usuario la asigne.
import hashlib
import json
import logging
import os
import re
from datetime import date, timedelta

import requests
from django.db import IntegrityError, transaction as db_transaction
from django.utils import timezone

from .models import Cuenta, MensajeBanco, Transaccion, TransaccionCategoria

log = logging.getLogger(__name__)

GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
GROQ_MODELO = os.getenv('GROQ_MODEL', 'llama-3.1-8b-instant')

# Minutos en que un envío y un recibo del mismo monto se consideran la misma transferencia
VENTANA_TRANSFERENCIA = timedelta(minutes=30)

MONTO = r'(?:cop|\$)?\s?(?P<monto>\d[\d.,]*)'
FECHA = r'(?P<fecha>\d{1,2}/\d{1,2}/\d{2,5})'

# Cada patrón: (clase, regex). La clase decide qué transacción se crea.
PATRONES = [
    ('compra', re.compile(
        rf'compraste\s+{MONTO}\s+en\s+(?P<comercio>.+?)\s+con\s+tu\s+t\.?\s?(?:cred|deb)\w*\.?\s*\*(?P<digitos>\d+)'
        rf'(?:,?\s+el\s+{FECHA})?', re.I | re.S)),
    ('compra', re.compile(
        rf'pagaste\s+{MONTO}\s+en\s+(?P<comercio>.+?)(?:\s+con\s+tu\s+.*?\*(?P<digitos>\d+))?(?:,?\s+el\s+{FECHA})?[.\s]*$',
        re.I | re.S)),
    ('recibida', re.compile(
        rf'recibiste\s+(?:una\s+transferencia\s+)?de\s+(?P<contraparte>.+?)\s+por\s+{MONTO}'
        rf'(?:\s+en\s+tu\s+cuenta\s+\*(?P<digitos>\d+))?(?:.*?\bel\s+{FECHA})?', re.I | re.S)),
    ('enviada', re.compile(
        rf'transferiste\s+{MONTO}\s+desde\s+tu\s+cuenta\s+\*(?P<digitos>\d+)\s+a\s+la\s+cuenta\s+\*(?P<destino>\d+)'
        rf'(?:\s+el\s+{FECHA})?', re.I | re.S)),
]

# Mensajes que jamás son movimientos (y que no conviene guardar)
PALABRAS_SEGURIDAD = re.compile(r'\b(clave|c[oó]digo|otp|contrase[nñ]a|token)\b', re.I)

# Billeteras sin número: el remitente o el prefijo del SMS dice cuál es
BILLETERAS = {'nequi': re.compile(r'^\s*nequi\b', re.I), 'daviplata': re.compile(r'^\s*daviplata\b', re.I)}


# ── Utilidades de texto ─────────────────────────────────────────────

def a_pesos(texto):
    """
    '6.345,00' → 6345 · '2,250.00' → 2250 · '4.500' → 4500 · '20.799,84' → 20800.
    Un separador seguido de 1–2 dígitos al final es decimal; los demás son de miles.
    """
    t = (texto or '').strip().rstrip('.,')
    m = re.match(r'^(.*?)[.,](\d{1,2})$', t)
    entero, decimales = (m.group(1), m.group(2)) if m else (t, '0')
    digitos = re.sub(r'\D', '', entero)
    if not digitos:
        return None
    return round(int(digitos) + int(decimales.ljust(2, '0')) / 100)


def montos_en_texto(texto):
    return {a_pesos(n) for n in re.findall(r'\d[\d.,]*\d|\d', texto)} - {None}


def leer_fecha(texto, hoy):
    """dd/mm/aa(aa). Si no tiene sentido (p. ej. '20206') o está lejos de hoy, None."""
    if not texto:
        return None
    try:
        d, m, a = (int(x) for x in texto.split('/'))
        if a < 100:
            a += 2000
        f = date(a, m, d)
    except ValueError:
        return None
    return f if hoy - timedelta(days=10) <= f <= hoy + timedelta(days=1) else None


def enmascarar(texto):
    """Números de 6+ dígitos (llaves, cuentas de terceros) quedan como ******6703."""
    return re.sub(r'\d{6,}', lambda m: '*' * (len(m.group()) - 4) + m.group()[-4:], texto)


def limpiar_comercio(nombre):
    """'EPC*EPIC GAMES STORE' → 'Epic Games Store' · 'LAS HERMOSAS COFFEE' → 'Las Hermosas Coffee'."""
    n = re.sub(r'^[A-Z0-9]{2,5}\*\s*', '', nombre.strip(), flags=re.I)
    n = re.sub(r'\s+', ' ', n).strip(' .,')
    return n.title() if n.isupper() or n.islower() else n


def huella(remitente, texto):
    return hashlib.sha256(f'{remitente}|{" ".join(texto.split())}'.encode()).hexdigest()


# ── Entender el SMS ─────────────────────────────────────────────────

def billetera(remitente, texto):
    for nombre, patron in BILLETERAS.items():
        if patron.search(texto):
            return nombre
    return None


def con_patrones(texto):
    for clase, patron in PATRONES:
        m = patron.search(texto)
        if not m:
            continue
        g = m.groupdict()
        monto = a_pesos(g.get('monto'))
        if not monto:
            continue
        return {
            'clase': clase,
            'monto': monto,
            'comercio': limpiar_comercio(g['comercio']) if g.get('comercio') else '',
            'contraparte': limpiar_comercio(g['contraparte']) if g.get('contraparte') else '',
            'digitos': g.get('digitos') or '',
            'destino': (g.get('destino') or '')[-4:],  # de terceros: solo lo necesario
            'fecha_texto': g.get('fecha') or '',
        }
    return None


PROMPT_IA = """Extrae el movimiento de este SMS de un banco colombiano. Responde SOLO un JSON:
{"es_movimiento": bool, "clase": "compra"|"recibida"|"enviada"|"otro",
 "monto": "el monto tal como aparece en el texto", "comercio": str, "contraparte": str,
 "digitos": "últimos dígitos de la tarjeta o cuenta propia, sin *", "destino": "dígitos de la cuenta destino o vacío",
 "fecha": "dd/mm/aaaa o vacío"}
"compra" = pago o compra (incluye retiros y pagos PSE). "recibida" = plata que entra. "enviada" = transferencia que sale.
Si es publicidad, un código o un aviso sin plata, es_movimiento=false."""


def con_ia(texto):
    clave = os.getenv('GROQ_API_KEY')
    if not clave:
        return None, 'No reconocí este formato de SMS.'
    try:
        r = requests.post(
            GROQ_URL,
            headers={'Authorization': f'Bearer {clave}'},
            json={
                'model': GROQ_MODELO,
                'temperature': 0,
                'response_format': {'type': 'json_object'},
                'messages': [
                    {'role': 'system', 'content': PROMPT_IA},
                    {'role': 'user', 'content': enmascarar(texto)},
                ],
            },
            timeout=8,
        )
        r.raise_for_status()
        datos = json.loads(r.json()['choices'][0]['message']['content'])
    except (requests.RequestException, KeyError, ValueError, TypeError) as e:
        log.warning('Groq no respondió: %s', e)
        return None, 'No pude leer este SMS automáticamente.'

    if not isinstance(datos, dict):
        return None, 'No pude leer este SMS automáticamente.'
    if not datos.get('es_movimiento'):
        return {'clase': 'otro'}, 'No parece un movimiento de plata.'
    monto = a_pesos(str(datos.get('monto', '')))
    # La IA puede equivocarse con los números: el monto tiene que estar en el SMS
    if not monto or monto not in montos_en_texto(texto):
        return None, 'No pude confirmar el monto de este SMS.'
    clase = datos.get('clase') if datos.get('clase') in ('compra', 'recibida', 'enviada') else None
    if not clase:
        return None, 'No entendí qué tipo de movimiento es.'
    return {
        'clase': clase,
        'monto': monto,
        'comercio': limpiar_comercio(str(datos.get('comercio') or '')),
        'contraparte': limpiar_comercio(str(datos.get('contraparte') or '')),
        'digitos': re.sub(r'\D', '', str(datos.get('digitos') or '')),
        'destino': re.sub(r'\D', '', str(datos.get('destino') or ''))[-4:],
        'fecha_texto': str(datos.get('fecha') or ''),
    }, ''


def entender(remitente, texto):
    """Devuelve (datos, metodo, motivo). datos=None si no se entendió."""
    datos = con_patrones(texto)
    if datos:
        return datos, 'patron', ''
    datos, motivo = con_ia(texto)
    return datos, ('ia' if datos else 'ninguno'), motivo


# ── Cuentas ─────────────────────────────────────────────────────────

def identificadores(cuenta):
    return [t.lower() for t in re.split(r'[\s,;]+', cuenta.terminaciones or '') if t]


def buscar_cuenta(cuentas, ident):
    """Por los últimos 4 dígitos (o la palabra 'nequi'). También por el nombre de la billetera."""
    if not ident:
        return None
    ident = ident.lower()
    corto = ident[-4:] if ident.isdigit() else ident
    for c in cuentas:
        for t in identificadores(c):
            if t == ident or (t.isdigit() and corto.isdigit() and t[-4:] == corto):
                return c
    if not ident.isdigit():
        return next((c for c in cuentas if ident in c.nombre.lower()), None)
    return None


def categorias_aprendidas(usuario, nombre, tipo):
    """Las categorías de la última vez que registraste el mismo comercio."""
    previa = (
        Transaccion.objects.filter(usuario=usuario, tipo=tipo, nombre__iexact=nombre)
        .exclude(transaccion_categorias=None).order_by('-fecha', '-id').first()
    )
    return list(previa.transaccion_categorias.values_list('categoria_id', flat=True)) if previa else []


# ── Registrar ───────────────────────────────────────────────────────

def plan_de_registro(usuario, datos, cuentas, pista_billetera, hoy):
    """
    Traduce lo entendido a una transacción. Devuelve (campos, motivo_si_falta_algo).
    """
    ident = datos.get('digitos') or pista_billetera or ''
    cuenta = buscar_cuenta(cuentas, ident)
    fecha = leer_fecha(datos.get('fecha_texto'), hoy) or hoy
    base = {'usuario': usuario, 'monto': datos['monto'], 'fecha': fecha, 'origen': 'sms'}
    etiqueta = f'*{ident[-4:]}' if ident.isdigit() else ident.capitalize()

    if not cuenta:
        if not ident:
            return None, 'El SMS no dice de qué cuenta salió la plata.'
        return None, f'No sé a qué cuenta corresponde {etiqueta}.'

    clase = datos['clase']
    if clase == 'compra':
        nombre = datos.get('comercio') or 'Compra'
        return {**base, 'tipo': 'gasto', 'nombre': nombre, 'cuenta_origen': cuenta}, ''
    if clase == 'recibida':
        de = datos.get('contraparte')
        return {**base, 'tipo': 'ingreso', 'nombre': f'Transferencia de {de}' if de else 'Transferencia recibida',
                'cuenta_destino': cuenta}, ''
    if clase == 'enviada':
        destino = buscar_cuenta([c for c in cuentas if c.id != cuenta.id], datos.get('destino'))
        if destino:
            return {**base, 'tipo': 'transferencia', 'nombre': f'Transferencia a {destino.nombre}',
                    'cuenta_origen': cuenta, 'cuenta_destino': destino}, ''
        d = datos.get('destino') or ''
        return {**base, 'tipo': 'gasto', 'nombre': f'Transferencia a *{d[-4:]}' if d else 'Transferencia enviada',
                'cuenta_origen': cuenta}, ''
    return None, 'No entendí qué tipo de movimiento es.'


def unir_con_contraparte(campos, clase):
    """
    Plata que pasa entre dos cuentas propias llega como dos SMS (uno sale, otro entra).
    Si ya se registró la otra mitad hace poco, se convierte en una sola transferencia.
    """
    if clase not in ('recibida', 'enviada'):
        return None
    desde = timezone.now() - VENTANA_TRANSFERENCIA
    otra = Transaccion.objects.filter(
        usuario=campos['usuario'], origen='sms', monto=campos['monto'], creada_en__gte=desde,
        mensajes__datos__clase='enviada' if clase == 'recibida' else 'recibida',
    )
    if clase == 'recibida':
        otra = otra.filter(tipo='gasto').exclude(cuenta_origen=campos['cuenta_destino'])
    else:
        otra = otra.filter(tipo='ingreso').exclude(cuenta_destino=campos['cuenta_origen'])
    otra = otra.order_by('-creada_en').first()
    if not otra:
        return None
    origen = otra.cuenta_origen if clase == 'recibida' else campos['cuenta_origen']
    destino = campos['cuenta_destino'] if clase == 'recibida' else otra.cuenta_destino
    otra.tipo = 'transferencia'
    otra.cuenta_origen, otra.cuenta_destino = origen, destino
    otra.nombre = f'Transferencia a {destino.nombre}'
    otra.save()
    otra.transaccion_categorias.all().delete()
    return otra


def registrar(mensaje, datos, cuentas, hoy):
    """Crea la transacción de un mensaje entendido. Devuelve el motivo si no se pudo."""
    campos, motivo = plan_de_registro(mensaje.usuario, datos, cuentas, billetera(mensaje.remitente, mensaje.texto), hoy)
    if not campos:
        return motivo
    with db_transaction.atomic():
        trans = unir_con_contraparte(campos, datos['clase'])
        if not trans:
            trans = Transaccion.objects.create(**campos, notas='Registrada automáticamente desde un SMS del banco.')
            cats = categorias_aprendidas(mensaje.usuario, trans.nombre, trans.tipo)
            TransaccionCategoria.objects.bulk_create([
                TransaccionCategoria(transaccion=trans, categoria_id=c) for c in cats
            ])
        mensaje.transaccion = trans
        mensaje.estado = 'registrado'
        mensaje.motivo = ''
        mensaje.save()
    return ''


def procesar_sms(usuario, remitente, texto):
    """
    Punto de entrada del atajo. Devuelve (mensaje, creado).
    creado=False si el mismo SMS ya había llegado antes.
    """
    texto = (texto or '').strip()
    remitente = (remitente or '').strip()[:40]
    hoy = timezone.localdate()
    h = huella(remitente, texto)

    existente = MensajeBanco.objects.filter(usuario=usuario, huella=h).first()
    if existente:
        return existente, False

    if PALABRAS_SEGURIDAD.search(texto) and not con_patrones(texto):
        # Códigos y claves: no se guarda el texto
        msg = MensajeBanco(usuario=usuario, remitente=remitente, texto='(mensaje de seguridad, no se guarda)',
                           huella=h, estado='descartado', motivo='Mensaje de seguridad.')
    else:
        datos, metodo, motivo = entender(remitente, texto)
        msg = MensajeBanco(usuario=usuario, remitente=remitente, texto=enmascarar(texto), huella=h,
                           metodo=metodo, datos=datos or {}, motivo=motivo)
        if datos and datos.get('clase') == 'otro':
            msg.estado = 'descartado'
    try:
        msg.save()
    except IntegrityError:
        # Llegó dos veces al mismo tiempo
        return MensajeBanco.objects.get(usuario=usuario, huella=h), False

    if msg.datos.get('monto') and msg.estado == 'pendiente':
        cuentas = list(Cuenta.objects.filter(usuario=usuario, activa=True))
        motivo = registrar(msg, msg.datos, cuentas, hoy)
        if motivo:
            msg.motivo = motivo
            msg.save(update_fields=['motivo'])
    return msg, True


def reprocesar_pendientes(usuario):
    """Tras asignar una terminación a una cuenta, registra lo que estaba esperando."""
    cuentas = list(Cuenta.objects.filter(usuario=usuario, activa=True))
    hoy = timezone.localdate()
    registrados = 0
    for msg in MensajeBanco.objects.filter(usuario=usuario, estado='pendiente').exclude(datos={}):
        if not msg.datos.get('monto'):
            continue
        motivo = registrar(msg, msg.datos, cuentas, hoy)
        if motivo:
            if motivo != msg.motivo:
                msg.motivo = motivo
                msg.save(update_fields=['motivo'])
        else:
            registrados += 1
    return registrados


def resumen_para_atajo(msg):
    """Texto corto para la notificación del iPhone."""
    if msg.estado == 'registrado' and msg.transaccion:
        t = msg.transaccion
        monto = f'${t.monto:,.0f}'.replace(',', '.')
        return f'Registrado: {monto} · {t.nombre}'
    if msg.estado == 'descartado':
        return 'Ignorado: no es un movimiento.'
    return f'Por revisar en FinTracker: {msg.motivo or "falta un dato"}'

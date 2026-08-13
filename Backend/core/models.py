# Modelos principales de FinTracker
from django.db import models
from django.contrib.auth.models import User


class PerfilUsuario(models.Model):
    """Perfil extendido del usuario — uno por cada User de Django"""

    usuario = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='perfil',
    )
    # PIN de respaldo hasheado — nunca en texto plano
    pin_hash = models.CharField(max_length=256, blank=True, default='')
    # Día del mes en que resetea el período (1 = mes calendario, 15 = del 15 al 15)
    periodo_inicio = models.PositiveSmallIntegerField(default=1)
    creado_en = models.DateTimeField(auto_now_add=True)
    # Challenge temporal de WebAuthn — se sobreescribe en cada intento
    webauthn_challenge = models.CharField(max_length=256, blank=True, default='')

    class Meta:
        verbose_name = 'Perfil de usuario'
        verbose_name_plural = 'Perfiles de usuario'

    def __str__(self):
        return f'Perfil de {self.usuario.username}'


class Cuenta(models.Model):
    """Cuenta bancaria, de efectivo o ahorro — separada por usuario"""

    TIPOS = [
        ('activo', 'Activo'),
        ('pasivo', 'Pasivo'),
    ]

    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='cuentas',
    )
    nombre = models.CharField(max_length=100)
    tipo = models.CharField(max_length=20, choices=TIPOS, default='activo')
    balance_inicial = models.BigIntegerField(default=0)  # COP sin decimales
    color_hex = models.CharField(max_length=7, default='#3A86FF')
    activa = models.BooleanField(default=True)
    creada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nombre']
        unique_together = ['usuario', 'nombre']
        verbose_name = 'Cuenta'
        verbose_name_plural = 'Cuentas'

    def __str__(self):
        return f'{self.nombre} ({self.usuario.username})'

    @property
    def balance_actual(self):
        """Calcula el balance real sumando todas las transacciones"""
        from django.db.models import Sum

        entradas = self.transacciones_destino.aggregate(
            total=Sum('monto')
        )['total'] or 0

        salidas = self.transacciones_origen.aggregate(
            total=Sum('monto')
        )['total'] or 0

        return self.balance_inicial + entradas - salidas


class Categoria(models.Model):
    """
    Categoría de presupuesto — separada por usuario.
    Samuel arranca con las 14 categorías traducidas al español.
    """

    TIPOS = [
        ('ingreso', 'Ingreso'),
        ('gasto', 'Gasto'),
        ('ahorro', 'Ahorro'),
    ]

    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='categorias',
    )
    nombre = models.CharField(max_length=100)
    tipo = models.CharField(max_length=20, choices=TIPOS)
    # Nullable — arrancan vacíos, Samuel los llena cuando quiera
    presupuesto_mensual = models.BigIntegerField(null=True, blank=True)
    presupuesto_semanal = models.BigIntegerField(null=True, blank=True)
    color_hex = models.CharField(max_length=7, default='#3A86FF')
    activa = models.BooleanField(default=True)

    class Meta:
        ordering = ['tipo', 'nombre']
        unique_together = ['usuario', 'nombre']
        verbose_name = 'Categoría'
        verbose_name_plural = 'Categorías'

    def __str__(self):
        return f'{self.nombre} ({self.tipo}) — {self.usuario.username}'


class Transaccion(models.Model):
    """Transacción financiera — gasto, ingreso o ahorro"""

    TIPOS = [
        ('gasto', 'Gasto'),
        ('ingreso', 'Ingreso'),
        ('ahorro', 'Ahorro'),
    ]

    nombre = models.CharField(max_length=200)
    monto = models.BigIntegerField()  # COP, siempre positivo
    fecha = models.DateField()
    tipo = models.CharField(max_length=20, choices=TIPOS)

    # De dónde sale la plata — vacío si es ingreso nuevo
    cuenta_origen = models.ForeignKey(
        Cuenta,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='transacciones_origen',
    )

    # A dónde entra la plata — vacío si es gasto
    cuenta_destino = models.ForeignKey(
        Cuenta,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='transacciones_destino',
    )

    # Multi-categoría: ej. "Novia + Comida y bebidas"
    categorias = models.ManyToManyField(
        Categoria,
        through='TransaccionCategoria',
        blank=True,
    )

    notas = models.TextField(blank=True, default='')
    creada_en = models.DateTimeField(auto_now_add=True)
    actualizada_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha', '-creada_en']
        verbose_name = 'Transacción'
        verbose_name_plural = 'Transacciones'

    def __str__(self):
        return f'{self.nombre} — ${self.monto:,}'

    @property
    def usuario(self):
        """Infiere el usuario desde las cuentas asociadas"""
        if self.cuenta_origen:
            return self.cuenta_origen.usuario
        if self.cuenta_destino:
            return self.cuenta_destino.usuario
        return None


class TransaccionCategoria(models.Model):
    """Tabla intermedia explícita entre Transaccion y Categoria"""

    transaccion = models.ForeignKey(
        Transaccion,
        on_delete=models.CASCADE,
        related_name='transaccion_categorias',
    )
    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.CASCADE,
        related_name='transaccion_categorias',
    )

    class Meta:
        unique_together = ['transaccion', 'categoria']
        verbose_name = 'Categoría de transacción'
        verbose_name_plural = 'Categorías de transacciones'

    def __str__(self):
        return f'{self.transaccion} → {self.categoria}'


class TransaccionRecurrente(models.Model):
    """
    Plantilla para transacciones que se repiten.
    SIN datos precargados — Samuel las crea manualmente.
    """

    FRECUENCIAS = [
        ('diaria', 'Diaria'),
        ('semanal', 'Semanal'),
        ('quincenal', 'Quincenal'),
        ('mensual', 'Mensual'),
    ]

    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='recurrentes',
    )
    nombre = models.CharField(max_length=200)
    monto = models.BigIntegerField()
    tipo = models.CharField(max_length=20, choices=Transaccion.TIPOS)
    categoria = models.ForeignKey(
        Categoria,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    cuenta_origen = models.ForeignKey(
        Cuenta,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='recurrentes_origen',
    )
    cuenta_destino = models.ForeignKey(
        Cuenta,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='recurrentes_destino',
    )
    frecuencia = models.CharField(
        max_length=20,
        choices=FRECUENCIAS,
        default='mensual',
    )
    # Día de ejecución: para mensual/quincenal = día del mes (1-28),
    # para semanal = día de la semana (1=lunes … 7=domingo).
    # Nulo = sin auto-registro (solo manual).
    dia_ejecucion = models.PositiveSmallIntegerField(null=True, blank=True)
    # Fecha de la última ejecución automática
    ultima_ejecucion = models.DateField(null=True, blank=True)
    activa = models.BooleanField(default=True)
    creada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nombre']
        verbose_name = 'Transacción recurrente'
        verbose_name_plural = 'Transacciones recurrentes'

    def __str__(self):
        return f'{self.nombre} ({self.frecuencia}) — {self.usuario.username}'


class UserCredential(models.Model):
    """Almacena las llaves públicas de WebAuthn para el login biométrico"""
    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='credentials',
    )
    credential_id = models.BinaryField(unique=True)
    public_key = models.BinaryField()
    sign_count = models.IntegerField(default=0)
    nickname = models.CharField(max_length=100, blank=True, default='Dispositivo desconocido')
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Credencial de usuario'
        verbose_name_plural = 'Credenciales de usuario'

    def __str__(self):
        return f'Llave {self.nickname} — {self.usuario.username}'
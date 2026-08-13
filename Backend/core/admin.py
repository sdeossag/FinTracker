# Registro de modelos en el panel de administración de Django
from django.contrib import admin
from .models import (
    PerfilUsuario,
    Cuenta,
    Categoria,
    Transaccion,
    TransaccionCategoria,
    TransaccionRecurrente,
)


@admin.register(PerfilUsuario)
class PerfilUsuarioAdmin(admin.ModelAdmin):
    list_display = ['usuario', 'periodo_inicio', 'creado_en']
    readonly_fields = ['creado_en']


@admin.register(Cuenta)
class CuentaAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'usuario', 'tipo', 'balance_inicial', 'activa']
    list_filter = ['tipo', 'activa', 'usuario']
    search_fields = ['nombre', 'usuario__username']


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'usuario', 'tipo', 'presupuesto_mensual', 'activa']
    list_filter = ['tipo', 'activa', 'usuario']
    search_fields = ['nombre', 'usuario__username']


class TransaccionCategoriaInline(admin.TabularInline):
    model = TransaccionCategoria
    extra = 1


@admin.register(Transaccion)
class TransaccionAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'monto', 'fecha', 'tipo', 'cuenta_origen', 'cuenta_destino']
    list_filter = ['tipo', 'fecha']
    search_fields = ['nombre', 'notas']
    inlines = [TransaccionCategoriaInline]
    readonly_fields = ['creada_en', 'actualizada_en']


@admin.register(TransaccionRecurrente)
class TransaccionRecurrenteAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'usuario', 'monto', 'tipo', 'frecuencia', 'activa']
    list_filter = ['frecuencia', 'activa', 'usuario']
    search_fields = ['nombre', 'usuario__username']
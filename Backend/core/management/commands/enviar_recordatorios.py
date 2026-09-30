from django.core.management.base import BaseCommand

from core.notificaciones import enviar_recordatorios


class Command(BaseCommand):
    help = 'Envía los recordatorios de corte y pago de tarjetas que tocan hoy.'

    def handle(self, *args, **opciones):
        self.stdout.write(str(enviar_recordatorios()))

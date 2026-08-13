from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_transaccionrecurrente_dia_ejecucion_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='perfilusuario',
            name='webauthn_challenge',
            field=models.CharField(blank=True, default='', max_length=256),
        ),
    ]

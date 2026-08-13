FROM python:3.12-slim

WORKDIR /app

# Dependencias del sistema para psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput

EXPOSE 8080

# Aplica migraciones pendientes antes de iniciar el servidor
CMD python manage.py migrate --noinput && \
    gunicorn fintracker_backend.wsgi:application \
    --bind 0.0.0.0:8080 --workers 2 --timeout 60

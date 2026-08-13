# FinTracker

PWA de finanzas personales diseñada para Colombia 🇨🇴. Registra ingresos, gastos y ahorros, gestiona cuentas, visualiza gráficas de análisis y automatiza movimientos recurrentes.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite + React Router v7 |
| Backend | Django 6 + Django REST Framework |
| Auth | JWT (SimpleJWT) + WebAuthn/FIDO2 |
| Base de datos | SQLite (dev) → PostgreSQL/Neon (prod) |
| PWA | vite-plugin-pwa + Workbox |
| Deploy | Vercel (frontend) + Fly.io (backend) |

## Funcionalidades

- **Cuentas** — activos y pasivos con balance en tiempo real
- **Transacciones** — ingresos, gastos y ahorros con categorías y búsqueda
- **Recurrentes** — plantillas de movimientos repetitivos con auto-registro diario
- **Presupuesto** — límite por categoría con barra de progreso y alertas
- **Gráficas** — barras mensuales, donut por categoría, variación porcentual
- **Notificaciones PWA** — alertas de recurrentes y presupuesto excedido
- **NavBar Liquid Glass** — efecto glass con física de arrastre inspirado en iOS 26
- **Biometría** — login con huella / Face ID vía WebAuthn/FIDO2

## Estructura del proyecto

```
FinTracker/
├── Backend/
│   ├── core/               # App Django principal
│   │   ├── models.py       # Cuenta, Transaccion, Categoria, Presupuesto, Recurrente
│   │   ├── views.py        # ViewSets + endpoints custom (analytics, resumen, webauthn)
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── fintracker_backend/ # Configuración Django
│   ├── manage.py
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── paginas/        # Inicio, Transacciones, Cuentas, Graficas, Presupuesto,
    │   │                   # Recurrentes, Configuracion, NuevaTransaccion, Onboarding…
    │   ├── componentes/    # NavBar (liquid glass), ProtectedRoute
    │   ├── utils/          # notificaciones.js
    │   └── api.js          # Axios + interceptor JWT auto-refresh
    ├── public/
    └── package.json
```

## Instalación local

### Backend

```bash
cd Backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

La app corre en `http://localhost:5173` y espera el API en `http://localhost:8000`.

## Variables de entorno

Crea `Backend/.env`:

```env
SECRET_KEY=tu_secret_key_aqui
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
DATABASE_URL=sqlite:///db.sqlite3  # o postgres://... en producción
```

## Despliegue

Ver [DEPLOY.md](./DEPLOY.md) para la guía completa de Vercel + Fly.io + Neon.

## Licencia

MIT — uso personal.

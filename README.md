# FinTracker

A personal finance tracking Progressive Web App (PWA) built for Colombia, with iOS-inspired dark UI, biometric authentication, smart push notifications, and recurring transaction automation. Built with Django REST Framework and React 19.

---

## Features

### Dashboard (Inicio)
- Monthly summary: income, expenses, and savings at a glance
- Account balances listed with color coding
- Quick access to log a new transaction
- Push notification toggle with three states: active, inactive, and browser-blocked

### Transactions
- Log income, expenses, and savings with amount, category, account, date, and notes
- Edit and delete transactions
- Monthly transaction list with color-coded type indicators
- COP currency formatting via `Intl.NumberFormat` throughout the app

### Accounts (Cuentas)
- Create and manage multiple accounts (checking, savings, cash, investment)
- Custom color per account
- Initial balance support
- Real-time balance updates as transactions are logged

### Budget (Presupuesto)
- Budget categories for expenses, income, and savings
- Monthly spending per category tracked against budget limit
- Progress bars showing used vs. remaining budget
- Custom color per category
- Filter by type (gastos / ingresos / ahorros)

### Recurring Transactions (Recurrentes)
- Schedule recurring transactions with frequencies: daily, weekly, biweekly, or monthly
- Day-of-week targeting for weekly transactions
- Day-of-month targeting for monthly transactions
- Auto-registration runs on backend when user opens the app — missed transactions are logged automatically
- Color-coded by transaction type

### Charts (Gráficas)
- Period selector: current month, 3 months, 6 months, full year
- Income vs. expenses vs. savings metric cards with period-over-period percentage change
- Spending breakdown by category with bar chart
- Income breakdown by category
- Compact number formatting (1.2M, 450K) for chart axes

### Biometric Authentication (WebAuthn)
- Register fingerprint / Face ID / device PIN via WebAuthn Passkeys (FIDO2)
- Multiple credentials per account with custom device nicknames
- One-tap biometric login — no password required after initial setup
- Rename and delete saved credentials
- Base64url encoding utilities for WebAuthn challenge/response handling

### Push Notifications
- Browser push notifications via Web Push API
- Permission request flow with graceful handling of denied state
- Daily reminder when the app is opened (if subscribed)

### Onboarding
- Guided first-run flow collecting financial profile data
- Sets up the user's starting point before unlocking the main app
- Skipped automatically on subsequent logins

### Authentication
- JWT access + refresh tokens with automatic silent refresh via Axios interceptors
- Auto-logout on failed refresh
- Protected routes: all main pages redirect to `/login` if unauthenticated
- Email + password registration and login

### Settings (Configuración)
- User profile management
- App preferences

---

## Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Framework | Django + Django REST Framework |
| Auth | SimpleJWT + WebAuthn (django-webauthn) |
| Database | SQLite (local) |
| Hosting | Railway / Render |

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 19 + Vite |
| Routing | React Router v7 |
| HTTP client | Axios with JWT interceptor |
| Styling | Custom CSS, iOS-inspired dark theme, no CSS framework |
| Hosting | Vercel |

---

## Project Structure

```
FinTracker/
└── frontend/
    ├── src/
    │   ├── paginas/
    │   │   ├── Inicio.jsx             # Dashboard — balances, monthly summary
    │   │   ├── Transacciones.jsx      # Transaction list
    │   │   ├── NuevaTransaccion.jsx   # Log a new transaction
    │   │   ├── EditarTransaccion.jsx  # Edit existing transaction
    │   │   ├── Cuentas.jsx            # Account management
    │   │   ├── Presupuesto.jsx        # Budget categories
    │   │   ├── Recurrentes.jsx        # Recurring transactions
    │   │   ├── Graficas.jsx           # Charts and analytics
    │   │   ├── Biometria.jsx          # WebAuthn passkey management
    │   │   ├── Configuracion.jsx      # Settings
    │   │   ├── Login.jsx              # Login
    │   │   ├── Registro.jsx           # Registration
    │   │   └── Onboarding.jsx         # First-run flow
    │   ├── componentes/
    │   │   ├── NavBar.jsx             # Bottom nav with Liquid Glass spring physics
    │   │   ├── ProtectedRoute.jsx     # Auth guard component
    │   │   └── Onboarding.jsx         # Onboarding component
    │   ├── utils/
    │   │   ├── notificaciones.js      # Web Push subscribe/unsubscribe/permission
    │   │   └── webauthn.js            # Base64url encode/decode for WebAuthn
    │   └── api.js                     # Axios instance + JWT interceptors + API helpers
    └── vite.config.js
```

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/token/` | Obtain JWT access + refresh tokens |
| POST | `/api/token/refresh/` | Refresh access token |
| POST | `/api/registro/` | Register new user |
| GET/PUT | `/api/perfil/` | User profile |

### Accounts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/cuentas/` | List / create accounts |
| GET/PUT/DELETE | `/api/cuentas/<id>/` | Account detail |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/transacciones/` | List / create transactions |
| GET/PUT/DELETE | `/api/transacciones/<id>/` | Transaction detail |
| GET | `/api/transacciones/resumen-mes/` | Monthly income/expense/savings summary |

### Categories & Budget
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/categorias/` | List / create budget categories |
| GET/PUT/DELETE | `/api/categorias/<id>/` | Category detail |

### Recurring Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/recurrentes/` | List / create recurring transactions |
| GET/PUT/DELETE | `/api/recurrentes/<id>/` | Recurring transaction detail |
| POST | `/api/recurrentes/procesar/` | Auto-register pending recurring transactions |

### WebAuthn
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/webauthn/register/options/` | Get registration challenge |
| POST | `/api/webauthn/register/verify/` | Verify and save credential |
| GET | `/api/webauthn/credentials/` | List saved credentials |
| PUT | `/api/webauthn/credentials/<id>/` | Rename credential |
| DELETE | `/api/webauthn/credentials/<id>/` | Remove credential |
| GET | `/api/webauthn/login/options/` | Get authentication challenge |
| POST | `/api/webauthn/login/verify/` | Verify biometric login |

### Push Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/push/subscribe/` | Register device |
| DELETE | `/api/push/unsubscribe/` | Remove subscription |
| POST | `/api/push/check/` | Trigger daily notification |

---

## Environment Variables

### Backend
```env
SECRET_KEY=
DEBUG=False
ALLOWED_HOSTS=
DATABASE_URL=
```

### Frontend (Vercel)
```env
VITE_API_URL=https://your-backend.railway.app/api
VITE_VAPID_PUBLIC_KEY=
```

---

## Local Development

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local    # set VITE_API_URL=http://localhost:8000/api
npm run dev
```

---

## Design Notes

- **Liquid Glass NavBar**: the bottom navigation bar uses spring physics — the active indicator animates with a bounce easing that follows the selected tab, inspired by iOS 26 design language
- **Colombian focus**: all currency values are formatted in COP using `Intl.NumberFormat('es-CO')`, and seed data includes typical Colombian accounts (Nequi, Bancolombia, Efectivo)
- **Dark-first**: the entire UI is built for dark mode with CSS custom properties; no third-party component library
- **Bottom-sheet modals**: create/edit forms slide up from the bottom of the screen on mobile, matching native app patterns

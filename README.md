# FinTracker

A personal finance tracking Progressive Web App (PWA) built for Colombia, with iOS-inspired dark UI, biometric authentication via WebAuthn Passkeys, smart push notifications, and recurring transaction automation. Built with Django REST Framework and React 19.

---

## Features

### Dashboard (Inicio)
- Monthly summary: total income, expenses, and savings at a glance
- Account balances listed with custom color coding
- Quick-access button to log a new transaction
- Push notification toggle with three visual states: active, inactive, and browser-blocked

### Transactions
- Log income, expenses, and savings with amount, category, account, date, and notes
- Multi-category support per transaction (e.g., "Novia + Comida y bebidas")
- Edit and delete existing transactions
- Monthly list with color-coded type indicators (green / red / blue)
- COP formatting via `Intl.NumberFormat('es-CO')` throughout

### Accounts (Cuentas)
- Create and manage multiple accounts (activo / pasivo)
- Custom color per account
- Initial balance support
- `balance_actual` computed dynamically from all linked transactions — no stored running total

### Budget (Presupuesto)
- Budget categories for expenses, income, and savings with monthly and weekly limits
- Real spending per category tracked against budget
- Progress bars showing used vs. remaining budget
- Custom color per category; filter view by type

### Recurring Transactions (Recurrentes)
- Schedule recurring transactions with frequencies: daily, weekly, biweekly, or monthly
- Day-of-week targeting for weekly recurrences (1 = Monday … 7 = Sunday)
- Day-of-month targeting for monthly and biweekly recurrences
- Auto-registration: backend logs pending transactions automatically when triggered; tracks `ultima_ejecucion` to avoid duplicates
- Color-coded by transaction type in the UI

### Charts (Gráficas)
- Period selector: current month, 3 months, 6 months, full year
- Income / expenses / savings metric cards with period-over-period percentage change
- Spending breakdown by category (bar chart)
- Income breakdown by category
- Compact number formatting (1.2M, 450K) for chart axes

### Biometric Authentication (WebAuthn / Passkeys)
- Register fingerprint, Face ID, or device PIN via WebAuthn FIDO2 standard
- Multiple credentials per account with custom device nicknames
- One-tap biometric login — no password required after initial setup
- Rename and delete saved credentials
- Server-side: challenge generated per attempt, stored in `PerfilUsuario.webauthn_challenge`, verified with `webauthn` library
- Client-side: base64url encode/decode helpers for WebAuthn challenge and response buffers

### Push Notifications
- Browser Web Push API integration
- Permission request flow with graceful handling of denied state
- Daily reminder on app open (if subscribed)
- Bell icon in dashboard reflects current permission state

### Onboarding
- Guided first-run flow after registration
- Collects financial profile data to personalize the experience
- Automatically skipped on subsequent logins via `onboarding_completo` flag

### Authentication
- Email + password registration and login
- JWT access + refresh tokens with automatic silent refresh via Axios interceptors
- Auto-logout and redirect to `/login` on failed token refresh
- Protected routes via `ProtectedRoute` component
- Google OAuth configured (django-allauth)
- Backup PIN support (stored hashed in `PerfilUsuario.pin_hash`)
- Password change endpoint

---

## Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Framework | Django + Django REST Framework |
| Auth | SimpleJWT + WebAuthn (FIDO2) + django-allauth (Google OAuth) |
| Database | SQLite (development) / PostgreSQL via `DATABASE_URL` (production) |
| Static files | WhiteNoise |
| Hosting | Render (auto-detects `RENDER_EXTERNAL_HOSTNAME`) |

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 19 + Vite |
| Routing | React Router v7 |
| HTTP client | Axios with JWT interceptor |
| Styling | Custom CSS — iOS-inspired dark theme, no CSS framework |
| Hosting | Vercel |

---

## Project Structure

```
FinTracker/
├── Backend/
│   ├── core/
│   │   ├── models.py          # PerfilUsuario, Cuenta, Categoria, Transaccion,
│   │   │                      # TransaccionCategoria, TransaccionRecurrente,
│   │   │                      # UserCredential
│   │   ├── views.py           # ViewSets + WebAuthn + Perfil + Registro
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   └── migrations/        # 5 migrations
│   └── fintracker_backend/
│       ├── settings.py
│       └── urls.py
└── frontend/
    ├── src/
    │   ├── paginas/
    │   │   ├── Inicio.jsx             # Dashboard
    │   │   ├── Transacciones.jsx      # Transaction list
    │   │   ├── NuevaTransaccion.jsx   # Log a new transaction
    │   │   ├── EditarTransaccion.jsx  # Edit transaction
    │   │   ├── Cuentas.jsx            # Account management
    │   │   ├── Presupuesto.jsx        # Budget categories
    │   │   ├── Recurrentes.jsx        # Recurring transactions
    │   │   ├── Graficas.jsx           # Charts and analytics
    │   │   ├── Biometria.jsx          # WebAuthn passkey management
    │   │   ├── Configuracion.jsx      # Settings
    │   │   ├── Login.jsx
    │   │   ├── Registro.jsx
    │   │   └── Onboarding.jsx
    │   ├── componentes/
    │   │   ├── NavBar.jsx             # Bottom nav — Liquid Glass spring physics
    │   │   └── ProtectedRoute.jsx     # Auth guard
    │   ├── utils/
    │   │   ├── notificaciones.js      # Web Push subscribe/unsubscribe/permission
    │   │   └── webauthn.js            # Base64url encode/decode for WebAuthn
    │   └── api.js                     # Axios instance + JWT interceptors
    └── vite.config.js
```

---

## Data Models

### PerfilUsuario
Extends Django's built-in `User` with a OneToOne relationship.

| Field | Type | Description |
|-------|------|-------------|
| `pin_hash` | CharField | Hashed backup PIN |
| `periodo_inicio` | PositiveSmallIntegerField | Day of month for period reset (1 = calendar month) |
| `webauthn_challenge` | CharField | Temporary challenge for in-progress WebAuthn ceremony |

### Cuenta (Account)
| Field | Type | Description |
|-------|------|-------------|
| `nombre` | CharField | Account name (unique per user) |
| `tipo` | CharField | `activo` or `pasivo` |
| `balance_inicial` | BigIntegerField | Starting balance in COP (no decimals) |
| `color_hex` | CharField | UI color |
| `balance_actual` | property | Computed: `balance_inicial + entradas − salidas` |

### Transaccion
| Field | Type | Description |
|-------|------|-------------|
| `nombre` | CharField | Description |
| `monto` | BigIntegerField | Amount in COP, always positive |
| `tipo` | CharField | `gasto`, `ingreso`, or `ahorro` |
| `cuenta_origen` | FK → Cuenta | Source account (null for new income) |
| `cuenta_destino` | FK → Cuenta | Destination account (null for expenses) |
| `categorias` | M2M → Categoria | Via `TransaccionCategoria` (multi-category) |

### Categoria
| Field | Type | Description |
|-------|------|-------------|
| `nombre` | CharField | Category name (unique per user) |
| `tipo` | CharField | `ingreso`, `gasto`, or `ahorro` |
| `presupuesto_mensual` | BigIntegerField | Monthly budget limit |
| `presupuesto_semanal` | BigIntegerField | Weekly budget limit |

### TransaccionRecurrente
| Field | Type | Description |
|-------|------|-------------|
| `frecuencia` | CharField | `diaria`, `semanal`, `quincenal`, `mensual` |
| `dia_ejecucion` | PositiveSmallIntegerField | Day of week (1-7) or day of month (1-28) |
| `ultima_ejecucion` | DateField | Last auto-registration date — prevents duplicates |

### UserCredential (WebAuthn)
| Field | Type | Description |
|-------|------|-------------|
| `credential_id` | BinaryField | FIDO2 credential ID (unique) |
| `public_key` | BinaryField | COSE-encoded public key |
| `sign_count` | IntegerField | Replay-attack counter |
| `nickname` | CharField | User-assigned device name |

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/token/` | Obtain JWT access + refresh tokens |
| POST | `/api/token/refresh/` | Refresh access token |
| POST | `/api/registro/` | Register new user |
| GET/PUT | `/api/perfil/` | User profile |
| POST | `/api/cambiar-password/` | Change password |

### Accounts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/cuentas/` | List / create accounts |
| GET/PUT/PATCH/DELETE | `/api/cuentas/<id>/` | Account detail |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/transacciones/` | List / create transactions |
| GET/PUT/PATCH/DELETE | `/api/transacciones/<id>/` | Transaction detail |
| GET | `/api/transacciones/resumen-mes/` | Monthly income/expense/savings totals |

### Categories & Budget
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/categorias/` | List / create categories |
| GET/PUT/PATCH/DELETE | `/api/categorias/<id>/` | Category detail |

### Recurring Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/recurrentes/` | List / create recurring templates |
| GET/PUT/PATCH/DELETE | `/api/recurrentes/<id>/` | Recurring detail |
| POST | `/api/recurrentes/<id>/procesar/` | Manually trigger auto-registration |

### WebAuthn (Passkeys)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/webauthn/register-options/` | Get registration challenge |
| POST | `/api/webauthn/register-verify/` | Verify and save credential |
| GET | `/api/webauthn/credentials/` | List saved credentials |
| PUT/DELETE | `/api/webauthn/credentials/<id>/` | Rename or delete credential |
| GET | `/api/webauthn/auth-options/` | Get authentication challenge |
| POST | `/api/webauthn/auth-verify/` | Verify biometric login → returns JWT |

---

## Environment Variables

### Backend
```env
SECRET_KEY=
DEBUG=False
ALLOWED_HOSTS=your-domain.com
DATABASE_URL=              # PostgreSQL in production; omit for SQLite in dev
```

### Frontend (Vercel)
```env
VITE_API_URL=https://your-backend.onrender.com/api
VITE_VAPID_PUBLIC_KEY=
```

---

## Local Development

### Backend
```bash
cd Backend
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
# create .env.local with: VITE_API_URL=http://localhost:8000/api
npm run dev
```

---

## Design Notes

- **Liquid Glass NavBar**: the bottom navigation uses spring physics — the active indicator animates with a bounce easing that follows the selected tab, inspired by iOS 26 design language
- **Colombian focus**: all currency is stored as `BigIntegerField` (COP has no decimal places), formatted with `Intl.NumberFormat('es-CO')`, and seed data includes typical Colombian accounts (Nequi, Bancolombia, Efectivo)
- **Dark-first**: the entire UI is built for dark mode using CSS custom properties; no third-party component library
- **Bottom-sheet modals**: create/edit forms slide up from the bottom of the screen, matching native mobile app patterns
- **Balance computation**: account balances are never stored — `balance_actual` is a Django property computed on every request by aggregating all linked transactions, ensuring it is always consistent with the transaction log

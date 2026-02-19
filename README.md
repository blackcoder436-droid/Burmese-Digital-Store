# Burmese Digital Store

> Myanmar's trusted digital store for VPN accounts, streaming subscriptions, gaming credits, and more.

**Domain:** [burmesedigital.store](https://burmesedigital.store)

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + React 18
- **Styling:** Tailwind CSS (Dark Cyberpunk Theme)
- **Backend:** Next.js API Routes
- **Database:** MongoDB + Mongoose
- **Auth:** JWT (HttpOnly Cookies)
- **OCR:** Tesseract.js (Payment Screenshot Verification)
- **Icons:** Lucide React

## Features

- 🛡️ **Role-Based Auth** — Admin (manage products/orders) & User (browse/order)
- 🔍 **OCR Payment Verification** — Auto-extract Transaction ID & Amount from Kpay/WaveMoney screenshots
- 📦 **Digital Inventory** — Auto-deliver serial keys/login details upon payment approval
- 💳 **Local Payments** — KBZ Pay, WaveMoney, UAB Pay, AYA Pay
- 📱 **Mobile First** — Responsive design optimized for phone users
- 🔒 **Security** — Rate limiting, input validation, JWT auth, HttpOnly cookies
- ⚡ **Instant Delivery** — Keys delivered immediately after payment verification

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

**Required variables:**
- `MONGODB_URI` — Your MongoDB connection string
- `JWT_SECRET` — A strong random secret key

**Security-critical production variables:**
- `ENABLE_ADMIN_SEED=false` — keep disabled except a short one-time bootstrap window
- `RATE_LIMIT_FAIL_CLOSED=true` — fail safely if distributed rate limiter is unavailable
- `ADMIN_SECRET` — required only when temporary bootstrap endpoint is enabled
- `VPN_SERVER_ALLOWED_HOSTS` — allowlist for outbound 3xUI panel domains (SSRF hardening)

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 3.1 Pre-commit Lint Hook (Husky + lint-staged)

This project runs lint checks before each commit on staged JS/TS files.

- Installed tools: `husky`, `lint-staged`
- Hook file: `.husky/pre-commit`
- Command run on staged files: `eslint --max-warnings=0 --fix`

If hooks are missing after a fresh clone, run:

```bash
npm run prepare
```

### 4. Create Admin Account

1. Register a normal account at `/register`
2. In MongoDB, update the user's `role` field to `"admin"`

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   ├── shop/               # Shop & product detail pages
│   ├── vpn/                # VPN plans page
│   ├── contact/            # Contact page
│   ├── login/              # Login page
│   ├── register/           # Register page
│   ├── account/            # User dashboard & orders
│   ├── admin/              # Admin dashboard, products, orders
│   └── api/                # API routes
│       ├── auth/           # Login, register, me
│       ├── products/       # Public products API
│       ├── orders/         # User orders API
│       ├── ocr/            # OCR verification API
│       └── admin/          # Admin-only APIs
├── components/             # Reusable UI components
│   ├── layout/             # Navbar, Footer
│   ├── ProductCard.tsx     # Product card component
│   ├── OrderStatus.tsx     # Order stepper UI
│   ├── MyKeys.tsx          # Delivered keys display
│   └── PaymentUpload.tsx   # Screenshot upload + OCR
├── lib/                    # Utility libraries
│   ├── mongodb.ts          # MongoDB connection
│   ├── auth.ts             # JWT auth utilities
│   ├── ocr.ts              # Tesseract.js OCR engine
│   └── rateLimit.ts        # API rate limiter
├── models/                 # Mongoose schemas
│   ├── User.ts
│   ├── Product.ts
│   └── Order.ts
├── types/                  # TypeScript types
│   └── index.ts
└── middleware.ts            # Route protection middleware
```

## Sitemap

| Page | Route | Access |
|------|-------|--------|
| Home | `/` | Public |
| VPN Plans | `/vpn` | Public |
| Shop | `/shop` | Public |
| Product Detail | `/shop/[id]` | Public |
| Contact | `/contact` | Public |
| Login | `/login` | Public |
| Register | `/register` | Public |
| My Account | `/account` | Auth |
| My Orders | `/account/orders` | Auth |
| Admin Dashboard | `/admin` | Admin |
| Admin Products | `/admin/products` | Admin |
| Admin Orders | `/admin/orders` | Admin |

## Security Notes

- ⚠️ **Never hardcode secrets** — Use `.env.local` for all sensitive values
- Rate limiting on all API endpoints (DDoS protection)
- JWT stored in HttpOnly cookies (XSS protection)
- Password hashing with bcrypt (12 rounds)
- Input validation on all routes
- Admin routes protected by middleware + server-side checks
- Keep `/api/admin/seed` disabled in production (`ENABLE_ADMIN_SEED=false`) after initial admin setup
- Use end-to-end TLS and Cloudflare SSL mode `Full (strict)` (do not use Flexible)

# Security Policy — Burmese Digital Store

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest (main branch) | ✅ Active |
| Previous releases | ❌ Not supported |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

### Contact

- **Email:** security@burmesedigital.store
- **Telegram:** @burmesedigitalstore (DM only, do NOT post in groups)

### What to Include

1. **Description** of the vulnerability
2. **Steps to reproduce** (detailed)
3. **Impact assessment** — what data/functionality is at risk
4. **Screenshots or proof-of-concept** (if applicable)
5. **Your contact info** for follow-up

### Response Timeline

| Phase | Timeframe |
|-------|-----------|
| Acknowledgment | Within 24 hours |
| Initial assessment | Within 48 hours |
| Status update | Within 5 business days |
| Fix deployed | Depends on severity (see below) |

### Severity-Based Fix Timeline

| Severity | Target Fix Time | Example |
|----------|----------------|---------|
| **Critical** | 24 hours | RCE, auth bypass, data leak |
| **High** | 72 hours | Privilege escalation, XSS with impact |
| **Medium** | 1 week | CSRF, information disclosure |
| **Low** | 2 weeks | Minor UX security issue |

## Security Best Practices (Users)

1. Use a **strong, unique password** (min 8 chars, mix of letters/numbers/symbols)
2. Never share your login credentials
3. Report suspicious activity on your account immediately
4. Log out from shared/public devices
5. Keep your browser updated

## Security Architecture Overview

### Authentication
- JWT-based authentication with `jose` (HS256, Edge Runtime compatible)
- Token versioning for instant invalidation on role/password changes
- Cookie: `__Host-auth-token` (production) with `Secure`, `HttpOnly`, `SameSite=Strict`
- Rate limiting on all auth endpoints (login, register, reset password)

### Data Protection
- Input sanitization on all user inputs (XSS, injection prevention)
- MongoDB ObjectId validation on all ID parameters
- SSRF protection with hostname allowlisting for VPN server connections
- File upload validation: magic bytes, MIME type, suspicious content scanning
- Payment screenshots quarantined until admin approval (S7)

### Infrastructure
- CSP headers with nonce-based script protection (production)
- HSTS with preload
- X-Frame-Options: DENY
- Rate limiting via Upstash Redis (fail-closed in production)
- Structured JSON logging with sensitive data redaction

### Fraud Detection
- Duplicate transaction ID detection
- Screenshot hash comparison (SHA-256)
- Amount-time suspicious pattern detection
- First-time buyer flagging
- High-amount order flagging with configurable thresholds

## Disclosure Policy

- We will not pursue legal action against researchers who follow responsible disclosure
- We will credit reporters (unless anonymity is requested)
- We ask that you do NOT publicly disclose until a fix is deployed
- Do NOT test against production with real user data

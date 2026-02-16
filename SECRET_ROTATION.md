# Secret Rotation Runbook — Burmese Digital Store

## Overview

This document provides step-by-step instructions for rotating all sensitive credentials used by the application. Rotate secrets when:

- A credential may have been exposed
- A team member leaves
- Periodic rotation schedule (every 90 days recommended)
- After a security incident

---

## 1. JWT_SECRET Rotation

**Impact:** All existing user sessions will be invalidated (users must re-login).

### Steps:

```bash
# 1. Generate new secret
openssl rand -hex 64

# 2. Update on server
ssh root@<droplet-ip>
cd /var/www/store
nano .env.local
# Replace JWT_SECRET=<old> with new value

# 3. Restart application
pm2 restart burmese-store

# 4. Verify
pm2 logs burmese-store --lines 20  # Check for startup errors
curl -s https://burmesedigital.store/api/auth/me  # Should return 401 (no session)
```

### Post-rotation:
- [ ] All users will need to re-login (expected behavior)
- [ ] Verify admin can login and access dashboard
- [ ] Monitor error logs for 30 minutes

---

## 2. ADMIN_SECRET Rotation

**Impact:** Only affects the one-time admin seed endpoint.

### Steps:

```bash
# 1. Generate new secret
openssl rand -hex 32

# 2. Update on server
nano .env.local
# Replace ADMIN_SECRET=<old> with new value
# Ensure ENABLE_ADMIN_SEED=false (should already be false in production)

# 3. Restart application
pm2 restart burmese-store
```

### Post-rotation:
- [ ] Verify `ENABLE_ADMIN_SEED=false` in production
- [ ] Old secret no longer works (test with curl if seed is enabled)

---

## 3. MongoDB Credentials Rotation

**Impact:** Application will lose DB connectivity during rotation. Plan for brief downtime.

### Steps:

```bash
# 1. Go to MongoDB Atlas dashboard
#    → Database Access → Edit user
#    → Change password → Auto-generate secure password

# 2. Update connection string on server
ssh root@<droplet-ip>
nano /var/www/store/.env.local
# Update MONGODB_URI with new password in connection string
# Format: mongodb+srv://<user>:<NEW_PASSWORD>@cluster.mongodb.net/dbname

# 3. Restart application
pm2 restart burmese-store

# 4. Verify
pm2 logs burmese-store --lines 20  # Check "MongoDB connected" message
curl -s https://burmesedigital.store/api/products  # Should return products
```

### Post-rotation:
- [ ] Verify application connects to DB successfully
- [ ] Check that orders, products, users pages load
- [ ] Monitor error logs for connection failures

---

## 4. Upstash Redis Credentials Rotation

**Impact:** Rate limiting may temporarily fall back to fail-closed (503 responses) during rotation if `RATE_LIMIT_FAIL_CLOSED=true`.

### Steps:

```bash
# 1. Go to Upstash Console → Redis → Your database
#    → Settings → Reset Password (or create new database)

# 2. Copy new REST URL and Token

# 3. Update on server
ssh root@<droplet-ip>
nano /var/www/store/.env.local
# Update:
# UPSTASH_REDIS_REST_URL=<new-url>
# UPSTASH_REDIS_REST_TOKEN=<new-token>

# 4. Restart application
pm2 restart burmese-store

# 5. Verify rate limiting works
# Try multiple rapid requests — should get 429 after limit
for i in {1..20}; do curl -s -o /dev/null -w "%{http_code}\n" https://burmesedigital.store/api/products; done
```

### Post-rotation:
- [ ] Verify rate limiting is active (not all returning 503)
- [ ] Check structured logs for "rate limit" entries
- [ ] Test login flow (auth rate limits)

---

## 5. XUI Panel Credentials (VPN)

**Impact:** VPN provisioning will fail until new credentials are applied.

### Steps:

```bash
# 1. Change password on 3xUI panel web interface
#    → Login to each panel → Settings → Update password

# 2. Update on server
ssh root@<droplet-ip>
nano /var/www/store/.env.local
# Update:
# XUI_USERNAME=<new-username>
# XUI_PASSWORD=<new-password>

# 3. Restart application
pm2 restart burmese-store

# 4. Verify — check VPN server health
curl -s https://burmesedigital.store/api/vpn/servers | jq '.data[].isOnline'
```

### Post-rotation:
- [ ] All VPN servers show online status
- [ ] Test VPN provisioning with a test order
- [ ] Check VPN keys management page loads

---

## 6. SMTP Credentials Rotation

**Impact:** Email sending will fail until new credentials are applied. Password reset emails will not work.

### Steps:

```bash
# 1. Go to email provider dashboard (Mailgun/Resend)
#    → API Keys or SMTP Settings → Rotate/regenerate credentials

# 2. Update on server
ssh root@<droplet-ip>
nano /var/www/store/.env.local
# Update:
# SMTP_HOST=<provider-smtp-host>
# SMTP_USER=<new-username>
# SMTP_PASS=<new-password>

# 3. Restart application
pm2 restart burmese-store

# 4. Verify — trigger a test email
# Use forgot password flow with a test account
```

### Post-rotation:
- [ ] Test password reset email flow
- [ ] Check structured logs for email send errors
- [ ] Verify DKIM/SPF still valid (DNS records)

---

## 7. S3/DO Spaces Credentials (if using S3 storage)

**Impact:** File uploads and serving will fail during rotation.

### Steps:

```bash
# 1. DigitalOcean → API → Spaces Keys → Generate New Key

# 2. Update on server
ssh root@<droplet-ip>
nano /var/www/store/.env.local
# Update:
# S3_ACCESS_KEY=<new-access-key>
# S3_SECRET_KEY=<new-secret-key>

# 3. Revoke old key in DigitalOcean dashboard

# 4. Restart application
pm2 restart burmese-store

# 5. Verify — upload a test file
```

### Post-rotation:
- [ ] Test file upload (avatar, payment screenshot)
- [ ] Verify existing files still accessible
- [ ] Revoke old access key

---

## Rotation Schedule

| Secret | Frequency | Last Rotated | Next Rotation |
|--------|-----------|-------------|---------------|
| JWT_SECRET | Every 90 days | — | — |
| ADMIN_SECRET | After each use | — | — |
| MongoDB password | Every 90 days | — | — |
| Upstash Redis token | Every 90 days | — | — |
| XUI panel password | Every 90 days | — | — |
| SMTP credentials | Every 90 days | — | — |
| S3 access keys | Every 90 days | — | — |

---

## Emergency Rotation Checklist

If you suspect **any** credential has been compromised:

1. [ ] Immediately rotate the affected credential(s) using steps above
2. [ ] Rotate JWT_SECRET to invalidate all sessions
3. [ ] Check activity logs for unauthorized admin actions
4. [ ] Review MongoDB Atlas audit log for suspicious queries
5. [ ] Check Upstash Redis for unusual rate limit patterns
6. [ ] Review VPN keys for unauthorized provisions
7. [ ] Follow [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) incident process
8. [ ] Document in post-incident report

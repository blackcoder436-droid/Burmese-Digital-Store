# Production Deployment Guide

## 1. Cloudflare R2 CDN Configuration

### 1.1 Create R2 Bucket
1. Go to **Cloudflare Dashboard** → **R2** → **Create bucket**
2. Bucket name: `burmese-digital-store`
3. Location: Auto (or closest to your users)
4. Enable **Public access** via custom domain

### 1.2 Create API Token
1. Go to **R2** → **Manage R2 API Tokens** → **Create API Token**
2. Permissions: **Object Read & Write**
3. Specify bucket: `burmese-digital-store`
4. Copy the **Access Key ID** and **Secret Access Key**

### 1.3 Custom Domain (Optional)
1. Go to R2 bucket → **Settings** → **Public access** → **Custom Domain**
2. Add `cdn.burmesedigital.store` (or your preferred subdomain)
3. Cloudflare will auto-configure DNS and SSL

### 1.4 Environment Variables
Add these to your production `.env.local`:

```bash
# Storage Provider
STORAGE_PROVIDER=r2

# Cloudflare R2
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=burmese-digital-store
R2_PUBLIC_URL=https://cdn.burmesedigital.store
```

### 1.5 Verify
After deploy, upload a product image via admin panel and confirm the URL starts with your `R2_PUBLIC_URL`.

---

## 2. VPN Expiry Cron Job Setup

### 2.1 PM2 Cron (Recommended)
The `ecosystem.config.js` includes cron job definitions:

- **expire-orders**: Runs every 5 minutes to auto-expire unpaid orders
- **vpn-expiry-reminders**: Runs daily at 9:00 AM to send VPN expiry reminders (7/3/1 days)

```bash
# Make the cron runner executable
chmod +x scripts/cron-runner.sh

# Start all PM2 apps (includes cron jobs)
pm2 start ecosystem.config.js

# Verify cron jobs are scheduled
pm2 list
```

### 2.2 Alternative: System Crontab
If you prefer not to use PM2 cron:

```bash
# Edit crontab
crontab -e

# Add these lines (replace YOUR_CRON_SECRET with actual value):
*/5 * * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/expire-orders >> /var/log/cron-expire-orders.log 2>&1
0 9 * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/vpn-expiry-reminders >> /var/log/cron-vpn-reminders.log 2>&1
```

### 2.3 Environment Variable
Ensure `CRON_SECRET` is set in `.env.local`:

```bash
CRON_SECRET=your_random_secure_string_here
```

Generate a secure secret:
```bash
openssl rand -hex 32
```

---

## 3. MongoDB Index Verification

### 3.1 After Deploy
Run this script via `mongosh` to verify all indexes are created:

```javascript
// Connect to your database
// mongosh "mongodb+srv://your-connection-string"

const collections = [
  'users', 'products', 'orders', 'reviews',
  'notifications', 'coupons', 'activitylogs', 'vpnservers'
];

for (const coll of collections) {
  console.log(`\n=== ${coll} ===`);
  const indexes = db.getCollection(coll).getIndexes();
  indexes.forEach(idx => {
    console.log(`  ${idx.name}: ${JSON.stringify(idx.key)}${idx.unique ? ' (unique)' : ''}${idx.expireAfterSeconds ? ` (TTL: ${idx.expireAfterSeconds}s)` : ''}`);
  });
  console.log(`  Total: ${indexes.length} indexes`);
}
```

### 3.2 Expected Index Count
| Collection     | Indexes | Notable |
|----------------|---------|---------|
| users          | 6       | text index, unique email |
| products       | 8       | text index, unique slug |
| orders         | 16      | compound indexes for queries, TTL-compatible |
| reviews        | 4       | unique user+product |
| notifications  | 3       | TTL 30 days auto-delete |
| coupons        | 3       | unique code |
| activitylogs   | 5       | TTL 90 days auto-delete |
| vpnservers     | 4       | unique serverId |

**Total: 49 indexes** (including default `_id` indexes)

### 3.3 Force Index Creation
If indexes are missing, Mongoose creates them on first model access. You can force creation by:

```bash
# Hit the health endpoint to trigger model loading
curl http://localhost:3000/api/health
```

Or explicitly in `mongosh`:
```javascript
// Example: Create a missing compound index on orders
db.orders.createIndex({ user: 1, status: 1 });
```

---

## 4. Complete Production Checklist

```
[ ] .env.local has all required variables:
    [ ] MONGODB_URI
    [ ] JWT_SECRET
    [ ] CRON_SECRET
    [ ] STORAGE_PROVIDER=r2
    [ ] R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
    [ ] UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
    [ ] TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID
    [ ] SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
    [ ] NEXT_PUBLIC_BASE_URL
[ ] npm run build succeeds
[ ] pm2 start ecosystem.config.js
[ ] Cron jobs visible in pm2 list
[ ] curl /api/health returns success
[ ] MongoDB indexes verified via mongosh
[ ] R2 CDN serving files at configured URL
[ ] SSL/TLS active on all domains
[ ] Nginx configured with proper proxy headers (X-Forwarded-For, X-Real-IP)
[ ] Rate limiting working (check /admin/rate-limits dashboard)
```

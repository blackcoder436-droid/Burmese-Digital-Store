# Backup & Restore Runbook — Burmese Digital Store

## 1. MongoDB Backup

### Manual Backup (mongodump)

```bash
# Full database backup
mongodump --uri="mongodb+srv://<USER>:<PASS>@<CLUSTER>/<DB>" --out=./backup/$(date +%Y%m%d)

# Specific collections only
mongodump --uri="$MONGODB_URI" --collection=orders --out=./backup/$(date +%Y%m%d)
mongodump --uri="$MONGODB_URI" --collection=users  --out=./backup/$(date +%Y%m%d)
```

### Automated Daily Backup (cron)

Add to crontab (`crontab -e`):

```cron
# Daily at 2 AM — full backup, keep 30 days
0 2 * * * /usr/local/bin/mongodump --uri="$MONGODB_URI" --out=/backups/mongo/$(date +\%Y\%m\%d) && find /backups/mongo -mtime +30 -type d -exec rm -rf {} +
```

### MongoDB Atlas Backup

If using Atlas, enable **Continuous Backup** or **Cloud Backup Snapshots** in the Atlas UI:
1. Navigate to **Project → Cluster → Backup**
2. Enable **Continuous Backup** (point-in-time restore, recommended)
3. Set snapshot schedule: daily + weekly retention

---

## 2. File Uploads Backup

Upload files are stored at `public/uploads/` (avatars, payment screenshots).

### Local → S3 Sync

```bash
# Sync uploads to S3 / DigitalOcean Spaces
aws s3 sync ./public/uploads s3://your-bucket/uploads --delete

# Or use rclone
rclone sync ./public/uploads remote:your-bucket/uploads
```

### Cron Job

```cron
# Daily at 3 AM — sync uploads to S3
0 3 * * * aws s3 sync /app/public/uploads s3://your-bucket/uploads --delete >> /var/log/upload-sync.log 2>&1
```

---

## 3. Restore Procedures

### Restore MongoDB

```bash
# Full restore
mongorestore --uri="$MONGODB_URI" --drop ./backup/20260215/

# Single collection restore
mongorestore --uri="$MONGODB_URI" --drop --collection=orders --db=burmese-store ./backup/20260215/burmese-store/orders.bson
```

### Restore Uploads

```bash
aws s3 sync s3://your-bucket/uploads ./public/uploads
```

---

## 4. Environment Variables Backup

Store a copy of `.env.local` in a secure password manager or encrypted vault:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Database connection string |
| `JWT_SECRET` | Auth token signing key |
| `EMAIL_USER` / `EMAIL_PASS` | SMTP credentials |
| `UPSTASH_REDIS_REST_URL` | Rate-limit Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Rate-limit Redis |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Storage credentials |
| `OCR_LANGUAGE` | Tesseract language pack |

> **Never commit `.env.local` to git.**

---

## 5. Disaster Recovery Checklist

1. **Provision new server / container**
2. **Clone repo** and `npm ci`
3. **Restore `.env.local`** from secure vault
4. **Restore MongoDB** from latest backup (see §3)
5. **Restore uploads** from S3 (see §3)
6. **Run `npm run build && npm start`**
7. **Verify**: hit `/api/products` and `/api/auth/me` endpoints
8. **Update DNS** if server IP changed

---

## 6. Testing Backups

Run a monthly restore drill:
1. Restore to a staging database
2. Verify document counts match production
3. Spot-check 5 recent orders
4. Log drill result in team channel

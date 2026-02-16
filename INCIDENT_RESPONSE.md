# Incident Response Runbook — Burmese Digital Store

## Overview

This document defines the incident response process for security events, outages, and data-related incidents.

---

## 1. Roles & Responsibilities

| Role | Responsibility | Contact |
|------|---------------|---------|
| **Incident Commander (IC)** | Coordinates response, makes decisions, communicates status | Project owner |
| **Technical Lead** | Investigates root cause, implements fixes | Lead developer |
| **Communications** | Notifies affected users, posts status updates | IC or designated |

> For a small team, one person may fill multiple roles.

---

## 2. Severity Levels

| Level | Definition | Response Time | Examples |
|-------|-----------|---------------|---------|
| **SEV-1 (Critical)** | Service down or data breach | Immediate (< 1 hour) | DB leak, auth bypass, full outage |
| **SEV-2 (High)** | Major feature broken, security vulnerability | < 4 hours | Payment processing down, XSS, privilege escalation |
| **SEV-3 (Medium)** | Partial degradation, non-critical security issue | < 24 hours | Slow performance, minor data exposure |
| **SEV-4 (Low)** | Cosmetic issue, improvement needed | Next business day | UI bug, logging gap |

---

## 3. Incident Response Steps

### Phase 1: Detection & Triage (0-15 min)

1. **Identify** — How was the incident detected?
   - Monitoring alerts (login failures, rate limit spikes, error rate increase)
   - User report (email/Telegram)
   - Self-discovered (during review/testing)

2. **Assess severity** — Use the severity table above

3. **Assign IC** — Designate Incident Commander

4. **Create incident log** — Document timeline in a private channel/doc:
   ```
   [YYYY-MM-DD HH:MM] INCIDENT OPENED — SEV-X
   [YYYY-MM-DD HH:MM] Description: ...
   [YYYY-MM-DD HH:MM] IC: <name>
   ```

### Phase 2: Containment (15-60 min)

For **security incidents**:
- [ ] Rotate compromised credentials immediately (see [SECRET_ROTATION.md](SECRET_ROTATION.md))
- [ ] Block attacker IP/account if identified
- [ ] Disable affected feature if necessary (e.g., disable registration, disable OCR)
- [ ] Take affected endpoints offline if critical

For **outages**:
- [ ] Check server health: `pm2 status`, `pm2 logs`
- [ ] Check MongoDB Atlas dashboard for connection issues
- [ ] Check Upstash Redis dashboard for rate limit service
- [ ] Restart services if needed: `pm2 restart burmese-store`

For **data incidents**:
- [ ] Identify scope of data exposure
- [ ] Preserve evidence (logs, screenshots)
- [ ] Block further access

### Phase 3: Investigation (1-4 hours)

1. **Collect logs:**
   ```bash
   # PM2 logs
   pm2 logs burmese-store --lines 500
   
   # Search for specific patterns
   pm2 logs burmese-store --lines 1000 | grep -i "error\|fail\|unauthorized"
   
   # MongoDB Atlas — check slow query log, connection metrics
   ```

2. **Identify root cause:**
   - Check recent deployments/changes
   - Review git log for last commits
   - Check rate limit metrics (Upstash dashboard)
   - Review structured logs for anomalies

3. **Document findings** in incident log

### Phase 4: Resolution (varies)

1. **Implement fix** — patch the vulnerability or restore service
2. **Test** in staging/development if possible
3. **Deploy** fix to production
4. **Verify** the fix resolves the issue
5. **Monitor** for recurrence (next 24 hours)

### Phase 5: Communication

**For user-affecting incidents (SEV-1, SEV-2):**

1. Notify affected users via email (if data was involved)
2. Post status on main communication channel (Telegram group)
3. Update status when resolved

**Template:**
```
[Burmese Digital Store — Service Notice]

We identified an issue affecting [describe impact].
The issue has been [contained/resolved].
[If data involved]: Your [data type] may have been affected. We recommend [action].

We apologize for the inconvenience.
```

### Phase 6: Post-Incident Review (within 48 hours)

Create a post-incident report:

```markdown
## Post-Incident Report — [Date]

**Severity:** SEV-X
**Duration:** HH:MM to HH:MM (X hours)
**Impact:** [Who/what was affected]

### Timeline
- [time] — Incident detected by [method]
- [time] — IC assigned
- [time] — Root cause identified
- [time] — Fix deployed
- [time] — Incident resolved

### Root Cause
[Detailed explanation]

### Resolution
[What was done to fix it]

### Action Items
- [ ] [Preventive measure 1]
- [ ] [Preventive measure 2]
- [ ] [Monitoring improvement]
```

---

## 4. Common Incident Playbooks

### A. Suspected Account Compromise
1. Force reset user's password (increment `tokenVersion` in DB)
2. Check admin activity log for unauthorized actions
3. Review login history (structured logs)
4. Notify user to change password
5. Check for privilege escalation

### B. Rate Limit / DDoS Spike
1. Check Upstash Redis metrics
2. Review Cloudflare analytics for traffic spike
3. Enable Cloudflare "Under Attack Mode" if needed
4. Check if rate limit `RATE_LIMIT_FAIL_CLOSED=true` is working
5. Block offending IPs via Cloudflare firewall rules

### C. Database Connection Failure
1. Check MongoDB Atlas status page
2. Verify IP whitelist hasn't changed
3. Check connection string in environment variables
4. Review connection pool limits
5. Restart application: `pm2 restart burmese-store`

### D. VPN Provisioning Failure
1. Check 3xUI panel health (server status page)
2. Verify panel credentials (`XUI_USERNAME`, `XUI_PASSWORD`)
3. Check server SSL certificates
4. Review VPN provision logs in structured logging
5. Admin can manually retry provisioning from dashboard

### E. Fraudulent Payment Detected
1. Review fraud flags in admin order detail
2. Check verification checklist
3. Compare screenshot with payment records
4. If fraud confirmed: reject order, flag user
5. Document in activity log

---

## 5. Emergency Contacts & Resources

| Resource | URL/Contact |
|----------|------------|
| MongoDB Atlas | https://cloud.mongodb.com |
| Upstash Redis | https://console.upstash.com |
| Cloudflare | https://dash.cloudflare.com |
| DigitalOcean | https://cloud.digitalocean.com |
| Server SSH | `ssh root@<droplet-ip>` |
| PM2 Dashboard | `pm2 monit` (on server) |

# Security Audit Report

Project: Burmese Digital Store  
Date: 2026-02-16  
Scope: Application layer, API/auth, middleware, dependency posture, deployment scripts, operational documentation.

## Safety Note

This report is defensive. It identifies likely attacker paths at a high level and focuses on mitigation. It does not include weaponized exploit steps.

## Executive Summary

Overall maturity is **moderate**: strong foundations exist (JWT + HttpOnly cookie, role checks, upload validation, OCR fraud flags, route-level rate limiting), but several high-impact risks remain at system and operational levels.

### Risk Snapshot

- **Critical:** 1
- **High:** 3
- **Medium:** 6
- **Low:** 4

Top priorities:

1. Remove/lock down publicly reachable admin bootstrap endpoint after first admin setup.
2. Upgrade Next.js to a patched version and validate image optimizer hardening.
3. Enforce strict production transport and origin controls (TLS, reverse proxy hardening, trusted headers).
4. Strengthen SSRF boundary around VPN server/panel health and provisioning integrations.
5. Add security runbooks and automated checks to prevent config drift.

---

## Findings

## 1) Critical — Public admin bootstrap endpoint remains attackable surface

**Area:** `/api/admin/seed`  
**Evidence:** `src/middleware.ts` allows this route as public admin route; `src/app/api/admin/seed/route.ts` performs secret-based bootstrap.

### Why it matters

Even with ADMIN_SECRET and rate limiting, a publicly exposed privileged bootstrap endpoint creates persistent high-value attack surface:

- brute-force or secret leakage becomes catastrophic;
- endpoint may be abused during incidents when secrets are mishandled;
- attack path remains available long after initial setup when it should be disabled.

### Remediation

- Make this endpoint one-time only (auto-disable after first successful admin creation/promote).
- Gate by environment flag, e.g. `ENABLE_ADMIN_SEED=false` in production.
- Restrict access by allowlisted source IP/CIDR at reverse proxy.
- Rotate ADMIN_SECRET after first bootstrap.
- Add monitoring alert on any request to this endpoint in production.

---

## 2) High — Dependency vulnerability exposure (Next.js)

**Area:** runtime framework dependency  
**Evidence:** `npm audit --omit=dev --json` reports advisory exposure in installed Next.js range; `package.json` currently pins Next 14.x.

### Why it matters

Framework-level DoS vulnerabilities can be triggered remotely and may affect availability under crafted traffic.

### Remediation

- Upgrade to a patched supported Next.js release (prefer latest stable compatible with your codebase).
- Re-run test suite and smoke tests for API/image routes after upgrade.
- Add dependency vulnerability scanning to CI (fail build on high/critical in production deps).

---

## 3) High — Transport architecture weak point in deployment documentation

**Area:** VPS deploy guidance  
**Evidence:** `deploy.sh` recommends Cloudflare Flexible/HTTP-to-origin and includes proxy setup without strict origin TLS requirement.

### Why it matters

If origin traffic is HTTP, requests between CDN and origin can be intercepted or modified in some network scenarios. This weakens cookie/session and admin-route protection assumptions.

### Remediation

- Enforce TLS end-to-end (Cloudflare Full Strict + valid origin cert).
- Redirect all origin HTTP to HTTPS, disable plain HTTP except ACME challenge path if needed.
- Add strict proxy security headers and trusted proxy configuration.
- Update deployment docs to remove insecure TLS modes.

---

## 4) High — SSRF-style risk boundary in VPN integrations

**Area:** VPN server panel interactions  
**Evidence:** `src/lib/xui.ts`, `src/app/api/vpn/health/route.ts`, server metadata from `src/lib/vpn-servers.ts`.

### Why it matters

System performs outbound requests to panel URLs/domains. If server records are misconfigured, compromised, or overly permissive, backend may probe unintended hosts/services.

### Remediation

- Enforce strict allowlist for server domains/IP ranges.
- Reject loopback, link-local, private-network targets unless explicitly approved.
- Resolve and validate DNS/IP before request.
- Add outbound egress firewall rules from host/container.
- Log and alert on panel URL changes.

---

## 5) Medium — Middleware token check does not enforce DB tokenVersion/role freshness

**Area:** edge middleware auth  
**Evidence:** `src/middleware.ts` validates JWT signature/role claim only; deeper DB tokenVersion checks happen in `src/lib/auth.ts` (`getAuthUser`/`requireAdmin`) but not at middleware stage.

### Why it matters

A demoted/rotated user can still pass middleware until server-side route checks run. This is mostly defense-in-depth gap, but can affect protected page rendering behavior and route gating consistency.

### Remediation

- Keep server-side checks (already present) as source of truth.
- In middleware, reduce trust of role claim for page access (optional hardening: lightweight session revocation cache).
- Ensure all sensitive API routes always call `requireAdmin`/`getAuthUser` (already mostly done).

---

## 6) Medium — CSP still permits unsafe inline scripts

**Area:** response security headers  
**Evidence:** `src/middleware.ts` sets `script-src 'self' 'unsafe-inline'` in production.

### Why it matters

Allowing inline scripts weakens XSS blast-radius reduction.

### Remediation

- Move toward nonce-based CSP for scripts.
- Remove unsafe-inline in production when compatible.
- Keep strict `frame-ancestors`, `base-uri`, `form-action` (already present).

---

## 7) Medium — Rate limiting fallback weak in multi-instance production

**Area:** request throttling  
**Evidence:** `src/lib/rateLimit.ts` falls back to in-memory map when Upstash is absent/unavailable.

### Why it matters

In-memory fallback is ineffective across multiple instances and easy to bypass with distributed requests.

### Remediation

- Treat distributed limiter as mandatory in production (fail closed for sensitive endpoints).
- Add endpoint-specific stricter thresholds for auth/reset/seed.
- Include per-account + per-IP + per-route keys.

---

## 8) Medium — Security headers missing modern policy hardening details

**Area:** middleware headers  
**Evidence:** `src/middleware.ts` includes several good headers but lacks COOP/COEP/CORP tuning and trusted-host validation.

### Why it matters

Not always exploitable directly, but missing modern browser isolation controls can increase impact under XSS or cross-origin interactions.

### Remediation

- Add/validate `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` where compatible.
- Validate host header against canonical domain list at edge/proxy.

---

## 9) Medium — Logging may expose sensitive metadata during failures

**Area:** structured logs  
**Evidence:** `src/lib/logger.ts` and route error logging patterns.

### Why it matters

Error logs can leak tokens, emails, transaction IDs, or operational secrets if metadata is passed unsafely by future changes.

### Remediation

- Add centralized redaction (token, secret, cookie, authorization, password, reset token patterns).
- Define log data classification and retention policy.

---

## 10) Medium — Upload storage served publicly without malware scanning

**Area:** file upload lifecycle  
**Evidence:** `src/app/api/auth/avatar/route.ts`, `src/app/api/orders/route.ts`, `src/app/api/vpn/orders/route.ts`, static serving via Nginx in `deploy.sh`.

### Why it matters

Validation is strong (magic bytes + sharp for some routes), but no antivirus scanning or quarantine process for uploaded files.

### Remediation

- Add async malware scan/quarantine pipeline for payment screenshots.
- Store uploads outside web root where possible; serve via controlled handler/CDN.

---

## 11) Low — Deprecated/legacy header usage

**Area:** X-XSS-Protection  
**Evidence:** `src/middleware.ts` sets X-XSS-Protection.

### Why it matters

Modern browsers ignore this; it may create false confidence.

### Remediation

- Remove legacy header; rely on CSP + output encoding.

---

## 12) Low — Documentation and runbook gaps

**Area:** operational documentation  
**Evidence:** `README.md`, `BACKUP.md`, deployment docs.

### Why it matters

Security depends on repeatable operations. Missing incident response and key rotation guidance increases breach dwell time.

### Remediation

Add dedicated docs for:

- incident response playbook,
- secret rotation cadence,
- access review checklist,
- patch SLA and dependency update policy,
- least-privilege IAM for cloud/storage.

---

## Existing Strengths (Keep and Expand)

- Strong upload validation utility and magic-byte checks.
- JWT in HttpOnly secure cookies with strict sameSite.
- Server-side role/tokenVersion checks in auth utilities.
- Admin APIs generally enforce `requireAdmin`.
- Fraud flags and review workflow for payment verification.
- Basic rate limiting present across major routes.

---

## Priority Remediation Plan

## 24 Hours (Immediate)

1. Disable or heavily gate `/api/admin/seed` in production.
2. Rotate ADMIN_SECRET and JWT_SECRET if exposure uncertainty exists.
3. Enforce Full Strict TLS architecture; remove insecure deployment guidance.
4. Add monitoring alert for repeated auth/reset/seed failures.

## 7 Days (Short-term)

1. Upgrade Next.js to patched version; run full regression.
2. Make distributed rate limiter mandatory in production.
3. Add outbound request allowlist/egress rules for VPN panel calls.
4. Harden CSP strategy and remove unnecessary inline script allowances.

## 30 Days (Mid-term)

1. Add CI security gates: npm audit, SAST, secret scan, dependency policy.
2. Implement log redaction and retention controls.
3. Add malware scanning workflow for uploads.
4. Publish security runbook set (incident, rotation, backup-restore validation).

---

## System-Level Hardening Checklist

- Host firewall: only 80/443 externally; DB private only.
- SSH hardening: key-only auth, fail2ban, non-root admin account.
- PM2 process user not root; principle of least privilege.
- Nginx: request size limits, timeout tuning, deny dotfiles, security headers.
- Database: least privilege DB user, IP allowlist, backup encryption.
- Secrets: vault-managed, rotated, not copied in plain text docs/chats.
- Monitoring: auth anomalies, 5xx spikes, high-rate endpoints, admin events.

---

## Documentation-Level Hardening Checklist

Create/maintain:

1. SECURITY.md (reporting policy, support window, response SLA)
2. THREAT_MODEL.md (assets, trust boundaries, abuse cases)
3. INCIDENT_RESPONSE.md (severity levels, owners, comms)
4. SECRET_ROTATION.md (what, when, how to rotate)
5. DEPLOYMENT_SECURITY.md (TLS mode, WAF, reverse proxy baseline)
6. ACCESS_CONTROL_REVIEW.md (admin role review monthly)

---

## Validation Performed During Audit

- Focused security/auth tests run: passed (`__tests__/security.test.ts`, `__tests__/auth.test.ts`).
- Production dependency audit run: identified high vulnerability path in Next.js dependency range.

---

## Final Notes

No single issue proves active compromise from source review alone. However, the combination of a public bootstrap admin route, framework vulnerability exposure, and transport-level deployment guidance creates a realistic high-impact risk profile. Addressing the first five priorities will materially reduce attack surface.

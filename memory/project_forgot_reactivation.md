---
name: project-forgot-reactivation
description: Forgot password and account reactivation flows — DB columns, endpoints, pages, migration SQL
metadata:
  type: project
---

Forgot password and account reactivation added.

**DB columns added (shared reset_token columns):**
- `reset_token VARCHAR(255)`
- `reset_token_type VARCHAR(20)` CHECK IN ('password', 'reactivation')
- `reset_token_expires_at TIMESTAMPTZ`

**Backend endpoints:**
- `POST /api/auth/forgot-password` — responds immediately (anti-enumeration), sends email async. Token expires 1 jam. Only works for accounts with password_hash (not Google-only)
- `POST /api/auth/reset-password` — validates token, hashes new password, clears token
- `POST /api/auth/request-reactivation` — responds immediately, sends email async. Token expires 24 jam
- `GET /api/auth/reactivate/:token` — validates token, sets is_active=true, returns JWT

**Login modification:** query changed from `WHERE is_active=true` to no is_active filter; returns `code: ACCOUNT_INACTIVE` with `email` in response body when account is inactive.

**Frontend pages:**
- `ForgotPasswordPage.jsx` → `/forgot-password` (PublicRoute)
- `ResetPasswordPage.jsx` → `/reset-password/:token` (open)
- `ReactivatePage.jsx` → `/reactivate/:token` (open, auto-login on success)

**LoginPage changes:**
- "Lupa password?" link next to password label → `/forgot-password`
- StatusBanner component shows inline for EMAIL_NOT_VERIFIED and ACCOUNT_INACTIVE codes with action buttons

**Migration SQL (existing DB):**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_type VARCHAR(20) CHECK (reset_token_type IN ('password', 'reactivation'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;
```

**Why:** User requested forgot password and account reactivation features.
**How to apply:** If user reports reset/reactivation not working, first check DB migration was run. Token expiry: reset=1h, reactivation=24h.

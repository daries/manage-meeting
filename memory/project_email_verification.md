---
name: project-email-verification
description: Email verification flow for manual register — DB columns, endpoints, frontend pages, and DB migration SQL
metadata:
  type: project
---

Email verification added for manual (email+password) registration.

**DB columns added to users table:**
- `email_verified BOOLEAN DEFAULT FALSE`
- `verification_token VARCHAR(255)`
- `verification_token_expires_at TIMESTAMPTZ`

**Backend endpoints:**
- `POST /api/auth/register` — no longer returns JWT; sends verification email, returns `{ message }`
- `GET /api/auth/verify-email/:token` — validates token, sets `email_verified=true`, returns JWT
- `POST /api/auth/resend-verification` — resends verification email (safe against email enumeration)
- `POST /api/auth/login` — blocks login with `code: EMAIL_NOT_VERIFIED` if not verified; also blocks password login for Google-only accounts

**Google SSO users:** auto-set `email_verified=true` at creation.

**Frontend pages:**
- `RegisterPage.jsx` — shows "check email" state after form submit, with resend button
- `VerifyEmailPage.jsx` (new) — handles `/verify-email/:token` route, auto-redirects to dashboard on success

**Migration SQL (existing DB):**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ;
UPDATE users SET email_verified = TRUE;
```

**Why:** User requested email confirmation for manual registration.
**How to apply:** If user reports login blocked, check `email_verified` column in DB. Remind them to run migration SQL if upgrading from old schema.

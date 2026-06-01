# Memory Index

- [Project Overview](project_overview.md) — Stack: React+Vite frontend, Express+PostgreSQL backend, app name "RapatKu" (meeting management)
- [Google SSO Implementation](project_google_sso.md) — Google SSO added via @react-oauth/google (frontend) + google-auth-library (backend)
- [Email Verification Flow](project_email_verification.md) — Manual register now requires email verification; endpoints verify-email + resend-verification added
- [Forgot Password & Reactivation](project_forgot_reactivation.md) — Forgot password (1h token) + account reactivation (24h token) via email; login detects ACCOUNT_INACTIVE code

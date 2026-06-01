---
name: project-google-sso
description: Google SSO implementation details — packages, endpoints, env vars, and DB migration needed
metadata:
  type: project
---

Google SSO (Login/Register with Gmail) added to RapatKu.

**Packages installed:**
- Backend: `google-auth-library`
- Frontend: `@react-oauth/google`

**Backend endpoint:** `POST /api/auth/google` in `backend/src/routes/auth.js`
- Accepts `{ access_token }` (from `useGoogleLogin` hook) OR `{ credential }` (ID token)
- Verifies via Google's userinfo API or `verifyIdToken`
- Auto-creates user if first login, links google_id if email already exists

**Database migration needed** (for existing DBs):
```sql
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
```

**Env vars required:**
- Backend `.env`: `GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com`
- Frontend `.env`: `VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com`

**Frontend wiring:**
- `App.jsx` wrapped with `GoogleOAuthProvider`
- `AuthContext.jsx` has `loginWithGoogle(tokenData)` function
- Both `LoginPage.jsx` and `RegisterPage.jsx` have "Masuk/Daftar dengan Google" button

**Google Cloud Console setup needed:** Create OAuth 2.0 Web Client ID at https://console.cloud.google.com, add `http://localhost:5173` to Authorized JavaScript Origins.

**Why:** User requested Google SSO feature.
**How to apply:** If user has DB issues, remind them to run the migration SQL above.

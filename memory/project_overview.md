---
name: project-overview
description: Tech stack, structure, and key details of the RapatKu meeting management app
metadata:
  type: project
---

Full-stack meeting management app called "RapatKu".

- **Frontend**: React 18 + Vite + Tailwind CSS, in `/frontend/src/`
- **Backend**: Express.js + PostgreSQL (pg), in `/backend/`
- **Auth**: JWT stored in localStorage; auth routes in `backend/src/routes/auth.js`
- **Email**: Resend API; **WhatsApp**: Fonnte
- **DB Schema**: `/backend/database/schema.sql`
- **Key pages**: Login, Register, Dashboard, Profile, MeetingCreate/Detail/Edit/Minutes, Calendar, Search, Attendance

**Why:** Track for future work to understand the project structure quickly.
**How to apply:** Reference these paths when editing or adding features.

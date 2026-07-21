# Activity Monetizer — Server (Phase 1: Auth + Session Validation)

This is the central server module covering:
- Login (student / teacher / admin) with JWT issuance
- Session creation (teacher)
- Session join validation (student) — enforces the 15-minute join window,
  session duration cutoff, and special-access approval flow
- Special access request/approval endpoints
- Audit logging of login attempts

Everything else (PC control, messaging, attendance charts, AI chatbot, dashboards)
builds on top of this in later phases.

## Setup (local testing — no database install needed)

This is currently configured to use a single **SQLite file** (`db.sqlite`) as its database —
no PostgreSQL install, no Docker, nothing external to run. Just:

```bash
npm install
cp .env.example .env      # DATABASE_URL already points at file:./db.sqlite — just set JWT_SECRET
npx prisma migrate dev --name init
npm run seed
npm run start:dev
```

That's it — `db.sqlite` is created automatically in the project folder on first migrate.
You can open it with any SQLite viewer (e.g. "DB Browser for SQLite") to inspect data directly.

**Going to production later:** open `prisma/schema.prisma`, change `provider = "sqlite"` back to
`provider = "postgresql"`, point `DATABASE_URL` at a real Postgres instance, then re-run
`npx prisma migrate dev`. No service code changes needed — everything in `src/` talks to Prisma,
not to SQLite or Postgres directly.

`npm run seed` creates three demo accounts for testing the full flow end-to-end —
**change every password before any real deployment**:

| Role    | Username    | Password      | Notes                  |
|---------|-------------|---------------|-------------------------|
| Admin   | `admin`     | `ChangeMe123!` |                         |
| Teacher | `teacher01` | `Teacher123!`  |                         |
| Student | `student01` | `Student123!`  | regNumber `STU-2026-0001`, class `CS101` |

## API walkthrough

### 1. Admin logs in
```
POST /auth/login
{ "username": "admin", "password": "ChangeMe123!", "expectedRole": "ADMIN" }
```
Use the returned `accessToken` as `Authorization: Bearer <token>` on subsequent calls.

### 2. Teacher creates a session
```
POST /sessions
Authorization: Bearer <teacher token>
{
  "classTitle": "Data Structures Lab 3",
  "durationMinutes": 90,
  "joinWindowMinutes": 15,
  "allowedSites": ["https://leetcode.com", "https://replit.com"],
  "blockedSites": ["https://youtube.com"]
}
```
Response includes the session `id` — this is the Session ID students type in.

### 3. Student logs in, then joins the session
```
POST /auth/login
{ "username": "student01", "password": "...", "expectedRole": "STUDENT" }

POST /sessions/join
Authorization: Bearer <student token>
{ "sessionId": "<id from step 2>", "regNumber": "STU-2026-001", "pcHostname": "LAB1-PC07" }
```
- Within 15 minutes of creation → joins immediately.
- After 15 minutes but before the session ends → rejected with a message to
  request special access (`POST /sessions/request-access`), which a teacher
  approves via `POST /sessions/handle-access-request`.
- After the session's `durationMinutes` has elapsed → always rejected, no
  exceptions, matching the "can't join after duration ends" rule.

## Phase 2: Realtime (WebSocket) layer

Namespace: `/realtime` (Socket.IO). Every client connects with its JWT:

```js
io("http://<server>/realtime", { auth: { token: "<accessToken>" } });
```

### Student client (the .exe on each lab PC)
- Emits `pc:register` → `{ hostname, labName?, sessionId?, studentId? }` once logged in and joined a session.
- Emits `pc:heartbeat` → `{ hostname }` periodically (e.g. every 30s) to keep `lastSeen` fresh.
- Listens for `command:execute` → `{ action, message?, issuedBy, issuedAt }` where `action` is one of
  `LOCK | UNLOCK | FREEZE | UNFREEZE | SHUTDOWN | MESSAGE`. The client is responsible for actually
  calling the Win32 APIs (`LockWorkStation`, full-screen overlay, `ExitWindowsEx`) — the server only
  relays the command and records it.

### Teacher/Admin dashboard
- Emits `teacher:subscribe` → `{ sessionId }` to join that session's room; immediately receives
  `pc:list` with the current PCs in that session.
- Listens for `pc:status-update` → `{ hostname, status, studentId? }` for live grid updates
  (a PC coming online/offline/locked/frozen).
- Emits `teacher:command` → `{ sessionId, targetHostname?: string | "ALL", action, message? }`.
  Omitting `targetHostname` (or passing `"ALL"`) broadcasts to every PC currently in the session.
  Server verifies the teacher owns the session before relaying, and writes every command to
  `AuditLog`.

Note: rooms and the online-socket map are in-memory and single-process for this phase. Scaling to
multiple server instances later just needs the Socket.IO Redis adapter — no protocol changes.

## Phase 3: Admin CRUD + Attendance

All routes below require `Authorization: Bearer <admin token>` and role `ADMIN` (enforced by `RolesGuard`).

### User management
```
POST   /admin/users/students   { username, password, regNumber, mobile?, email?, classId? }
POST   /admin/users/teachers   { username, password, mobile?, email? }
GET    /admin/users?role=STUDENT&classId=<id>
PATCH  /admin/users/:id        { mobile?, email?, classId?, password?, isActive? }
DELETE /admin/users/:id        (soft delete → isActive=false; add ?hard=true to actually remove)
```
Passwords are always hashed with bcrypt before storage; responses never include `passwordHash`.
Deletes default to *soft* — this keeps attendance/session history intact even after a student
account is deactivated, which the admin dashboard's historical charts depend on.

### Attendance (feeds the pie charts)
```
GET /admin/attendance/overview          → { present, absent, total }  — overall, across all classes
GET /admin/attendance/class/:classId    → same shape, scoped to one class
GET /admin/attendance/student/:id       → { present, absent, total, records: [...] } — per-session history
```

### Ending a session (triggers attendance computation)
```
POST /sessions/:id/end
```
Teachers can end their own sessions; admins can end any. This closes out any participant who
never explicitly left, computes `presentSeconds` for everyone (time between join and leave/now),
and marks `isPresent = presentSeconds / requiredSeconds >= 0.70` — the 70%-class-activeness rule.
Attendance rows only count toward the pie charts once a session has gone through this step.

## Phase 4: AI Chatbot (student coding help)

```
POST /chatbot/ask
Authorization: Bearer <student token>
{
  "code": "for i in range(10)\n  print(i)",
  "errorMessage": "SyntaxError: expected ':'",
  "language": "python"
}
```
Requires `ANTHROPIC_API_KEY` in `.env` (get one from the Anthropic Console). The server proxies the
request to the Claude API with a tutoring-style system prompt — it explains what's wrong and nudges
toward the fix rather than just handing over corrected code, unless the student indicates they're
already stuck after trying. Rate-limited to 10 requests/minute per student since each call costs
against your Anthropic usage. The student's actual code isn't stored — only a lightweight audit
entry (`CHATBOT_QUERY`, with code length and language) is logged.

## What's next (later phases)
- Site allow/block enforcement contract with the embedded WebView2 browser
- Windows client app (WPF) implementing all of the above from the student side
- Teacher/Admin dashboard frontend (React)

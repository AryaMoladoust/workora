

# Workora

> بازطراحی مرحله‌ای: وضعیت و نقشه راه در `STAGES.md`.

Workora is a modular team/workspace management application built with Next.js, JavaScript/JSX and MongoDB/Mongoose.

## Current milestone: Local MongoDB + real authentication

This version is configured for a local MongoDB server. No seed/fake users are created.

### 1. Install dependencies

```bash
npm install
```

### 2. Start MongoDB

Make sure the MongoDB server is running locally on:   

```text
mongodb://127.0.0.1:27017
```

MongoDB Compass is only the GUI; the MongoDB Server service must also be running.

On Windows, if MongoDB was installed as a Windows service, start it from:

```text
Services → MongoDB Server → Start
```

Or from an administrator terminal, depending on the installation:

```bash
net start MongoDB
```

### 3. Environment

A local `.env.local` is included for development:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/workora
AUTH_SECRET=workora-local-development-secret-change-this-before-production-2026
```

Do not commit `.env.local`.

### 4. Run Workora

```bash
npm run dev   # custom server (Next.js + WebSocket), see STAGES.md
```

Open:

```text
http://localhost:3000
```

### 5. Test the real flow

1. Open `/register`.
2. Create your first account and Workspace.
3. Workora creates a real User, Workspace and Owner Membership in MongoDB.
4. You are automatically logged in with an HTTP-only session cookie.
5. You are redirected to `/dashboard`.
6. Logout is available through `/api/auth/logout` and can be connected to the UI in the next milestone.

### MongoDB Compass

After registration, refresh Compass and open:

```text
workora
├── users
├── workspaces
└── memberships
```

No fake records are inserted by the application.

## Moving to MongoDB Atlas later

Only the environment configuration needs to change for the database connection:

```env
MONGODB_URI=<your Atlas connection string>
```

The application code should continue using `connectToDatabase()`; do not hard-code Atlas credentials in source files.


## Local MongoDB

This version uses a separate MongoDB database named `workora` on the same local MongoDB server used by other projects.

`.env.local`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/workora
AUTH_SECRET=workora-local-development-secret-change-this-before-production-2026
```

Before registration, make sure the MongoDB Server service is running. MongoDB Compass is only a GUI client; it is not the database server itself.

Health check:

`http://localhost:3000/api/health`

A successful response contains `"ok": true` and `"database": "connected"`.

# Tamil Nadu Vote Poll — Setup Guide

## What You Get
- Gmail OAuth login (only verified Google accounts can vote)
- One vote per Gmail account — enforced by database
- SQLite database storing all votes securely
- Admin panel to view live results at `/admin`

---

## Step 1 — Get Google OAuth Credentials

1. Go to https://console.cloud.google.com
2. Create a new project (e.g. "Vote Poll")
3. Go to **APIs & Services → OAuth consent screen**
   - User Type: External → Fill in app name & your email → Save
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:3000/auth/google/callback`
   - Click Create → Copy your **Client ID** and **Client Secret**

---

## Step 2 — Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```
GOOGLE_CLIENT_ID=paste_your_client_id_here
GOOGLE_CLIENT_SECRET=paste_your_client_secret_here
SESSION_SECRET=any_long_random_string_like_this_abc123xyz
ADMIN_KEY=your_secret_admin_password
PORT=3000
```

---

## Step 3 — Install & Run

```bash
npm install
npm start
```

App runs at: http://localhost:3000

---

## Pages

| URL | Purpose |
|-----|---------|
| `http://localhost:3000` | Login page (Gmail sign-in) |
| `http://localhost:3000/vote` | Voting page (after login) |
| `http://localhost:3000/admin` | Admin results panel |

---

## Admin Panel

Go to `/admin` and enter the `ADMIN_KEY` you set in `.env`.

You'll see:
- Total vote count
- Leading party
- Bar chart of results
- Recent 20 votes with name, email, party, and time

---

## How Duplicate Prevention Works

- When a user signs in with Google, their unique **Google ID** is stored
- On vote submission, the server checks: `SELECT * FROM votes WHERE google_id = ?`
- If a record exists → vote is rejected with "You have already voted"
- If not → vote is inserted into the database
- Even if someone creates a new email, they can't reuse the same Google account

---

## Deploy to Production (optional)

1. Deploy to any Node.js host (Railway, Render, Fly.io — all free tiers available)
2. Update the OAuth redirect URI in Google Console to your live domain:
   `https://yourdomain.com/auth/google/callback`
3. Update `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in production env vars

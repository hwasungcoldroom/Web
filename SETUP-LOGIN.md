# Login system — setup guide

The site now has a login system with two account types:

- **Normal user** — sees Login/Logout in the nav. Nothing else changes for them.
- **Office** — additionally sees an **Office** dropdown in the nav with
  **Petty Cash / Project / Bank Statement**.

Visitors and normal users **never** see the Office menu. The check happens on
the server (`/api/me` only sends the office links to office sessions), so it
cannot be bypassed with browser dev tools.

No database is needed — accounts live in Vercel environment variables.

---

## 1. Required environment variables (Vercel → Project → Settings → Environment Variables)

### AUTH_SECRET  (required)
A long random string used to sign login cookies. Generate one on your machine:

```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the output as the value. **If this is missing, login is disabled** and the
login page will say so.

### OFFICE_ACCOUNTS
Comma-separated `username:password` pairs for office/admin people, e.g.:

```
office:Hw2026!Cold,mrlee:AnotherStrongPass
```

### USER_ACCOUNTS
Same format, for normal users:

```
jean:Jean1234,client1:Welcome2026
```

Notes:
- Usernames are case-insensitive; passwords are case-sensitive.
- No commas or colons inside usernames/passwords.
- To add/remove an account: edit the env var, then **redeploy** (env changes
  only take effect on the next deployment).

## 2. Office dropdown links (optional — add later)

The three menu items are placeholders (`#`) until you set these:

```
OFFICE_LINK_PETTY_CASH      = https://…
OFFICE_LINK_PROJECT         = https://…
OFFICE_LINK_BANK_STATEMENT  = https://…
```

Links open in a new tab. Change them any time — just update the env var and
redeploy. No code change needed.

> If the links point to Google Drive/Sheets, ALSO restrict sharing on the
> Google side (share with specific emails, not "anyone with the link").
> The website hides the links from non-office users, but the files themselves
> are protected by Google's own sharing settings.

## 3. How it works

| File | Purpose |
|---|---|
| `login.html` | The `/login` page (linked from the nav). |
| `api/login.js` | Checks credentials, sets a signed HttpOnly cookie (12-hour session). |
| `api/logout.js` | Clears the cookie. |
| `api/me.js` | Tells the page who is signed in; office links returned **only** for office role. |
| `api/_lib/auth.js` | Shared helpers (not exposed as an endpoint — underscore folder). |

Sessions last **12 hours**, then the person must sign in again.

## 4. Later upgrade path

If the owner eventually wants self-registration, password reset, or many
accounts, swap the env-var accounts for Supabase Auth — the frontend
(`/api/me` contract) stays the same, only the API internals change.

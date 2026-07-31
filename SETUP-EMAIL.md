# Setting up job application emails

Applications from the Employment page are emailed to you by a small serverless
function that lives in this project at `api/apply.js`. It runs on Vercel and
sends through **Resend**. Nothing to install — there are no npm dependencies.

There are **four steps**. It takes about ten minutes.

---

## 1. Put the files in your repo

The folder layout matters. `api` must be a folder at the top level, beside your
HTML files:

```
your-repo/
  index.html
  employment.html
  styles.css
  script.js
  logo.png  ...etc
  api/
    apply.js        <-- job applications
    booking.js      <-- "Book Now" callback requests
```

Vercel turns anything inside `api/` into a serverless function automatically.
`api/apply.js` becomes `https://www.hwasung1996.com/api/apply`.

**Do not rename the folder or the file** — the form posts to `/api/apply`, and
that path comes from those two names.

Also upload the updated `script.js` and **all eight HTML pages** — the Book Now
form appears on every page, so every page had to be wired up.

---

## 2. Create a Resend account

1. Go to **resend.com** and sign up.
2. **Sign up using hwasungcoldroom@gmail.com.** This matters — see step 4.
3. Go to **API Keys** → **Create API Key**. Give it any name, choose
   *Sending access*.
4. Copy the key. It starts with `re_`. You only get to see it once.

Free plan: 3,000 emails per month, 100 per day. Far more than you need.

---

## 3. Add the key to Vercel

1. Vercel dashboard → your project → **Settings** → **Environment Variables**
2. Add:

   | Name | Value |
   |---|---|
   | `RESEND_API_KEY` | the `re_...` key from step 2 |

3. Leave the environment set to all three (Production, Preview, Development).
4. Click **Save**, then go to **Deployments** and **Redeploy** the latest one.

**The redeploy is required.** Environment variables are only picked up when a
deployment is built, so without it the form will report that it is not
configured yet.

Two optional variables:

| Name | Default | Use |
|---|---|---|
| `APPLY_TO` | `hwasungcoldroom@gmail.com` | recipient for job applications |
| `BOOKING_TO` | falls back to `APPLY_TO` | recipient for callback requests, if you want them going somewhere else |
| `APPLY_FROM` | `Hwasung Careers <onboarding@resend.dev>` | change the sender, after step 4 |

---

## 4. About the sender address

Out of the box, mail is sent **from** `onboarding@resend.dev`. That works with
no setup at all, but Resend restricts it: **it can only deliver to the address
that owns the Resend account.** That is exactly why step 2 says to sign up with
hwasungcoldroom@gmail.com. Sign up with a different address and applications
will not arrive.

To send from your own domain instead — which looks more professional and is
worth doing eventually:

1. Resend → **Domains** → **Add Domain** → `hwasung1996.com`
2. Resend shows you DNS records. Add them wherever your domain's DNS lives.
3. Wait for it to verify (usually minutes, sometimes hours).
4. In Vercel, set `APPLY_FROM` to `Hwasung Careers <careers@hwasung1996.com>`
   and redeploy.

Until then, leave `APPLY_FROM` unset.

---

## 5. Test it

**Both forms use the same `RESEND_API_KEY`**, so configuring it once switches on
both.

**Job application** — open the Employment page, apply for a role, attach a real
CV, and submit.

- You should stay on the page and see a green **"Application received"** message.
- The email should arrive within seconds, with the CV attached.
- **Reply** goes straight to the applicant — their address is set as the
  reply-to, so you never have to copy it out.

**Callback request** — click **Book Now** in the header on any page, tick a
request type, enter a name and number, and submit. The email arrives with the
phone number as a tappable link. No CV, no reply-to — the form deliberately
collects no email address.

If something goes wrong, the forms now tell you what rather than failing
silently. To see the underlying reason: Vercel dashboard → your project →
**Logs**, then submit again and watch what appears.

| Message on the page | What it means |
|---|---|
| "not configured yet" | `RESEND_API_KEY` missing, or you didn't redeploy after adding it |
| "could not send ... just now" | Resend rejected it. Check Vercel logs — usually the sender address rule in step 4 |
| "could not reach the server" | `/api/apply` is 404ing. The `api/` folder is in the wrong place |
| "check these fields" | Validation. The message names the field |

---

## The 3 MB CV limit

The CV cap is **3 MB**, not 10 MB. Vercel limits a serverless request body to
4.5 MB, and the file is base64-encoded in transit, which inflates it by about a
third. 3 MB is the largest that reliably fits.

3 MB is generous for a PDF or DOCX CV. If you genuinely need larger, the file
has to be uploaded straight to storage (Vercel Blob or S3) with only a link
emailed — a bigger change. Ask if you want it.

The limit appears in three places and all three must agree:

- `employment.html` — the "Maximum file size: 3 MB" hint
- `script.js` — `MAX_BYTES`
- `api/apply.js` — `MAX_CV_BYTES` (the one that actually enforces it)

---

## What the function does about spam and abuse

- **Honeypot.** A hidden field bots tend to fill in. If it has anything in it,
  the function returns success and sends nothing.
- **Server-side validation.** Every field is re-checked on the server, so
  editing the page in devtools does not get past it.
- **Length caps.** Every field is truncated, so nobody can post a huge payload.
- **HTML escaping.** Applicant text is escaped before going into the email, so
  a malicious CV filename or message cannot inject markup into your inbox.
- **Position allow-list.** Only the three real job titles are accepted.

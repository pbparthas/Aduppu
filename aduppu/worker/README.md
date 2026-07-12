# Aduppu auth broker (Cloudflare Worker)

Keeps the Google session alive so the PWA doesn't ask you to sign in every
hour. It holds the **refresh token** in Cloudflare KV (never in the browser)
and mints fresh access tokens on demand. It only ever touches auth tokens —
your recipes still go browser → Google Drive directly and never pass through it.

## One-time setup

Everything runs from this `aduppu/worker/` folder.

### 1. Install Wrangler and log in
```bash
cd aduppu/worker
npm install
npx wrangler login       # opens a browser to authorise Cloudflare
```

### 2. Get your Google client secret
- Go to https://console.cloud.google.com/apis/credentials
- Open your existing OAuth 2.0 **Web application** client (the one whose ID is
  already baked into the app).
- Copy the **Client secret** (it's already there — the browser flow just never
  used it).
- Make sure **Authorized JavaScript origins** includes `https://aduppu.orionforge.dev`
  (already added). No redirect URI is needed — the popup flow uses `postmessage`.

### 3. Create the KV namespace
```bash
npx wrangler kv namespace create SESSIONS
```
Copy the printed `id` into `wrangler.toml` (replace `REPLACE_WITH_KV_NAMESPACE_ID`).

### 4. Store the secret
```bash
npx wrangler secret put GOOGLE_CLIENT_SECRET
# paste the client secret when prompted
```

### 5. (Optional) Enable AI recipe drafting
The `POST /recipe` endpoint drafts an everyday Indian home recipe for a named
dish via the **Gemini free tier**. It's optional — without a key the endpoint
returns `501` and the app simply hides the "Draft the recipe" button.

```bash
# Create a free key at https://aistudio.google.com/apikey
npx wrangler secret put GEMINI_API_KEY
# paste the Gemini API key when prompted
```

### 6. Deploy
```bash
npx wrangler deploy
```

### 7. Put it on auth.orionforge.dev
In the Cloudflare dashboard: **Workers & Pages → aduppu-auth → Settings →
Domains & Routes → Add → Custom Domain →** `auth.orionforge.dev`.
Cloudflare creates the DNS record automatically.

### 8. Turn it on in the app
Done — `AUTH_WORKER_DEFAULT = 'https://auth.orionforge.dev'` is set in
`app/src/lib/auth.js`, so every user gets persistent login by default. To point
at a *different* broker without a rebuild, run
`localStorage.setItem('ad_auth_worker','https://your-worker')` in the browser
console; clear it with `localStorage.removeItem('ad_auth_worker')`.

## The `/recipe` endpoint (AI recipe drafting)

`POST /recipe` drafts an everyday Indian home recipe for a dish that has no
method yet. It reuses the same auth and per-day rate-limit approach as the
photo-to-pantry `/vision` feature (see PLAN.md §16.4 and §13.1).

- **Body:** `{ name, cuisine, diet, ingredients }` (`ingredients` is the
  normalized string array).
- **Response:** `{ servings, time_minutes, ingredients_full, steps }`.
- **Auth:** requires a valid `ad_session` cookie (same KV lookup as `/refresh`)
  and an allowlisted `Origin`; anonymous calls get `401`.
- **Rate limit:** a per-day KV counter (`recipe:<YYYY-MM-DD>`), max
  **30/day** — beyond that returns `429`. The counter has a 2-day TTL.
- **No key configured:** returns `501 { error: 'not_configured' }` and the app
  hides the "Draft the recipe" button.
- **Upstream errors:** passed through as `502`; a Gemini quota `429` is
  surfaced to the app as `429`.

The Gemini call is isolated in one function (`callRecipeModel`) so swapping
providers is a one-function edit plus a secret swap. Set the key with
`wrangler secret put GEMINI_API_KEY` (step 5 above).

## Notes
- The **first** connection must grant consent so Google issues a refresh token;
  a new origin (aduppu.orionforge.dev) does this automatically.
- Sign out in the app calls `/revoke`, which revokes the refresh token and
  clears the session.
- Free tier is plenty: KV free tier and Workers free tier cover personal use.
  The Gemini free tier covers personal recipe-drafting volumes; the KV rate
  limit keeps usage inside the daily quota.

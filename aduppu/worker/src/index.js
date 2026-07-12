// Aduppu auth broker — a Cloudflare Worker that turns the browser's one-time
// Google authorization code into a long-lived session. It holds the refresh
// token in KV (never in the browser) and mints fresh access tokens on demand,
// so the PWA stays signed in without the hourly Google prompt.
//
// It only ever touches auth tokens — recipe data still goes browser → Google
// Drive directly and never passes through here.
//
// Endpoints (all POST, credentials/cookies required except /exchange which
// also accepts the first code):
//   /exchange  { code }        -> sets ad_session cookie, returns access token
//   /refresh                   -> returns a fresh access token (uses cookie)
//   /revoke                    -> revokes the refresh token, clears the session
//   /recipe    { name, ... }   -> AI-drafts an everyday Indian home recipe (Gemini)

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const COOKIE = 'ad_session';
const SESSION_TTL = 60 * 60 * 24 * 180; // 180 days

// Recipe drafting (§16.4) — same Gemini free-tier pattern as /vision (§13.1).
// The model call lives in one function so switching providers is a one-function
// edit plus a secret swap; keep the Worker zero-dependency (plain fetch).
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const RECIPE_DAILY_LIMIT = 30; // matches the free-tier daily quota guard

const form = (obj) => new URLSearchParams(obj);

function corsHeaders(origin, allowed) {
  const h = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  // Only echo the origin when it's allowlisted; on mismatch omit the header
  // entirely (never emit a fixed fallback origin — L3).
  if (origin && allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
const json = (obj, status, headers) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...headers } });

// The PWA uses the popup 'postmessage' flow; the desktop service uses a
// loopback redirect. Allow only those shapes so /exchange can't be pointed at
// an attacker-controlled redirect.
function isAllowedRedirect(uri) {
  if (uri === 'postmessage') return true;
  return /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}\/oauth\/callback$/.test(uri || '');
}

function getCookie(req, name) {
  const raw = req.headers.get('Cookie') || '';
  const m = raw.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? m[1] : null;
}
function newSessionId() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function setCookie(id, domain, maxAge) {
  // SameSite=None + Secure so it rides cross-subdomain (app → auth). Domain
  // shares it across *.orionforge.dev.
  const dom = domain ? `; Domain=${domain}` : '';
  return `${COOKIE}=${id}; HttpOnly; Secure; SameSite=None; Path=/${dom}; Max-Age=${maxAge}`;
}

async function googleToken(env, params) {
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, ...params }),
  });
  return { ok: r.ok, data: await r.json() };
}

// Draft an everyday Indian home recipe for a named dish. Guaranteed-parseable
// JSON via a response schema (same trick as callVisionModel). Throws
// Error('recipe <status>') on an upstream failure so the caller can map the
// Gemini status (esp. 429 quota) onto an app-facing status.
async function callRecipeModel(env, { name, cuisine, diet, ingredients }) {
  const PROMPT = `Write the everyday home-cooking recipe for "${name}", a ${diet} dish from ${cuisine} regional Indian cuisine. Known ingredients: ${ingredients.join(', ')}. Give realistic quantities for a typical family (servings), total time in minutes, a full ingredient list WITH quantities in metric/Indian kitchen units (cups, tsp, tbsp, grams), and 5-10 concise numbered steps in the authentic regional home style. Keep it practical for a home cook.`;
  const r = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            servings: { type: 'INTEGER' },
            time_minutes: { type: 'INTEGER' },
            ingredients_full: { type: 'ARRAY', items: { type: 'STRING' } },
            steps: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['ingredients_full', 'steps'],
        },
      },
    }),
  });
  if (!r.ok) throw new Error('recipe ' + r.status);
  const data = await r.json();
  const out = JSON.parse(data.candidates[0].content.parts[0].text);
  return {
    servings: out.servings,
    time_minutes: out.time_minutes,
    ingredients_full: out.ingredients_full,
    steps: out.steps,
  };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const ch = corsHeaders(origin, allowed);
    const domain = env.COOKIE_DOMAIN || '';

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });

    // CSRF guard (M1): a browser always sends Origin on a cross-origin POST.
    // Reject state-changing POSTs whose Origin is present but not allowlisted.
    // A missing Origin (non-browser — e.g. the desktop Node service, which sends
    // the session cookie explicitly, not ambiently) is not a CSRF vector.
    if (req.method === 'POST' && origin && !allowed.includes(origin)) {
      return json({ error: 'forbidden_origin' }, 403, ch);
    }

    try {
      if (url.pathname === '/exchange' && req.method === 'POST') {
        const { code, redirect_uri, code_verifier } = await req.json().catch(() => ({}));
        if (!code) return json({ error: 'missing_code' }, 400, ch);
        const redirect = redirect_uri || 'postmessage';
        if (!isAllowedRedirect(redirect)) return json({ error: 'bad_redirect' }, 400, ch);
        const { ok, data } = await googleToken(env, {
          code, redirect_uri: redirect, grant_type: 'authorization_code',
          ...(code_verifier ? { code_verifier } : {}),
        });
        if (!ok) { console.log('exchange_failed', JSON.stringify(data)); return json({ error: 'exchange_failed' }, 400, ch); }

        // Always mint a fresh session id (anti session-fixation — L5); carry the
        // refresh token forward from any prior session so a re-auth that Google
        // answers without a new refresh_token still works.
        const oldSid = getCookie(req, COOKIE);
        const existing = oldSid ? await env.SESSIONS.get(oldSid, 'json') : null;
        const sid = newSessionId();
        const refresh_token = data.refresh_token || existing?.refresh_token;
        // No refresh token means Google didn't grant offline access (usually a
        // returning grant). The app should re-consent.
        if (!refresh_token) return json({ error: 'no_refresh_token' }, 400, ch);
        await env.SESSIONS.put(sid, JSON.stringify({ refresh_token }), { expirationTtl: SESSION_TTL });
        if (oldSid && oldSid !== sid) await env.SESSIONS.delete(oldSid).catch(() => {});

        return json({ access_token: data.access_token, expires_in: data.expires_in }, 200, {
          ...ch, 'Set-Cookie': setCookie(sid, domain, SESSION_TTL),
        });
      }

      if (url.pathname === '/refresh' && req.method === 'POST') {
        const sid = getCookie(req, COOKIE);
        const s = sid ? await env.SESSIONS.get(sid, 'json') : null;
        if (!s?.refresh_token) return json({ error: 'no_session' }, 401, ch);
        const { ok, data } = await googleToken(env, {
          refresh_token: s.refresh_token, grant_type: 'refresh_token',
        });
        if (!ok) {
          if (data.error === 'invalid_grant') { await env.SESSIONS.delete(sid); return json({ error: 'revoked' }, 401, ch); }
          console.log('refresh_failed', JSON.stringify(data));
          return json({ error: 'refresh_failed' }, 400, ch);
        }
        // refresh the cookie's lifetime on use
        return json({ access_token: data.access_token, expires_in: data.expires_in }, 200, {
          ...ch, 'Set-Cookie': setCookie(sid, domain, SESSION_TTL),
        });
      }

      if (url.pathname === '/revoke' && req.method === 'POST') {
        const sid = getCookie(req, COOKIE);
        if (sid) {
          const s = await env.SESSIONS.get(sid, 'json');
          if (s?.refresh_token) {
            await fetch(REVOKE_URL, {
              method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: form({ token: s.refresh_token }),
            }).catch(() => {});
          }
          await env.SESSIONS.delete(sid);
        }
        return json({ ok: true }, 200, { ...ch, 'Set-Cookie': setCookie('', domain, 0) });
      }

      if (url.pathname === '/recipe' && req.method === 'POST') {
        // Auth: a valid session cookie only (same KV lookup as /refresh). The
        // top-level CSRF guard already rejected any non-allowlisted Origin.
        const sid = getCookie(req, COOKIE);
        const s = sid ? await env.SESSIONS.get(sid, 'json') : null;
        if (!s?.refresh_token) return json({ error: 'no_session' }, 401, ch);

        // Without the Gemini secret the feature is off; the app hides the
        // "Draft the recipe" button after a 501.
        if (!env.GEMINI_API_KEY) return json({ error: 'not_configured' }, 501, ch);

        // Rate-limit via a per-day KV counter (protects the free-tier quota).
        const bucket = 'recipe:' + new Date().toISOString().slice(0, 10);
        const used = parseInt((await env.SESSIONS.get(bucket)) || '0', 10) || 0;
        if (used >= RECIPE_DAILY_LIMIT) return json({ error: 'rate_limited' }, 429, ch);

        const { name, cuisine, diet, ingredients } = await req.json().catch(() => ({}));
        if (!name) return json({ error: 'missing_name' }, 400, ch);

        let recipe;
        try {
          recipe = await callRecipeModel(env, {
            name,
            cuisine: cuisine || 'Indian',
            diet: diet || 'vegetarian',
            ingredients: Array.isArray(ingredients) ? ingredients : [],
          });
        } catch (e) {
          const status = parseInt(String(e).match(/recipe (\d+)/)?.[1] || '0', 10);
          // Gemini quota exhaustion -> 429 to the app ("daily draft quota reached").
          if (status === 429) return json({ error: 'rate_limited' }, 429, ch);
          console.log('recipe_failed', String(e));
          return json({ error: 'upstream' }, 502, ch);
        }

        // Count only successful drafts against the daily bucket; 2-day TTL so
        // yesterday's bucket self-expires.
        await env.SESSIONS.put(bucket, String(used + 1), { expirationTtl: 60 * 60 * 24 * 2 });
        return json(recipe, 200, ch);
      }

      return json({ error: 'not_found' }, 404, ch);
    } catch (e) {
      console.log('server_error', String(e));
      return json({ error: 'server_error' }, 500, ch);
    }
  },
};

# Aduppu v3 — Implementation Plan (Nisaba-pattern rebuild)

> Supersedes the v2 Firebase plan (see git history of this file). Decided with the
> owner on 2026-07-09: rebuild Aduppu on the **Nisaba architecture** — React + Vite
> PWA on GitHub Pages at `aduppu.orionforge.dev`, a Cloudflare Worker auth broker,
> and **the owner's own Google Drive as storage** (per-item JSON files, offline-first
> IndexedDB replica, background sync). No Firebase, no server that sees data.
>
> This document is the complete spec for the implementing agent. The reference
> implementation is the owner's Nisaba repo — clone `pbparthas/Nisaba` and port
> from `nisaba/` as directed below. Where this plan and Nisaba's code disagree,
> this plan wins.

---

## 0. Ground rules

- **Branch**: develop on `claude/meal-planner-review-8yy67r` in `pbparthas/Aduppu`, push there.
- **Reference**: `git clone --depth 1 https://github.com/pbparthas/nisaba` and port
  from `nisaba/app`, `nisaba/worker`, `nisaba/docs`, `.github/workflows/deploy-pages.yml`.
- Plain JavaScript (no TypeScript), ESM, React 19 function components — matching Nisaba.
- Keep ported files as close to Nisaba's originals as possible (same structure,
  same comments-style) so fixes can flow between the two apps. Deviations only
  where this plan says so.
- v1 (`aduppu.html`) stays in the repo root untouched as reference until v3 ships.

## 1. What Aduppu is

A personal South Indian meal planner: plan the week's breakfast/lunch/dinner,
log what was actually eaten (home-cooked vs ordered, with ₹ cost), keep a dish
catalog with ingredients + optional recipe details, suggest what to cook from
what's in the kitchen, and track home-vs-out stats and grocery spend. Currency ₹,
dates in local time (IST in practice), en-IN formatting.

**Usage assumption (owner-confirmed):** one user, one primary mobile device per
login. Drive sync exists for durability (phone loss/wipe, future device
migration), not for concurrent multi-device editing. Consequence: the simple
merge choices below (newer-wins for every type, whole-list pantry singleton)
are deliberate and final for v1 — do NOT add conflict copies, field-level
merging, or CRDT-style pantry merging.

## 2. Repository layout (target)

```
Aduppu/
├── aduppu/
│   ├── app/                    # React 19 + Vite PWA
│   │   ├── index.html
│   │   ├── vite.config.js
│   │   ├── package.json
│   │   ├── public/
│   │   │   ├── icon.svg
│   │   │   ├── pwa-192.png  pwa-512.png  pwa-512-maskable.png
│   │   │   ├── manifest.webmanifest
│   │   │   └── CNAME               # "aduppu.orionforge.dev"
│   │   ├── src/
│   │   │   ├── main.jsx
│   │   │   ├── App.jsx             # shell: header, tabs, sign-in gate, settings
│   │   │   ├── styles.css          # ported design system, terracotta accent
│   │   │   ├── tabs/
│   │   │   │   ├── Today.jsx
│   │   │   │   ├── Plan.jsx
│   │   │   │   ├── Cook.jsx
│   │   │   │   └── Track.jsx
│   │   │   └── lib/
│   │   │       ├── auth.js         # ported (Worker + GIS modes; no desktop mode)
│   │   │       ├── drive.js        # ported (folder "Aduppu")
│   │   │       ├── sync.js         # ported verbatim
│   │   │       ├── merge.js        # simplified: LWW for all types
│   │   │       ├── store-idb.js    # ported (db name "aduppu")
│   │   │       ├── store-memory.js # ported (tests)
│   │   │       ├── theme.js        # ported (keys "ad:*", terracotta theme-colors)
│   │   │       ├── pwaInstall.js   # ported verbatim
│   │   │       ├── dates.js        # NEW — local-date helpers (IST-safe)
│   │   │       ├── model.js        # NEW — item shapes, defaults seed, backup
│   │   │       ├── randomizer.js   # NEW — repeat-avoiding meal picker
│   │   │       └── kitchen.js      # NEW — pantry matching for "From my kitchen"
│   │   └── test/
│   │       ├── mock-drive.js       # ported verbatim
│   │       ├── sync.test.js        # ported, item shapes adapted
│   │       ├── merge.test.js       # rewritten for LWW
│   │       ├── randomizer.test.js  # NEW
│   │       ├── kitchen.test.js     # NEW
│   │       └── dates.test.js       # NEW
│   ├── worker/                 # Cloudflare Worker auth broker
│   │   ├── src/index.js        # ported; cookie "ad_session"
│   │   ├── wrangler.toml       # name "aduppu-auth"
│   │   ├── package.json
│   │   └── README.md
│   └── docs/
│       └── GOOGLE_SETUP.md     # adapted from Nisaba's
├── .github/workflows/deploy-pages.yml
├── README.md                   # rewritten for v3
├── PLAN.md                     # this file
├── aduppu.html                 # v1, kept as reference
└── LICENSE
```

Delete `manifest.json`, `sw.js`, `icons/` from the repo root once `aduppu/app`
exists (they were half-wired v2 groundwork; vite-plugin-pwa replaces them).

## 3. Infrastructure config (differences from Nisaba)

| Setting | Nisaba | Aduppu |
|---|---|---|
| App URL | nisaba.orionforge.dev | **aduppu.orionforge.dev** |
| Worker name | nisaba-auth | **aduppu-auth** |
| Worker URL | auth.orionforge.dev | **aduppu-auth.orionforge.dev** |
| Session cookie | `ns_session` | **`ad_session`** |
| COOKIE_DOMAIN | orionforge.dev | orionforge.dev (same) |
| ALLOWED_ORIGINS | nisaba origin + localhost:5173 | `https://aduppu.orionforge.dev,http://localhost:5173` |
| OAuth client | Nisaba's own | **new, separate client** (drive.file visibility is per-client; sharing would let each app see the other's files) |
| Drive folder | `Nisaba/` | **`Aduppu/`** (`items/` subfolder; `attachments/` created but unused in v1) |
| IndexedDB name | `nisaba` | **`aduppu`** |
| localStorage keys | `ns_*` / `ns:*` | **`ad_*` / `ad:*`** |
| AUTH_WORKER_DEFAULT (auth.js) | https://auth.orionforge.dev | **https://aduppu-auth.orionforge.dev** |
| DEFAULT_CLIENT_ID (App.jsx) | baked-in Nisaba id | leave placeholder `''` → app shows the SetupScreen (paste client id) until the owner creates one; bake it in afterwards |

`wrangler.toml` keeps the KV id as `REPLACE_WITH_KV_NAMESPACE_ID` and a comment
with the create command, exactly like Nisaba's.

## 4. Data model

Every item is one JSON file `Aduppu/items/<id>.json` in Drive, one row in the
IDB `items` store. Common envelope (see Nisaba `merge.js#newItem`):

```js
{ schema: 1, id, type, deleted: false, deleted_at: null,
  created_at, updated_at }           // + local-only `dirty: 0|1`
```

Types:

```js
// Dish — catalog entry; recipe fields are optional extras on the SAME type.
{ type: 'dish', name: 'Kara Kuzhambu', meal: 'breakfast'|'lunch'|'dinner',
  ingredients: ['tamarind','onion', ...],   // normalized lowercase strings
  tags: ['spicy','one-pot'], ref: '',       // source: book / URL / "Paati"
  notes: '' }                               // free-text prep notes

// Plan — ONE PER CALENDAR DAY, deterministic id so devices converge.
{ id: 'plan-2026-07-09', type: 'plan', date: '2026-07-09',
  meals: { breakfast: 'Idli', lunch: '', dinner: '' } }  // dish names, '' = unset

// Log — what was actually eaten.
{ type: 'log', date: '2026-07-09', meal: 'breakfast',
  mode: 'home'|'out', dish: 'Idli with sambar', cost: 0, notes: '' }

// Grocery spend entry.
{ type: 'grocery', date: '2026-07-09', amount: 450, note: 'weekly vegetables' }
```

Decisions:
- Plans reference dishes **by name** (strings), not id — survives dish deletion,
  allows free-text meals, matches v1 behavior.
- `plan-<date>` ids are the ONLY deterministic ids; everything else uses
  `crypto.randomUUID()`.
- **Merge policy: newer-wins (LWW) for every type. No conflict copies.**
  `merge.js` keeps `resolveItem(remote, local)` with the same signature but the
  conflict-copy branch is removed (a meal-slot race doesn't merit duplicates).
- **Pantry** (ingredients on hand) is device-synced app state, not a per-item
  file: store as a singleton item `{ id: 'pantry', type: 'pantry',
  items: ['rice','toor dal',...] }` so it syncs like everything else.

### Seeding defaults

Port v1's `DEFAULTS` dish lists (8 breakfast / 9 lunch / 8 dinner South Indian
dishes — copy names+ingredients verbatim from `aduppu.html` lines 407–439) into
`model.js`. On startup, if the store has no dish items AND meta `seeded` unset:
insert them with **deterministic ids** (`seed-breakfast-1` … `seed-dinner-8`),
`dirty: 1`, and set meta `seeded = 1`. Deterministic ids mean two devices that
both seed produce the same Drive files and converge instead of duplicating.
A seeded dish the user deletes stays deleted (tombstone syncs; the `seeded`
meta prevents re-seeding).

## 5. Core algorithms

### 5.1 Local dates (`dates.js`) — fixes v1's IST bug

Never use `toISOString()` for calendar dates (it returns UTC; before 05:30 IST
that's *yesterday*). Provide:

```js
localDateStr(d = new Date())   // 'YYYY-MM-DD' from getFullYear/getMonth/getDate
addDays(dateStr, n)            // string in, string out
weekDates(anchor = today)      // [Mon..Sun] containing anchor, as date strings
dayLabel(dateStr)              // 'Today' / 'Yesterday' / 'Tomorrow' / weekday / '9 Jul'
```

Unit-test with a fixed Date at `2026-07-09T00:30+05:30` equivalent to prove the
local date is used.

### 5.2 Randomizer (`randomizer.js`)

```js
NO_REPEAT_DAYS = { breakfast: 2, lunch: 10, dinner: 3 }

pickDish(meal, date, { dishes, plans, logs, exclude = [] })
```

1. Build `lastUsed[name]` for this meal: latest date each dish name appears in
   any plan item's `meals[meal]` or any log's `dish` (exact name match) with
   `date < target date`.
2. Pool = dishes of that meal, minus `exclude`, minus names used within
   `NO_REPEAT_DAYS[meal]` days before `date`.
3. If pool is non-empty → uniform random pick.
4. If pool is empty → relax: pick the **least-recently-used** name (never-used
   first); still honor `exclude`.
5. Return the dish name, or `null` if the meal has no dishes at all.

Semantics in the UI:
- **Randomize day / Randomize week**: fill **empty slots only** — never
  overwrite a slot the user set. Sequential fill, passing already-chosen names
  for that day in `exclude` so one day never repeats itself.
- **Per-slot 🎲**: rerolls that slot, `exclude = [currentValue]`.

Pure functions over passed-in data — fully unit-testable (test: window
exclusion per meal type, LRU fallback when pool exhausted, fill-only behavior,
no same-day duplicates).

### 5.3 Kitchen matching (`kitchen.js`) — replaces v1's substring matcher

v1's bidirectional substring match made "rice" satisfy "rice flour". New rules:

```js
STAPLES = ['salt','oil','water','mustard','mustard seeds','curry leaves',
           'turmeric','ghee','sugar','asafoetida','cumin','jeera']

normalize(s)   // lowercase, trim, collapse spaces, strip trailing 's' per word

matchDish(dish, pantry, { staplesOn = true })
// required = dish.ingredients, minus STAPLES when staplesOn
// an ingredient is available iff normalize-equal to a pantry entry
// → { status: 'full' | 'partial' | 'none', have, missing, score }
// full: every required available; partial: score >= 0.5
```

Staples toggle ("I have the basics") defaults ON and is remembered in
localStorage. Tests: exact-match only ("rice" ≠ "rice flour"), plural
insensitivity ("tomatoes" = "tomato"), staples exclusion flips a partial to full.

### 5.4 Backup (`model.js`)

`exportAll(store)` → JSON blob `{ app:'aduppu', schema:1, exported_at, items:[...] }`
download as `aduppu-backup-YYYY-MM-DD.json`. `importAll(store, json)` upserts by
id keeping the newer `updated_at`, marks imported items dirty, returns counts.

## 6. Ported infrastructure — file by file

| Target | Source (in Nisaba repo) | Changes |
|---|---|---|
| `app/src/lib/sync.js` | `app/src/lib/sync.js` | verbatim (attachment paths stay; they no-op with no attachments) |
| `app/src/lib/drive.js` | `app/src/lib/drive.js` | folder name `Aduppu`; boundary prefix `aduppu-` |
| `app/src/lib/store-idb.js` | same | DB name `aduppu` |
| `app/src/lib/store-memory.js` | same | verbatim |
| `app/src/lib/auth.js` | same | delete `createServiceAuth` + `serviceConfig` (no desktop); `ns_*` keys → `ad_*`; `AUTH_WORKER_DEFAULT = 'https://aduppu-auth.orionforge.dev'`; override key `ad_auth_worker` |
| `app/src/lib/merge.js` | same | drop conflict-copy branch + `bodyEqual`; `newItem` defaults per §4 |
| `app/src/lib/theme.js` | same | key `ad:mode`; `THEME_COLOR = { paper:'#e2d6ba', dark:'#171410' }` (unchanged values) |
| `app/src/lib/pwaInstall.js` | same | verbatim |
| `app/test/mock-drive.js` | `app/test/mock-drive.js` | verbatim |
| `app/test/sync.test.js` | `app/test/sync.test.js` | adapt item fixtures to §4 shapes; drop conflict-copy assertions; keep two-device round-trip, tombstone GC, md5/version tests |
| `worker/src/index.js` | `worker/src/index.js` | cookie const `ad_session`; comment header says Aduppu |
| `worker/wrangler.toml` | `worker/wrangler.toml` | name/vars per §3 |
| `worker/README.md` | `worker/README.md` | names/URLs per §3 |
| `docs/GOOGLE_SETUP.md` | `docs/GOOGLE_SETUP.md` | s/Nisaba/Aduppu/; origins list = localhost:5173 + aduppu.orionforge.dev; project name `Aduppu` |
| `.github/workflows/deploy-pages.yml` | same | working-directory `aduppu/app`; name "Deploy Aduppu…"; trigger paths `aduppu/**` |
| `app/vite.config.js` | same | env var `ADUPPU_BASE`; same PWA/workbox config; `includeAssets` for our icon files |
| `app/index.html` | same | title Aduppu, theme-color `#e2d6ba` |
| `app/src/main.jsx` | same | keep structure (SW register, storage.persist, chunk-reload guard, theme before paint); fonts per §8; no notePrefs |

`app/package.json` dependencies: `react`, `react-dom`,
`@fontsource/inter` (400/500/600/700), `@fontsource/saira-condensed`
(400/600/800), `@fontsource/caveat` (700). Dev: `vite`, `@vitejs/plugin-react`,
`vite-plugin-pwa`, `vitest`, `playwright-core`. **No BlockNote, no other fonts.**

## 7. UI spec

Shell = Nisaba's exactly: sticky blurred header (logo + wordmark, sync status
pill, gear), 640px column, fixed bottom tab bar with safe-area padding, FAB
where noted, `.card` lists, eyebrow section headings, long-press multi-select
where noted. Port `App.jsx`'s shell scaffolding (tabs state, selection mode,
status wiring, sign-in gate, Settings) and replace the Notes/Tasks screens with
the four tabs below.

**Tabs**: 🍳 wordless icons + labels TODAY · PLAN · COOK · TRACK (Saira
Condensed uppercase, like Nisaba's). Settings via gear only.

### Sign-in gate
Port `SignInScreen` + `SetupScreen` verbatim (Aduppu logo/wordmark/copy:
"Your meals, planned from your own kitchen — synced through your own Google
Drive."). Same `ad_skip_signin` semantics. **Status pill: when the user chose
local-only, show neutral gray `local`, not red** — red is reserved for real
errors (`offline`, `update app`). `tap to sync` appears only after a previously
signed-in session loses auth.

### Today
- Date heading (eyebrow `TODAY` + "Thursday, 9 July" display line).
- Three meal cards (Breakfast / Lunch / Dinner), each showing:
  - the **planned** dish for today's plan item (or "Nothing planned" + 🎲),
  - per-slot 🎲 (reroll semantics §5.2),
  - **"Cooked this ✓"** one-tap button when planned & not yet logged → creates
    `{type:'log', mode:'home', dish: planned}` instantly (toast + Undo),
  - logged entries for that meal today (mode chip 🏠/🛵, cost, notes), each
    tappable to edit inline, deletable (Undo toast, no confirm dialog),
  - an **inline log composer** (Nisaba's add-composer pattern): text input +
    home/out toggle + ₹ cost (shown for "out") + optional note; Enter saves.
- Summary strip when there are logs today: cooked n · ordered n · ₹ spent.

### Plan
- Seven day-pills (Mon–Sun of current week) + ‹ › week arrows; today
  highlighted, past days dimmed. Selected day defaults to today.
- Selected day: three meal boxes — planned name (tap to edit as inline text
  input with dish-name autocomplete from the catalog), per-slot 🎲, "pick from
  catalog" opens the Cook-style list in a bottom sheet, "✓ had this" logged
  indicator when a log matches that day+meal.
- Buttons: **Fill day 🎲** and **Fill week 🎲** (fill-empty-only, §5.2).
- Below, a compact **week overview**: 7 rows × 3 meal chips (no horizontal
  scroll grid — the 640px column stacks).

### Cook
- Search bar (Nisaba's pill search) filtering by name / ingredient / tag.
- Mode toggle pills: **All dishes | From my kitchen**.
- *All dishes*: meal-type filter chips (All/Breakfast/Lunch/Dinner); dish cards
  grouped by meal with eyebrow headings; card = name + ingredient preview +
  tag chips; expands in place (Nisaba task-card pattern) to full ingredients,
  ref, notes, meal selector — all inline-editable; ⋯ menu → Delete (Undo
  toast). Inline **add composer** at top: name + meal select, Enter saves,
  expand-to-edit for details.
- *From my kitchen*: pantry chip input (type + Enter adds a chip, ✕ removes;
  persisted via the `pantry` item), "I have the basics" staples toggle, then
  two sections: **Can cook now** (full matches) and **Almost there** (partial,
  sorted by score, "Need: …" line). Each result: "Plan it →" (day/meal picker
  sheet) and "Log it" shortcuts.

### Track
- Range toggle pills: **7 days | This month | All**.
- Natural-language summary card: "You cooked 12 meals and ordered 3 this
  week. Orders ₹850, groceries ₹1,200."
- 2×2 stat tiles (home-cooked, ordered, order spend, grocery spend) styled as
  `.card` with big number (Saira Condensed).
- Grocery: inline add composer (date defaults today, ₹ amount, note) + recent
  entries list, edit/delete.
- Meal log: entries grouped by day buckets (Nisaba's `groupByCreated` pattern
  keyed on `log.date`), row = meal chip + mode chip + dish + ₹ + note; tap to
  edit inline; long-press multi-select → bulk delete (selbar).

### Settings (gear)
Port Nisaba's Settings structure, minus Note-text card, minus Trash:
- **Appearance**: Paper / Lights out toggle.
- **Account & sync**: Drive status pill, item count, Connect/Sign out.
- **App & storage**: install state + Install button (pwaInstall), offline-copy
  persistence row, **Export backup** / **Import backup** buttons (§5.4).
- **About**: one paragraph ("Aduppu — your kitchen's rhythm… data lives in
  your own Google Drive as plain JSON. அடுப்பு = hearth.").

### Identity
- `Logo` component: stroke-based SVG, `currentColor` + `var(--accent)` (like
  Nisaba's): a rounded **clay pot** arc sitting on three hearth stones with a
  three-tongue **flame** above in accent. Keep it legible at 16px.
- Wordmark "Aduppu" in Caveat 700 (`.word` class swap; no text-stroke needed —
  Caveat is heavier than Great Vibes).
- `public/icon.svg`: the mark on paper background, rounded-square. Generate
  `pwa-192/512/maskable` PNGs by rendering the SVG in headless Chromium
  (playwright-core script in `app/scripts/gen-icons.cjs`; chromium at
  `/opt/pw-browsers/chromium` in the dev container).

## 8. Styles

Port `styles.css` wholesale, then:
- Accent swap: `--accent: #b5541c` (terracotta); dark mode `--accent: #e0824a`;
  `--accent-ink: #fdf3e7`. Everything else in the palette (paper canvas, cards,
  ink, gold, overdue/success) stays.
- Delete: note-ink blocks, per-note color palette (`--nc-*`, `[data-color]`),
  BlockNote (`.bn-*`), font-dropdown, swatch/color-pop, thumbs, note-card
  specifics, trash styles.
- Add (following existing patterns): meal chips (`.chip` variants for
  breakfast/lunch/dinner using accent/gold/muted washes — stay within the
  one-accent discipline: tint, don't rainbow), stat tiles, week-overview rows,
  mode toggle (home/out), summary strip, pantry chip input.
- Keep: reduced-motion, focus-visible, safe-areas, selection bar, sheets.

## 9. App wiring (App.jsx)

Same skeleton as Nisaba's `App.jsx`:
- `store` singleton, `useMemo` auth+drive+engine on `clientId`.
- 30s interval + focus-listener sync; `engine.gc()` after sync.
- `saveItem(partial)` = upsert + `updated_at` + `dirty:1` + `engine.schedule()`.
- Seed defaults (§4) in the initial `useEffect` before first `refresh()`.
- Derived state per tab from `items`: `dishes`, `plansByDate` (Map),
  `logsByDate`, `grocery`, `pantry`.
- Undo toast helper: `deleteWithUndo(item)` tombstones immediately, shows toast
  5s with Undo → restores (`deleted:false`). One toast at a time.
- STATUS_LABEL per Nisaba minus the guilt-red mapping change (§7 sign-in).

## 10. Build order (suggested commits)

1. **Scaffold**: `aduppu/app` (package.json, vite config, index.html, main.jsx,
   empty App shell rendering header+tabs), remove root `manifest.json`/`sw.js`/
   `icons/`. `npm run dev` shows the shell.
2. **Lib port**: all §6 files + `dates/model/randomizer/kitchen` + all tests.
   `npm test` green. (Biggest verification win — sync engine proven against
   mock Drive before any UI exists.)
3. **Styles + identity**: styles.css port with terracotta, Logo, icons script,
   manifest, CNAME.
4. **Tabs**: Today → Plan → Cook → Track → Settings, in that order (Today
   exercises logs+plans+randomizer; the rest reuse those patterns).
5. **Worker + docs**: `aduppu/worker`, `docs/GOOGLE_SETUP.md`, deploy workflow,
   README rewrite.
6. **Verify** (§11), fix, push.

## 11. Verification

- `npm test` — all suites green.
- `npm run build` — clean; inspect `dist/` size (should be ~⅓ of Nisaba's, no
  BlockNote).
- Playwright smoke script (pattern exists from the review session): dev server
  + headless Chromium (`/opt/pw-browsers/chromium`), viewport 390×844:
  skip sign-in → seed visible in Cook → plan a day via 🎲 → "Cooked this ✓" on
  Today → log an ordered meal with cost → Track shows correct stats → dark
  mode → screenshots of all five screens. Attach screenshots to the PR/summary.
- Manual checklist in the summary for the owner (things only they can do):
  1. Google Cloud: new project `Aduppu`, enable Drive API, consent screen →
     publish, Web client id with origins `http://localhost:5173` +
     `https://aduppu.orionforge.dev` (docs/GOOGLE_SETUP.md walks through it).
  2. Bake the client id into `App.jsx` `DEFAULT_CLIENT_ID` (or paste it into
     the app's setup screen at runtime).
  3. Worker: `wrangler kv namespace create SESSIONS` → id into wrangler.toml,
     `wrangler secret put GOOGLE_CLIENT_SECRET`, `wrangler deploy`, add custom
     domain `aduppu-auth.orionforge.dev`.
  4. GitHub Pages: enable for the repo (workflow deploys `aduppu/app/dist`),
     custom domain `aduppu.orionforge.dev` (CNAME file ships in `public/`),
     DNS CNAME in Cloudflare → `pbparthas.github.io`, enforce HTTPS.

## 12. Out of scope (deliberate, for later)

- Recipe photos (sync engine's attachment support is ported but dormant — no UI).
- Trash/restore screen (tombstones + 30-day GC run underneath; Undo toast
  covers the immediate-mistake case).
- Desktop (Tauri) shell, local REST/MCP service, multi-user/family sharing.
- Grid week view for wide screens; nutrition data.
- Cross-app bridge to Nisaba (e.g. "send shopping list as a Nisaba task").
  Deliberately not built: the apps use separate OAuth clients, so with
  `drive.file` scope neither can see the other's Drive files — bridging would
  require sharing one OAuth client (reversing the isolation decision in §3)
  and coupling Aduppu to Nisaba's item schema. The shopping list is native to
  Aduppu instead (§13.2). Revisit only if the owner asks again after using it.

## 13. Phase 2 — owner-requested features (build AFTER core v3 ships and is verified)

Do not start these until §11 verification passes and the owner has the core
app deployed. Both are specced here so no re-design is needed.

### 13.1 Photo-to-pantry ("scan my kitchen")

Take a photo of ingredients/shelf/fridge; a vision model extracts an
ingredient list that prefills the pantry chips in Cook → "From my kitchen".

**Architecture:** the browser never holds an AI API key. Add one endpoint to
the existing auth Worker (`aduppu/worker`), which already holds secrets and
allowlists origins:

- `POST /vision` — body `{ image: <base64 jpeg>, media_type: 'image/jpeg' }`.
  Auth: require a valid `ad_session` cookie (same KV lookup as `/refresh`) AND
  the CORS origin allowlist — the endpoint spends money, so anonymous calls
  must 401. Rate-limit via KV counter (e.g. key `vision:<date>`, max 30/day,
  429 beyond).
- Worker calls the Claude API with the official TypeScript SDK
  (`@anthropic-ai/sdk` — fetch-based, runs on Cloudflare Workers). API key via
  `wrangler secret put ANTHROPIC_API_KEY`. Model: **`claude-opus-4-8`**.
  Use structured outputs so the reply is guaranteed-parseable JSON:

  ```js
  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    output_config: { format: { type: 'json_schema', schema: {
      type: 'object',
      properties: { ingredients: { type: 'array', items: { type: 'string' } } },
      required: ['ingredients'], additionalProperties: false,
    } } },
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type, data: image } },
      { type: 'text', text:
        'List every food ingredient you can identify in this photo of a home kitchen. ' +
        'Use common English grocery names in lowercase singular form (e.g. "tomato", ' +
        '"toor dal", "curry leaves", "rice flour"). Indian/South Indian household context. ' +
        'Only include items you can actually see; do not guess at closed containers.' },
    ] }],
  });
  const { ingredients } = JSON.parse(msg.content.find(b => b.type === 'text').text);
  ```

- Worker responds `{ ingredients: [...] }`; on Claude API error, pass through
  a 502 with a short message.

**App side (Cook tab):**
- 📷 "Scan my kitchen" button next to the pantry chip input. Hidden when
  offline (`navigator.onLine`) or not signed in (no session cookie → 401).
- `<input type="file" accept="image/*" capture="environment">` → downscale on
  a canvas to ≤1280px long edge, JPEG quality 0.8 (controls upload size and
  image-token cost; full-res would cost ~3× for no recognition benefit) →
  base64 → `fetch(worker + '/vision', { credentials: 'include', ... })`.
- Results render as **pending chips** (visually distinct, e.g. dashed border)
  the user confirms or removes before they merge into the pantry item —
  vision output is good but not infallible; never silently overwrite the
  pantry. Normalize through `kitchen.js#normalize` before merging; drop
  duplicates against existing pantry entries.
- Spinner + "reading your kitchen…" state; errors surface as a toast.

**Cost note for the owner:** ~1 photo ≈ 1,500–2,500 input tokens + ~100
output ≈ $0.01–0.02 (₹1–2) per scan at Opus 4.8 rates. Owner setup: create an
Anthropic API key (console.anthropic.com) and `wrangler secret put
ANTHROPIC_API_KEY`. If the key/secret is absent the Worker returns 501 and
the app hides the scan button after the first 501.

### 13.2 Shopping list (checklist, native to Aduppu — not a Nisaba task)

Owner decision (2026-07-09): the shopping list lives **in Aduppu**, not as a
task pushed to Nisaba — see §12 for why the cross-app bridge is out. The
in-app version also enables a loop Nisaba can't: buying an item updates the
pantry, which improves "From my kitchen" matching.

**Data:** one synced singleton, same pattern as pantry (single-device LWW):

```js
{ id: 'shopping', type: 'shopping',
  items: [ { id, name, note: '', done: false, from: 'plan'|'manual' } ] }
```

**Generation:** button "Build list from plan" on the shopping sheet:
1. Collect ingredients of every dish planned for the next 7 days (today
   inclusive; dish names resolved against the catalog, unknown names skipped).
2. Subtract pantry entries and STAPLES (normalized matching via `kitchen.js`).
3. Dedupe against items already on the list (by normalized name).
4. Present the candidates as pending additions the user confirms (same
   pending-chip pattern as §13.1) — never auto-add.

**UI:** a bottom-sheet (Nisaba `.overlay`/`.panel` pattern) opened from a
🛒 button in the Plan tab header, plus a Settings row. Checklist rows use
Nisaba's `.tick` pattern; inline add-composer for manual items; count badge
on the 🛒 button while any unchecked items exist.

**The pantry loop:** "Clear bought" removes checked items from the list and
adds their names to the pantry item (normalized, deduped) in one action, with
an Undo toast covering the whole batch.

**Reminders:** deliberately none in this phase. A PWA cannot fire reliable
scheduled notifications without a push server (out of scope; the Worker could
host Web Push later if the owner asks). The checklist + badge is the v1
reminder surface.

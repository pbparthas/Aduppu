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
- **FIRST TASK — remove the stale v2 implementation.** Commit `eb2521d`
  ("Implement Aduppu v2: full PWA redesign with Firebase…") on this branch
  was produced by an old session against the superseded Firebase plan and
  contradicts this document. Before anything else, `git revert eb2521d`
  (keeps it recoverable in history), which removes `index.html`, `css/`,
  `js/`, and restores `sw.js`. None of its code is to be reused — this plan's
  architecture (Nisaba pattern, no Firebase) replaces it entirely.
- **Reference**: `git clone --depth 1 https://github.com/pbparthas/nisaba` and port
  from `nisaba/app`, `nisaba/worker`, `nisaba/docs`, `.github/workflows/deploy-pages.yml`.
- Plain JavaScript (no TypeScript), ESM, React 19 function components — matching Nisaba.
- Keep ported files as close to Nisaba's originals as possible (same structure,
  same comments-style) so fixes can flow between the two apps. Deviations only
  where this plan says so.
- v1 (`aduppu.html`) stays in the repo root untouched as reference until v3 ships.

## 1. What Aduppu is

A personal Indian meal planner: plan the week's breakfast/lunch/dinner, log
what was actually eaten (home-cooked vs ordered, with ₹ cost), keep a dish
catalog with ingredients + optional recipe details, suggest what to cook from
what's in the kitchen, and track home-vs-out stats and grocery spend.
**Cuisine and diet are first-class dimensions** (owner requirements,
2026-07-09): every dish belongs to a regional Indian cuisine — a two-level
taxonomy where the southern states split out (Tamil Nadu, Kerala, Karnataka,
Andhra, Telangana, Goan) and Tamil Nadu / Kerala / Karnataka have
sub-regional cuisines (Chettinad, Malabar, Udupi–Mangalore, …). Every dish is
also marked veg / egg / non-veg. The user picks a **diet preference** and
**favorite cuisines** at first run, can change both in Settings, and is asked
which cuisine to plan for when filling a day/week. Diet is a hard constraint
everywhere — a vegetarian user must never be suggested a non-veg dish.
Currency ₹, dates in local time (IST in practice), en-IN formatting.

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
  cuisine: 'tamil-nadu',                    // any key from CUISINES (§4.1) — region
                                            // OR sub-cuisine key; 'other' allowed
  diet: 'veg',                              // 'veg' | 'egg' | 'nonveg' (FSSAI trio)
  ingredients: ['tamarind','onion', ...],   // normalized lowercase strings
  tags: ['spicy','one-pot'], ref: '',       // source: book / URL / "Paati"
  notes: '' }                               // free-text prep notes

// Prefs — synced singleton (deterministic id), same pattern as pantry.
{ id: 'prefs', type: 'prefs',
  diet: 'veg' | 'veg-egg' | 'all',          // asked explicitly at onboarding
  cuisines: ['tamil-nadu','kerala:malabar'] } // ≥1; region keys select the whole
                                              // region, 'region:sub' keys select
                                              // one sub-cuisine only

// Plan — ONE PER CALENDAR DAY, deterministic id so devices converge.
{ id: 'plan-2026-07-09', type: 'plan', date: '2026-07-09',
  cuisine: null,                            // set when the day was filled for a chosen
                                            // cuisine; guides per-slot rerolls
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

### 4.1 Cuisines (canonical two-level taxonomy)

There is no single "South Indian" cuisine — the southern states are top-level
regions, and Tamil Nadu / Kerala / Karnataka carry sub-regional cuisines.
`model.js` exports the data-driven tree — adding a region or sub later is one
entry plus its seed dishes:

```js
CUISINES = [
  { key: 'tamil-nadu', label: 'Tamil Nadu', subs: [
      { key: 'tamil-nadu:chettinad', label: 'Chettinad' },
      { key: 'tamil-nadu:kongunad',  label: 'Kongunad' },
      { key: 'tamil-nadu:madurai',   label: 'Madurai' },
      { key: 'tamil-nadu:thanjavur', label: 'Thanjavur / Delta' },
  ]},
  { key: 'kerala', label: 'Kerala', subs: [
      { key: 'kerala:malabar',    label: 'Malabar' },
      { key: 'kerala:travancore', label: 'Travancore' },
      { key: 'kerala:central',    label: 'Central Kerala / Kochi' },
      { key: 'kerala:palakkad',   label: 'Palakkad' },
  ]},
  { key: 'karnataka', label: 'Karnataka', subs: [
      { key: 'karnataka:udupi-mangalore', label: 'Udupi–Mangalore' },
      { key: 'karnataka:north',           label: 'North Karnataka' },
      { key: 'karnataka:malnad',          label: 'Malnad' },
      { key: 'karnataka:kodava',          label: 'Kodava / Coorg' },
  ]},
  { key: 'andhra',    label: 'Andhra' },
  { key: 'telangana', label: 'Telangana', subs: [
      { key: 'telangana:hyderabadi', label: 'Hyderabadi' },
  ]},
  { key: 'goan',      label: 'Goan' },
  { key: 'punjabi',   label: 'Punjabi' },
  { key: 'bengali',   label: 'Bengali' },
  { key: 'marathi',   label: 'Marathi' },
  { key: 'gujarati',  label: 'Gujarati' },
  { key: 'rajasthani',label: 'Rajasthani' },
  { key: 'kashmiri',  label: 'Kashmiri' },
  { key: 'other',     label: 'Other' },   // custom dishes only; no seeds, not pickable at onboarding
]
```

**Selection semantics** (`model.js#expandCuisines(selectedKeys) -> Set<key>`):
a region key in `prefs.cuisines` covers the region key **plus all its sub
keys**; a `region:sub` key covers only that sub **plus the parent region key**
(region-level dishes are the common base — someone who cooks Chettinad also
cooks generic Tamil food). All filtering (randomizer, suggestions, Cook
defaults) goes through this expansion. Dishes may be tagged at either level:
region for everyday dishes, sub for signature ones.

### 4.2 Diet (veg / egg / non-veg)

Every dish carries `diet`; the user's `prefs.diet` maps to allowed values:

| `prefs.diet` | Allowed `dish.diet` | Onboarding label |
|---|---|---|
| `veg` | `veg` | "Vegetarian" |
| `veg-egg` | `veg`, `egg` | "Veg + Egg" |
| `all` | `veg`, `egg`, `nonveg` | "Everything" |

Diet is a **hard filter** in the randomizer, kitchen suggestions, and Cook's
default view — never relaxed by any fallback. UI marker: the familiar FSSAI
dot on dish cards, plan chips, and results (green square-dot = veg, yellow =
egg, red/brown triangle = non-veg) — render as a small inline SVG, not emoji.

### Seeding defaults (per cuisine, diet-aware)

Seed catalogs live in `model.js` as `SEEDS[key] = { breakfast: [...],
lunch: [...], dinner: [...] }`, keyed by region **and** sub-cuisine keys.
Every seed dish carries `diet`.

- **Tamil Nadu (region)**: port v1's `DEFAULTS` lists verbatim as the
  baseline (8 breakfast / 9 lunch / 8 dinner — names and ingredients from
  `aduppu.html` lines 407–439), tagged `cuisine: 'tamil-nadu'`, all `veg`.
- **Every other region** (all §4.1 top-level keys except `other`): the
  implementer authors ≥5 breakfast / ≥6 lunch / ≥5 dinner authentic, everyday
  home dishes with realistic ingredient lists — e.g. Kerala: Puttu–Kadala,
  Appam with stew, Sambar, Avial, Thoran, Meen Curry (nonveg), Erissery;
  Andhra: Pesarattu, Gongura Pachadi with rice, Gutti Vankaya, Chepala Pulusu
  (nonveg); Punjabi: Aloo Paratha, Chole, Rajma Chawal, Sarson da Saag with
  Makki Roti, Butter Chicken (nonveg); Bengali: Luchi–Aloor Dom, Shukto,
  Machher Jhol with rice (nonveg), Cholar Dal; Marathi: Poha, Thalipeeth,
  Varan Bhaat, Pithla Bhakri, Misal. Include the region's characteristic
  non-veg staples tagged `nonveg` (and egg dishes tagged `egg`) — the diet
  filter below decides who receives them. Favor daily home cooking over
  restaurant dishes; keep ingredient names in the matcher's normalized
  vocabulary (lowercase, singular).
- **Every sub-cuisine**: ≥3 signature dishes tagged to the sub key — e.g.
  Chettinad: Chettinad Chicken (nonveg), Kara Kuzhambu, Vellai Paniyaram;
  Malabar: Pathiri, Malabar Biryani (nonveg), Kadala Curry; Udupi–Mangalore:
  Neer Dosa, Goli Baje, Kori Rotti (nonveg). The bulk of a region's food
  sits at region level; subs add their distinctives.

**When seeding runs:** seeding is **per cuisine key, filtered by the current
diet preference** — a vegetarian's catalog is never polluted with non-veg
seeds. Triggered at onboarding (each selected key + its expansion) and again
when a cuisine is enabled in Settings **or the diet preference widens** (veg
→ veg-egg → all: re-run seeding for all enabled cuisines; the previously
skipped egg/non-veg dishes insert now). Track meta `seeded:<key>:<diet>` per
tier; inserts use **deterministic ids** (`seed-<key>-<meal>-<n>`), `dirty: 1`.
Deterministic ids mean two devices that both seed produce the same Drive
files and converge instead of duplicating, and make diet-widening re-runs
idempotent. A seeded dish the user deletes stays deleted (tombstone syncs).
Narrowing diet does NOT delete dishes — they drop out of default views via
the diet filter. Disabling a favorite cuisine likewise keeps its dishes in
Cook (filterable); they just leave randomizer/suggestion defaults.

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

pickDish(meal, date, { dishes, plans, logs, exclude = [], cuisines = null, diet = 'all' })
```

0. **Diet first, and hard**: drop every dish whose `diet` is not allowed by
   `diet` (§4.2 table). No fallback below ever crosses this line.
1. Filter the remainder to `expandCuisines(cuisines)` when given (the day's
   chosen cuisine, or the user's favorites for "Mix").
2. Build `lastUsed[name]` for this meal: latest date each dish name appears in
   any plan item's `meals[meal]` or any log's `dish` (exact name match) with
   `date < target date`.
3. Pool = filtered dishes of that meal, minus `exclude`, minus names used
   within `NO_REPEAT_DAYS[meal]` days before `date`.
4. If pool is non-empty → uniform random pick.
5. If pool is empty → relax in order: (a) least-recently-used within the
   cuisine filter; (b) if the cuisine filter itself has no dishes for this
   meal at all, widen to the user's favorite cuisines, then to all cuisines —
   never return `null` while any dish of that meal exists.
6. Return the dish name, or `null` if the meal has no dishes at all.

Semantics in the UI:
- **Fill day / Fill week 🎲** first asks the cuisine (see §7 Plan): the
  chosen key (or the favorites array for "Mix") flows in as `cuisines`, and a
  single chosen cuisine is stored on the plan item(s) as `plan.cuisine`.
- Fill **empty slots only** — never overwrite a slot the user set.
  Sequential fill, passing already-chosen names for that day in `exclude` so
  one day never repeats itself.
- **Per-slot 🎲**: rerolls that slot, `exclude = [currentValue]`;
  `cuisines` = the day's `plan.cuisine` if set, else the favorites.

Tests add: cuisine filtering respected; widening fallback (a) → (b); the
favorites-mix path draws from multiple cuisines; **diet is never violated by
any fallback** (a veg user with only non-veg dishes for a meal gets `null`,
not a non-veg pick); region selection includes sub-cuisine dishes and
sub-only selection includes region-level dishes.

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

### Onboarding (first run, right after the sign-in gate — two steps)
Shown when no `prefs` item exists locally — but for a signed-in user, only
after the first sync round completes (an existing Drive `prefs` item means
this device is a reinstall: skip onboarding, don't re-ask). Full-screen,
same visual language as the sign-in screen, step dots at the bottom.

**Step 1 — Diet.** Heading "How do you eat?" with three large cards:
**Vegetarian** / **Veg + Egg** / **Everything** (§4.2 mapping), each with its
FSSAI dot. Single-select, explicit — no default preselected; the user must
tap one to continue.

**Step 2 — Cuisines.** Eyebrow "YOUR KITCHEN" + heading "Which cuisines do
you cook?" + lead text "Pick your favourites — Aduppu seeds each one with
everyday dishes and plans around them. You can change this anytime in
Settings."
- One tappable card per top-level region (all §4.1 keys except `other`),
  Nisaba `.toggle`/`.seg` styling, multi-select. Regions with sub-cuisines
  show a small "e.g. Chettinad, Kongunad…" caption and a chevron that expands
  an indented row of **sub-cuisine chips**: tapping the region card selects
  the whole region; expanding and picking specific subs narrows to those
  (region card then renders in a "partial" state). Minimum one selection
  (region or sub) to continue.
- "Continue" → create the `prefs` item (diet + cuisines), seed each selected
  key per §4 Seeding (diet-filtered), land on Today.

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
  Both first open a **cuisine ask** — a small bottom sheet: "What are we
  cooking?" with one pill per favorite cuisine plus **"Mix"** (all favorites;
  default, pre-focused so double-tap = old one-tap behavior). A single chosen
  cuisine is stamped on the affected plan item(s) as `plan.cuisine` and shown
  as a small chip on the day header (removable — clearing it reverts rerolls
  to favorites-mix). Week fill applies the choice to all seven days.
- Below, a compact **week overview**: 7 rows × 3 meal chips (no horizontal
  scroll grid — the 640px column stacks); days with a cuisine show its chip.

### Cook
- Search bar (Nisaba's pill search) filtering by name / ingredient / tag /
  cuisine.
- Mode toggle pills: **All dishes | From my kitchen**.
- *All dishes*: meal-type filter chips (All/Breakfast/Lunch/Dinner) plus a
  **cuisine filter** (All + one chip per cuisine that has dishes — favorites
  first; sub-cuisines appear indented under their region when the region chip
  is active). The user's diet is the default view filter, with a quick
  toggle to reveal excluded dishes (labelled e.g. "Show non-veg") so the
  catalog is never hidden, just filtered. Dish cards grouped by meal with
  eyebrow headings; card = FSSAI diet dot + name + cuisine chip + ingredient
  preview + tag chips; expands in place (Nisaba task-card pattern) to full
  ingredients, ref, notes, meal selector, cuisine selector, diet selector —
  all inline-editable; ⋯ menu → Delete (Undo toast). Inline **add composer**
  at top: name + meal select (new dishes default to the user's first favorite
  cuisine and `veg`; changeable in the expanded editor), Enter saves,
  expand-to-edit for details.
- *From my kitchen*: pantry chip input (type + Enter adds a chip, ✕ removes;
  persisted via the `pantry` item), "I have the basics" staples toggle, then
  two sections: **Can cook now** (full matches) and **Almost there** (partial,
  sorted by score, "Need: …" line). Results respect the diet preference
  (hard filter) and default to the favorite cuisines (the same cuisine chips
  as *All dishes* widen the net). Each result: FSSAI dot + "Plan it →"
  (day/meal picker sheet) and "Log it" shortcuts.

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
- **Diet**: the same three cards as onboarding Step 1, editing `prefs.diet`.
  Widening (veg → veg-egg → all) triggers the diet-widening re-seed (§4) with
  a toast; narrowing just filters — lead text says "Dishes outside your diet
  are hidden from suggestions, never deleted."
- **Cuisines**: the same region cards + expandable sub-cuisine chips as
  onboarding Step 2 (min 1), editing the synced `prefs` item. Enabling a
  cuisine that has never been seeded on this account triggers its seeding
  (§4, diet-filtered) with a toast ("Added 16 Punjabi dishes to Cook");
  disabling one only removes it from randomizer / suggestion defaults — its
  dishes stay in Cook. Lead text explains exactly that.
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
- Onboarding gate: after the sign-in gate, render the cuisine picker until a
  `prefs` item exists (§7 Onboarding); seeding (§4) runs per selected cuisine.
- Derived state per tab from `items`: `dishes`, `plansByDate` (Map),
  `logsByDate`, `grocery`, `pantry`, `prefs` (favorite cuisines).
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
  skip sign-in → onboarding step 1: pick "Vegetarian" → step 2: select Tamil
  Nadu (whole region) + Kerala → Malabar (sub only) → Cook shows seeds from
  both, all veg (no non-veg seeded), with cuisine chips and FSSAI dots →
  Fill day 🎲 choosing "Kerala" plans only Kerala/Malabar veg dishes →
  "Cooked this ✓" on Today → log an ordered meal with cost → Track shows
  correct stats → Settings: widen diet to "Everything" → non-veg dishes
  appear in Cook after the re-seed toast → dark
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

**This is the ONLY AI-dependent feature in the app** — everything else
(randomizer, matching, shopping list) is deterministic code. Keep the
provider fully swappable: the app contract is only `POST /vision` →
`{ ingredients: string[] }`, and the model call must live in one function in
the Worker (`callVisionModel(env, image, mediaType) -> string[]`) so
switching to another vision-capable LLM (Claude, OpenAI, self-hosted) is a
one-function edit plus a secret swap. If no vision secret is configured,
return 501 — the app hides the scan button and works fully without AI.

**Architecture:** the browser never holds an AI API key. Add one endpoint to
the existing auth Worker (`aduppu/worker`), which already holds secrets and
allowlists origins:

- `POST /vision` — body `{ image: <base64 jpeg>, media_type: 'image/jpeg' }`.
  Auth: require a valid `ad_session` cookie (same KV lookup as `/refresh`) AND
  the CORS origin allowlist — never serve anonymous calls (401). Rate-limit
  via KV counter (e.g. key `vision:<date>`, max 30/day, 429 beyond) — the
  free tier has daily request caps, so the limiter protects the quota.
- **Provider (owner decision, 2026-07-09): Gemini free tier.** Worker calls
  the Gemini API via plain `fetch` (keeps the Worker zero-dependency, same
  style as the auth code). Key via `wrangler secret put GEMINI_API_KEY`
  (create free at https://aistudio.google.com/apikey). Model: the current
  free-tier Flash model — `gemini-2.5-flash` as of this writing; verify the
  current free-tier model id when implementing. Use a JSON response schema so
  the reply is guaranteed-parseable:

  ```js
  const PROMPT =
    'List every food ingredient you can identify in this photo of a home kitchen. ' +
    'Use common English grocery names in lowercase singular form (e.g. "tomato", ' +
    '"toor dal", "curry leaves", "rice flour"). Indian/South Indian household context. ' +
    'Only include items you can actually see; do not guess at closed containers.';

  async function callVisionModel(env, image, mediaType) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: mediaType, data: image } },
            { text: PROMPT },
          ] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: { ingredients: { type: 'ARRAY', items: { type: 'STRING' } } },
              required: ['ingredients'],
            },
          },
        }),
      }
    );
    if (!r.ok) throw new Error('vision ' + r.status);
    const data = await r.json();
    return JSON.parse(data.candidates[0].content.parts[0].text).ingredients;
  }
  ```

- Worker responds `{ ingredients: [...] }`; on upstream error, pass through a
  502 with a short message (429 from Gemini → 429 to the app: "daily scan
  quota reached").

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

**Cost note for the owner:** ₹0 — Gemini Flash's free tier covers personal
scan volumes comfortably (the KV rate limit keeps usage inside the daily
quota). Owner setup is one step: create a free API key at Google AI Studio
and `wrangler secret put GEMINI_API_KEY`. If the secret is absent the Worker
returns 501 and the app hides the scan button after the first 501.

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

## 14. v3.1 — View-layer rebuild (UI/UX overhaul; owner-directed, 2026-07-10)

Read `UIUX-REVIEW.md` first — it is the evidence base for this section and
lists every finding (A1–A15, B1–B11, C, D) referenced below. **Scope: rebuild
`aduppu/app/src/tabs/*` and the render layer of `App.jsx` against this spec.
Do NOT touch `lib/` logic except the two directed changes in §14.5.**
Data model, sync, Worker, tests for lib/ all stay.

### 14.1 Non-negotiable ground rules

1. **Zero inline `style={{...}}` in tabs** except truly dynamic values
   (e.g. a computed width). Every visual pattern gets a class in
   `styles.css`. If a style is needed twice, it is a class.
2. **One shared component set** in `src/components/` — no per-tab copies of
   anything. Minimum set:
   - `DietDot` (the FSSAI bordered-square variant, 3 sizes) — used by ALL tabs.
   - `Chip` (meal / cuisine / mode variants), `IconButton` (44px min target),
     `Sheet` (bottom sheet with title, close affordance, safe-area padding),
     `Toast` (single system app-wide: text + optional Undo, queue of one,
     positioned above the tab bar, never overlapping interactive content),
     `EmptyState`, `SegRow`, `Composer` (labelled-field stack with explicit
     Save/Cancel), `DishName` (2-line clamp + full name on tap via Sheet).
   - Real stroke SVG icons for die and list-picker (no emoji anywhere).
3. **One editing model everywhere**: tapping an entry opens a **bottom Sheet**
   with labelled fields and explicit **Save / Cancel / Delete** (Delete via
   `deleteWithUndo`). No save-on-blur anywhere. No fake buttons (A6).
4. **Destructive actions always undoable**: plan-slot clear, day clear, week
   clear all go through the undo toast (restore previous `meals`/`cuisine`).
5. Every tap target ≥ 44×44px; interactive rows are `<button>`s; visible
   focus states; ARIA labels on icon-only buttons.
6. Tabs render a plain `<div>` (App owns the single `<main className="screen">`)
   — fixes A2.

### 14.2 App shell fixes

- **Status pill (A1)**: in local-only mode show neutral gray `local`; never
  schedule sync when not signed in (`saveItem` gates `engine.schedule()` on
  `auth.isSignedIn()`). Red is reserved for real errors. `tap to sync`
  appears only for a previously-signed-in session that lost auth, and IS
  tappable (calls `signIn`).
- Single Toast host in App; tabs receive `showToast(msg, undoFn?)`.
- Date heading drops to 17px/600 (stops competing with the wordmark).

### 14.3 Per-screen redlines

**Onboarding** — add step dots (1/2); center content column; region row tap
= expand/collapse when subs exist (selection via the checkbox only — fixes
B7); sub-only selection renders the parent checkbox in a distinct *partial*
state (minus-square, not ✓ — fixes A11); same component reused in Settings.

**Today** (the daily screen — optimize for glance + log):
- Hero = the meal cards, not a Fill button. "Fill day" becomes a compact
  secondary button in the header row and **opens the cuisine-ask sheet**
  (A12) exactly like Plan's.
- Meal card layout: chip row (meal chip + DietDot + cuisine chip if the
  day has one), dish name on its own line via `DishName` (fixes A13),
  action row: **`Cooked this ✓` as a real button** (primary, success-tinted;
  shows whenever the planned dish has no matching log — fixes A5/B1),
  overflow row of icon buttons (reroll, pick from catalog, clear-with-undo).
- Logged entries: same row component as Track (one source of truth); tap →
  edit Sheet (14.1.3).
- Summary strip: natural sentence — "2 cooked · 1 ordered · ₹120 spent"
  (fixes A14).

**Plan**:
- Week strip: 7 equal pills that FIT 390px (no arrows in the row — swipe or
  compact ‹ › above it; verify at 360px too; fixes A3).
- Slot rows use the same card anatomy as Today. Inline free-text edit is
  replaced by the **catalog picker Sheet with a search field**; typing a name
  not in the catalog offers "Use '<text>'" as an explicit choice (fixes A9)
  and, when chosen, opens the minimal new-dish sheet (name+meal prefilled,
  cuisine/diet pickable) so phantom dishes never enter the data.
- "✓ had this" only when a log's dish matches the planned dish (A4);
  otherwise show a neutral "logged: <dish>" line.
- Fill/Clear: Fill day + Fill week side by side; Clear actions inside an
  overflow menu, undoable (A8).
- Week overview: two-line rows (day + cuisine chip on line 1; three
  ellipsized dish names with meal initials on line 2), chevron affordance.

**Cook**:
- Browsing list stays; the expanded in-place editor is replaced by an
  **edit Sheet** (B3) with the standard editing model. Card tap = Sheet.
- Filters: one horizontal scroll row — All / regions (subs appear as a second
  row only while their region is active).
- Kitchen mode: "Log it" opens the standard log Sheet pre-filled (meal from
  dish, mode=home) instead of writing silently (B4); result rows show *what
  matched* ("have 5 of 6").

**Track**:
- One mental model: the range seg (Last 7 days / Last 30 days / All — honest
  labels, A7) governs stats AND the log list. The calendar becomes an
  optional collapsed "Pick a date" affordance, not the primary browser.
- Log rows: same component as Today; edit via Sheet (fixes A6).
- Grocery composer: amount first (autofocus, numeric), note, date (defaults
  today, collapsed behind "change date"); disabled Add until amount valid.

**Settings** — unchanged except: shared CuisinePicker (with partial state),
diet cards horizontal compact row, and the pill/status fixes from 14.2.

### 14.4 Seed-data QA pass (blocks release — see review §D)

Audit all seeds for: correct cuisine (no North-Indian staples tagged Tamil
Nadu), correct meal slots, correct diet tags, plausible ingredient lists,
and a **normalized ingredient vocabulary** (one canonical name per
ingredient across every dish: "rice", "idli rice", "rice flour" are three
distinct deliberate ingredients; "black chickpea" vs "kadala" are not).
Maintain the canonical vocabulary list in `model.js` and add a test that
every seed ingredient is in it.

### 14.5 The only two lib/ changes allowed

1. `kitchen.js`: add a small alias map into `normalize()` (e.g. kadala→black
   chickpea, jeera→cumin) and a `have M of N` count in `matchDish`'s result —
   needed for A10/Kitchen result rows. Update tests.
2. None other. If a redline seems to require a lib change, stop and flag it.

### 14.6 Acceptance checklist (all required before "done")

- [ ] `npm test` green; `npm run build` clean.
- [ ] Zero emoji glyphs in the UI; zero inline styles in tabs (grep
      `style={{` — allowed only with a `/* dynamic */` comment).
- [ ] One DietDot, one Toast, one editing model — verified by grep (no
      duplicate component definitions).
- [ ] Playwright walkthrough at **390×844 AND 360×780**, both themes,
      screenshotting: sign-in, both onboarding steps (incl. partial
      sub-selection state), Today (planned/logged/composer), Plan (week
      strip fits, cuisine ask, picker sheet), Cook (list, edit sheet,
      kitchen results showing "have M of N"), Track (ranges, edit sheet),
      Settings. Attach all screenshots to the summary.
- [ ] Kitchen smoke test: pantry = rice, urad dal, coconut, onion, tomato,
      toor dal + staples ON ⇒ "Can cook now" is non-empty (Idli or Dosa
      present).
- [ ] Local-only mode shows gray `local` pill on every screen.
- [ ] Sunday reachable in the Plan week strip at 360px.

## 15. v3.2 — Pantry & Groceries section + round-2 punch list (owner-directed, 2026-07-11)

Owner requirement: *"grocery entry needs a proper section, separate — and a
grocery/pantry tracker."* Groceries currently live as a small sub-section of
Track, and the pantry is buried inside Cook's kitchen mode. Both are kitchen
*inventory* concerns and get their own tab. Read `UIUX-REVIEW.md` "Round 2"
for context; §15.0 items are bug fixes and come first.

### 15.0 Round-2 punch list (fix before building the new tab)

1. **R2-1 / A11**: in both cuisine pickers (onboarding + Settings), STOP
   force-adding the parent region key when a sub is selected —
   `expandCuisines()` already covers the parent for `region:sub` keys.
   `prefs.cuisines` must store exactly what the user chose. Render the
   parent's partial state as a **minus-square** (not ✓). Migration: on load,
   if prefs contain a region key AND sub keys of the same region, drop the
   region key only when not all subs are present (one-time cleanup, dirty=1).
2. **R2-2**: Notes fields in Sheets get the same bordered input styling as
   every other field.
3. **R2-3/R2-4**: the Toast dismisses on tab navigation and never overlaps an
   open Sheet's action row (suppress or lift above the Sheet).
4. **R2-5**: Meal and Mode selectors in Sheets use SegRow, not native selects.
5. **R2-6**: seed-vocabulary verification — with pantry exactly
   `rice, urad dal, salt` and staples ON, Idli (or Dosa) must appear in
   "Can cook now"; add this as a unit test over `SEEDS` + `matchDish`, and
   settle the alias policy (`idli rice` aliases to `rice`) in `kitchen.js`.

### 15.1 Navigation change

Five tabs + gear: **TODAY · PLAN · COOK · PANTRY · TRACK** (Nisaba's tab bar
handles five comfortably at 360px — verify). PANTRY icon: a stroke jar/basket
in `Icons.jsx`, consistent with the existing set.

### 15.2 PANTRY tab — two sections, one screen

**Section 1 — "In the kitchen" (pantry inventory).**
The pantry singleton's manager moves here from Cook:
- Chip cloud of current items with ✕ remove (undoable via Toast), add
  composer (comma/Enter separated, normalized + deduped exactly as today),
  count in the eyebrow ("IN THE KITCHEN · 23 items"), and a clear-all in an
  overflow menu (undoable).
- A search/filter field appears when the pantry exceeds ~20 items.
- **Cook keeps a read-write compact view** (same singleton item — chips +
  add input stay in kitchen mode so the suggest flow keeps working in place);
  the Pantry tab is the full manager. Same data, zero duplication of state.

**Section 2 — "Groceries" (purchase tracker).**
Grocery entry and history move here from Track (Track keeps only the spend
stats):
- Composer (amount-first, autofocus; note; date behind "Change date" —
  unchanged from Track's fixed version) **plus one new optional field:
  "Items bought"** — a chip input like the pantry's.
- History list grouped by day buckets (same grouping as Track's log), each
  row: date · note · items-bought preview · ₹ amount; tap → edit Sheet.
- **The tracker loop**: when a grocery entry has items, a one-tap
  **"Add to pantry"** action on the entry (and offered in the post-save
  Toast) merges those items into the pantry singleton (normalized, deduped,
  undoable as one batch). This is the grocery→pantry tracker: buy it, tap
  once, and "From my kitchen" immediately knows.

**Data model**: `grocery` items gain optional `items: string[]` (normalized
lowercase). No other schema change; pantry stays the singleton. Sync
unaffected (LWW per §4).

### 15.3 Track tab adjustments

- Remove the Groceries composer + list from Track.
- Keep the four stat tiles and summary sentence; the "Grocery Spend" tile
  becomes tappable and navigates to the PANTRY tab.
- Meal log unchanged.

### 15.4 Forward pointer

The Phase-2 shopping list (§13.2) will live in the PANTRY tab (its natural
home: list → buy → check off → pantry), with the entry point also kept on
Plan's header per §13.2. Do not build it in this pass.

### 15.5 Acceptance additions (on top of §14.6, all still required)

- [ ] §15.0 punch list all fixed; A11 covered by a UI screenshot showing a
      minus-square partial state; R2-6 covered by the new seed/matcher test.
- [ ] Five-tab bar verified by screenshot at 390px AND 360px, both themes.
- [ ] Walkthrough: add grocery entry with items "tomato, curry leaves" →
      "Add to pantry" → both appear in pantry chips → kitchen results update
      accordingly; undo restores the previous pantry.
- [ ] Track shows no grocery composer; Grocery Spend tile navigates to
      PANTRY.

### 15.6 Recipe references (owner request, 2026-07-11)

The seed catalog is generated dish data (name + ingredients + tags only — no
methods, no sources); the owner's real recipes come from creators (e.g.
Instagram cooks) and family. Make the existing `ref` field carry that:
- When `dish.ref` is a URL, render it as a **tappable link** on the dish
  card's expanded Sheet and as a small link chip on the card row (show the
  hostname or @handle, e.g. "instagram.com/rekhascucina"; open in new tab).
- Placeholder text for the field becomes: "Recipe source — link, book, or
  person (e.g. an Instagram reel)".
- Do NOT scrape or auto-import third-party recipe content. Manual entry with
  attribution is the model.

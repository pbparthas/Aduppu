# Aduppu v2 — Full PWA Redesign Plan

## Context

Aduppu is a single-file (839-line) meal planning PWA currently stored as `aduppu.html`. It uses localStorage, blob-based manifest/service worker, and has a functional but dated UI. The user wants to:

1. **Convert to a proper PWA** hosted on GitHub Pages
2. **Persist data beyond browser wipes** (localStorage alone won't survive)
3. **Add a Recipes section** with ingredients, name, reference, tags, and meal planner integration
4. **Add sign-in** so data can be tied to a user
5. **Significantly improve UI/UX** based on modern meal planner app patterns

---

## Architecture Decision: Firebase (Free Tier)

**Why Firebase?** Simplest path for a static GitHub Pages PWA with auth + cloud persistence:
- **Firebase Auth**: Google Sign-In (one tap), no backend needed, free for 50K MAUs
- **Firestore**: Cloud database with offline support built-in, free tier (50K reads/20K writes/day)
- **No server needed**: Everything runs client-side, perfect for GitHub Pages

**Data flow:**
1. User signs in with Google via Firebase Auth
2. Data stored in Firestore (cloud) + cached locally by Firestore SDK (offline support)
3. Survives browser wipes — data lives in Firestore, re-syncs on next sign-in
4. Export/Import JSON as manual backup option

---

## File Structure (New)

```
Aduppu/
├── index.html          # Main app (replaces aduppu.html)
├── manifest.json       # PWA manifest (already created)
├── sw.js               # Service worker (already created)
├── icons/
│   ├── icon-192.svg    # App icon (already created)
│   └── icon-512.svg    # App icon (already created)
├── css/
│   └── style.css       # All styles extracted + new design
├── js/
│   ├── app.js          # Main app logic, tab switching, init
│   ├── firebase.js     # Firebase config, auth, Firestore sync
│   ├── data.js         # Data layer (CRUD operations, defaults, smart randomizer)
│   ├── today.js        # Today tab logic
│   ├── planner.js      # Plan tab logic (with smart repeat-avoidance randomizer)
│   ├── suggest.js      # Suggest tab logic
│   ├── recipes.js      # Merged Recipes+Dishes tab logic
│   ├── track.js        # Track tab logic + export/import
│   └── backup.js       # Export/Import JSON logic
└── aduppu.html         # Keep original as reference (can remove later)
```

---

## UI/UX Redesign

### Design System Changes

| Element | Current | New |
|---------|---------|-----|
| Font | Crimson Text (serif) | Inter (sans-serif) via Google Fonts — modern, clean, readable |
| Primary color | #b5541c (terracotta) | Keep — it's warm and food-appropriate |
| Cards | Flat with subtle shadow | Slightly elevated, rounded (16px), subtle hover lift |
| Buttons | Flat orange | Soft gradient with hover feedback, 44px min touch target |
| Animations | None | Fade-in on tab switch, smooth transitions on cards |
| Empty states | Minimal text | Helpful messaging with call-to-action |
| Icons | Emoji only | Emoji + text labels always visible (bottom nav) |

### Navigation (5 tabs — merged Recipes+Dishes)

**Bottom nav (mobile) + Header tabs (desktop):**
1. 🌤 **Today** — What's cooking today
2. 📅 **Plan** — Weekly meal planner (smart randomizer with repeat avoidance)
3. 🍳 **Recipes** — Merged tab: full recipes + quick dishes toggle
4. 🥘 **Suggest** — Cook from what you have
5. 📊 **Track** — Stats, spending, logs, export/import

### Tab-by-Tab Redesign

#### Sign-In Screen (New — shown before app loads)
- Clean centered card with app logo + tagline
- "Sign in with Google" button (Firebase Auth)
- "Continue without sign-in" option (uses localStorage only, with warning about data loss)
- After sign-in, data syncs from Firestore; first-time users get defaults loaded

#### 1. Today Tab (Improved)
- **Date header** with day name, large and prominent
- **Meal cards** (breakfast/lunch/dinner) as expandable panels:
  - Shows planned dish name + meal type pill
  - Expand to see: logged meal, quick "Log Now" inline button
  - "Log Now" opens inline form (no scrolling to separate form)
- **Quick log form** still available below for manual entry
  - **Autocomplete** from dishes database as user types
  - Edit/delete logged meals
- **Daily summary** card at bottom (cooked count, order count, spend)

#### 2. Plan Tab (Improved)
- **Default to day view on mobile**, grid on desktop
- **Grid view**: Dim past days, highlight today with accent border
- **Day view**: Larger meal cards with dish name + first 3 ingredients preview
- **Randomize** with confirmation toast (not modal — keep it quick)
- **"Add from Recipes"** button on each meal slot — opens recipe picker modal

**Smart Randomizer (repeat avoidance):**
- Lunch dishes: no repeat within **10 days** (checks plan history + track log)
- Dinner dishes: no repeat within **3 days**
- Breakfast: no repeat within **2 days** (lighter constraint since breakfast options are fewer)
- Algorithm: filter dish pool to exclude recently used, then pick random from remaining. If pool is exhausted (too few dishes), relax the constraint and pick least-recently-used.
- Tracks usage in `aduppu_dish_history` — `{ dishName: lastUsedDate }` per meal type

#### 3. Recipes Tab (NEW — merged with Dishes)

**Two sub-views via toggle:**

**"Dishes" view (default)** — Quick lightweight list for the randomizer:
- Name + meal type + ingredients (same as current Dishes tab)
- Add/edit/delete with search bar
- This is what the planner randomizer pulls from
- **Confirmation dialog** before delete

**"Recipes" view** — Detailed recipe cards:
- Recipe name (large, bold)
- Reference name (source — cookbook, URL, family name, etc.)
- Tags as colored pills (e.g., "Quick", "Spicy", "Weekend", "Festival", "One-pot")
- Meal type (breakfast/lunch/dinner/any)
- Ingredients list (comma-separated, expandable)
- Optional: prep notes / instructions (textarea)
- **"Add to Planner"** button → opens day/meal picker
- **"Add as Dish"** button → copies name+meal+ingredients to the quick dishes list

**Add form** adapts to current view (simple for dishes, full for recipes)
**Search/filter bar**: Filter by name, tag, or ingredient across both views
**Storage**: `aduppu_dishes` (for randomizer) + `aduppu_recipes` (detailed) in localStorage / Firestore

#### 4. Suggest Tab (Improved)
- **Ingredient input** with autocomplete from all known ingredients
- **Real-time filtering** as user types (debounced)
- **Results** show "Add to Plan" button on each suggested dish
- **Ingredient pills** with X to remove (instead of re-editing text)

#### 5. Track Tab (Improved)
- **Date range picker** (Last 7 days, This month, All time)
- **Summary card** with natural language: "You cooked 12 meals and ordered 3 this week. Spent ₹850."
- **Stats grid** with visual hierarchy (larger numbers for key metrics)
- **Spending trend** — simple CSS-based bar chart (no library needed)
- **Meal log** with filters (by date, meal type, home/out)
- **Export/Import section** at bottom:
  - "Export All Data" → downloads JSON file with all aduppu_* data
  - "Import Data" → file picker to restore from JSON backup

---

## Firebase Integration Details

### Setup
- Create Firebase project (free Spark plan)
- Enable Google Auth provider
- Create Firestore database with rules:
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{userId}/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
  ```

### Data Structure in Firestore
```
users/{uid}/
├── dishes      # { breakfast: [...], lunch: [...], dinner: [...] }
├── plan        # { Monday: { breakfast: "Idli", ... }, ... }
├── track       # [ { id, date, meal, type, dish, cost, notes }, ... ]
├── grocery     # [ { id, date, amount, note }, ... ]
└── recipes     # [ { id, name, reference, tags, meal, ingredients, notes }, ... ]
```

### Sync Logic (js/firebase.js)
- On sign-in: Load data from Firestore → merge with any localStorage data → render
- On data change: Write to both localStorage (instant) and Firestore (async)
- On sign-out: Keep localStorage data, stop Firestore sync
- "Continue without sign-in": localStorage only, show subtle banner "Sign in to sync across devices"

### Firebase Config
- Firebase config object embedded in `js/firebase.js`
- Firebase SDK loaded from CDN (no build step needed)
- Modular imports via `<script type="module">`

---

## Critical Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `index.html` | **Create** | New HTML shell with all tab markup, Firebase SDK scripts |
| `css/style.css` | **Create** | Extracted + redesigned styles |
| `js/app.js` | **Create** | Tab switching, init, toast, shared utilities |
| `js/firebase.js` | **Create** | Firebase config, auth UI, Firestore CRUD |
| `js/data.js` | **Create** | Data layer — defaults, lsGet/lsSet, sync wrapper |
| `js/today.js` | **Create** | Today tab render + quick log |
| `js/planner.js` | **Create** | Plan tab render + randomize |
| `js/suggest.js` | **Create** | Suggest tab render + matching |
| `js/dishes.js` | **Create** | Dishes tab render + CRUD |
| `js/recipes.js` | **Create** | NEW recipes tab render + CRUD |
| `js/track.js` | **Create** | Track tab render + grocery + export/import |
| `js/backup.js` | **Create** | Export/Import JSON logic |
| `manifest.json` | **Keep** | Already created, update if needed |
| `sw.js` | **Update** | Add all new files to cache list |

---

## Implementation Order

1. **Create `css/style.css`** — Full redesigned stylesheet
2. **Create `js/data.js`** — Data layer with defaults + sync wrapper
3. **Create `js/firebase.js`** — Firebase auth + Firestore sync
4. **Create `js/app.js`** — Core app logic (tabs, toast, init)
5. **Create `index.html`** — New HTML structure with 6 tabs
6. **Create tab JS files** — today.js, planner.js, suggest.js, dishes.js, recipes.js, track.js, backup.js
7. **Update `sw.js`** — Cache all new files
8. **Test locally** — Verify all tabs work, auth flow, data persistence
9. **Commit and push** to `claude/aduppu-pwa-setup-S1W0Q`

---

## Verification Plan

1. **Open `index.html` in browser** — All 6 tabs should render, switching should animate
2. **Sign-in flow** — Google sign-in button works (requires Firebase project setup by user)
3. **"Continue without sign-in"** — App works with localStorage only
4. **Recipes tab** — Add recipe with name, reference, tags, ingredients; verify it appears in list; use "Add to Planner" to assign to a day
5. **Today tab** — Log a meal with autocomplete, verify it shows in summary
6. **Plan tab** — Randomize week, verify grid/day views work
7. **Track tab** — Export data as JSON, clear localStorage, import JSON — data should restore
8. **PWA install** — Open on mobile, verify install prompt works
9. **Offline** — Disconnect network, verify app loads from cache
10. **GitHub Pages** — Push to branch, enable Pages, verify app loads at `https://<user>.github.io/aduppu/`

---

## Note on Firebase Setup

The user will need to:
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Google Auth provider
3. Create Firestore database
4. Copy the Firebase config into `js/firebase.js`
5. Add their GitHub Pages domain to Firebase Auth authorized domains

I'll include placeholder config with clear instructions in the code.

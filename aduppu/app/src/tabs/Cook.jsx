import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { localDateStr, dayLabel, addDays } from '../lib/dates.js';
import { CUISINES, expandCuisines, DIET_ALLOWED, newItem } from '../lib/model.js';
import { matchDish, STAPLES, normalize } from '../lib/kitchen.js';
import DietDot from '../components/DietDot.jsx';
import Sheet from '../components/Sheet.jsx';
import Composer from '../components/Composer.jsx';
import SegRow from '../components/SegRow.jsx';
import Chip from '../components/Chip.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { SearchIcon, LinkIcon } from '../components/Icons.jsx';

/* ── Constants ───────────────────────────────────────────────────────────── */

const MODE_ITEMS = [
  { key: 'all', label: 'All dishes' },
  { key: 'kitchen', label: 'From my kitchen' },
];

const MEAL_FILTER_ITEMS = [
  { key: 'all', label: 'All' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
];

const MEAL_SEG_ITEMS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
];

const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

const DIET_OPTIONS = [
  { value: 'veg', label: 'Vegetarian' },
  { value: 'egg', label: 'Egg' },
  { value: 'nonveg', label: 'Non-vegetarian' },
];

const MODE_OPTIONS = [
  { value: 'home', label: 'Home' },
  { value: 'out', label: 'Order' },
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const CUISINE_LABELS = {};
for (const c of CUISINES) {
  CUISINE_LABELS[c.key] = c.label;
  if (c.subs) for (const s of c.subs) CUISINE_LABELS[s.key] = s.label;
}
function cuisineLabel(key) { return CUISINE_LABELS[key] || key || ''; }

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

/* ── Recipe-reference helpers (§15.6) ────────────────────────────────────── */

// Does the ref look like a URL? Starts with http(s), or has a dot and no spaces.
function isUrl(ref) {
  if (!ref) return false;
  const s = String(ref).trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  if (/\s/.test(s)) return false;
  return s.includes('.');
}

// Ensure a ref has a protocol so it can be used as an href.
function refHref(ref) {
  const s = String(ref).trim();
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

// Short display label for a URL ref.
//  "https://instagram.com/rekhascucina" -> "instagram.com/rekhascucina"
//  "https://youtube.com/@chefdeena"     -> "youtube.com/@chefdeena"
//  "https://www.youtube.com/watch?v=ab" -> "youtube.com" (host only for deep URLs)
function formatRefLabel(ref) {
  let s = String(ref).trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .replace(/^www\./i, '');
  const slash = s.indexOf('/');
  if (slash === -1) return s; // bare host / handle
  const host = s.slice(0, slash);
  const path = s.slice(slash + 1).split('?')[0].split('#')[0];
  const segs = path.split('/').filter(Boolean);
  if (segs.length === 0) return host;
  const first = segs[0];
  // A single, clean handle/channel segment -> host/segment; otherwise host only.
  if (segs.length === 1 && first !== 'watch' && !/[=&]/.test(first)) {
    return `${host}/${first}`;
  }
  return host;
}

// Base URL to fill into the field from a quick-pick label.
function baseToUrl(base) {
  return /^https?:\/\//i.test(base) ? base : `https://${base}`;
}

/* ── Recipe draft helpers (§16.4) ────────────────────────────────────────── */

// Worker base URL — same resolution as lib/auth.js (the /recipe endpoint lives
// on the same Worker). localStorage override wins, else the deployed default.
const AUTH_WORKER_DEFAULT = 'https://aduppu-auth.orionforge.dev';
function workerBase() {
  try { return localStorage.getItem('ad_auth_worker') || AUTH_WORKER_DEFAULT; }
  catch { return AUTH_WORKER_DEFAULT; }
}

// Signed in? Mirrors auth.js's isSignedIn (the shared session flag).
function isSignedIn() {
  try { return localStorage.getItem('ad_signed_in') === '1'; } catch { return false; }
}

// Has the Worker told us /recipe isn't configured (501)? Then hide the button.
function recipeDisabledInit() {
  try { return localStorage.getItem('ad_recipe_disabled') === '1'; } catch { return false; }
}

// Split a textarea into trimmed, non-empty lines (one recipe line per row).
function splitLines(s) {
  return (s || '').split('\n').map((x) => x.trim()).filter(Boolean);
}

// "40 min · serves 4" — omits either half when absent.
function recipeMetaLabel(recipe) {
  const parts = [];
  if (recipe?.time_minutes != null && recipe.time_minutes !== '') {
    parts.push(`${recipe.time_minutes} min`);
  }
  if (recipe?.servings != null && recipe.servings !== '') {
    parts.push(`serves ${recipe.servings}`);
  }
  return parts.join(' · ');
}

// Does the dish carry any real recipe content?
function hasRecipeContent(recipe) {
  if (!recipe) return false;
  return (
    (recipe.ingredients_full || []).length > 0
    || (recipe.steps || []).length > 0
    || (recipe.servings != null && recipe.servings !== '')
    || (recipe.time_minutes != null && recipe.time_minutes !== '')
  );
}

/* ═════════════════════════════════════════════════════════════════════════ */
/* Cook                                                                     */
/* ═════════════════════════════════════════════════════════════════════════ */

export default function Cook({
  items, dishes, plans, logs, groceryItems,
  pantryItem, prefsItem, saveItem, deleteWithUndo, showToast,
}) {
  /* ── State ─────────────────────────────────────────────────────────────── */

  const [mode, setMode]               = useState('all');
  const [query, setQuery]             = useState('');
  const [mealFilter, setMealFilter]   = useState('all');
  const [cuisineFilter, setCuisineFilter] = useState(null);
  const [showAllDiet, setShowAllDiet] = useState(false);

  // Recipe card sheet (read view — opens on tap; §16.2)
  const [cardDishId, setCardDishId]   = useState(null);

  // Edit sheet
  const [editDishId, setEditDishId]   = useState(null);
  const [editValues, setEditValues]   = useState({});

  // Draft-the-recipe flow (§16.4)
  const [drafting, setDrafting]         = useState(false);
  const [recipeDisabled, setRecipeDisabled] = useState(recipeDisabledInit);
  const [online, setOnline]             = useState(
    () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  );

  // Add composer
  const [addingDish, setAddingDish]   = useState(false);
  const [addName, setAddName]         = useState('');
  const [addMeal, setAddMeal]         = useState('breakfast');

  // Kitchen mode
  const [pantryInput, setPantryInput] = useState('');
  const [staplesOn, setStaplesOn]     = useState(() => {
    try {
      const v = localStorage.getItem('ad:staples');
      return v === null ? true : v === 'true';
    } catch { return true; }
  });

  // Plan picker sheet
  const [showPlanPicker, setShowPlanPicker] = useState(null);
  const [planDay, setPlanDay]         = useState(() => localDateStr());
  const [planMeal, setPlanMeal]       = useState('lunch');

  // Log sheet (kitchen mode "Log it" — B4 fix)
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [logValues, setLogValues]     = useState({});

  // Persist staples toggle
  useEffect(() => {
    try { localStorage.setItem('ad:staples', String(staplesOn)); } catch { /* noop */ }
  }, [staplesOn]);

  // Track connectivity so the "Draft the recipe" button hides when offline
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  /* ── Derived ───────────────────────────────────────────────────────────── */

  const userDiet    = prefsItem?.diet || 'all';
  const favCuisines = prefsItem?.cuisines || [];
  const pantryItems = pantryItem?.items || [];
  const allowedDiets = useMemo(
    () => new Set(DIET_ALLOWED[userDiet] || DIET_ALLOWED.all),
    [userDiet],
  );
  const activeDishes = useMemo(
    () => dishes.filter((d) => !d.deleted),
    [dishes],
  );

  // §15.6 recent sources: top-5 most-used distinct URL ref hosts/handles,
  // derived from the catalog (no hardcoded creator list).
  const recentSources = useMemo(() => {
    const counts = new Map();
    for (const d of activeDishes) {
      const r = (d.ref || '').trim();
      if (!r || !isUrl(r)) continue;
      const base = formatRefLabel(r);
      if (!base) continue;
      counts.set(base, (counts.get(base) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([base]) => base);
  }, [activeDishes]);

  // Flat cuisine options for the Composer select
  const cuisineOptions = useMemo(() => {
    const opts = [];
    for (const c of CUISINES) {
      opts.push({ value: c.key, label: c.label });
      if (c.subs) {
        for (const s of c.subs) {
          opts.push({ value: s.key, label: '  ' + s.label });
        }
      }
    }
    return opts;
  }, []);

  /* ── Search ────────────────────────────────────────────────────────────── */

  const matchesQuery = useCallback((dish) => {
    if (!query.trim()) return true;
    const q = normalize(query);
    if (normalize(dish.name || '').includes(q)) return true;
    if ((dish.ingredients || []).some((i) => normalize(i).includes(q))) return true;
    if ((dish.tags || []).some((t) => normalize(t).includes(q))) return true;
    if (normalize(cuisineLabel(dish.cuisine)).includes(q)) return true;
    return false;
  }, [query]);

  /* ── All-dishes filtered list ──────────────────────────────────────────── */

  const allDishesFiltered = useMemo(() => {
    let pool = activeDishes.filter(matchesQuery);
    if (mealFilter !== 'all') pool = pool.filter((d) => d.meal === mealFilter);
    if (cuisineFilter) {
      const expanded = expandCuisines([cuisineFilter]);
      pool = pool.filter((d) => expanded.has(d.cuisine));
    }
    if (!showAllDiet) pool = pool.filter((d) => allowedDiets.has(d.diet || 'veg'));
    return pool;
  }, [activeDishes, matchesQuery, mealFilter, cuisineFilter, showAllDiet, allowedDiets]);

  // Group by meal type
  const dishesByMeal = useMemo(() => {
    const groups = { breakfast: [], lunch: [], dinner: [] };
    for (const d of allDishesFiltered) {
      const m = d.meal || 'lunch';
      if (groups[m]) groups[m].push(d);
    }
    return groups;
  }, [allDishesFiltered]);

  /* ── Cuisine chips (regions that have dishes, favourites first) ─────── */

  const cuisinesWithDishes = useMemo(() => {
    const keys = new Set(activeDishes.map((d) => d.cuisine).filter(Boolean));
    const favSet = new Set(favCuisines);
    const regions = CUISINES.filter((r) => {
      if (keys.has(r.key)) return true;
      return r.subs?.some((s) => keys.has(s.key));
    });
    regions.sort((a, b) => {
      const af = favSet.has(a.key) || a.subs?.some((s) => favSet.has(s.key));
      const bf = favSet.has(b.key) || b.subs?.some((s) => favSet.has(s.key));
      if (af && !bf) return -1;
      if (!af && bf) return 1;
      return 0;
    });
    return regions;
  }, [activeDishes, favCuisines]);

  // Sub-cuisines with dishes (keyed by region)
  const subsWithDishes = useMemo(() => {
    const keys = new Set(activeDishes.map((d) => d.cuisine).filter(Boolean));
    const out = {};
    for (const r of CUISINES) {
      if (r.subs) out[r.key] = r.subs.filter((s) => keys.has(s.key));
    }
    return out;
  }, [activeDishes]);

  // Which region is currently active?
  const activeRegionKey = useMemo(() => {
    if (!cuisineFilter) return null;
    if (CUISINES.find((c) => c.key === cuisineFilter)) return cuisineFilter;
    const parent = CUISINES.find((c) => c.subs?.some((s) => s.key === cuisineFilter));
    return parent?.key || null;
  }, [cuisineFilter]);

  /* ── Kitchen mode: match dishes against pantry ─────────────────────────── */

  const kitchenResults = useMemo(() => {
    if (mode !== 'kitchen') return { full: [], partial: [] };

    let pool = activeDishes.filter(matchesQuery);
    pool = pool.filter((d) => allowedDiets.has(d.diet || 'veg'));

    if (cuisineFilter) {
      const expanded = expandCuisines([cuisineFilter]);
      pool = pool.filter((d) => expanded.has(d.cuisine));
    } else if (favCuisines.length > 0) {
      const expanded = expandCuisines(favCuisines);
      pool = pool.filter((d) => expanded.has(d.cuisine));
    }

    const full = [];
    const partial = [];
    for (const dish of pool) {
      const result = matchDish(dish, pantryItems, { staplesOn });
      if (result.status === 'full') full.push({ dish, match: result });
      else if (result.status === 'partial') partial.push({ dish, match: result });
    }
    partial.sort((a, b) => b.match.score - a.match.score);
    return { full, partial };
  }, [mode, activeDishes, matchesQuery, allowedDiets, cuisineFilter, favCuisines, pantryItems, staplesOn]);

  /* ── Edit-sheet field definitions ──────────────────────────────────────── */

  const editFields = useMemo(() => [
    { key: 'name', label: 'Dish name', type: 'text', placeholder: 'Dish name' },
    { key: 'ingredients', label: 'Ingredients (comma-separated)', type: 'textarea', placeholder: 'rice, toor dal, tomato...' },
    { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Prep notes...' },
    { key: 'meal', label: 'Meal', type: 'select', options: MEAL_OPTIONS },
    { key: 'cuisine', label: 'Cuisine', type: 'select', options: cuisineOptions },
    { key: 'diet', label: 'Diet', type: 'select', options: DIET_OPTIONS },
    { key: 'tags', label: 'Tags (comma-separated)', type: 'text', placeholder: 'spicy, one-pot, quick...' },
    { key: 'servings', label: 'Servings', type: 'number', placeholder: '4' },
    { key: 'time_minutes', label: 'Time (minutes)', type: 'number', placeholder: '40' },
    { key: 'ingredients_full', label: 'Ingredients with quantities (one per line)', type: 'textarea', placeholder: '1 cup toor dal\nlemon-size tamarind...' },
    { key: 'steps', label: 'Method (one step per line)', type: 'textarea', placeholder: 'Pressure cook dal...\nRoast and grind masala...' },
  ], [cuisineOptions]);

  // Log sheet field definitions
  const logFields = useMemo(() => [
    { key: 'dish', label: 'Dish', type: 'text', placeholder: 'Dish name' },
    { key: 'meal', label: 'Meal', type: 'select', options: MEAL_OPTIONS },
    { key: 'mode', label: 'Mode', type: 'select', options: MODE_OPTIONS },
    { key: 'cost', label: 'Cost', type: 'number', placeholder: '0' },
    { key: 'notes', label: 'Notes', type: 'text', placeholder: '' },
  ], []);

  /* ── Handlers ──────────────────────────────────────────────────────────── */

  const openEditSheet = useCallback((dish) => {
    setEditDishId(dish.id);
    setEditValues({
      name: dish.name || '',
      ingredients: (dish.ingredients || []).join(', '),
      ref: dish.ref || '',
      notes: dish.notes || '',
      meal: dish.meal || 'lunch',
      cuisine: dish.cuisine || '',
      diet: dish.diet || 'veg',
      tags: (dish.tags || []).join(', '),
      servings: dish.recipe?.servings != null ? String(dish.recipe.servings) : '',
      time_minutes: dish.recipe?.time_minutes != null ? String(dish.recipe.time_minutes) : '',
      ingredients_full: (dish.recipe?.ingredients_full || []).join('\n'),
      steps: (dish.recipe?.steps || []).join('\n'),
    });
  }, []);

  const closeEditSheet = useCallback(() => {
    setEditDishId(null);
    setEditValues({});
  }, []);

  const openCard = useCallback((dish) => setCardDishId(dish.id), []);
  const closeCard = useCallback(() => setCardDishId(null), []);

  // Edit from the recipe card: swap the read view for the §14 edit Sheet.
  const editFromCard = useCallback((dish) => {
    setCardDishId(null);
    openEditSheet(dish);
  }, [openEditSheet]);

  // §16.4 — draft a recipe via the Worker /recipe endpoint.
  const draftRecipe = useCallback(async (dish) => {
    if (drafting) return;
    setDrafting(true);
    try {
      const res = await fetch(workerBase() + '/recipe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: dish.name,
          cuisine: dish.cuisine,
          diet: dish.diet,
          ingredients: dish.ingredients || [],
        }),
      });
      if (res.status === 501) {
        // Not configured — hide the button from now on.
        try { localStorage.setItem('ad_recipe_disabled', '1'); } catch { /* noop */ }
        setRecipeDisabled(true);
        return;
      }
      if (!res.ok) throw new Error('recipe ' + res.status);
      const data = await res.json();
      saveItem({
        ...dish,
        recipe: {
          servings: data.servings,
          time_minutes: data.time_minutes,
          ingredients_full: data.ingredients_full || [],
          steps: data.steps || [],
          draft: true,
        },
      });
      if (showToast) showToast('AI draft ready — check and make it yours');
    } catch {
      if (showToast) showToast('Couldn’t draft the recipe. Try again.');
    } finally {
      setDrafting(false);
    }
  }, [drafting, saveItem, showToast]);

  // The draft button shows only when configured, online, and signed in.
  const canDraft = !recipeDisabled && online && isSignedIn();

  const fillRef = useCallback((base) => {
    setEditValues((v) => ({ ...v, ref: baseToUrl(base) }));
  }, []);

  const saveEditDish = useCallback(() => {
    const dish = activeDishes.find((d) => d.id === editDishId);
    if (!dish) { closeEditSheet(); return; }

    // Recipe fields (§16.1). Editing any of them makes the recipe "theirs":
    // draft is always cleared on a manual save.
    const ingredients_full = splitLines(editValues.ingredients_full);
    const steps = splitLines(editValues.steps);
    const servings = editValues.servings === '' || editValues.servings == null
      ? undefined : Number(editValues.servings);
    const time_minutes = editValues.time_minutes === '' || editValues.time_minutes == null
      ? undefined : Number(editValues.time_minutes);
    const nextRecipe = {
      ...(dish.recipe || {}),
      servings,
      time_minutes,
      ingredients_full,
      steps,
      draft: false,
    };
    const keepRecipe = hasRecipeContent(nextRecipe) || dish.recipe;

    saveItem({
      ...dish,
      name: editValues.name.trim() || dish.name,
      ingredients: editValues.ingredients
        .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
      ref: editValues.ref.trim(),
      notes: editValues.notes.trim(),
      meal: editValues.meal || dish.meal,
      cuisine: editValues.cuisine || dish.cuisine,
      diet: editValues.diet || dish.diet,
      tags: editValues.tags
        .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
      recipe: keepRecipe ? nextRecipe : undefined,
    });
    closeEditSheet();
    if (showToast) showToast('Dish saved');
  }, [activeDishes, editDishId, editValues, saveItem, closeEditSheet, showToast]);

  const deleteEditDish = useCallback(() => {
    const dish = activeDishes.find((d) => d.id === editDishId);
    if (dish) deleteWithUndo(dish);
    closeEditSheet();
  }, [activeDishes, editDishId, deleteWithUndo, closeEditSheet]);

  const handleAddDish = useCallback(() => {
    const name = addName.trim();
    if (!name) return;
    const dish = newItem({
      type: 'dish',
      name,
      meal: addMeal,
      cuisine: favCuisines[0] || 'other',
      diet: 'veg',
      ingredients: [],
      tags: [],
      ref: '',
      notes: '',
    });
    saveItem(dish);
    setAddName('');
    setAddingDish(false);
    // Immediately open the edit Sheet for the new dish
    openEditSheet(dish);
  }, [addName, addMeal, favCuisines, saveItem, openEditSheet]);

  const handlePantryAdd = useCallback((text) => {
    const trimmed = text.trim().toLowerCase();
    if (!trimmed) return;
    if (pantryItems.some((i) => normalize(i) === normalize(trimmed))) return;
    const updated = [...pantryItems, trimmed];
    if (pantryItem) {
      saveItem({ ...pantryItem, items: updated });
    } else {
      saveItem(newItem({ id: 'pantry', type: 'pantry', items: updated }));
    }
  }, [pantryItems, pantryItem, saveItem]);

  const handlePantryRemove = useCallback((item) => {
    const updated = pantryItems.filter((i) => i !== item);
    if (pantryItem) {
      saveItem({ ...pantryItem, items: updated });
    }
  }, [pantryItems, pantryItem, saveItem]);

  const handlePlanDish = useCallback((dishName, day, meal) => {
    const planId = `plan-${day}`;
    const existing = plans.find((p) => p.id === planId && !p.deleted);
    if (existing) {
      saveItem({ ...existing, meals: { ...existing.meals, [meal]: dishName } });
    } else {
      saveItem(newItem({
        id: planId,
        type: 'plan',
        date: day,
        meals: { breakfast: '', lunch: '', dinner: '', [meal]: dishName },
      }));
    }
    setShowPlanPicker(null);
    if (showToast) showToast('Added to plan');
  }, [plans, saveItem, showToast]);

  // B4 fix: "Log it" opens a log Sheet pre-filled, not silent write
  const openLogSheet = useCallback((dishName, meal) => {
    setLogValues({
      dish: dishName,
      meal: meal || 'lunch',
      mode: 'home',
      cost: '',
      notes: '',
    });
    setShowLogSheet(true);
  }, []);

  const saveLog = useCallback(() => {
    saveItem(newItem({
      type: 'log',
      date: localDateStr(),
      meal: logValues.meal || 'lunch',
      mode: logValues.mode || 'home',
      dish: logValues.dish || '',
      cost: Number(logValues.cost) || 0,
      notes: logValues.notes || '',
    }));
    setShowLogSheet(false);
    setLogValues({});
    if (showToast) showToast('Meal logged');
  }, [logValues, saveItem, showToast]);

  const openPlanPicker = useCallback((dishName, meal) => {
    setShowPlanPicker({ dishName, meal });
    setPlanDay(localDateStr());
    setPlanMeal(meal || 'lunch');
  }, []);

  // Diet toggle label
  const dietToggleLabel = showAllDiet ? 'Showing all' : 'Show all';

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div>

      {/* ── Search bar ── */}
      <div className="search">
        <SearchIcon size={17} />
        <input
          type="text"
          placeholder="Search dishes, ingredients, cuisines..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="search-x"
            onClick={() => setQuery('')}
            aria-label="Clear search"
          >
            &#x2715;
          </button>
        )}
      </div>

      {/* ── Mode toggle ── */}
      <div className="section">
        <SegRow
          items={MODE_ITEMS}
          value={mode}
          onChange={(key) => { setMode(key); setCuisineFilter(null); }}
        />
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ALL DISHES MODE                                                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {mode === 'all' && (
        <>
          {/* ── Cuisine filter row 1: regions ── */}
          <div className="group-toggle">
            <button
              type="button"
              className={cuisineFilter === null ? 'on' : ''}
              onClick={() => setCuisineFilter(null)}
            >
              All
            </button>
            {cuisinesWithDishes.map((region) => (
              <button
                key={region.key}
                type="button"
                className={activeRegionKey === region.key ? 'on' : ''}
                onClick={() => setCuisineFilter(
                  cuisineFilter === region.key ? null : region.key,
                )}
              >
                {region.label}
              </button>
            ))}
          </div>

          {/* ── Cuisine filter row 2: sub-cuisines (only when region active) ── */}
          {activeRegionKey && (subsWithDishes[activeRegionKey] || []).length > 0 && (
            <div className="group-toggle">
              <button
                type="button"
                className={cuisineFilter === activeRegionKey ? 'on' : ''}
                onClick={() => setCuisineFilter(activeRegionKey)}
              >
                All {cuisineLabel(activeRegionKey)}
              </button>
              {(subsWithDishes[activeRegionKey] || []).map((sub) => (
                <button
                  key={sub.key}
                  type="button"
                  className={cuisineFilter === sub.key ? 'on' : ''}
                  onClick={() => setCuisineFilter(
                    cuisineFilter === sub.key ? activeRegionKey : sub.key,
                  )}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {/* ── Diet toggle ── */}
          {userDiet !== 'all' && (
            <div className="group-toggle">
              <button
                type="button"
                className={showAllDiet ? 'on' : ''}
                onClick={() => setShowAllDiet(!showAllDiet)}
              >
                {dietToggleLabel}
              </button>
            </div>
          )}

          {/* ── Meal filter ── */}
          <div className="section">
            <SegRow
              items={MEAL_FILTER_ITEMS}
              value={mealFilter}
              onChange={setMealFilter}
            />
          </div>

          {/* ── Add composer ── */}
          <div className="section">
            {addingDish ? (
              <div className="card">
                <div className="add-composer">
                  <div className="dot" />
                  <input
                    type="text"
                    placeholder="Dish name"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddDish();
                      if (e.key === 'Escape') setAddingDish(false);
                    }}
                    autoFocus
                  />
                </div>
                <div className="section">
                  <SegRow
                    items={MEAL_SEG_ITEMS}
                    value={addMeal}
                    onChange={setAddMeal}
                  />
                </div>
                <div className="btn-row">
                  <button type="button" className="btn ghost" onClick={() => setAddingDish(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn accent" onClick={handleAddDish}>
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="add-task"
                onClick={() => setAddingDish(true)}
              >
                <span className="plus">+</span>
                Add dish
              </button>
            )}
          </div>

          {/* ── Dish cards grouped by meal ── */}
          {['breakfast', 'lunch', 'dinner'].map((meal) => {
            const cards = dishesByMeal[meal];
            if (mealFilter !== 'all' && mealFilter !== meal) return null;
            if (!cards || cards.length === 0) return null;
            return (
              <div key={meal} className="section">
                <span className="eyebrow">{cap(meal)}</span>
                <div className="list">
                  {cards.map((dish) => (
                    <DishCard
                      key={dish.id}
                      dish={dish}
                      onTap={() => openCard(dish)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {allDishesFiltered.length === 0 && (
            <EmptyState message="No dishes found." />
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* FROM MY KITCHEN MODE                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {mode === 'kitchen' && (
        <>
          {/* ── Pantry chip input ── */}
          <div className="section">
            <span className="eyebrow">Your pantry</span>
            <div className="list">
              <div className="pantry-input">
                {pantryItems.map((item, idx) => (
                  <span key={`${item}-${idx}`} className="ing-pill">
                    {item}
                    <button
                      type="button"
                      className="x"
                      onClick={() => handlePantryRemove(item)}
                      aria-label={`Remove ${item}`}
                    >
                      &#x2715;
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder="Add ingredient..."
                  value={pantryInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.includes(',')) {
                      const parts = val.split(',');
                      const last = parts.pop();
                      for (const p of parts) {
                        const trimmed = p.trim();
                        if (trimmed) handlePantryAdd(trimmed);
                      }
                      setPantryInput(last.trimStart());
                    } else {
                      setPantryInput(val);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const parts = pantryInput.split(',');
                      for (const p of parts) {
                        const trimmed = p.trim();
                        if (trimmed) handlePantryAdd(trimmed);
                      }
                      setPantryInput('');
                    }
                  }}
                />
              </div>

              {/* Staples toggle */}
              <div className="row">
                <label className="row">
                  <input
                    type="checkbox"
                    checked={staplesOn}
                    onChange={() => setStaplesOn(!staplesOn)}
                  />
                  I have the basics
                </label>
                <span className="lead">
                  ({STAPLES.slice(0, 4).join(', ')}, ...)
                </span>
              </div>
            </div>
          </div>

          {/* ── Cuisine filter chips ── */}
          <div className="group-toggle">
            <button
              type="button"
              className={cuisineFilter === null ? 'on' : ''}
              onClick={() => setCuisineFilter(null)}
              title={favCuisines.length > 0
                ? 'Filter to your favourite cuisines from Settings'
                : 'Show all cuisines'}
            >
              {favCuisines.length > 0 ? 'Favourites' : 'All'}
            </button>
            {cuisinesWithDishes.map((region) => (
              <button
                key={region.key}
                type="button"
                className={cuisineFilter === region.key ? 'on' : ''}
                onClick={() => setCuisineFilter(
                  cuisineFilter === region.key ? null : region.key,
                )}
              >
                {region.label}
              </button>
            ))}
          </div>
          {cuisineFilter === null && favCuisines.length > 0 && (
            <span className="lead">
              Showing favourite cuisines (from Settings)
            </span>
          )}

          {/* ── Results: Can cook now ── */}
          {kitchenResults.full.length > 0 && (
            <div className="section">
              <span className="eyebrow">Can cook now</span>
              <div className="list">
                {kitchenResults.full.map(({ dish, match }) => (
                  <KitchenCard
                    key={dish.id}
                    dish={dish}
                    match={match}
                    variant="full"
                    onPlan={() => openPlanPicker(dish.name, dish.meal)}
                    onLog={() => openLogSheet(dish.name, dish.meal)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Results: Almost there ── */}
          {kitchenResults.partial.length > 0 && (
            <div className="section">
              <span className="eyebrow">Almost there</span>
              <div className="list">
                {kitchenResults.partial.map(({ dish, match }) => (
                  <KitchenCard
                    key={dish.id}
                    dish={dish}
                    match={match}
                    variant="partial"
                    onPlan={() => openPlanPicker(dish.name, dish.meal)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty states */}
          {kitchenResults.full.length === 0
            && kitchenResults.partial.length === 0
            && pantryItems.length > 0 && (
            <EmptyState message="No matching dishes found. Try adding more ingredients." />
          )}
          {pantryItems.length === 0 && (
            <EmptyState message="Add ingredients above to see what you can cook." />
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* RECIPE CARD SHEET (read view first — §16.2)                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {cardDishId && (() => {
        const dish = activeDishes.find((d) => d.id === cardDishId);
        if (!dish) return null;
        return (
          <Sheet title={dish.name} onClose={closeCard}>
            <RecipeCard
              dish={dish}
              drafting={drafting}
              canDraft={canDraft}
              onEdit={() => editFromCard(dish)}
              onPlan={() => { closeCard(); openPlanPicker(dish.name, dish.meal); }}
              onDraft={() => draftRecipe(dish)}
            />
          </Sheet>
        );
      })()}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* EDIT DISH SHEET (B3 fix: Sheet + Composer, not in-place expansion) */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {editDishId && (
        <Sheet title={editValues.name || 'Edit dish'} onClose={closeEditSheet}>
          {/* Reference field (custom, so we can show a link + recent-source
              quick-pick below it — §15.6) */}
          <div className="form-stack ref-block">
            <label className="form-label">
              <span className="form-label-text">Reference</span>
              <input
                type="text"
                className="form-input"
                value={editValues.ref ?? ''}
                placeholder="Recipe source — link, book, or person (e.g. an Instagram reel or YouTube video)"
                onChange={(e) => setEditValues({ ...editValues, ref: e.target.value })}
              />
            </label>

            {isUrl(editValues.ref) && (
              <a
                className="ref-link"
                href={refHref(editValues.ref)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <LinkIcon size={14} />
                {formatRefLabel(editValues.ref)}
              </a>
            )}

            {recentSources.length > 0 && (
              <div className="ref-quickpick">
                <span className="form-label-text">Recent sources</span>
                <div className="chip-row">
                  {recentSources.map((src) => (
                    <button
                      key={src}
                      type="button"
                      className="chip plain ref-chip"
                      onClick={() => fillRef(src)}
                    >
                      <LinkIcon size={11} />
                      {src}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Composer
            fields={editFields}
            values={editValues}
            onChange={setEditValues}
            onSave={saveEditDish}
            onCancel={closeEditSheet}
            onDelete={deleteEditDish}
          />
        </Sheet>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* LOG SHEET (B4 fix: opens pre-filled Sheet instead of silent write) */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {showLogSheet && (
        <Sheet title="Log meal" onClose={() => setShowLogSheet(false)}>
          <Composer
            fields={logFields}
            values={logValues}
            onChange={setLogValues}
            onSave={saveLog}
            onCancel={() => setShowLogSheet(false)}
            saveLabel="Log it"
          />
        </Sheet>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* PLAN PICKER SHEET                                                  */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {showPlanPicker && (
        <Sheet
          title={'Plan “' + showPlanPicker.dishName + '”'}
          onClose={() => setShowPlanPicker(null)}
        >
          <div className="form-stack">
            <span className="eyebrow">Day</span>
            <div className="seg wrap">
              {Array.from({ length: 7 }, (_, i) => addDays(localDateStr(), i)).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={planDay === d ? 'on' : ''}
                  onClick={() => setPlanDay(d)}
                >
                  {dayLabel(d)}
                </button>
              ))}
            </div>

            <span className="eyebrow">Meal</span>
            <SegRow
              items={MEAL_SEG_ITEMS}
              value={planMeal}
              onChange={setPlanMeal}
            />

            <div className="btn-row">
              <button
                type="button"
                className="btn accent"
                onClick={() => handlePlanDish(showPlanPicker.dishName, planDay, planMeal)}
              >
                Add to plan
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════ */
/* DishCard — browse card (All dishes mode)                                */
/* Card tap = edit Sheet (B3); no in-place expansion, no overflow menu.    */
/* ═════════════════════════════════════════════════════════════════════════ */

function DishCard({ dish, onTap }) {
  const preview = (dish.ingredients || []).slice(0, 4);
  const moreCount = Math.max(0, (dish.ingredients || []).length - 4);

  return (
    <div
      className="card"
      onClick={onTap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(); }
      }}
      aria-label={`View recipe for ${dish.name}`}
    >
      <div className="task-row">
        <DietDot diet={dish.diet || 'veg'} />
        <div className="task-main">
          <span className="dish-name">{dish.name}</span>
          <div className="task-sub">
            {dish.cuisine && (
              <Chip type="cuisine">{cuisineLabel(dish.cuisine)}</Chip>
            )}
            {isUrl(dish.ref) && (
              <a
                className="chip plain ref-chip"
                href={refHref(dish.ref)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Open recipe source ${formatRefLabel(dish.ref)}`}
              >
                <LinkIcon size={11} />
                {formatRefLabel(dish.ref)}
              </a>
            )}
            {preview.length > 0 && (
              <span className="lead">
                {preview.join(', ')}
                {moreCount > 0 ? `, +${moreCount} more` : ''}
              </span>
            )}
          </div>
          {(dish.tags || []).length > 0 && (
            <div className="task-sub">
              {dish.tags.map((tag) => (
                <Chip key={tag} type="plain">#{tag}</Chip>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════ */
/* RecipeCard — read view for a dish (§16.2)                               */
/* Recipe present: meta, quantities, numbered steps, source, Edit/Plan.    */
/* Recipe absent: catalog fields + an inviting empty state (§16.4 draft).  */
/* ═════════════════════════════════════════════════════════════════════════ */

function RecipeCard({ dish, drafting, canDraft, onEdit, onPlan, onDraft }) {
  const recipe = dish.recipe;
  const has = hasRecipeContent(recipe);
  const meta = recipeMetaLabel(recipe);
  const fullIngredients = recipe?.ingredients_full || [];
  const steps = recipe?.steps || [];

  // Catalog preview (shown in the recipe-less empty state).
  const preview = (dish.ingredients || []).slice(0, 6);
  const moreCount = Math.max(0, (dish.ingredients || []).length - 6);

  const sourceLink = isUrl(dish.ref) ? (
    <a
      className="ref-link"
      href={refHref(dish.ref)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <LinkIcon size={14} />
      {formatRefLabel(dish.ref)}
    </a>
  ) : null;

  return (
    <div className="recipe-card">
      {/* Header: name + diet dot + cuisine chip */}
      <div className="recipe-head">
        <DietDot diet={dish.diet || 'veg'} />
        <span className="dish-name">{dish.name}</span>
        {dish.cuisine && <Chip type="cuisine">{cuisineLabel(dish.cuisine)}</Chip>}
      </div>

      {/* Soft draft banner (§16.4) — shows while the recipe is an unedited draft */}
      {recipe?.draft && (
        <div className="draft-banner">AI draft — check and make it yours</div>
      )}

      {has ? (
        <>
          {meta && <div className="recipe-meta">{meta}</div>}

          {fullIngredients.length > 0 && (
            <div className="section">
              <span className="eyebrow">Ingredients</span>
              <ul className="recipe-ingredients">
                {fullIngredients.map((line, i) => (
                  <li key={`${line}-${i}`}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {steps.length > 0 && (
            <div className="section">
              <span className="eyebrow">Method</span>
              <ol className="recipe-steps">
                {steps.map((step, i) => (
                  <li key={`${step}-${i}`} className="recipe-step">{step}</li>
                ))}
              </ol>
            </div>
          )}

          {sourceLink && <div className="section">{sourceLink}</div>}

          <div className="btn-row">
            <button type="button" className="btn accent" onClick={onEdit}>
              Edit
            </button>
            <button type="button" className="btn" onClick={onPlan}>
              Plan it
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Catalog fields for a recipe-less dish */}
          {preview.length > 0 && (
            <div className="section">
              <span className="eyebrow">Ingredients</span>
              <p className="lead">
                {preview.join(', ')}
                {moreCount > 0 ? `, +${moreCount} more` : ''}
              </p>
            </div>
          )}

          {(dish.tags || []).length > 0 && (
            <div className="task-sub">
              {dish.tags.map((tag) => (
                <Chip key={tag} type="plain">#{tag}</Chip>
              ))}
            </div>
          )}

          {sourceLink && <div className="section">{sourceLink}</div>}

          {/* Inviting empty state (§16.2 / §16.4) */}
          <div className="recipe-empty">
            <p className="lead">No steps yet — write your method or draft one.</p>
            <div className="btn-row">
              <button type="button" className="btn" onClick={onEdit}>
                Write method
              </button>
              {canDraft && (
                <button
                  type="button"
                  className="btn accent"
                  onClick={onDraft}
                  disabled={drafting}
                >
                  {drafting ? (
                    <span className="draft-loading">
                      <span className="spinner" aria-hidden="true" />
                      Drafting…
                    </span>
                  ) : 'Draft the recipe'}
                </button>
              )}
            </div>
          </div>

          {/* Plan it stays available even without a method */}
          <div className="btn-row">
            <button type="button" className="btn ghost" onClick={onPlan}>
              Plan it
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════ */
/* KitchenCard — result card (From my kitchen mode)                        */
/* Shows "have M of N" (A10) and action buttons.                           */
/* "Log it" opens the log Sheet (B4), not silent write.                    */
/* ═════════════════════════════════════════════════════════════════════════ */

function KitchenCard({ dish, match, variant, onPlan, onLog }) {
  const total = match.have.length + match.missing.length;
  const haveCount = match.have.length;

  return (
    <div className="card">
      <div className="task-row">
        <DietDot diet={dish.diet || 'veg'} />
        <div className="task-main">
          <span className="task-title">{dish.name}</span>
          <div className="task-sub">
            <span className="lead">
              have {haveCount} of {total}
              {variant === 'partial' && match.missing.length > 0 && (
                <> &middot; Need: {match.missing.join(', ')}</>
              )}
            </span>
          </div>
        </div>
      </div>
      <div className="btn-row">
        <button type="button" className="btn small" onClick={onPlan}>
          Plan it
        </button>
        {variant === 'full' && onLog && (
          <button type="button" className="btn small" onClick={onLog}>
            Log it
          </button>
        )}
      </div>
    </div>
  );
}

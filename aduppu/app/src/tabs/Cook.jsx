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
import { SearchIcon } from '../components/Icons.jsx';

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

  // Edit sheet
  const [editDishId, setEditDishId]   = useState(null);
  const [editValues, setEditValues]   = useState({});

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
    { key: 'ref', label: 'Reference', type: 'text', placeholder: 'Book, URL, or person' },
    { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Prep notes...' },
    { key: 'meal', label: 'Meal', type: 'select', options: MEAL_OPTIONS },
    { key: 'cuisine', label: 'Cuisine', type: 'select', options: cuisineOptions },
    { key: 'diet', label: 'Diet', type: 'select', options: DIET_OPTIONS },
    { key: 'tags', label: 'Tags (comma-separated)', type: 'text', placeholder: 'spicy, one-pot, quick...' },
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
    });
  }, []);

  const closeEditSheet = useCallback(() => {
    setEditDishId(null);
    setEditValues({});
  }, []);

  const saveEditDish = useCallback(() => {
    const dish = activeDishes.find((d) => d.id === editDishId);
    if (!dish) { closeEditSheet(); return; }
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
                      onTap={() => openEditSheet(dish)}
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
      {/* EDIT DISH SHEET (B3 fix: Sheet + Composer, not in-place expansion) */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {editDishId && (
        <Sheet title={editValues.name || 'Edit dish'} onClose={closeEditSheet}>
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
      aria-label={`Edit ${dish.name}`}
    >
      <div className="task-row">
        <DietDot diet={dish.diet || 'veg'} />
        <div className="task-main">
          <span className="dish-name">{dish.name}</span>
          <div className="task-sub">
            {dish.cuisine && (
              <Chip type="cuisine">{cuisineLabel(dish.cuisine)}</Chip>
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

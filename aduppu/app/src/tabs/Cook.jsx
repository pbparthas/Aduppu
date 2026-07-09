import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { localDateStr, dayLabel, addDays } from '../lib/dates.js';
import { CUISINES, expandCuisines, DIET_ALLOWED, newItem } from '../lib/model.js';
import { matchDish, STAPLES, normalize } from '../lib/kitchen.js';
import { pickDish } from '../lib/randomizer.js';

// ── FSSAI diet dot (inline SVG) ──────────────────────────────────────────────
// Green circle = veg, yellow circle = egg, brown triangle = non-veg.
// Renders via .diet-dot CSS classes which set color via currentColor.

function DietDot({ diet, size }) {
  const cls = diet === 'nonveg' ? 'nonveg' : diet === 'egg' ? 'egg' : 'veg';
  const label = diet === 'nonveg' ? 'Non-vegetarian' : diet === 'egg' ? 'Egg' : 'Vegetarian';
  const sizeStyle = size ? { width: size, height: size } : undefined;

  if (diet === 'nonveg') {
    return (
      <span className={`diet-dot ${cls}`} aria-label={label} style={sizeStyle}>
        <svg viewBox="0 0 14 14">
          <rect x="0.5" y="0.5" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1" />
          <polygon points="7,3 11,11 3,11" fill="currentColor" />
        </svg>
      </span>
    );
  }
  return (
    <span className={`diet-dot ${cls}`} aria-label={label} style={sizeStyle}>
      <svg viewBox="0 0 14 14">
        <rect x="0.5" y="0.5" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="7" cy="7" r="3.5" fill="currentColor" />
      </svg>
    </span>
  );
}

// ── Cuisine label lookup ─────────────────────────────────────────────────────

const CUISINE_LABELS = {};
for (const c of CUISINES) {
  CUISINE_LABELS[c.key] = c.label;
  if (c.subs) for (const s of c.subs) CUISINE_LABELS[s.key] = s.label;
}
function cuisineLabel(key) { return CUISINE_LABELS[key] || key || ''; }

// ── Capitalize ───────────────────────────────────────────────────────────────

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

// ── Which region does a cuisine key belong to? ───────────────────────────────

function regionKeyFor(key) {
  if (!key) return null;
  if (CUISINES.find((c) => c.key === key)) return key;
  if (key.includes(':')) return key.split(':')[0];
  return null;
}

// ── Minimal editor input style (no dedicated CSS class exists) ───────────────

const EDITOR_INPUT = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid var(--line)',
  borderRadius: '6px',
  fontSize: '13px',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: 'var(--card)',
  color: 'var(--ink)',
};

// ═════════════════════════════════════════════════════════════════════════════
// Cook component
// ═════════════════════════════════════════════════════════════════════════════

export default function Cook({
  items, dishes, plans, logs, groceryItems,
  pantryItem, prefsItem, saveItem, deleteWithUndo,
}) {
  // ── State ────────────────────────────────────────────────────────────────
  const [mode, setMode]               = useState('all');        // 'all' | 'kitchen'
  const [query, setQuery]             = useState('');
  const [mealFilter, setMealFilter]   = useState('all');        // 'all' | meal key
  const [cuisineFilter, setCuisineFilter] = useState(null);     // null | cuisine key
  const [showAllDiet, setShowAllDiet] = useState(false);
  const [expandedId, setExpandedId]   = useState(null);
  const [addingDish, setAddingDish]   = useState(false);
  const [addName, setAddName]         = useState('');
  const [addMeal, setAddMeal]         = useState('breakfast');
  const [menuOpen, setMenuOpen]       = useState(false);
  const [pantryInput, setPantryInput] = useState('');
  const [staplesOn, setStaplesOn]     = useState(() => {
    try { const v = localStorage.getItem('ad:staples'); return v === null ? true : v === 'true'; }
    catch { return true; }
  });
  const [showPlanPicker, setShowPlanPicker] = useState(null);   // null | { dishName, meal }
  const [planDay, setPlanDay]         = useState(() => localDateStr());
  const [planMeal, setPlanMeal]       = useState('lunch');

  // Persist staples toggle
  useEffect(() => {
    try { localStorage.setItem('ad:staples', String(staplesOn)); } catch { /* noop */ }
  }, [staplesOn]);

  // Reset overflow menu when the expanded card changes
  useEffect(() => { setMenuOpen(false); }, [expandedId]);

  // ── Derived helpers ──────────────────────────────────────────────────────
  const userDiet     = prefsItem?.diet || 'all';
  const favCuisines  = prefsItem?.cuisines || [];
  const pantryItems  = pantryItem?.items || [];
  const allowedDiets = useMemo(() => new Set(DIET_ALLOWED[userDiet] || DIET_ALLOWED.all), [userDiet]);

  // Active dishes (not deleted)
  const activeDishes = useMemo(() => dishes.filter((d) => !d.deleted), [dishes]);

  // ── Search helper ────────────────────────────────────────────────────────
  const matchesQuery = useCallback((dish) => {
    if (!query.trim()) return true;
    const q = normalize(query);
    if (normalize(dish.name || '').includes(q)) return true;
    if ((dish.ingredients || []).some((i) => normalize(i).includes(q))) return true;
    if ((dish.tags || []).some((t) => normalize(t).includes(q))) return true;
    if (normalize(cuisineLabel(dish.cuisine)).includes(q)) return true;
    return false;
  }, [query]);

  // ── "All dishes" filtered list ───────────────────────────────────────────
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

  // ── Cuisine chips (regions that have dishes, favorites first) ────────────
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

  // Which region is currently active in the cuisine filter?
  const activeRegionKey = useMemo(() => {
    if (!cuisineFilter) return null;
    if (CUISINES.find((c) => c.key === cuisineFilter)) return cuisineFilter;
    const parent = CUISINES.find((c) => c.subs?.some((s) => s.key === cuisineFilter));
    return parent?.key || null;
  }, [cuisineFilter]);

  // ── Kitchen mode: match dishes against pantry ────────────────────────────
  const kitchenResults = useMemo(() => {
    if (mode !== 'kitchen') return { full: [], partial: [] };

    let pool = activeDishes.filter(matchesQuery);

    // Diet hard filter
    pool = pool.filter((d) => allowedDiets.has(d.diet || 'veg'));

    // Cuisine: specific filter, or favorites if none set
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

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAddDish = () => {
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
    setExpandedId(dish.id);
  };

  const handlePantryAdd = (text) => {
    const trimmed = text.trim().toLowerCase();
    if (!trimmed) return;
    if (pantryItems.some((i) => normalize(i) === normalize(trimmed))) return;
    const updated = [...pantryItems, trimmed];
    if (pantryItem) {
      saveItem({ ...pantryItem, items: updated });
    } else {
      saveItem(newItem({ id: 'pantry', type: 'pantry', items: updated }));
    }
  };

  const handlePantryRemove = (item) => {
    const updated = pantryItems.filter((i) => i !== item);
    if (pantryItem) {
      saveItem({ ...pantryItem, items: updated });
    }
  };

  const handlePlanDish = (dishName, day, meal) => {
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
  };

  const handleLogDish = (dishName, meal) => {
    saveItem(newItem({
      type: 'log',
      date: localDateStr(),
      meal: meal || 'lunch',
      mode: 'home',
      dish: dishName,
      cost: 0,
      notes: '',
    }));
  };

  const handleFieldUpdate = (dish, field, value) => {
    saveItem({ ...dish, [field]: value });
  };

  // Diet toggle label
  const dietToggleLabel = showAllDiet
    ? 'Diet only'
    : userDiet === 'veg' ? 'Show non-veg' : 'Show all';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="screen">

      {/* ── Search bar ── */}
      <div className="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search dishes, ingredients, cuisines..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="search-x" onClick={() => setQuery('')}>&#x2715;</button>
        )}
      </div>

      {/* ── Mode toggle ── */}
      <div className="seg" style={{ marginTop: 10 }}>
        {[{ key: 'all', label: 'All dishes' }, { key: 'kitchen', label: 'From my kitchen' }].map(({ key, label }) => (
          <button
            key={key}
            className={mode === key ? 'on' : undefined}
            onClick={() => { setMode(key); setCuisineFilter(null); }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ALL DISHES MODE                                                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {mode === 'all' && (
        <>
          {/* Meal filter */}
          <div className="seg wrap" style={{ marginTop: 10 }}>
            {['all', 'breakfast', 'lunch', 'dinner'].map((m) => (
              <button key={m} className={mealFilter === m ? 'on' : undefined} onClick={() => setMealFilter(m)}>
                {m === 'all' ? 'All' : cap(m)}
              </button>
            ))}
          </div>

          {/* Cuisine filter */}
          <div className="group-toggle">
            <button
              className={cuisineFilter === null ? 'on' : undefined}
              onClick={() => setCuisineFilter(null)}
            >
              All
            </button>
            {cuisinesWithDishes.map((region) => (
              <React.Fragment key={region.key}>
                <button
                  className={activeRegionKey === region.key ? 'on' : undefined}
                  onClick={() => setCuisineFilter(cuisineFilter === region.key ? null : region.key)}
                >
                  {region.label}
                </button>
                {/* Sub-cuisine chips (indented, visible when region is active) */}
                {activeRegionKey === region.key && (subsWithDishes[region.key] || []).map((sub) => (
                  <button
                    key={sub.key}
                    className={cuisineFilter === sub.key ? 'on' : undefined}
                    onClick={() => setCuisineFilter(cuisineFilter === sub.key ? region.key : sub.key)}
                    style={{ marginLeft: 12 }}
                  >
                    {sub.label}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>

          {/* Diet toggle */}
          {userDiet !== 'all' && (
            <div className="group-toggle">
              <button
                className={showAllDiet ? 'on' : undefined}
                onClick={() => setShowAllDiet(!showAllDiet)}
              >
                {dietToggleLabel}
              </button>
            </div>
          )}

          {/* ── Inline add composer ── */}
          {addingDish ? (
            <div className="card" style={{ marginTop: 10 }}>
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
              <div className="seg" style={{ marginTop: 8 }}>
                {['breakfast', 'lunch', 'dinner'].map((m) => (
                  <button key={m} className={addMeal === m ? 'on' : undefined} onClick={() => setAddMeal(m)}>
                    {cap(m)}
                  </button>
                ))}
              </div>
              <div className="btn-row">
                <button className="btn ghost" onClick={() => setAddingDish(false)}>Cancel</button>
                <button className="btn accent" onClick={handleAddDish}>Add</button>
              </div>
            </div>
          ) : (
            <button className="add-task" onClick={() => setAddingDish(true)}>
              <span className="plus">+</span>
              Add dish
            </button>
          )}

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
                      expanded={expandedId === dish.id}
                      onToggle={() => setExpandedId(expandedId === dish.id ? null : dish.id)}
                      menuOpen={menuOpen && expandedId === dish.id}
                      onMenuToggle={() => setMenuOpen(!menuOpen)}
                      saveItem={saveItem}
                      deleteWithUndo={deleteWithUndo}
                      onFieldUpdate={handleFieldUpdate}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {allDishesFiltered.length === 0 && (
            <p className="empty">No dishes found.</p>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* FROM MY KITCHEN MODE                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {mode === 'kitchen' && (
        <>
          {/* Pantry chip input */}
          <div className="section">
            <span className="eyebrow">Your pantry</span>
            <div className="pantry-input" style={{ marginTop: 8 }}>
              {pantryItems.map((item, idx) => (
                <span key={`${item}-${idx}`} className="ing-pill">
                  {item}
                  <button
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
                onChange={(e) => setPantryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { handlePantryAdd(pantryInput); setPantryInput(''); }
                }}
              />
            </div>
          </div>

          {/* Staples toggle */}
          <div className="row" style={{ marginTop: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={staplesOn} onChange={() => setStaplesOn(!staplesOn)} />
              I have the basics
            </label>
            <span className="lead">({STAPLES.slice(0, 4).join(', ')}, ...)</span>
          </div>

          {/* Cuisine chips for kitchen mode */}
          <div className="group-toggle">
            <button
              className={cuisineFilter === null ? 'on' : undefined}
              onClick={() => setCuisineFilter(null)}
            >
              {favCuisines.length > 0 ? 'Favourites' : 'All'}
            </button>
            {cuisinesWithDishes.map((region) => (
              <button
                key={region.key}
                className={cuisineFilter === region.key ? 'on' : undefined}
                onClick={() => setCuisineFilter(cuisineFilter === region.key ? null : region.key)}
              >
                {region.label}
              </button>
            ))}
          </div>

          {/* ── Results: Can cook now ── */}
          {kitchenResults.full.length > 0 && (
            <div className="section">
              <span className="eyebrow" style={{ color: 'var(--success)' }}>Can cook now</span>
              <div className="list">
                {kitchenResults.full.map(({ dish, match }) => (
                  <KitchenCard
                    key={dish.id}
                    dish={dish}
                    match={match}
                    variant="full"
                    onPlan={() => {
                      setShowPlanPicker({ dishName: dish.name, meal: dish.meal });
                      setPlanDay(localDateStr());
                      setPlanMeal(dish.meal || 'lunch');
                    }}
                    onLog={() => handleLogDish(dish.name, dish.meal)}
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
                    onPlan={() => {
                      setShowPlanPicker({ dishName: dish.name, meal: dish.meal });
                      setPlanDay(localDateStr());
                      setPlanMeal(dish.meal || 'lunch');
                    }}
                    onLog={() => handleLogDish(dish.name, dish.meal)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty states */}
          {kitchenResults.full.length === 0 && kitchenResults.partial.length === 0 && pantryItems.length > 0 && (
            <p className="empty">No matching dishes found. Try adding more ingredients.</p>
          )}
          {pantryItems.length === 0 && (
            <p className="empty">Add ingredients above to see what you can cook.</p>
          )}
        </>
      )}

      {/* ── Plan picker sheet (overlay) ── */}
      {showPlanPicker && (
        <div className="overlay" onClick={() => setShowPlanPicker(null)}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <span className="editor-title-read">
              Plan &ldquo;{showPlanPicker.dishName}&rdquo;
            </span>

            <span className="eyebrow">Day</span>
            <div className="seg wrap">
              {Array.from({ length: 7 }, (_, i) => addDays(localDateStr(), i)).map((d) => (
                <button key={d} className={planDay === d ? 'on' : undefined} onClick={() => setPlanDay(d)}>
                  {dayLabel(d)}
                </button>
              ))}
            </div>

            <span className="eyebrow">Meal</span>
            <div className="seg">
              {['breakfast', 'lunch', 'dinner'].map((m) => (
                <button key={m} className={planMeal === m ? 'on' : undefined} onClick={() => setPlanMeal(m)}>
                  {cap(m)}
                </button>
              ))}
            </div>

            <button
              className="btn accent wide"
              onClick={() => handlePlanDish(showPlanPicker.dishName, planDay, planMeal)}
            >
              Add to plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// DishCard — expandable catalog card (All dishes mode)
// Uses .card + .task pattern for expand-in-place behavior.
// ═════════════════════════════════════════════════════════════════════════════

function DishCard({ dish, expanded, onToggle, menuOpen, onMenuToggle, saveItem, deleteWithUndo, onFieldUpdate }) {
  const preview = (dish.ingredients || []).slice(0, 4);
  const moreCount = Math.max(0, (dish.ingredients || []).length - 4);

  return (
    <div className={`card task${expanded ? ' open' : ''}`}>
      {/* ── Summary row ── */}
      <div className="task-row" onClick={onToggle}>
        <DietDot diet={dish.diet || 'veg'} />
        <div className="task-main">
          <div className="task-title">{dish.name}</div>
          <div className="task-sub">
            {dish.cuisine && (
              <span className="chip cuisine">{cuisineLabel(dish.cuisine)}</span>
            )}
            {preview.length > 0 && (
              <span className="lead">
                {preview.join(', ')}{moreCount > 0 ? `, +${moreCount} more` : ''}
              </span>
            )}
          </div>
          {(dish.tags || []).length > 0 && (
            <div className="task-sub">
              {dish.tags.map((tag) => (
                <span key={tag} className="chip plain">#{tag}</span>
              ))}
            </div>
          )}
        </div>
        <span className="chev">&#x203A;</span>
      </div>

      {/* ── Expanded editor ── */}
      {expanded && (
        <div className="task-detail" onClick={(e) => e.stopPropagation()}>
          {/* Ingredients */}
          <span className="eyebrow">Ingredients</span>
          <textarea
            key={`ing-${dish.id}-${dish.updated_at}`}
            defaultValue={(dish.ingredients || []).join(', ')}
            onBlur={(e) => {
              const ings = e.target.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
              if (JSON.stringify(ings) !== JSON.stringify(dish.ingredients || [])) {
                onFieldUpdate(dish, 'ingredients', ings);
              }
            }}
            placeholder="rice, toor dal, tomato..."
            rows={2}
            style={{ ...EDITOR_INPUT, resize: 'vertical' }}
          />

          {/* Reference */}
          <span className="eyebrow" style={{ marginTop: 8 }}>Reference</span>
          <input
            type="text"
            key={`ref-${dish.id}-${dish.updated_at}`}
            defaultValue={dish.ref || ''}
            onBlur={(e) => {
              if (e.target.value !== (dish.ref || '')) onFieldUpdate(dish, 'ref', e.target.value);
            }}
            placeholder="Book, URL, or person"
            style={EDITOR_INPUT}
          />

          {/* Notes */}
          <span className="eyebrow" style={{ marginTop: 8 }}>Notes</span>
          <textarea
            key={`note-${dish.id}-${dish.updated_at}`}
            defaultValue={dish.notes || ''}
            onBlur={(e) => {
              if (e.target.value !== (dish.notes || '')) onFieldUpdate(dish, 'notes', e.target.value);
            }}
            placeholder="Prep notes..."
            rows={2}
            style={{ ...EDITOR_INPUT, resize: 'vertical' }}
          />

          {/* Meal selector */}
          <span className="eyebrow" style={{ marginTop: 8 }}>Meal</span>
          <div className="seg">
            {['breakfast', 'lunch', 'dinner'].map((m) => (
              <button
                key={m}
                className={dish.meal === m ? 'on' : undefined}
                onClick={() => onFieldUpdate(dish, 'meal', m)}
              >
                {cap(m)}
              </button>
            ))}
          </div>

          {/* Cuisine selector */}
          <span className="eyebrow" style={{ marginTop: 8 }}>Cuisine</span>
          <select
            value={dish.cuisine || ''}
            onChange={(e) => onFieldUpdate(dish, 'cuisine', e.target.value)}
            style={EDITOR_INPUT}
          >
            <option value="">Select...</option>
            {CUISINES.map((c) => (
              <React.Fragment key={c.key}>
                <option value={c.key}>{c.label}</option>
                {c.subs?.map((s) => (
                  <option key={s.key} value={s.key}>&nbsp;&nbsp;{s.label}</option>
                ))}
              </React.Fragment>
            ))}
          </select>

          {/* Diet selector */}
          <span className="eyebrow" style={{ marginTop: 8 }}>Diet</span>
          <div className="seg">
            {[{ key: 'veg', label: 'Veg' }, { key: 'egg', label: 'Egg' }, { key: 'nonveg', label: 'Non-veg' }].map(({ key, label }) => (
              <button
                key={key}
                className={dish.diet === key ? 'on' : undefined}
                onClick={() => onFieldUpdate(dish, 'diet', key)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <DietDot diet={key} size={12} /> {label}
              </button>
            ))}
          </div>

          {/* Tags */}
          <span className="eyebrow" style={{ marginTop: 8 }}>Tags</span>
          <input
            type="text"
            key={`tags-${dish.id}-${dish.updated_at}`}
            defaultValue={(dish.tags || []).join(', ')}
            onBlur={(e) => {
              const tags = e.target.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
              if (JSON.stringify(tags) !== JSON.stringify(dish.tags || [])) {
                onFieldUpdate(dish, 'tags', tags);
              }
            }}
            placeholder="spicy, one-pot, quick..."
            style={EDITOR_INPUT}
          />

          {/* Overflow menu */}
          <div className="detail-foot">
            <button className="overflow" onClick={onMenuToggle} aria-label="More options">
              &#x22EF;
            </button>
            {menuOpen && (
              <div className="menu">
                <button
                  className="danger"
                  onClick={() => { deleteWithUndo(dish); onMenuToggle(); }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// KitchenCard — result card (From my kitchen mode)
// ═════════════════════════════════════════════════════════════════════════════

function KitchenCard({ dish, match, variant, onPlan, onLog }) {
  return (
    <div
      className="card"
      style={variant === 'full' ? { borderLeft: '3px solid var(--success)' } : undefined}
    >
      <div className="task-row">
        <DietDot diet={dish.diet || 'veg'} />
        <div className="task-main">
          <div className="task-title">{dish.name}</div>
          <div className="task-sub">
            {dish.cuisine && (
              <span className="chip cuisine">{cuisineLabel(dish.cuisine)}</span>
            )}
          </div>
          {variant === 'partial' && match.missing.length > 0 && (
            <span className="lead" style={{ color: 'var(--overdue)' }}>
              Need: {match.missing.join(', ')}
            </span>
          )}
        </div>
      </div>
      <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn small" onClick={onPlan}>Plan it &rarr;</button>
        <button className="btn small" onClick={onLog}>Log it</button>
      </div>
    </div>
  );
}

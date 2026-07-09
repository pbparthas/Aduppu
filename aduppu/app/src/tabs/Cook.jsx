import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { localDateStr, dayLabel, addDays } from '../lib/dates.js';
import { CUISINES, expandCuisines, DIET_ALLOWED, newItem } from '../lib/model.js';
import { matchDish, STAPLES, normalize } from '../lib/kitchen.js';
import { pickDish } from '../lib/randomizer.js';

// ── FSSAI diet dot (inline SVG) ──────────────────────────────────────────────
// Green circle = veg, yellow circle = egg, brown triangle = non-veg.

function DietDot({ diet, size = 14 }) {
  if (diet === 'nonveg') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" className="diet-dot" aria-label="Non-vegetarian" style={{ flexShrink: 0 }}>
        <rect x="0.5" y="0.5" width="13" height="13" fill="none" stroke="#8B4513" strokeWidth="1" />
        <polygon points="7,3 11,11 3,11" fill="#8B4513" />
      </svg>
    );
  }
  const color = diet === 'egg' ? '#C8A951' : '#008000';
  const label = diet === 'egg' ? 'Egg' : 'Vegetarian';
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className="diet-dot" aria-label={label} style={{ flexShrink: 0 }}>
      <rect x="0.5" y="0.5" width="13" height="13" fill="none" stroke={color} strokeWidth="1" />
      <circle cx="7" cy="7" r="3.5" fill={color} />
    </svg>
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
    <div className="tab-content cook-tab">

      {/* ── Search bar ── */}
      <div style={{ padding: '12px 16px 8px' }}>
        <input
          type="text"
          className="search-input"
          placeholder="Search dishes, ingredients, cuisines..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%', padding: '8px 14px', borderRadius: '20px',
            border: '1px solid var(--border, #ddd)', fontSize: '0.875rem',
            fontFamily: 'Inter, sans-serif', outline: 'none',
            background: 'var(--card-bg, #fff)', color: 'var(--ink, #222)',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* ── Mode toggle ── */}
      <div className="seg-group" style={{ display: 'flex', gap: '4px', padding: '0 16px 8px' }}>
        {[{ key: 'all', label: 'All dishes' }, { key: 'kitchen', label: 'From my kitchen' }].map(({ key, label }) => (
          <button
            key={key}
            className={`seg${mode === key ? ' active' : ''}`}
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
        <div className="all-dishes-mode">
          {/* Meal filter */}
          <div className="chip-row" style={{ display: 'flex', gap: '6px', padding: '0 16px 6px', flexWrap: 'wrap' }}>
            {['all', 'breakfast', 'lunch', 'dinner'].map((m) => (
              <button key={m} className={`chip${mealFilter === m ? ' active' : ''}`} onClick={() => setMealFilter(m)}>
                {m === 'all' ? 'All' : cap(m)}
              </button>
            ))}
          </div>

          {/* Cuisine filter */}
          <div className="chip-row" style={{ display: 'flex', gap: '6px', padding: '0 16px 6px', flexWrap: 'wrap' }}>
            <button
              className={`chip${cuisineFilter === null ? ' active' : ''}`}
              onClick={() => setCuisineFilter(null)}
            >
              All
            </button>
            {cuisinesWithDishes.map((region) => (
              <React.Fragment key={region.key}>
                <button
                  className={`chip${activeRegionKey === region.key ? ' active' : ''}`}
                  onClick={() => setCuisineFilter(cuisineFilter === region.key ? null : region.key)}
                >
                  {region.label}
                </button>
                {/* Sub-cuisine chips (indented, visible when region is active) */}
                {activeRegionKey === region.key && (subsWithDishes[region.key] || []).map((sub) => (
                  <button
                    key={sub.key}
                    className={`chip sub${cuisineFilter === sub.key ? ' active' : ''}`}
                    onClick={() => setCuisineFilter(cuisineFilter === sub.key ? region.key : sub.key)}
                    style={{ marginLeft: '16px', fontSize: '0.75rem' }}
                  >
                    {sub.label}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>

          {/* Diet toggle */}
          {userDiet !== 'all' && (
            <div style={{ padding: '0 16px 8px' }}>
              <button
                className={`chip${showAllDiet ? ' active' : ''}`}
                onClick={() => setShowAllDiet(!showAllDiet)}
              >
                {dietToggleLabel}
              </button>
            </div>
          )}

          {/* ── Inline add composer ── */}
          <div style={{ padding: '0 16px 8px' }}>
            {addingDish ? (
              <div className="card" style={{ padding: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                    style={{
                      flex: 1, padding: '6px 10px', border: '1px solid var(--border, #ddd)',
                      borderRadius: '6px', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif',
                      background: 'var(--card-bg, #fff)', color: 'var(--ink, #222)',
                    }}
                  />
                  <select
                    value={addMeal}
                    onChange={(e) => setAddMeal(e.target.value)}
                    style={{
                      padding: '6px 8px', border: '1px solid var(--border, #ddd)',
                      borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif',
                      background: 'var(--card-bg, #fff)', color: 'var(--ink, #222)',
                    }}
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => setAddingDish(false)} style={{ opacity: 0.6 }}>Cancel</button>
                  <button className="btn" onClick={handleAddDish}>Add</button>
                </div>
              </div>
            ) : (
              <button
                className="btn"
                onClick={() => setAddingDish(true)}
                style={{ width: '100%', textAlign: 'center' }}
              >
                + Add dish
              </button>
            )}
          </div>

          {/* ── Dish cards grouped by meal ── */}
          {['breakfast', 'lunch', 'dinner'].map((meal) => {
            const cards = dishesByMeal[meal];
            if (mealFilter !== 'all' && mealFilter !== meal) return null;
            if (!cards || cards.length === 0) return null;

            return (
              <div key={meal} style={{ padding: '0 16px 12px' }}>
                <div className="eyebrow">{cap(meal)}</div>
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
            );
          })}

          {allDishesFiltered.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted, #888)' }}>
              No dishes found.
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* FROM MY KITCHEN MODE                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {mode === 'kitchen' && (
        <div className="kitchen-mode">
          {/* Pantry chip input */}
          <div style={{ padding: '0 16px 8px' }}>
            <div className="eyebrow">Your pantry</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {pantryItems.map((item, idx) => (
                <span key={`${item}-${idx}`} className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {item}
                  <button
                    onClick={() => handlePantryRemove(item)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '0.7rem', padding: '0 2px', color: 'var(--muted, #888)', lineHeight: 1,
                    }}
                    aria-label={`Remove ${item}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Add ingredient and press Enter..."
              value={pantryInput}
              onChange={(e) => setPantryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { handlePantryAdd(pantryInput); setPantryInput(''); }
              }}
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid var(--border, #ddd)',
                borderRadius: '6px', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif',
                background: 'var(--card-bg, #fff)', color: 'var(--ink, #222)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Staples toggle */}
          <div style={{ padding: '0 16px 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={staplesOn} onChange={() => setStaplesOn(!staplesOn)} />
              I have the basics
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted, #888)' }}>
              ({STAPLES.slice(0, 4).join(', ')}, ...)
            </span>
          </div>

          {/* Cuisine chips for kitchen mode */}
          <div className="chip-row" style={{ display: 'flex', gap: '6px', padding: '0 16px 8px', flexWrap: 'wrap' }}>
            <button
              className={`chip${cuisineFilter === null ? ' active' : ''}`}
              onClick={() => setCuisineFilter(null)}
            >
              {favCuisines.length > 0 ? 'Favourites' : 'All'}
            </button>
            {cuisinesWithDishes.map((region) => (
              <button
                key={region.key}
                className={`chip${cuisineFilter === region.key ? ' active' : ''}`}
                onClick={() => setCuisineFilter(cuisineFilter === region.key ? null : region.key)}
              >
                {region.label}
              </button>
            ))}
          </div>

          {/* ── Results: Can cook now ── */}
          {kitchenResults.full.length > 0 && (
            <div style={{ padding: '0 16px 12px' }}>
              <div className="eyebrow" style={{ color: '#2e7d32' }}>Can cook now</div>
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
          )}

          {/* ── Results: Almost there ── */}
          {kitchenResults.partial.length > 0 && (
            <div style={{ padding: '0 16px 12px' }}>
              <div className="eyebrow">Almost there</div>
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
          )}

          {/* Empty states */}
          {kitchenResults.full.length === 0 && kitchenResults.partial.length === 0 && pantryItems.length > 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted, #888)' }}>
              No matching dishes found. Try adding more ingredients.
            </div>
          )}
          {pantryItems.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted, #888)' }}>
              Add ingredients above to see what you can cook.
            </div>
          )}
        </div>
      )}

      {/* ── Plan picker sheet (overlay) ── */}
      {showPlanPicker && (
        <div className="overlay" onClick={() => setShowPlanPicker(null)}>
          <div className="panel" onClick={(e) => e.stopPropagation()} style={{ padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
              Plan &ldquo;{showPlanPicker.dishName}&rdquo;
            </h3>

            <div className="eyebrow">Day</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {Array.from({ length: 7 }, (_, i) => addDays(localDateStr(), i)).map((d) => (
                <button
                  key={d}
                  className={`chip${planDay === d ? ' active' : ''}`}
                  onClick={() => setPlanDay(d)}
                >
                  {dayLabel(d)}
                </button>
              ))}
            </div>

            <div className="eyebrow">Meal</div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              {['breakfast', 'lunch', 'dinner'].map((m) => (
                <button
                  key={m}
                  className={`chip${planMeal === m ? ' active' : ''}`}
                  onClick={() => setPlanMeal(m)}
                >
                  {cap(m)}
                </button>
              ))}
            </div>

            <button
              className="btn"
              onClick={() => handlePlanDish(showPlanPicker.dishName, planDay, planMeal)}
              style={{ width: '100%' }}
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
// ═════════════════════════════════════════════════════════════════════════════

const INPUT_STYLE = {
  width: '100%', padding: '6px 8px', border: '1px solid var(--border, #ddd)',
  borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif',
  boxSizing: 'border-box', background: 'var(--card-bg, #fff)', color: 'var(--ink, #222)',
};

function DishCard({ dish, expanded, onToggle, menuOpen, onMenuToggle, saveItem, deleteWithUndo, onFieldUpdate }) {
  const preview = (dish.ingredients || []).slice(0, 4);
  const moreCount = Math.max(0, (dish.ingredients || []).length - 4);

  return (
    <div className={`card${expanded ? ' expanded' : ''}`} style={{ marginBottom: '8px', padding: '12px' }}>
      {/* ── Summary row ── */}
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
        <DietDot diet={dish.diet || 'veg'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{dish.name}</div>
          {dish.cuisine && (
            <span className="chip" style={{ fontSize: '0.7rem', marginTop: '4px', display: 'inline-block' }}>
              {cuisineLabel(dish.cuisine)}
            </span>
          )}
          {preview.length > 0 && (
            <div style={{ fontSize: '0.8rem', color: 'var(--muted, #666)', marginTop: '4px' }}>
              {preview.join(', ')}{moreCount > 0 ? `, +${moreCount} more` : ''}
            </div>
          )}
          {(dish.tags || []).length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
              {dish.tags.map((tag) => (
                <span key={tag} className="chip" style={{ fontSize: '0.7rem' }}>#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Expanded editor ── */}
      {expanded && (
        <div
          style={{ marginTop: '12px', borderTop: '1px solid var(--border, #eee)', paddingTop: '12px' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Ingredients */}
          <label className="eyebrow" style={{ fontSize: '0.7rem' }}>Ingredients</label>
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
            style={{ ...INPUT_STYLE, resize: 'vertical' }}
          />

          {/* Reference */}
          <label className="eyebrow" style={{ fontSize: '0.7rem', marginTop: '8px', display: 'block' }}>Reference</label>
          <input
            type="text"
            key={`ref-${dish.id}-${dish.updated_at}`}
            defaultValue={dish.ref || ''}
            onBlur={(e) => {
              if (e.target.value !== (dish.ref || '')) onFieldUpdate(dish, 'ref', e.target.value);
            }}
            placeholder="Book, URL, or person"
            style={INPUT_STYLE}
          />

          {/* Notes */}
          <label className="eyebrow" style={{ fontSize: '0.7rem', marginTop: '8px', display: 'block' }}>Notes</label>
          <textarea
            key={`note-${dish.id}-${dish.updated_at}`}
            defaultValue={dish.notes || ''}
            onBlur={(e) => {
              if (e.target.value !== (dish.notes || '')) onFieldUpdate(dish, 'notes', e.target.value);
            }}
            placeholder="Prep notes..."
            rows={2}
            style={{ ...INPUT_STYLE, resize: 'vertical' }}
          />

          {/* Meal selector */}
          <label className="eyebrow" style={{ fontSize: '0.7rem', marginTop: '8px', display: 'block' }}>Meal</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['breakfast', 'lunch', 'dinner'].map((m) => (
              <button
                key={m}
                className={`chip${dish.meal === m ? ' active' : ''}`}
                onClick={() => onFieldUpdate(dish, 'meal', m)}
              >
                {cap(m)}
              </button>
            ))}
          </div>

          {/* Cuisine selector */}
          <label className="eyebrow" style={{ fontSize: '0.7rem', marginTop: '8px', display: 'block' }}>Cuisine</label>
          <select
            value={dish.cuisine || ''}
            onChange={(e) => onFieldUpdate(dish, 'cuisine', e.target.value)}
            style={{
              padding: '6px 8px', border: '1px solid var(--border, #ddd)',
              borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif',
              background: 'var(--card-bg, #fff)', color: 'var(--ink, #222)',
            }}
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
          <label className="eyebrow" style={{ fontSize: '0.7rem', marginTop: '8px', display: 'block' }}>Diet</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[{ key: 'veg', label: 'Veg' }, { key: 'egg', label: 'Egg' }, { key: 'nonveg', label: 'Non-veg' }].map(({ key, label }) => (
              <button
                key={key}
                className={`chip${dish.diet === key ? ' active' : ''}`}
                onClick={() => onFieldUpdate(dish, 'diet', key)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <DietDot diet={key} size={12} /> {label}
              </button>
            ))}
          </div>

          {/* Tags */}
          <label className="eyebrow" style={{ fontSize: '0.7rem', marginTop: '8px', display: 'block' }}>Tags</label>
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
            style={INPUT_STYLE}
          />

          {/* Overflow menu */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', position: 'relative' }}>
            <button
              onClick={onMenuToggle}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '1.25rem', padding: '4px 8px', color: 'var(--muted, #666)',
              }}
              aria-label="More options"
            >
              &#x22EF;
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', bottom: '100%', right: 0,
                background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #ddd)',
                borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                zIndex: 10, minWidth: '120px',
              }}>
                <button
                  onClick={() => { deleteWithUndo(dish); onMenuToggle(); }}
                  style={{
                    display: 'block', width: '100%', padding: '10px 16px',
                    background: 'none', border: 'none', textAlign: 'left',
                    cursor: 'pointer', fontSize: '0.875rem', color: '#c62828',
                  }}
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
      style={{
        marginBottom: '8px', padding: '12px',
        ...(variant === 'full' ? { borderLeft: '3px solid #4caf50' } : {}),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <DietDot diet={dish.diet || 'veg'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{dish.name}</div>
          {dish.cuisine && (
            <span className="chip" style={{ fontSize: '0.7rem', marginTop: '2px', display: 'inline-block' }}>
              {cuisineLabel(dish.cuisine)}
            </span>
          )}
          {variant === 'partial' && match.missing.length > 0 && (
            <div style={{ fontSize: '0.8rem', color: '#b71c1c', marginTop: '4px' }}>
              Need: {match.missing.join(', ')}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onPlan} style={{ fontSize: '0.8rem' }}>
          Plan it &rarr;
        </button>
        <button className="btn" onClick={onLog} style={{ fontSize: '0.8rem' }}>
          Log it
        </button>
      </div>
    </div>
  );
}

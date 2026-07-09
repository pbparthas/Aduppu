import React, { useState, useMemo, useCallback } from 'react';
import { localDateStr, addDays, weekDates, dayLabel } from '../lib/dates.js';
import { pickDish } from '../lib/randomizer.js';
import { CUISINES, expandCuisines } from '../lib/model.js';
import { newItem } from '../lib/merge.js';

/* ── constants ─────────────────────────────────────────── */

const MEALS = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ── helpers ───────────────────────────────────────────── */

function getDayAbbr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return DAY_ABBR[new Date(y, m - 1, d).getDay()];
}

function getDayNum(dateStr) {
  return parseInt(dateStr.split('-')[2], 10);
}

function cuisineLabel(key) {
  if (!key) return '';
  for (const c of CUISINES) {
    if (c.key === key) return c.label;
    if (c.subs) {
      for (const s of c.subs) {
        if (s.key === key) return s.label;
      }
    }
  }
  // Fallback: capitalize the key
  return key.replace(/(^|-)(\w)/g, (_, _sep, ch) => ' ' + ch.toUpperCase()).trim();
}

/* ── tiny sub-components ─────────────────────────────── */

function DietDot({ diet }) {
  if (!diet) return null;
  if (diet === 'nonveg') {
    return (
      <span className="diet-dot nonveg">
        <svg viewBox="0 0 10 10">
          <polygon points="5,0.5 9.5,9.5 0.5,9.5" fill="currentColor" />
        </svg>
      </span>
    );
  }
  return (
    <span className={`diet-dot ${diet}`}>
      <svg viewBox="0 0 10 10">
        <circle cx="5" cy="5" r="4.5" fill="currentColor" />
      </svg>
    </span>
  );
}

function MealChip({ meal }) {
  return (
    <span className={`chip ${meal}`}>
      {MEAL_LABELS[meal]}
    </span>
  );
}

/* ── main component ──────────────────────────────────── */

export default function Plan({
  items, dishes, plans, logs, groceryItems,
  pantryItem, prefsItem, saveItem, deleteWithUndo,
}) {
  const today = localDateStr();

  const [weekAnchor, setWeekAnchor] = useState(today);
  const [selectedDay, setSelectedDay] = useState(today);
  const [editingSlot, setEditingSlot] = useState(null);   // { day, meal }
  const [editValue, setEditValue] = useState('');
  const [showCuisineAsk, setShowCuisineAsk] = useState(null); // { mode, day? }
  const [showPicker, setShowPicker] = useState(null);      // { day, meal }
  const [pickerSearch, setPickerSearch] = useState('');

  // Current week's day strings [Mon..Sun]
  const days = useMemo(() => weekDates(weekAnchor), [weekAnchor]);

  const allFavCuisines = prefsItem?.cuisines || [];
  const favCuisines = allFavCuisines.filter(k => !k.includes(':'));

  /* ── lookups ───────────────────────────────────────── */

  const getPlan = useCallback(
    (day) => plans.find(p => p.date === day),
    [plans],
  );

  const hasLog = useCallback(
    (day, meal) => logs.some(l => l.date === day && l.meal === meal),
    [logs],
  );

  const getDiet = useCallback(
    (name) => {
      if (!name) return null;
      return dishes.find(d => d.name === name)?.diet || null;
    },
    [dishes],
  );

  /* ── week navigation ───────────────────────────────── */

  const changeWeek = useCallback((delta) => {
    const anchor = addDays(weekAnchor, delta * 7);
    setWeekAnchor(anchor);
    const newDays = weekDates(anchor);
    setSelectedDay(newDays.includes(today) ? today : newDays[0]);
  }, [weekAnchor, today]);

  /* ── plan persistence ──────────────────────────────── */

  const savePlan = useCallback(async (day, updates) => {
    const id = 'plan-' + day;
    const existing = plans.find(p => p.date === day);
    await saveItem({
      ...(existing || {}),
      id,
      type: 'plan',
      date: day,
      ...updates,
    });
  }, [plans, saveItem]);

  const setSlot = useCallback(async (day, meal, dishName) => {
    const existing = getPlan(day);
    const meals = {
      ...(existing?.meals || { breakfast: '', lunch: '', dinner: '' }),
      [meal]: dishName,
    };
    await savePlan(day, { meals });
  }, [getPlan, savePlan]);

  /* ── reroll a single slot ──────────────────────────── */

  const rerollSlot = useCallback(async (day, meal) => {
    const plan = getPlan(day);
    const current = plan?.meals?.[meal] || '';
    const name = pickDish(meal, day, {
      dishes, plans, logs,
      exclude: current ? [current] : [],
      cuisines: plan?.cuisine ? [plan.cuisine] : (prefsItem?.cuisines || null),
      diet: prefsItem?.diet || 'all',
    });
    if (name) await setSlot(day, meal, name);
  }, [dishes, plans, logs, prefsItem, getPlan, setSlot]);

  /* ── fill day / fill week ──────────────────────────── */

  const fillDay = useCallback(async (day, cuisineKey) => {
    const plan = getPlan(day);
    const meals = {
      ...(plan?.meals || { breakfast: '', lunch: '', dinner: '' }),
    };
    const exclude = Object.values(meals).filter(Boolean);
    const isMix = cuisineKey === 'mix';

    for (const meal of MEALS) {
      if (!meals[meal]) {
        const name = pickDish(meal, day, {
          dishes, plans, logs, exclude,
          cuisines: isMix ? (prefsItem?.cuisines || null) : [cuisineKey],
          diet: prefsItem?.diet || 'all',
        });
        if (name) {
          meals[meal] = name;
          exclude.push(name);
        }
      }
    }

    await savePlan(day, {
      meals,
      cuisine: isMix ? null : cuisineKey,
    });
  }, [dishes, plans, logs, prefsItem, getPlan, savePlan]);

  const handleCuisineChoice = useCallback(async (cuisineKey) => {
    if (!showCuisineAsk) return;
    const { mode, day } = showCuisineAsk;
    setShowCuisineAsk(null);

    if (mode === 'day') {
      await fillDay(day, cuisineKey);
    } else {
      // Fill week: only today and future days, not past days
      const todayStr = localDateStr();
      for (const d of days) {
        if (d >= todayStr) await fillDay(d, cuisineKey);
      }
    }
  }, [showCuisineAsk, days, fillDay]);

  /* ── inline edit ───────────────────────────────────── */

  const startEdit = useCallback((day, meal, currentName) => {
    setEditingSlot({ day, meal });
    setEditValue(currentName || '');
  }, []);

  const commitEdit = useCallback(async () => {
    if (!editingSlot) return;
    await setSlot(editingSlot.day, editingSlot.meal, editValue.trim());
    setEditingSlot(null);
    setEditValue('');
  }, [editingSlot, editValue, setSlot]);

  const cancelEdit = useCallback(() => {
    setEditingSlot(null);
    setEditValue('');
  }, []);

  // Autocomplete suggestions for the inline edit field
  const suggestions = useMemo(() => {
    if (!editingSlot || !editValue.trim()) return [];
    const q = editValue.toLowerCase();
    return dishes
      .filter(d => d.meal === editingSlot.meal && !d.deleted
        && d.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [editValue, editingSlot, dishes]);

  /* ── dish picker bottom sheet ──────────────────────── */

  const pickerDishes = useMemo(() => {
    if (!showPicker) return [];
    const { meal } = showPicker;
    let list = dishes.filter(d => d.meal === meal);

    if (pickerSearch.trim()) {
      const q = pickerSearch.toLowerCase();
      list = list.filter(d =>
        d.name.toLowerCase().includes(q) ||
        (d.ingredients || []).some(ing => ing.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [showPicker, dishes, pickerSearch]);

  /* ── remove cuisine from a day ─────────────────────── */

  const removeCuisine = useCallback(async (day) => {
    await savePlan(day, { cuisine: null });
  }, [savePlan]);

  /* ── selected day's plan ───────────────────────────── */

  const selPlan = getPlan(selectedDay);

  /* ── render ────────────────────────────────────────── */

  return (
    <div className="screen">

      {/* ── Week navigation ──────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <button className="btn ghost" onClick={() => changeWeek(-1)}>
          ‹
        </button>

        <div className="seg" style={{ flex: 1, justifyContent: 'center' }}>
          {days.map(day => {
            const isToday = day === today;
            const isSelected = day === selectedDay;
            const isPast = day < today;
            return (
              <button
                key={day}
                className={isSelected ? 'on' : ''}
                onClick={() => setSelectedDay(day)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  opacity: isPast && !isSelected ? 0.5 : 1,
                }}
              >
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
                  {getDayAbbr(day)}
                </span>
                <span style={{ fontWeight: isToday ? 800 : 500 }}>
                  {getDayNum(day)}
                </span>
              </button>
            );
          })}
        </div>

        <button className="btn ghost" onClick={() => changeWeek(1)}>
          ›
        </button>
      </div>

      {/* ── Selected day header ──────────────────── */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="disp" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
          {dayLabel(selectedDay)}
        </span>
        {selPlan?.cuisine && (
          <span
            className="chip cuisine"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            {cuisineLabel(selPlan.cuisine)}
            <span
              onClick={() => removeCuisine(selectedDay)}
              style={{ cursor: 'pointer', marginLeft: 2, fontSize: '0.65rem' }}
              role="button"
              tabIndex={0}
              title="Remove cuisine"
            >
              ✕
            </span>
          </span>
        )}
      </div>

      {/* ── Three meal boxes ─────────────────────── */}
      {MEALS.map(meal => {
        const planned = selPlan?.meals?.[meal] || '';
        const isEditing = editingSlot?.day === selectedDay
          && editingSlot?.meal === meal;
        const logged = hasLog(selectedDay, meal);
        const diet = getDiet(planned);

        return (
          <div key={meal} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MealChip meal={meal} />
              {planned && !isEditing && <DietDot diet={diet} />}

              {/* Dish name / inline edit */}
              <div style={{ flex: 1, position: 'relative' }}>
                {isEditing ? (
                  <div>
                    <input
                      autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      onBlur={() => setTimeout(commitEdit, 200)}
                      style={{
                        padding: '4px 8px',
                        border: '1px solid var(--line)',
                        borderRadius: 6,
                        fontSize: '0.875rem',
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                        background: 'var(--card)',
                        color: 'var(--ink)',
                      }}
                    />
                    {suggestions.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        background: 'var(--card)',
                        border: '1px solid var(--line)',
                        borderRadius: 6, zIndex: 10, maxHeight: 200,
                        overflowY: 'auto',
                        boxShadow: 'var(--shadow)',
                      }}>
                        {suggestions.map(d => (
                          <div
                            key={d.id}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              setEditValue(d.name);
                              setSlot(selectedDay, meal, d.name);
                              setEditingSlot(null);
                            }}
                            style={{
                              padding: '6px 10px', cursor: 'pointer',
                              fontSize: '0.85rem',
                              display: 'flex', alignItems: 'center', gap: 4,
                              borderBottom: '1px solid var(--line)',
                            }}
                          >
                            <DietDot diet={d.diet} />
                            {d.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <span
                    onClick={() => startEdit(selectedDay, meal, planned)}
                    style={{
                      cursor: 'pointer', fontSize: '0.9rem',
                      color: planned ? 'var(--ink)' : 'var(--muted)',
                      fontWeight: planned ? 500 : 400,
                    }}
                  >
                    {planned || 'Tap to plan'}
                  </span>
                )}
              </div>

              {/* "had this" indicator */}
              {logged && (
                <span style={{
                  fontSize: '0.7rem', color: 'var(--success)',
                  fontWeight: 600, whiteSpace: 'nowrap',
                }}>
                  ✓ had this
                </span>
              )}

              {/* Reroll */}
              <button
                className="btn ghost"
                onClick={() => rerollSlot(selectedDay, meal)}
                title="Reroll"
                style={{ fontSize: '1rem', padding: 4 }}
              >
                🎲
              </button>

              {/* Pick from catalog */}
              <button
                className="btn ghost"
                onClick={() => {
                  setShowPicker({ day: selectedDay, meal });
                  setPickerSearch('');
                }}
                title="Pick from catalog"
                style={{ fontSize: '0.8rem', padding: 4 }}
              >
                📋
              </button>
            </div>
          </div>
        );
      })}

      {/* ── Fill buttons ─────────────────────────── */}
      <div className="btn-row" style={{ marginBottom: 24 }}>
        <button
          className="btn accent"
          style={{ flex: 1 }}
          onClick={() => setShowCuisineAsk({ mode: 'day', day: selectedDay })}
        >
          Fill day 🎲
        </button>
        <button
          className="btn accent"
          style={{ flex: 1 }}
          onClick={() => setShowCuisineAsk({ mode: 'week' })}
        >
          Fill week 🎲
        </button>
      </div>

      {/* ── Week overview ────────────────────────── */}
      <span className="eyebrow" style={{ marginBottom: 8 }}>Week overview</span>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {days.map(day => {
          const plan = getPlan(day);
          const isPast = day < today;
          const isToday = day === today;
          return (
            <div
              key={day}
              className={`week-row${isToday ? ' today' : ''}`}
              onClick={() => setSelectedDay(day)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                opacity: isPast ? 0.5 : 1,
                ...(isToday ? { background: 'var(--accent-wash)' } : {}),
              }}
            >
              <span className="day-name" style={{ minWidth: 46, whiteSpace: 'nowrap' }}>
                {getDayAbbr(day)} {getDayNum(day)}
              </span>

              <div className="meals">
                {MEALS.map(meal => {
                  const name = plan?.meals?.[meal] || '';
                  return (
                    <span key={meal} style={{
                      flex: 1, fontSize: '0.7rem',
                      color: name ? 'var(--ink)' : 'var(--muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', padding: '2px 4px',
                      borderRadius: 4,
                    }}>
                      {name || '—'}
                    </span>
                  );
                })}
              </div>

              {plan?.cuisine && (
                <span className="chip cuisine">
                  {cuisineLabel(plan.cuisine)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Cuisine ask bottom sheet ─────────────── */}
      {showCuisineAsk && (
        <div className="overlay" onClick={() => setShowCuisineAsk(null)}>
          <div className="panel" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>
              What are we cooking?
            </div>
            <div className="seg wrap">
              <button
                className="on"
                autoFocus
                onClick={() => handleCuisineChoice('mix')}
              >
                Mix
              </button>
              {favCuisines.map(key => (
                <button
                  key={key}
                  onClick={() => handleCuisineChoice(key)}
                >
                  {cuisineLabel(key)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Dish picker bottom sheet ─────────────── */}
      {showPicker && (
        <div className="overlay" onClick={() => setShowPicker(null)}>
          <div
            className="panel"
            onClick={e => e.stopPropagation()}
            style={{ maxHeight: '70vh' }}
          >
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>
              Pick a dish — {MEAL_LABELS[showPicker.meal]}
            </div>

            <div className="search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                autoFocus
                placeholder="Search dishes..."
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {pickerDishes.length === 0 ? (
                <div className="empty">No dishes found</div>
              ) : (
                pickerDishes.map(d => (
                  <div
                    key={d.id}
                    onClick={() => {
                      setSlot(showPicker.day, showPicker.meal, d.name);
                      setShowPicker(null);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 8px', cursor: 'pointer',
                      borderBottom: '1px solid var(--line)',
                    }}
                  >
                    <DietDot diet={d.diet} />
                    <span style={{ flex: 1, fontSize: '0.875rem' }}>
                      {d.name}
                    </span>
                    {d.cuisine && (
                      <span className="chip cuisine">
                        {cuisineLabel(d.cuisine)}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

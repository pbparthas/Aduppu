import React, { useState, useMemo, useCallback } from 'react';
import { localDateStr, addDays, weekDates, dayLabel } from '../lib/dates.js';
import { pickDish } from '../lib/randomizer.js';
import { CUISINES, expandCuisines } from '../lib/model.js';
import { newItem } from '../lib/merge.js';

/* ── constants ─────────────────────────────────────────── */

const MEALS = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ACCENT = '#b5541c';
const ACCENT_LIGHT = '#f5ebe3';
const BORDER = '#e5e0d8';
const MUTED = '#999';
const INK = '#333';

const MEAL_CHIP_COLORS = {
  breakfast: { bg: '#fef3c7', text: '#92400e' },
  lunch:    { bg: ACCENT_LIGHT, text: ACCENT },
  dinner:   { bg: '#e8e5e0', text: '#555' },
};

const INPUT_STYLE = {
  padding: '8px 10px',
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  fontSize: '0.875rem',
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

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
      <svg width="10" height="10" viewBox="0 0 10 10"
        style={{ verticalAlign: 'middle', marginRight: 4, flexShrink: 0 }}>
        <polygon points="5,0.5 9.5,9.5 0.5,9.5" fill="#8B4513" />
      </svg>
    );
  }
  const color = diet === 'egg' ? '#DAA520' : '#228B22';
  return (
    <svg width="10" height="10" viewBox="0 0 10 10"
      style={{ verticalAlign: 'middle', marginRight: 4, flexShrink: 0 }}>
      <circle cx="5" cy="5" r="4.5" fill={color} />
    </svg>
  );
}

function MealChip({ meal }) {
  const c = MEAL_CHIP_COLORS[meal];
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 10,
      fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.04em', backgroundColor: c.bg, color: c.text,
    }}>
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
    <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>

      {/* ── Week navigation ──────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16,
      }}>
        <button
          onClick={() => changeWeek(-1)}
          style={{
            border: 'none', background: 'none', cursor: 'pointer',
            fontSize: '1.2rem', color: INK, padding: '4px 8px',
          }}
        >
          ‹
        </button>

        <div style={{ display: 'flex', flex: 1, gap: 2, justifyContent: 'center' }}>
          {days.map(day => {
            const isToday = day === today;
            const isSelected = day === selectedDay;
            const isPast = day < today;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', padding: '6px 2px', borderRadius: 10,
                  border: 'none', cursor: 'pointer',
                  backgroundColor: isSelected ? ACCENT
                    : isToday ? ACCENT_LIGHT : 'transparent',
                  color: isSelected ? '#fff' : isPast ? MUTED : INK,
                  opacity: isPast && !isSelected ? 0.6 : 1,
                  fontFamily: 'Inter, sans-serif',
                  transition: 'background-color 0.15s',
                }}
              >
                <span style={{
                  fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
                }}>
                  {getDayAbbr(day)}
                </span>
                <span style={{
                  fontSize: '0.9rem', fontWeight: isToday ? 700 : 500,
                }}>
                  {getDayNum(day)}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => changeWeek(1)}
          style={{
            border: 'none', background: 'none', cursor: 'pointer',
            fontSize: '1.2rem', color: INK, padding: '4px 8px',
          }}
        >
          ›
        </button>
      </div>

      {/* ── Selected day header ──────────────────── */}
      <div style={{
        marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          fontSize: '1.1rem', fontWeight: 600, color: INK,
          fontFamily: '"Saira Condensed", sans-serif',
        }}>
          {dayLabel(selectedDay)}
        </span>
        {selPlan?.cuisine && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 10,
            backgroundColor: ACCENT_LIGHT, color: ACCENT,
            fontSize: '0.7rem', fontWeight: 600,
          }}>
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
          <div key={meal} style={{
            backgroundColor: '#fff', border: `1px solid ${BORDER}`,
            borderRadius: 10, padding: 12, marginBottom: 10,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
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
                      style={{ ...INPUT_STYLE, padding: '4px 8px' }}
                    />
                    {suggestions.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        backgroundColor: '#fff', border: `1px solid ${BORDER}`,
                        borderRadius: 6, zIndex: 10, maxHeight: 200,
                        overflowY: 'auto',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
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
                              borderBottom: `1px solid ${BORDER}`,
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
                      color: planned ? INK : MUTED,
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
                  fontSize: '0.7rem', color: '#16a34a', fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>
                  ✓ had this
                </span>
              )}

              {/* Reroll */}
              <button
                onClick={() => rerollSlot(selectedDay, meal)}
                title="Reroll"
                style={{
                  border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: '1rem', padding: '4px',
                }}
              >
                🎲
              </button>

              {/* Pick from catalog */}
              <button
                onClick={() => {
                  setShowPicker({ day: selectedDay, meal });
                  setPickerSearch('');
                }}
                title="Pick from catalog"
                style={{
                  border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: '0.8rem', color: ACCENT, padding: '4px',
                  fontWeight: 600,
                }}
              >
                📋
              </button>
            </div>
          </div>
        );
      })}

      {/* ── Fill buttons ─────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <button
          onClick={() => setShowCuisineAsk({ mode: 'day', day: selectedDay })}
          style={{
            flex: 1, padding: '10px 0',
            border: `1px solid ${ACCENT}`, borderRadius: 10,
            backgroundColor: ACCENT_LIGHT, color: ACCENT,
            fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Fill day 🎲
        </button>
        <button
          onClick={() => setShowCuisineAsk({ mode: 'week' })}
          style={{
            flex: 1, padding: '10px 0',
            border: `1px solid ${ACCENT}`, borderRadius: 10,
            backgroundColor: ACCENT_LIGHT, color: ACCENT,
            fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Fill week 🎲
        </button>
      </div>

      {/* ── Week overview ────────────────────────── */}
      <div style={{
        fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: MUTED, marginBottom: 8,
      }}>
        Week overview
      </div>

      <div style={{
        backgroundColor: '#fff', border: `1px solid ${BORDER}`,
        borderRadius: 10, overflow: 'hidden',
      }}>
        {days.map((day, i) => {
          const plan = getPlan(day);
          const isPast = day < today;
          const isToday = day === today;
          return (
            <div
              key={day}
              onClick={() => setSelectedDay(day)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', cursor: 'pointer',
                borderBottom: i < 6 ? `1px solid ${BORDER}` : 'none',
                backgroundColor: isToday ? '#fdfcfa' : 'transparent',
                opacity: isPast ? 0.5 : 1,
              }}
            >
              <span style={{
                minWidth: 46, fontSize: '0.75rem', fontWeight: 600,
                color: isToday ? ACCENT : INK, whiteSpace: 'nowrap',
              }}>
                {getDayAbbr(day)} {getDayNum(day)}
              </span>

              <div style={{ flex: 1, display: 'flex', gap: 4 }}>
                {MEALS.map(meal => {
                  const name = plan?.meals?.[meal] || '';
                  return (
                    <span key={meal} style={{
                      flex: 1, fontSize: '0.7rem',
                      color: name ? INK : '#ccc',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', padding: '2px 4px',
                      borderRadius: 4,
                      backgroundColor: name
                        ? MEAL_CHIP_COLORS[meal].bg : 'transparent',
                    }}>
                      {name || '—'}
                    </span>
                  );
                })}
              </div>

              {plan?.cuisine && (
                <span style={{
                  fontSize: '0.6rem', padding: '1px 6px', borderRadius: 8,
                  backgroundColor: ACCENT_LIGHT, color: ACCENT,
                  fontWeight: 600, whiteSpace: 'nowrap',
                }}>
                  {cuisineLabel(plan.cuisine)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Cuisine ask bottom sheet ─────────────── */}
      {showCuisineAsk && (
        <div
          onClick={() => setShowCuisineAsk(null)}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 100,
            display: 'flex', alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px 16px 0 0',
              padding: '24px 20px',
              maxWidth: 640, width: '100%',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
            }}
          >
            <div style={{
              fontSize: '1rem', fontWeight: 600, color: INK, marginBottom: 16,
            }}>
              What are we cooking?
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {/* "Mix" is pre-focused (autoFocus) */}
              <button
                autoFocus
                onClick={() => handleCuisineChoice('mix')}
                style={{
                  padding: '8px 16px', borderRadius: 20,
                  border: `2px solid ${ACCENT}`,
                  backgroundColor: ACCENT_LIGHT, color: ACCENT,
                  fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Mix
              </button>
              {favCuisines.map(key => (
                <button
                  key={key}
                  onClick={() => handleCuisineChoice(key)}
                  style={{
                    padding: '8px 16px', borderRadius: 20,
                    border: `1px solid ${BORDER}`,
                    backgroundColor: '#fff', color: INK,
                    fontWeight: 400, fontSize: '0.85rem', cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
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
        <div
          onClick={() => setShowPicker(null)}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 100,
            display: 'flex', alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px 16px 0 0',
              padding: '20px 20px',
              maxWidth: 640, width: '100%',
              maxHeight: '70vh',
              display: 'flex', flexDirection: 'column',
              paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
            }}
          >
            <div style={{
              fontSize: '1rem', fontWeight: 600, color: INK, marginBottom: 12,
            }}>
              Pick a dish — {MEAL_LABELS[showPicker.meal]}
            </div>

            <input
              autoFocus
              placeholder="Search dishes..."
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              style={{ ...INPUT_STYLE, marginBottom: 12 }}
            />

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {pickerDishes.length === 0 ? (
                <div style={{
                  padding: 20, textAlign: 'center',
                  color: MUTED, fontSize: '0.85rem',
                }}>
                  No dishes found
                </div>
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
                      borderBottom: `1px solid ${BORDER}`,
                    }}
                  >
                    <DietDot diet={d.diet} />
                    <span style={{
                      flex: 1, fontSize: '0.875rem', color: INK,
                    }}>
                      {d.name}
                    </span>
                    {d.cuisine && (
                      <span style={{ fontSize: '0.65rem', color: MUTED }}>
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

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { localDateStr } from '../lib/dates.js';
import { pickDish } from '../lib/randomizer.js';
import { newItem } from '../lib/merge.js';

/* ── constants ─────────────────────────────────────────── */

const MEALS = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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
  boxSizing: 'border-box',
};

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

export default function Today({
  items, dishes, plans, logs, groceryItems,
  pantryItem, prefsItem, saveItem, deleteWithUndo,
}) {
  const [expandedMeal, setExpandedMeal] = useState(null);
  const [composer, setComposer] = useState({ dish: '', mode: 'home', cost: '', note: '' });
  const [editingLogId, setEditingLogId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const today = localDateStr();

  const todayPlan = useMemo(() => plans.find(p => p.date === today), [plans, today]);
  const todayLogs = useMemo(() => logs.filter(l => l.date === today), [logs, today]);

  // Format: "Thursday, 9 July"
  const dateDisplay = useMemo(() => {
    const d = new Date();
    return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }, []);

  const getDiet = useCallback((name) => {
    if (!name) return null;
    return dishes.find(d => d.name === name)?.diet || null;
  }, [dishes]);

  /* ── toast ─────────────────────────────────────────── */

  const showToast = useCallback((msg, undoFn) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
    setToast({ msg, undoFn });
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  /* ── handlers ──────────────────────────────────────── */

  const reroll = useCallback(async (meal) => {
    const name = pickDish(meal, today, {
      dishes,
      plans,
      logs,
      cuisines: todayPlan?.cuisine
        ? [todayPlan.cuisine]
        : (prefsItem?.cuisines || null),
      diet: prefsItem?.diet || 'all',
    });
    if (!name) return;
    const id = 'plan-' + today;
    const meals = {
      ...(todayPlan?.meals || { breakfast: '', lunch: '', dinner: '' }),
      [meal]: name,
    };
    await saveItem({ ...(todayPlan || {}), id, type: 'plan', date: today, meals });
  }, [today, dishes, plans, logs, todayPlan, prefsItem, saveItem]);

  const cookedThis = useCallback(async (meal, dishName) => {
    const item = newItem({
      type: 'log', date: today, meal,
      mode: 'home', dish: dishName, cost: 0, notes: '',
    });
    await saveItem(item);
    showToast('Logged!', async () => {
      await saveItem({ ...item, deleted: true, deleted_at: Date.now() });
    });
  }, [today, saveItem, showToast]);

  const submitComposer = useCallback(async (meal) => {
    const d = composer.dish.trim();
    if (!d) return;
    await saveItem(newItem({
      type: 'log', date: today, meal,
      mode: composer.mode,
      dish: d,
      cost: composer.mode === 'out' ? (Number(composer.cost) || 0) : 0,
      notes: composer.note.trim(),
    }));
    setComposer({ dish: '', mode: 'home', cost: '', note: '' });
    setExpandedMeal(null);
  }, [composer, today, saveItem]);

  const saveEdit = useCallback(async (original) => {
    await saveItem({
      ...original,
      dish: editValues.dish ?? original.dish,
      mode: editValues.mode ?? original.mode,
      cost: (editValues.mode ?? original.mode) === 'out'
        ? (Number(editValues.cost) || 0)
        : (original.cost || 0),
      notes: editValues.notes ?? original.notes,
    });
    setEditingLogId(null);
    setEditValues({});
  }, [editValues, saveItem]);

  const toggleComposer = useCallback((meal) => {
    if (expandedMeal === meal) {
      setExpandedMeal(null);
    } else {
      setExpandedMeal(meal);
      setComposer({ dish: '', mode: 'home', cost: '', note: '' });
    }
  }, [expandedMeal]);

  /* ── summary ───────────────────────────────────────── */

  const summary = useMemo(() => {
    if (todayLogs.length === 0) return null;
    const cooked = todayLogs.filter(l => l.mode === 'home').length;
    const ordered = todayLogs.filter(l => l.mode === 'out').length;
    const spent = todayLogs.reduce((s, l) => s + (l.cost || 0), 0);
    return { cooked, ordered, spent };
  }, [todayLogs]);

  /* ── render ────────────────────────────────────────── */

  return (
    <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>

      {/* ── Date heading ──────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: ACCENT, marginBottom: 2,
        }}>
          Today
        </div>
        <div style={{
          fontSize: '1.5rem', fontWeight: 700, color: INK,
          fontFamily: '"Saira Condensed", sans-serif',
        }}>
          {dateDisplay}
        </div>
      </div>

      {/* ── Meal cards ────────────────────────────── */}
      {MEALS.map(meal => {
        const planned = todayPlan?.meals?.[meal] || '';
        const mealLogs = todayLogs.filter(l => l.meal === meal);
        const hasLog = mealLogs.length > 0;
        const diet = getDiet(planned);

        return (
          <div key={meal} style={{
            backgroundColor: '#fff', border: `1px solid ${BORDER}`,
            borderRadius: 10, padding: 16, marginBottom: 12,
          }}>
            {/* Header row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
            }}>
              <MealChip meal={meal} />
              {planned && <DietDot diet={diet} />}
              <span style={{
                flex: 1, fontSize: '1rem', fontWeight: 500,
                color: planned ? INK : MUTED,
              }}>
                {planned || 'Nothing planned'}
              </span>
              <button
                onClick={() => reroll(meal)}
                title="Reroll"
                style={{
                  border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: '1.1rem', padding: '4px 6px', borderRadius: 6,
                }}
              >
                🎲
              </button>
            </div>

            {/* "Cooked this" button */}
            {planned && !hasLog && (
              <button
                onClick={() => cookedThis(meal, planned)}
                style={{
                  display: 'block', width: '100%', padding: '8px 0',
                  border: `1px solid ${ACCENT}`, borderRadius: 8,
                  backgroundColor: ACCENT_LIGHT, color: ACCENT,
                  fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                Cooked this ✓
              </button>
            )}

            {/* Logged entries */}
            {mealLogs.map(log => (
              <div key={log.id} style={{ marginBottom: 4 }}>
                {editingLogId === log.id ? (
                  /* ── inline edit ── */
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 6,
                    padding: 8, backgroundColor: '#fafaf8', borderRadius: 6,
                    border: `1px solid ${BORDER}`,
                  }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        value={editValues.dish ?? ''}
                        onChange={e => setEditValues(v => ({ ...v, dish: e.target.value }))}
                        style={{ ...INPUT_STYLE, flex: 1 }}
                      />
                      <button
                        onClick={() => setEditValues(v => ({
                          ...v,
                          mode: (v.mode ?? log.mode) === 'home' ? 'out' : 'home',
                        }))}
                        style={{
                          border: `1px solid ${BORDER}`, borderRadius: 6,
                          padding: '6px 10px', backgroundColor: '#fff',
                          cursor: 'pointer', fontSize: '0.9rem',
                        }}
                      >
                        {(editValues.mode ?? log.mode) === 'home' ? '🏠' : '🛵'}
                      </button>
                    </div>
                    {(editValues.mode ?? log.mode) === 'out' && (
                      <input
                        type="number"
                        placeholder="₹ cost"
                        value={editValues.cost ?? ''}
                        onChange={e => setEditValues(v => ({ ...v, cost: e.target.value }))}
                        style={INPUT_STYLE}
                      />
                    )}
                    <input
                      placeholder="Note"
                      value={editValues.notes ?? ''}
                      onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))}
                      style={INPUT_STYLE}
                    />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { setEditingLogId(null); setEditValues({}); }}
                        style={{
                          padding: '6px 12px', border: `1px solid ${BORDER}`,
                          borderRadius: 6, backgroundColor: '#fff',
                          cursor: 'pointer', fontSize: '0.8rem',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(log)}
                        style={{
                          padding: '6px 12px', border: 'none', borderRadius: 6,
                          backgroundColor: ACCENT, color: '#fff',
                          cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── display row ── */
                  <div
                    onClick={() => {
                      setEditingLogId(log.id);
                      setEditValues({
                        dish: log.dish, mode: log.mode,
                        cost: log.cost || '', notes: log.notes || '',
                      });
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 8px', borderRadius: 6,
                      cursor: 'pointer', backgroundColor: '#fafaf8',
                    }}
                  >
                    <span style={{ fontSize: '0.85rem' }}>
                      {log.mode === 'home' ? '🏠' : '🛵'}
                    </span>
                    <DietDot diet={getDiet(log.dish)} />
                    <span style={{ flex: 1, fontSize: '0.875rem', color: INK }}>
                      {log.dish}
                    </span>
                    {log.cost > 0 && (
                      <span style={{ fontSize: '0.8rem', color: MUTED }}>
                        ₹{log.cost}
                      </span>
                    )}
                    {log.notes ? (
                      <span style={{
                        fontSize: '0.75rem', color: MUTED, fontStyle: 'italic',
                        maxWidth: 80, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {log.notes}
                      </span>
                    ) : null}
                    <button
                      onClick={e => { e.stopPropagation(); deleteWithUndo(log); }}
                      style={{
                        border: 'none', background: 'none', cursor: 'pointer',
                        fontSize: '0.75rem', color: MUTED, padding: '4px',
                      }}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Inline log composer */}
            <div style={{ marginTop: 6 }}>
              {expandedMeal === meal ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 6,
                  padding: 8, backgroundColor: '#fafaf8', borderRadius: 6,
                  border: `1px dashed ${BORDER}`,
                }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      autoFocus
                      placeholder="What did you have?"
                      value={composer.dish}
                      onChange={e => setComposer(c => ({ ...c, dish: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') submitComposer(meal); }}
                      style={{ ...INPUT_STYLE, flex: 1 }}
                    />
                    <button
                      onClick={() => setComposer(c => ({
                        ...c, mode: c.mode === 'home' ? 'out' : 'home',
                      }))}
                      title={composer.mode === 'home' ? 'Home' : 'Ordered'}
                      style={{
                        border: `1px solid ${BORDER}`, borderRadius: 6,
                        padding: '8px 10px', cursor: 'pointer', fontSize: '0.9rem',
                        backgroundColor: composer.mode === 'out' ? '#fef3c7' : '#fff',
                      }}
                    >
                      {composer.mode === 'home' ? '🏠' : '🛵'}
                    </button>
                  </div>
                  {composer.mode === 'out' && (
                    <input
                      type="number"
                      placeholder="₹ cost"
                      value={composer.cost}
                      onChange={e => setComposer(c => ({ ...c, cost: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') submitComposer(meal); }}
                      style={INPUT_STYLE}
                    />
                  )}
                  <input
                    placeholder="Note (optional)"
                    value={composer.note}
                    onChange={e => setComposer(c => ({ ...c, note: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') submitComposer(meal); }}
                    style={INPUT_STYLE}
                  />
                </div>
              ) : (
                <button
                  onClick={() => toggleComposer(meal)}
                  style={{
                    display: 'block', width: '100%', padding: '8px 0',
                    border: `1px dashed ${BORDER}`, borderRadius: 8,
                    backgroundColor: 'transparent', color: MUTED,
                    fontSize: '0.8rem', cursor: 'pointer',
                  }}
                >
                  + Log a meal
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* ── Summary strip ─────────────────────────── */}
      {summary && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 12,
          padding: '12px 16px', backgroundColor: '#fff',
          border: `1px solid ${BORDER}`, borderRadius: 10,
          fontSize: '0.8rem', color: MUTED,
        }}>
          <span>cooked <strong style={{ color: INK }}>{summary.cooked}</strong></span>
          {summary.ordered > 0 && (
            <>
              <span style={{ color: BORDER }}>·</span>
              <span>ordered <strong style={{ color: INK }}>{summary.ordered}</strong></span>
            </>
          )}
          {summary.spent > 0 && (
            <>
              <span style={{ color: BORDER }}>·</span>
              <span>₹ <strong style={{ color: INK }}>{summary.spent}</strong> spent</span>
            </>
          )}
        </div>
      )}

      {/* ── Toast ─────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: INK, color: '#fff',
          padding: '10px 20px', borderRadius: 10, fontSize: '0.875rem',
          display: 'flex', alignItems: 'center', gap: 12,
          zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          <span>{toast.msg}</span>
          {toast.undoFn && (
            <button
              onClick={() => { toast.undoFn(); dismissToast(); }}
              style={{
                border: 'none', background: 'none', color: '#fbbf24',
                cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
                padding: 0,
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

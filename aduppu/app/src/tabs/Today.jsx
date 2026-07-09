import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { localDateStr } from '../lib/dates.js';
import { pickDish } from '../lib/randomizer.js';
import { newItem } from '../lib/merge.js';

const MEALS = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const MEAL_CLS = { breakfast: 'chip breakfast', lunch: 'chip lunch', dinner: 'chip dinner' };
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function DietDot({ diet }) {
  if (!diet) return null;
  if (diet === 'nonveg') {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" className="diet-dot nonveg" aria-label="Non-veg">
        <polygon points="5,0.5 9.5,9.5 0.5,9.5" fill="#8B4513" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" className={'diet-dot ' + (diet === 'egg' ? 'egg' : 'veg')}
      aria-label={diet === 'egg' ? 'Egg' : 'Veg'}>
      <circle cx="5" cy="5" r="4.5" fill={diet === 'egg' ? '#DAA520' : '#228B22'} />
    </svg>
  );
}

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

  const dateDisplay = useMemo(() => {
    const d = new Date();
    return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }, []);

  const getDiet = useCallback((name) => {
    if (!name) return null;
    return dishes.find(d => d.name === name)?.diet || null;
  }, [dishes]);

  const showToast = useCallback((msg, undoFn) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
    setToast({ msg, undoFn });
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const reroll = useCallback(async (meal) => {
    const name = pickDish(meal, today, {
      dishes, plans, logs,
      cuisines: todayPlan?.cuisine ? [todayPlan.cuisine] : (prefsItem?.cuisines || null),
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
    showToast('Meal logged!');
  }, [composer, today, saveItem, showToast]);

  const saveEdit = useCallback(async (original) => {
    await saveItem({
      ...original,
      dish: editValues.dish ?? original.dish,
      mode: editValues.mode ?? original.mode,
      cost: (editValues.mode ?? original.mode) === 'out'
        ? (Number(editValues.cost) || 0) : (original.cost || 0),
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

  const summary = useMemo(() => {
    if (todayLogs.length === 0) return null;
    const cooked = todayLogs.filter(l => l.mode === 'home').length;
    const ordered = todayLogs.filter(l => l.mode === 'out').length;
    const spent = todayLogs.reduce((s, l) => s + (l.cost || 0), 0);
    return { cooked, ordered, spent };
  }, [todayLogs]);

  return (
    <main className="screen">
      {/* Date heading */}
      <span className="eyebrow">Today</span>
      <div className="disp" style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
        {dateDisplay}
      </div>

      {/* Meal cards */}
      {MEALS.map(meal => {
        const planned = todayPlan?.meals?.[meal] || '';
        const mealLogs = todayLogs.filter(l => l.meal === meal);
        const hasLog = mealLogs.length > 0;
        const diet = getDiet(planned);

        return (
          <div key={meal} className="card" style={{ marginBottom: 12 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span className={MEAL_CLS[meal]}>{MEAL_LABELS[meal]}</span>
              {planned && <DietDot diet={diet} />}
              <span style={{ flex: 1, fontSize: 15, fontWeight: planned ? 600 : 400, color: planned ? 'var(--ink)' : 'var(--muted)' }}>
                {planned || 'Nothing planned'}
              </span>
              <button className="btn" style={{ padding: '6px 10px', fontSize: 16, minHeight: 0, border: 'none', background: 'none' }}
                onClick={() => reroll(meal)} title="Reroll">🎲</button>
            </div>

            {/* "Cooked this" quick button */}
            {planned && !hasLog && (
              <button className="btn accent" style={{ width: '100%', marginBottom: 10 }}
                onClick={() => cookedThis(meal, planned)}>
                Cooked this ✓
              </button>
            )}

            {/* Logged entries */}
            {mealLogs.map(log => (
              <div key={log.id} style={{ marginBottom: 6 }}>
                {editingLogId === log.id ? (
                  <div className="card" style={{ padding: 10, background: 'var(--bg)' }}>
                    <input className="search" style={{ marginBottom: 6 }}
                      value={editValues.dish ?? ''} placeholder="Dish name"
                      onChange={e => setEditValues(v => ({ ...v, dish: e.target.value }))} />
                    <div className="seg" style={{ marginBottom: 6 }}>
                      <button className={(editValues.mode ?? log.mode) === 'home' ? 'on' : ''}
                        onClick={() => setEditValues(v => ({ ...v, mode: 'home' }))}>
                        🏠 Home cooked
                      </button>
                      <button className={(editValues.mode ?? log.mode) === 'out' ? 'on' : ''}
                        onClick={() => setEditValues(v => ({ ...v, mode: 'out' }))}>
                        🛵 Ordered out
                      </button>
                    </div>
                    {(editValues.mode ?? log.mode) === 'out' && (
                      <input type="number" placeholder="₹ cost" style={{ marginBottom: 6, width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)', fontSize: 14 }}
                        value={editValues.cost ?? ''} onChange={e => setEditValues(v => ({ ...v, cost: e.target.value }))} />
                    )}
                    <input placeholder="Note (optional)" style={{ marginBottom: 8, width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)', fontSize: 14 }}
                      value={editValues.notes ?? ''} onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))} />
                    <div className="btn-row">
                      <button className="btn" onClick={() => { setEditingLogId(null); setEditValues({}); }}>Cancel</button>
                      <button className="btn accent" onClick={() => saveEdit(log)}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => { setEditingLogId(log.id); setEditValues({ dish: log.dish, mode: log.mode, cost: log.cost || '', notes: log.notes || '' }); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius)', background: 'var(--bg)', cursor: 'pointer' }}>
                    <span className={'chip ' + (log.mode === 'home' ? 'plain' : 'grain')} style={{ fontSize: 11 }}>
                      {log.mode === 'home' ? '🏠 Home' : '🛵 Order'}
                    </span>
                    <DietDot diet={getDiet(log.dish)} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{log.dish}</span>
                    {log.cost > 0 && <span style={{ fontSize: 13, color: 'var(--muted)' }}>₹{log.cost}</span>}
                    <button onClick={e => { e.stopPropagation(); deleteWithUndo(log); }}
                      className="search-x" title="Delete">✕</button>
                  </div>
                )}
              </div>
            ))}

            {/* Log composer */}
            {expandedMeal === meal ? (
              <div style={{ marginTop: 8, padding: 12, borderRadius: 'var(--radius)', border: '1px dashed var(--line)', background: 'var(--bg)' }}>
                <input autoFocus placeholder="What did you have?" value={composer.dish}
                  onChange={e => setComposer(c => ({ ...c, dish: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)', fontSize: 15, marginBottom: 8 }} />
                <div className="seg" style={{ marginBottom: 8 }}>
                  <button className={composer.mode === 'home' ? 'on' : ''}
                    onClick={() => setComposer(c => ({ ...c, mode: 'home' }))}>
                    🏠 Home cooked
                  </button>
                  <button className={composer.mode === 'out' ? 'on' : ''}
                    onClick={() => setComposer(c => ({ ...c, mode: 'out' }))}>
                    🛵 Ordered out
                  </button>
                </div>
                {composer.mode === 'out' && (
                  <input type="number" placeholder="₹ Amount spent" value={composer.cost}
                    onChange={e => setComposer(c => ({ ...c, cost: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)', fontSize: 14, marginBottom: 8 }} />
                )}
                <input placeholder="Note (optional)" value={composer.note}
                  onChange={e => setComposer(c => ({ ...c, note: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)', fontSize: 14, marginBottom: 10 }} />
                <div className="btn-row">
                  <button className="btn" onClick={() => setExpandedMeal(null)}>Cancel</button>
                  <button className="btn accent" disabled={!composer.dish.trim()} onClick={() => submitComposer(meal)}>
                    Log meal
                  </button>
                </div>
              </div>
            ) : (
              <button className="add-task" onClick={() => toggleComposer(meal)}>
                <span className="plus">+</span> Log a meal
              </button>
            )}
          </div>
        );
      })}

      {/* Summary */}
      {summary && (
        <div className="card" style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 13, color: 'var(--muted)' }}>
          <span>🏠 <strong style={{ color: 'var(--ink)' }}>{summary.cooked}</strong> cooked</span>
          {summary.ordered > 0 && <span>🛵 <strong style={{ color: 'var(--ink)' }}>{summary.ordered}</strong> ordered</span>}
          {summary.spent > 0 && <span>₹ <strong style={{ color: 'var(--ink)' }}>{summary.spent}</strong> spent</span>}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast" style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
          <span>{toast.msg}</span>
          {toast.undoFn && (
            <button onClick={() => { toast.undoFn(); dismissToast(); }}
              style={{ border: 'none', background: 'none', color: 'var(--gold)', cursor: 'pointer', fontWeight: 700, marginLeft: 12 }}>
              Undo
            </button>
          )}
        </div>
      )}
    </main>
  );
}

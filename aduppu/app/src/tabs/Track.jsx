import React, { useState, useMemo, useCallback, useRef } from 'react';
import { localDateStr, dayLabel, addDays } from '../lib/dates.js';
import { CUISINES, expandCuisines, DIET_ALLOWED, newItem } from '../lib/model.js';
import { matchDish, STAPLES, normalize } from '../lib/kitchen.js';
import { pickDish } from '../lib/randomizer.js';

// -- Currency formatter (en-IN) -------------------------------------------

function formatCurrency(amount) {
  return `₹${(amount || 0).toLocaleString('en-IN')}`;
}

// -- Capitalize -----------------------------------------------------------

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

// =========================================================================
// Track component
// =========================================================================

export default function Track({
  items, dishes, plans, logs, groceryItems,
  pantryItem, prefsItem, saveItem, deleteWithUndo,
}) {
  // -- State --------------------------------------------------------------
  const [range, setRange]                   = useState('7days');
  const [selMode, setSelMode]               = useState(false);
  const [selIds, setSelIds]                 = useState(new Set());
  const [addingGrocery, setAddingGrocery]   = useState(false);
  const [groceryDate, setGroceryDate]       = useState(() => localDateStr());
  const [groceryAmount, setGroceryAmount]   = useState('');
  const [groceryNote, setGroceryNote]       = useState('');
  const [editingLogId, setEditingLogId]     = useState(null);
  const [editingGroceryId, setEditingGroceryId] = useState(null);
  const [calendarMonth, setCalendarMonth]     = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [selectedLogDate, setSelectedLogDate] = useState(() => localDateStr());

  // Long-press timer for multi-select
  const longPressTimer = useRef(null);

  // -- Date cutoff --------------------------------------------------------
  const today = localDateStr();
  const cutoffDate = useMemo(() => {
    if (range === '7days')  return addDays(today, -6);
    if (range === '30days') return addDays(today, -29);
    return null;
  }, [range, today]);

  // -- Filtered logs and grocery items ------------------------------------
  const filteredLogs = useMemo(() => {
    const active = logs.filter((l) => !l.deleted);
    return cutoffDate ? active.filter((l) => l.date >= cutoffDate) : active;
  }, [logs, cutoffDate]);

  const filteredGrocery = useMemo(() => {
    const active = groceryItems.filter((g) => !g.deleted);
    return cutoffDate ? active.filter((g) => g.date >= cutoffDate) : active;
  }, [groceryItems, cutoffDate]);

  // -- Stats --------------------------------------------------------------
  const stats = useMemo(() => {
    const homeCooked  = filteredLogs.filter((l) => l.mode === 'home').length;
    const ordered     = filteredLogs.filter((l) => l.mode === 'out').length;
    const orderSpend  = filteredLogs.filter((l) => l.mode === 'out').reduce((s, l) => s + (l.cost || 0), 0);
    const grocerySpend = filteredGrocery.reduce((s, g) => s + (g.amount || 0), 0);
    return { homeCooked, ordered, orderSpend, grocerySpend };
  }, [filteredLogs, filteredGrocery]);

  // -- Summary text -------------------------------------------------------
  const rangeLabel = range === '7days' ? 'this week' : range === '30days' ? 'this month' : 'in total';
  const summaryText = useMemo(() => {
    const c = stats.homeCooked;
    const o = stats.ordered;
    const parts = [];
    parts.push(`You cooked ${c} meal${c !== 1 ? 's' : ''} and ordered ${o} ${rangeLabel}.`);
    parts.push(`Orders ${formatCurrency(stats.orderSpend)}, groceries ${formatCurrency(stats.grocerySpend)}.`);
    return parts.join(' ');
  }, [stats, rangeLabel]);

  // -- Logs grouped by date (descending) ----------------------------------
  const logsByDate = useMemo(() => {
    const groups = {};
    for (const log of filteredLogs) {
      const d = log.date || 'unknown';
      if (!groups[d]) groups[d] = [];
      groups[d].push(log);
    }
    return groups;
  }, [filteredLogs]);

  const sortedLogDates = useMemo(
    () => Object.keys(logsByDate).sort((a, b) => b.localeCompare(a)),
    [logsByDate],
  );

  // -- Grocery sorted by date descending ----------------------------------
  const sortedGrocery = useMemo(
    () => [...filteredGrocery].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [filteredGrocery],
  );

  // -- Handlers -----------------------------------------------------------

  const handleAddGrocery = () => {
    const amount = parseFloat(groceryAmount);
    if (isNaN(amount) || amount <= 0) return;
    saveItem(newItem({
      type: 'grocery',
      date: groceryDate || localDateStr(),
      amount,
      note: groceryNote.trim(),
    }));
    setGroceryAmount('');
    setGroceryNote('');
    setAddingGrocery(false);
  };

  const handleBulkDelete = () => {
    for (const id of selIds) {
      const item = logs.find((l) => l.id === id);
      if (item) deleteWithUndo(item);
    }
    setSelIds(new Set());
    setSelMode(false);
  };

  const handleLongPress = useCallback((logId) => {
    setSelMode(true);
    setSelIds(new Set([logId]));
  }, []);

  const toggleSelection = useCallback((logId) => {
    setSelIds((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
        if (next.size === 0) setSelMode(false);
      } else {
        next.add(logId);
      }
      return next;
    });
  }, []);

  const handleTouchStart = useCallback((logId) => {
    longPressTimer.current = setTimeout(() => {
      handleLongPress(logId);
      longPressTimer.current = null;
    }, 500);
  }, [handleLongPress]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // -- Render -------------------------------------------------------------
  return (
    <div className="screen">

      {/* -- Range toggle -- */}
      <div className="seg">
        {[
          { key: '7days',  label: '7 days' },
          { key: '30days', label: 'This month' },
          { key: 'all',    label: 'All' },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={range === key ? 'on' : undefined}
            onClick={() => setRange(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* -- Summary card -- */}
      <div className="card" style={{ marginTop: 10 }}>
        <p>{summaryText}</p>
      </div>

      {/* -- 2x2 stat tiles -- */}
      <div className="stat-grid">
        <StatTile label="Home Cooked" value={stats.homeCooked} />
        <StatTile label="Ordered" value={stats.ordered} />
        <StatTile label="Order Spend" value={formatCurrency(stats.orderSpend)} />
        <StatTile label="Grocery Spend" value={formatCurrency(stats.grocerySpend)} />
      </div>

      {/* -- Grocery section -- */}
      <div className="section">
        <span className="eyebrow">Groceries</span>

        {addingGrocery ? (
          <div className="card" style={{ marginTop: 10 }}>
            <div className="form-stack">
              <input
                type="date"
                value={groceryDate}
                onChange={(e) => setGroceryDate(e.target.value)}
                className="form-input"
              />
              <input
                type="number"
                inputMode="decimal"
                placeholder="Amount"
                value={groceryAmount}
                onChange={(e) => setGroceryAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddGrocery(); }}
                autoFocus
                className="form-input"
              />
              <input
                type="text"
                placeholder="Note (optional)"
                value={groceryNote}
                onChange={(e) => setGroceryNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddGrocery(); }}
                className="form-input"
              />
            </div>
            <div className="btn-row">
              <div className="spacer" />
              <button className="btn" onClick={() => setAddingGrocery(false)}>Cancel</button>
              <button className="btn accent" onClick={handleAddGrocery}>Add</button>
            </div>
          </div>
        ) : (
          <button
            className="add-task"
            onClick={() => { setAddingGrocery(true); setGroceryDate(localDateStr()); }}
          >
            <span className="plus">+</span>
            Add grocery entry
          </button>
        )}

        {/* Grocery entries list */}
        <div className="list">
          {sortedGrocery.map((g) => (
            <GroceryRow
              key={g.id}
              grocery={g}
              editing={editingGroceryId === g.id}
              onEdit={() => setEditingGroceryId(editingGroceryId === g.id ? null : g.id)}
              saveItem={saveItem}
              deleteWithUndo={deleteWithUndo}
            />
          ))}
        </div>
      </div>

      {/* -- Meal log (calendar view) -- */}
      <div className="section">
        <span className="eyebrow">Meal Log</span>

        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 8 }}>
          <button className="btn ghost" onClick={() => {
            const [y, m] = calendarMonth.split('-').map(Number);
            const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
            setCalendarMonth(prev);
          }}>‹</button>
          <span style={{ flex: 1, textAlign: 'center', fontWeight: 600, fontSize: 15 }}>
            {(() => {
              const [y, m] = calendarMonth.split('-').map(Number);
              return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
            })()}
          </span>
          <button className="btn ghost" onClick={() => {
            const [y, m] = calendarMonth.split('-').map(Number);
            const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
            setCalendarMonth(next);
          }}>›</button>
        </div>

        {/* Calendar grid */}
        <div className="card" style={{ padding: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', padding: '4px 0' }}>{d}</div>
            ))}
            {(() => {
              const [y, m] = calendarMonth.split('-').map(Number);
              const firstDay = new Date(y, m - 1, 1).getDay();
              const daysInMonth = new Date(y, m, 0).getDate();
              const offset = firstDay === 0 ? 6 : firstDay - 1;
              const cells = [];
              for (let i = 0; i < offset; i++) cells.push(<div key={'e' + i} />);
              for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const hasLogs = logs.some(l => l.date === dateStr && !l.deleted);
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedLogDate;
                cells.push(
                  <button key={d} onClick={() => setSelectedLogDate(dateStr)} style={{
                    border: 'none', cursor: 'pointer', padding: '6px 2px', borderRadius: 8, fontSize: 13,
                    fontWeight: isToday ? 700 : 400, position: 'relative',
                    background: isSelected ? 'var(--accent)' : isToday ? 'var(--accent-wash)' : 'transparent',
                    color: isSelected ? 'var(--accent-ink)' : dateStr > today ? 'var(--muted)' : 'var(--ink)',
                  }}>
                    {d}
                    {hasLogs && !isSelected && (
                      <span style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />
                    )}
                  </button>
                );
              }
              return cells;
            })()}
          </div>
        </div>

        {/* Selected day's logs */}
        <div style={{ marginTop: 12 }}>
          <span className="eyebrow">{dayLabel(selectedLogDate)}</span>
          {(() => {
            const dayLogs = logs.filter(l => l.date === selectedLogDate && !l.deleted);
            if (dayLogs.length === 0) return <div className="empty" style={{ padding: '20px 0' }}>No meals logged.</div>;
            return (
              <div className="list">
                {dayLogs.map((log) => (
                  <LogRow
                    key={log.id}
                    log={log}
                    selMode={selMode}
                    selected={selIds.has(log.id)}
                    editing={editingLogId === log.id && !selMode}
                    onTap={() => {
                      if (selMode) toggleSelection(log.id);
                      else setEditingLogId(editingLogId === log.id ? null : log.id);
                    }}
                    onTouchStart={() => handleTouchStart(log.id)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    saveItem={saveItem}
                    deleteWithUndo={deleteWithUndo}
                  />
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Bottom spacer for tab bar */}
      <div style={{ height: 20 }} />

      {/* -- Selection bar -- */}
      {selMode && (
        <div className="selbar">
          <button
            className="btn ghost"
            onClick={() => { setSelMode(false); setSelIds(new Set()); }}
          >
            Cancel
          </button>
          <span className="selcount">{selIds.size} selected</span>
          <button className="btn danger-fill" onClick={handleBulkDelete}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// StatTile
// =========================================================================

function StatTile({ label, value }) {
  return (
    <div className="stat-tile">
      <div className="stat-num disp">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// =========================================================================
// GroceryRow -- grocery entry with inline edit
// =========================================================================

function GroceryRow({ grocery, editing, onEdit, saveItem, deleteWithUndo }) {
  return (
    <div className="card" style={{ cursor: 'pointer' }} onClick={onEdit}>
      {/* Summary row */}
      <div className="task-row">
        <span className="lead" style={{ minWidth: 60, flexShrink: 0 }}>
          {dayLabel(grocery.date)}
        </span>
        <span className="task-main">
          {grocery.note || 'Groceries'}
        </span>
        <strong>{formatCurrency(grocery.amount)}</strong>
      </div>

      {/* Inline edit */}
      {editing && (
        <div className="task-detail" onClick={(e) => e.stopPropagation()}>
          <div className="form-stack">
            <input
              type="date"
              key={`gd-${grocery.id}-${grocery.updated_at}`}
              defaultValue={grocery.date}
              onBlur={(e) => {
                if (e.target.value && e.target.value !== grocery.date) {
                  saveItem({ ...grocery, date: e.target.value });
                }
              }}
              className="form-input"
            />
            <input
              type="number"
              inputMode="decimal"
              key={`ga-${grocery.id}-${grocery.updated_at}`}
              defaultValue={grocery.amount}
              placeholder="Amount"
              onBlur={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v !== grocery.amount) saveItem({ ...grocery, amount: v });
              }}
              className="form-input"
            />
            <input
              type="text"
              key={`gn-${grocery.id}-${grocery.updated_at}`}
              defaultValue={grocery.note || ''}
              onBlur={(e) => {
                if (e.target.value !== (grocery.note || '')) saveItem({ ...grocery, note: e.target.value });
              }}
              placeholder="Note"
              className="form-input"
            />
          </div>
          <div className="btn-row">
            <div className="spacer" />
            <button
              className="btn ghost"
              style={{ color: 'var(--overdue)' }}
              onClick={() => deleteWithUndo(grocery)}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// LogRow -- meal log entry with inline edit + multi-select
// =========================================================================

function LogRow({
  log, selMode, selected, editing,
  onTap, onTouchStart, onTouchEnd, onTouchMove,
  saveItem, deleteWithUndo,
}) {
  const mealClass = log.meal || 'lunch';
  const modeLabel = log.mode === 'home' ? 'Home' : 'Order';

  return (
    <div
      className={`card${selected ? ' selected' : ''}`}
      onClick={onTap}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Summary row */}
      <div className="task-row">
        {selMode && (
          <button className={`tick${selected ? ' done' : ''}`}>
            {selected ? '✓' : ''}
          </button>
        )}
        <span className={`chip ${mealClass}`}>
          {cap(log.meal || '')}
        </span>
        <span className="chip plain">
          {modeLabel}
        </span>
        <span className="task-main">
          {log.dish || ''}
        </span>
        {(log.cost || 0) > 0 && (
          <span className="lead" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
            {formatCurrency(log.cost)}
          </span>
        )}
      </div>

      {/* Notes preview */}
      {log.notes && !editing && (
        <p className="lead" style={selMode ? { paddingLeft: 34 } : undefined}>
          {log.notes}
        </p>
      )}

      {/* Inline edit (only when not in selection mode) */}
      {editing && (
        <div className="task-detail" onClick={(e) => e.stopPropagation()}>
          <div className="form-stack">
            <input
              type="text"
              key={`ld-${log.id}-${log.updated_at}`}
              defaultValue={log.dish || ''}
              onBlur={(e) => {
                if (e.target.value !== (log.dish || '')) saveItem({ ...log, dish: e.target.value });
              }}
              placeholder="Dish name"
              className="form-input"
            />
            <div className="row" style={{ gap: 8 }}>
              <select
                className="btn small"
                key={`lm-${log.id}-${log.updated_at}`}
                defaultValue={log.meal || 'lunch'}
                onChange={(e) => saveItem({ ...log, meal: e.target.value })}
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </select>
              <select
                className="btn small"
                key={`lmd-${log.id}-${log.updated_at}`}
                defaultValue={log.mode || 'home'}
                onChange={(e) => saveItem({ ...log, mode: e.target.value })}
              >
                <option value="home">Home</option>
                <option value="out">Ordered</option>
              </select>
            </div>
            <input
              type="number"
              inputMode="decimal"
              key={`lc-${log.id}-${log.updated_at}`}
              defaultValue={log.cost || 0}
              onBlur={(e) => {
                const v = parseFloat(e.target.value) || 0;
                if (v !== (log.cost || 0)) saveItem({ ...log, cost: v });
              }}
              placeholder="Cost"
              className="form-input"
            />
            <input
              type="text"
              key={`ln-${log.id}-${log.updated_at}`}
              defaultValue={log.notes || ''}
              onBlur={(e) => {
                if (e.target.value !== (log.notes || '')) saveItem({ ...log, notes: e.target.value });
              }}
              placeholder="Notes"
              className="form-input"
            />
          </div>
          <div className="btn-row">
            <button
              className="btn ghost"
              style={{ color: 'var(--overdue)' }}
              onClick={() => deleteWithUndo(log)}
            >
              Delete
            </button>
            <div className="spacer" />
            <button
              className="btn ghost"
              onClick={onTap}
            >
              Cancel
            </button>
            <button
              className="btn accent"
              onClick={onTap}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

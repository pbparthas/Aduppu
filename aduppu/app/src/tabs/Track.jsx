import React, { useState, useMemo, useCallback, useRef } from 'react';
import { localDateStr, dayLabel, addDays } from '../lib/dates.js';
import { CUISINES, expandCuisines, DIET_ALLOWED, newItem } from '../lib/model.js';
import { matchDish, STAPLES, normalize } from '../lib/kitchen.js';
import { pickDish } from '../lib/randomizer.js';

// ── Currency formatter (en-IN with ₹ prefix) ────────────────────────────────

function formatCurrency(amount) {
  return `₹${(amount || 0).toLocaleString('en-IN')}`;
}

// ── Capitalize ───────────────────────────────────────────────────────────────

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

// ── Shared input style ───────────────────────────────────────────────────────

const INPUT_STYLE = {
  padding: '6px 8px', border: '1px solid var(--border, #ddd)',
  borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif',
  boxSizing: 'border-box', background: 'var(--card-bg, #fff)', color: 'var(--ink, #222)',
};

// ═════════════════════════════════════════════════════════════════════════════
// Track component
// ═════════════════════════════════════════════════════════════════════════════

export default function Track({
  items, dishes, plans, logs, groceryItems,
  pantryItem, prefsItem, saveItem, deleteWithUndo,
}) {
  // ── State ────────────────────────────────────────────────────────────────
  const [range, setRange]                   = useState('7days');  // '7days' | '30days' | 'all'
  const [selMode, setSelMode]               = useState(false);
  const [selIds, setSelIds]                 = useState(new Set());
  const [addingGrocery, setAddingGrocery]   = useState(false);
  const [groceryDate, setGroceryDate]       = useState(() => localDateStr());
  const [groceryAmount, setGroceryAmount]   = useState('');
  const [groceryNote, setGroceryNote]       = useState('');
  const [editingLogId, setEditingLogId]     = useState(null);
  const [editingGroceryId, setEditingGroceryId] = useState(null);

  // Long-press timer for multi-select
  const longPressTimer = useRef(null);

  // ── Date cutoff for the selected range ───────────────────────────────────
  const today = localDateStr();
  const cutoffDate = useMemo(() => {
    if (range === '7days')  return addDays(today, -6);
    if (range === '30days') return addDays(today, -29);
    return null;
  }, [range, today]);

  // ── Filtered logs and grocery items ──────────────────────────────────────
  const filteredLogs = useMemo(() => {
    const active = logs.filter((l) => !l.deleted);
    return cutoffDate ? active.filter((l) => l.date >= cutoffDate) : active;
  }, [logs, cutoffDate]);

  const filteredGrocery = useMemo(() => {
    const active = groceryItems.filter((g) => !g.deleted);
    return cutoffDate ? active.filter((g) => g.date >= cutoffDate) : active;
  }, [groceryItems, cutoffDate]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const homeCooked  = filteredLogs.filter((l) => l.mode === 'home').length;
    const ordered     = filteredLogs.filter((l) => l.mode === 'out').length;
    const orderSpend  = filteredLogs.filter((l) => l.mode === 'out').reduce((s, l) => s + (l.cost || 0), 0);
    const grocerySpend = filteredGrocery.reduce((s, g) => s + (g.amount || 0), 0);
    return { homeCooked, ordered, orderSpend, grocerySpend };
  }, [filteredLogs, filteredGrocery]);

  // ── Summary text ─────────────────────────────────────────────────────────
  const rangeLabel = range === '7days' ? 'this week' : range === '30days' ? 'this month' : 'in total';
  const summaryText = useMemo(() => {
    const c = stats.homeCooked;
    const o = stats.ordered;
    const parts = [];
    parts.push(`You cooked ${c} meal${c !== 1 ? 's' : ''} and ordered ${o} ${rangeLabel}.`);
    parts.push(`Orders ${formatCurrency(stats.orderSpend)}, groceries ${formatCurrency(stats.grocerySpend)}.`);
    return parts.join(' ');
  }, [stats, rangeLabel]);

  // ── Logs grouped by date (descending) ────────────────────────────────────
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

  // ── Grocery sorted by date descending ────────────────────────────────────
  const sortedGrocery = useMemo(
    () => [...filteredGrocery].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [filteredGrocery],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="tab-content track-tab">

      {/* ── Range toggle ── */}
      <div className="seg-group" style={{ display: 'flex', gap: '4px', padding: '12px 16px 8px' }}>
        {[
          { key: '7days',  label: '7 days' },
          { key: '30days', label: 'This month' },
          { key: 'all',    label: 'All' },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`seg${range === key ? ' active' : ''}`}
            onClick={() => setRange(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Summary card ── */}
      <div className="card" style={{ margin: '0 16px 12px', padding: '16px' }}>
        <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: 1.5 }}>
          {summaryText}
        </p>
      </div>

      {/* ── 2x2 stat tiles ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '0 16px 12px' }}>
        <StatTile label="Home Cooked" value={stats.homeCooked} />
        <StatTile label="Ordered" value={stats.ordered} />
        <StatTile label="Order Spend" value={formatCurrency(stats.orderSpend)} />
        <StatTile label="Grocery Spend" value={formatCurrency(stats.grocerySpend)} />
      </div>

      {/* ── Grocery section ── */}
      <div style={{ padding: '0 16px 12px' }}>
        <div className="eyebrow">Groceries</div>

        {/* Add composer */}
        {addingGrocery ? (
          <div className="card" style={{ padding: '12px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="date"
                value={groceryDate}
                onChange={(e) => setGroceryDate(e.target.value)}
                style={{ ...INPUT_STYLE, flex: '0 0 auto' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <span style={{ fontSize: '0.875rem' }}>{'₹'}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Amount"
                  value={groceryAmount}
                  onChange={(e) => setGroceryAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddGrocery(); }}
                  autoFocus
                  style={{ ...INPUT_STYLE, width: '80px' }}
                />
              </div>
              <input
                type="text"
                placeholder="Note (optional)"
                value={groceryNote}
                onChange={(e) => setGroceryNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddGrocery(); }}
                style={{ ...INPUT_STYLE, flex: 1, minWidth: '100px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setAddingGrocery(false)} style={{ opacity: 0.6 }}>
                Cancel
              </button>
              <button className="btn" onClick={handleAddGrocery}>Add</button>
            </div>
          </div>
        ) : (
          <button
            className="btn"
            onClick={() => { setAddingGrocery(true); setGroceryDate(localDateStr()); }}
            style={{ width: '100%', textAlign: 'center', marginBottom: '8px' }}
          >
            + Add grocery entry
          </button>
        )}

        {/* Grocery entries list */}
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

      {/* ── Meal log ── */}
      <div style={{ padding: '0 16px 12px' }}>
        <div className="eyebrow">Meal Log</div>

        {sortedLogDates.map((date) => (
          <div key={date} style={{ marginBottom: '12px' }}>
            <div style={{
              fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted, #666)',
              marginBottom: '4px', paddingLeft: '2px',
            }}>
              {dayLabel(date)}
            </div>
            {logsByDate[date].map((log) => (
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
        ))}

        {filteredLogs.length === 0 && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted, #888)' }}>
            No meals logged {rangeLabel}.
          </div>
        )}
      </div>

      {/* ── Selection bar ── */}
      {selMode && (
        <div
          className="selbar"
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: 'var(--selbar-bg, #333)', color: '#fff',
            padding: '12px 16px env(safe-area-inset-bottom, 0)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            zIndex: 100,
          }}
        >
          <span style={{ fontSize: '0.875rem' }}>{selIds.size} selected</span>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => { setSelMode(false); setSelIds(new Set()); }}
              style={{
                color: '#fff', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: '0.875rem',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              style={{
                color: '#ef5350', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// StatTile — big-number stat card
// ═════════════════════════════════════════════════════════════════════════════

function StatTile({ label, value }) {
  return (
    <div className="stat-tile card" style={{ padding: '12px', textAlign: 'center' }}>
      <div style={{
        fontFamily: '"Saira Condensed", sans-serif',
        fontSize: '1.75rem', fontWeight: 600, lineHeight: 1.1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--muted, #666)', marginTop: '4px' }}>
        {label}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GroceryRow — grocery entry with inline edit
// ═════════════════════════════════════════════════════════════════════════════

function GroceryRow({ grocery, editing, onEdit, saveItem, deleteWithUndo }) {
  return (
    <div className="card" style={{ padding: '10px 12px', marginBottom: '4px' }}>
      {/* Summary row */}
      <div
        onClick={onEdit}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
      >
        <span style={{ fontSize: '0.8rem', color: 'var(--muted, #666)', minWidth: '60px' }}>
          {dayLabel(grocery.date)}
        </span>
        <span style={{ flex: 1, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {grocery.note || 'Groceries'}
        </span>
        <span style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
          {formatCurrency(grocery.amount)}
        </span>
      </div>

      {/* Inline edit */}
      {editing && (
        <div
          style={{ marginTop: '8px', borderTop: '1px solid var(--border, #eee)', paddingTop: '8px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="date"
              key={`gd-${grocery.id}-${grocery.updated_at}`}
              defaultValue={grocery.date}
              onBlur={(e) => {
                if (e.target.value && e.target.value !== grocery.date) {
                  saveItem({ ...grocery, date: e.target.value });
                }
              }}
              style={INPUT_STYLE}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <span style={{ fontSize: '0.8rem' }}>{'₹'}</span>
              <input
                type="number"
                inputMode="decimal"
                key={`ga-${grocery.id}-${grocery.updated_at}`}
                defaultValue={grocery.amount}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v !== grocery.amount) saveItem({ ...grocery, amount: v });
                }}
                style={{ ...INPUT_STYLE, width: '80px' }}
              />
            </div>
            <input
              type="text"
              key={`gn-${grocery.id}-${grocery.updated_at}`}
              defaultValue={grocery.note || ''}
              onBlur={(e) => {
                if (e.target.value !== (grocery.note || '')) saveItem({ ...grocery, note: e.target.value });
              }}
              placeholder="Note"
              style={{ ...INPUT_STYLE, flex: 1, minWidth: '100px' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              onClick={() => deleteWithUndo(grocery)}
              style={{
                color: '#c62828', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: '0.8rem',
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LogRow — meal log entry with inline edit + multi-select
// ═════════════════════════════════════════════════════════════════════════════

function LogRow({
  log, selMode, selected, editing,
  onTap, onTouchStart, onTouchEnd, onTouchMove,
  saveItem, deleteWithUndo,
}) {
  const modeIcon = log.mode === 'home' ? '🏠' : '🛵';

  return (
    <div
      className={`card${selected ? ' selected' : ''}`}
      style={{
        padding: '8px 12px', marginBottom: '4px', cursor: 'pointer',
        ...(selected ? { background: 'var(--sel-bg, #e3f2fd)' } : {}),
      }}
      onClick={onTap}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Summary row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {selMode && (
          <input
            type="checkbox"
            checked={selected}
            readOnly
            style={{ marginRight: '2px', flexShrink: 0 }}
          />
        )}
        <span className="chip" style={{ fontSize: '0.7rem', flexShrink: 0 }}>
          {cap(log.meal || '')}
        </span>
        <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{modeIcon}</span>
        <span style={{
          flex: 1, fontSize: '0.875rem', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {log.dish || ''}
        </span>
        {(log.cost || 0) > 0 && (
          <span style={{ fontSize: '0.8rem', color: 'var(--muted, #666)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {formatCurrency(log.cost)}
          </span>
        )}
      </div>

      {/* Notes preview */}
      {log.notes && !editing && (
        <div style={{
          fontSize: '0.75rem', color: 'var(--muted, #888)', marginTop: '2px',
          paddingLeft: selMode ? '24px' : '0',
        }}>
          {log.notes}
        </div>
      )}

      {/* Inline edit (only when not in selection mode) */}
      {editing && (
        <div
          style={{ marginTop: '8px', borderTop: '1px solid var(--border, #eee)', paddingTop: '8px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              key={`ld-${log.id}-${log.updated_at}`}
              defaultValue={log.dish || ''}
              onBlur={(e) => {
                if (e.target.value !== (log.dish || '')) saveItem({ ...log, dish: e.target.value });
              }}
              placeholder="Dish name"
              style={{ ...INPUT_STYLE, flex: 1, minWidth: '120px' }}
            />
            <select
              key={`lm-${log.id}-${log.updated_at}`}
              defaultValue={log.meal || 'lunch'}
              onChange={(e) => saveItem({ ...log, meal: e.target.value })}
              style={INPUT_STYLE}
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </select>
            <select
              key={`lmd-${log.id}-${log.updated_at}`}
              defaultValue={log.mode || 'home'}
              onChange={(e) => saveItem({ ...log, mode: e.target.value })}
              style={INPUT_STYLE}
            >
              <option value="home">{'🏠'} Home</option>
              <option value="out">{'🛵'} Ordered</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem' }}>{'₹'}</span>
            <input
              type="number"
              inputMode="decimal"
              key={`lc-${log.id}-${log.updated_at}`}
              defaultValue={log.cost || 0}
              onBlur={(e) => {
                const v = parseFloat(e.target.value) || 0;
                if (v !== (log.cost || 0)) saveItem({ ...log, cost: v });
              }}
              style={{ ...INPUT_STYLE, width: '70px' }}
            />
            <input
              type="text"
              key={`ln-${log.id}-${log.updated_at}`}
              defaultValue={log.notes || ''}
              onBlur={(e) => {
                if (e.target.value !== (log.notes || '')) saveItem({ ...log, notes: e.target.value });
              }}
              placeholder="Notes"
              style={{ ...INPUT_STYLE, flex: 1, minWidth: '100px' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              onClick={() => deleteWithUndo(log)}
              style={{
                color: '#c62828', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: '0.8rem',
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

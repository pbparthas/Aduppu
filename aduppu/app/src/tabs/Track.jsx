import React, { useState, useMemo, useCallback, useRef } from 'react';
import { localDateStr, addDays, dayLabel } from '../lib/dates.js';
import { newItem } from '../lib/merge.js';
import SegRow from '../components/SegRow.jsx';
import Chip from '../components/Chip.jsx';
import Sheet from '../components/Sheet.jsx';
import Composer from '../components/Composer.jsx';
import EmptyState from '../components/EmptyState.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount) {
  return '₹' + (amount || 0).toLocaleString('en-IN');
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RANGE_ITEMS = [
  { key: '7days',  label: 'Last 7 days' },
  { key: '30days', label: 'Last 30 days' },
  { key: 'all',    label: 'All' },
];

const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch',     label: 'Lunch' },
  { value: 'dinner',    label: 'Dinner' },
];

const MODE_OPTIONS = [
  { value: 'home', label: 'Home cooked' },
  { value: 'out',  label: 'Ordered' },
];

const GROCERY_EDIT_FIELDS = [
  { key: 'amount', label: 'Amount',  type: 'number', placeholder: 'Amount in rupees' },
  { key: 'note',   label: 'Note',    type: 'text',   placeholder: 'What was it for?' },
  { key: 'date',   label: 'Date',    type: 'date' },
];

// =========================================================================
// Track
// =========================================================================

export default function Track({
  items, dishes, plans, logs, groceryItems,
  pantryItem, prefsItem, saveItem, deleteWithUndo, showToast,
}) {
  // -- State ---------------------------------------------------------------

  const [range, setRange]         = useState('7days');
  const [selMode, setSelMode]     = useState(false);
  const [selIds, setSelIds]       = useState(new Set());

  // Grocery add
  const [addingGrocery, setAddingGrocery]     = useState(false);
  const [groceryAmount, setGroceryAmount]     = useState('');
  const [groceryNote, setGroceryNote]         = useState('');
  const [groceryDate, setGroceryDate]         = useState(() => localDateStr());
  const [showGroceryDate, setShowGroceryDate] = useState(false);

  // Edit sheets
  const [editingLog, setEditingLog]               = useState(null);
  const [editLogValues, setEditLogValues]         = useState({});
  const [editingGrocery, setEditingGrocery]       = useState(null);
  const [editGroceryValues, setEditGroceryValues] = useState({});

  // Optional date filter for the log list
  const [pickedDate, setPickedDate]       = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Long-press timer for multi-select
  const longPressTimer = useRef(null);

  // -- Date cutoff ---------------------------------------------------------

  const today = localDateStr();

  const cutoffDate = useMemo(() => {
    if (range === '7days')  return addDays(today, -6);
    if (range === '30days') return addDays(today, -29);
    return null;
  }, [range, today]);

  // -- Filtered data -------------------------------------------------------

  // Range-filtered logs (used for stats — not affected by picked date)
  const rangeFilteredLogs = useMemo(() => {
    const active = logs.filter(l => !l.deleted);
    return cutoffDate ? active.filter(l => l.date >= cutoffDate) : active;
  }, [logs, cutoffDate]);

  const filteredGrocery = useMemo(() => {
    const active = groceryItems.filter(g => !g.deleted);
    return cutoffDate ? active.filter(g => g.date >= cutoffDate) : active;
  }, [groceryItems, cutoffDate]);

  // Log list: range + optional picked-date filter
  const filteredLogs = useMemo(() => {
    if (pickedDate) return rangeFilteredLogs.filter(l => l.date === pickedDate);
    return rangeFilteredLogs;
  }, [rangeFilteredLogs, pickedDate]);

  // -- Stats ---------------------------------------------------------------

  const stats = useMemo(() => {
    const homeCooked  = rangeFilteredLogs.filter(l => l.mode === 'home').length;
    const ordered     = rangeFilteredLogs.filter(l => l.mode === 'out').length;
    const orderSpend  = rangeFilteredLogs
      .filter(l => l.mode === 'out')
      .reduce((s, l) => s + (l.cost || 0), 0);
    const grocerySpend = filteredGrocery.reduce((s, g) => s + (g.amount || 0), 0);
    return { homeCooked, ordered, orderSpend, grocerySpend };
  }, [rangeFilteredLogs, filteredGrocery]);

  // -- Summary text --------------------------------------------------------

  const rangeLabel = range === '7days'  ? 'in the last 7 days'
                   : range === '30days' ? 'in the last 30 days'
                   : 'in total';

  const summaryText = useMemo(() => {
    const c = stats.homeCooked;
    const o = stats.ordered;
    return `You cooked ${c} meal${c !== 1 ? 's' : ''} and ordered ${o} ${rangeLabel}. `
      + `Orders ${formatCurrency(stats.orderSpend)}, groceries ${formatCurrency(stats.grocerySpend)}.`;
  }, [stats, rangeLabel]);

  // -- Logs grouped by date (descending) -----------------------------------

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

  // -- Grocery sorted by date descending -----------------------------------

  const sortedGrocery = useMemo(
    () => [...filteredGrocery].sort((a, b) =>
      (b.date || '').localeCompare(a.date || '')),
    [filteredGrocery],
  );

  // -- Grocery add validation ----------------------------------------------

  const isGroceryValid = useMemo(() => {
    const amount = parseFloat(groceryAmount);
    return !isNaN(amount) && amount > 0;
  }, [groceryAmount]);

  // -- Handlers: range -----------------------------------------------------

  const handleRangeChange = useCallback((newRange) => {
    setRange(newRange);
    setPickedDate(null);
    setShowDatePicker(false);
  }, []);

  // -- Handlers: grocery add -----------------------------------------------

  const startGroceryAdd = useCallback(() => {
    setAddingGrocery(true);
    setGroceryDate(localDateStr());
    setGroceryAmount('');
    setGroceryNote('');
    setShowGroceryDate(false);
  }, []);

  const cancelGroceryAdd = useCallback(() => {
    setAddingGrocery(false);
    setShowGroceryDate(false);
  }, []);

  const handleAddGrocery = useCallback(() => {
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
    setGroceryDate(localDateStr());
    setShowGroceryDate(false);
    setAddingGrocery(false);
    if (showToast) showToast('Grocery entry added');
  }, [groceryAmount, groceryDate, groceryNote, saveItem, showToast]);

  // -- Handlers: grocery edit (Sheet + Composer) ---------------------------

  const openGroceryEdit = useCallback((grocery) => {
    setEditingGrocery(grocery);
    setEditGroceryValues({
      amount: grocery.amount || 0,
      note:   grocery.note || '',
      date:   grocery.date || localDateStr(),
    });
  }, []);

  const closeGroceryEdit = useCallback(() => {
    setEditingGrocery(null);
    setEditGroceryValues({});
  }, []);

  const saveGroceryEdit = useCallback(() => {
    if (!editingGrocery) return;
    saveItem({
      ...editingGrocery,
      amount: Number(editGroceryValues.amount) || 0,
      note:   editGroceryValues.note,
      date:   editGroceryValues.date,
    });
    closeGroceryEdit();
  }, [editingGrocery, editGroceryValues, saveItem, closeGroceryEdit]);

  const deleteGroceryItem = useCallback(() => {
    if (!editingGrocery) return;
    deleteWithUndo(editingGrocery);
    closeGroceryEdit();
  }, [editingGrocery, deleteWithUndo, closeGroceryEdit]);

  // -- Handlers: log edit (Sheet + Composer) -------------------------------

  const openLogEdit = useCallback((log) => {
    if (selMode) return;
    setEditingLog(log);
    setEditLogValues({
      dish:  log.dish || '',
      meal:  log.meal || 'lunch',
      mode:  log.mode || 'home',
      cost:  log.cost || 0,
      notes: log.notes || '',
    });
  }, [selMode]);

  const closeLogEdit = useCallback(() => {
    setEditingLog(null);
    setEditLogValues({});
  }, []);

  const saveLogEdit = useCallback(() => {
    if (!editingLog) return;
    saveItem({
      ...editingLog,
      dish:  editLogValues.dish,
      meal:  editLogValues.meal,
      mode:  editLogValues.mode,
      cost:  editLogValues.mode === 'out' ? (Number(editLogValues.cost) || 0) : 0,
      notes: editLogValues.notes,
    });
    closeLogEdit();
  }, [editingLog, editLogValues, saveItem, closeLogEdit]);

  const deleteLogItem = useCallback(() => {
    if (!editingLog) return;
    deleteWithUndo(editingLog);
    closeLogEdit();
  }, [editingLog, deleteWithUndo, closeLogEdit]);

  // -- Handlers: multi-select ---------------------------------------------

  const handleLongPress = useCallback((logId) => {
    setSelMode(true);
    setSelIds(new Set([logId]));
  }, []);

  const toggleSelection = useCallback((logId) => {
    setSelIds(prev => {
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

  const cancelSelection = useCallback(() => {
    setSelMode(false);
    setSelIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(() => {
    for (const id of selIds) {
      const item = logs.find(l => l.id === id);
      if (item) deleteWithUndo(item);
    }
    cancelSelection();
  }, [selIds, logs, deleteWithUndo, cancelSelection]);

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

  // -- Log edit fields (dynamic: cost appears only when mode is Ordered) ---

  const logEditFields = useMemo(() => {
    const fields = [
      { key: 'dish', label: 'Dish',  type: 'text',   placeholder: 'Dish name' },
      { key: 'meal', label: 'Meal',  type: 'select', options: MEAL_OPTIONS },
      { key: 'mode', label: 'Mode',  type: 'select', options: MODE_OPTIONS },
    ];
    if (editLogValues.mode === 'out') {
      fields.push({ key: 'cost', label: 'Cost', type: 'number', placeholder: 'Amount' });
    }
    fields.push({ key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Add notes...' });
    return fields;
  }, [editLogValues.mode]);

  // -- Render --------------------------------------------------------------

  return (
    <div>

      {/* -- Range toggle -- */}
      <SegRow items={RANGE_ITEMS} value={range} onChange={handleRangeChange} />

      {/* -- Summary + stat tiles -- */}
      <div className="section">
        <div className="card">
          <p className="lead">{summaryText}</p>
        </div>

        <div className="stat-grid">
          <div className="stat-tile">
            <div className="stat-num">{stats.homeCooked}</div>
            <div className="stat-label">Home Cooked</div>
          </div>
          <div className="stat-tile">
            <div className="stat-num">{stats.ordered}</div>
            <div className="stat-label">Ordered</div>
          </div>
          <div className="stat-tile">
            <div className="stat-num">{formatCurrency(stats.orderSpend)}</div>
            <div className="stat-label">Order Spend</div>
          </div>
          <div className="stat-tile">
            <div className="stat-num">{formatCurrency(stats.grocerySpend)}</div>
            <div className="stat-label">Grocery Spend</div>
          </div>
        </div>
      </div>

      {/* -- Grocery section -- */}
      <div className="section">
        <span className="eyebrow">Groceries</span>

        {addingGrocery ? (
          <div className="list">
            <div className="card">
              <div className="form-stack">
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
                {showGroceryDate ? (
                  <input
                    type="date"
                    value={groceryDate}
                    onChange={(e) => setGroceryDate(e.target.value)}
                    className="form-input"
                  />
                ) : (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setShowGroceryDate(true)}
                  >
                    Change date
                  </button>
                )}
              </div>
              <div className="btn-row">
                <button type="button" className="btn ghost" onClick={cancelGroceryAdd}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn accent"
                  onClick={handleAddGrocery}
                  disabled={!isGroceryValid}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button type="button" className="add-task" onClick={startGroceryAdd}>
            <span className="plus">+</span>
            Add grocery entry
          </button>
        )}

        {sortedGrocery.length > 0 && (
          <div className="list">
            {sortedGrocery.map((g) => (
              <div
                key={g.id}
                className="card"
                role="button"
                tabIndex={0}
                onClick={() => openGroceryEdit(g)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') openGroceryEdit(g);
                }}
              >
                <div className="task-row">
                  <span className="lead">{dayLabel(g.date)}</span>
                  <span className="task-main">{g.note || 'Groceries'}</span>
                  <strong>{formatCurrency(g.amount)}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* -- Meal log section -- */}
      <div className="section">
        <span className="eyebrow">Meal Log</span>

        {/* Pick a date (optional collapsed affordance) */}
        {showDatePicker ? (
          <div className="row">
            <input
              type="date"
              className="form-input"
              value={pickedDate || ''}
              onChange={(e) => setPickedDate(e.target.value || null)}
            />
            <button
              type="button"
              className="btn ghost"
              onClick={() => { setPickedDate(null); setShowDatePicker(false); }}
            >
              Show all
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn ghost"
            onClick={() => setShowDatePicker(true)}
          >
            Pick a date
          </button>
        )}

        {/* Log groups by day */}
        {sortedLogDates.length === 0 ? (
          <EmptyState message="No meals logged." />
        ) : (
          sortedLogDates.map((date) => (
            <div key={date} className="section">
              <span className="eyebrow">{dayLabel(date)}</span>
              <div className="list">
                {logsByDate[date].map((log) => (
                  <div
                    key={log.id}
                    className={`card${selIds.has(log.id) ? ' selected' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (selMode) toggleSelection(log.id);
                      else openLogEdit(log);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        if (selMode) toggleSelection(log.id);
                        else openLogEdit(log);
                      }
                    }}
                    onTouchStart={() => handleTouchStart(log.id)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <div className="task-row">
                      {selMode && (
                        <span className={`tick${selIds.has(log.id) ? ' done' : ''}`}>
                          {selIds.has(log.id) ? '✓' : ''}
                        </span>
                      )}
                      <Chip type={`meal-${log.meal || 'lunch'}`}>
                        {cap(log.meal || '')}
                      </Chip>
                      <Chip
                        type={log.mode === 'out' ? 'mode-out' : 'mode-home'}
                        className="plain"
                      />
                      <span className="task-main">{log.dish || ''}</span>
                      {(log.cost || 0) > 0 && (
                        <span className="lead">{formatCurrency(log.cost)}</span>
                      )}
                    </div>
                    {log.notes && !selMode && (
                      <p className="lead">{log.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* -- Selection bar -- */}
      {selMode && (
        <div className="selbar">
          <button type="button" className="btn ghost" onClick={cancelSelection}>
            Cancel
          </button>
          <span className="selcount">{selIds.size} selected</span>
          <button type="button" className="btn danger-fill" onClick={handleBulkDelete}>
            Delete
          </button>
        </div>
      )}

      {/* -- Log edit Sheet -- */}
      {editingLog && (
        <Sheet title="Edit meal log" onClose={closeLogEdit}>
          <Composer
            fields={logEditFields}
            values={editLogValues}
            onChange={setEditLogValues}
            onSave={saveLogEdit}
            onCancel={closeLogEdit}
            onDelete={deleteLogItem}
          />
        </Sheet>
      )}

      {/* -- Grocery edit Sheet -- */}
      {editingGrocery && (
        <Sheet title="Edit grocery entry" onClose={closeGroceryEdit}>
          <Composer
            fields={GROCERY_EDIT_FIELDS}
            values={editGroceryValues}
            onChange={setEditGroceryValues}
            onSave={saveGroceryEdit}
            onCancel={closeGroceryEdit}
            onDelete={deleteGroceryItem}
          />
        </Sheet>
      )}
    </div>
  );
}

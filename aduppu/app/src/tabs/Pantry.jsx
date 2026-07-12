import React, { useState, useMemo, useCallback } from 'react';
import { localDateStr, dayLabel } from '../lib/dates.js';
import { newItem } from '../lib/merge.js';
import { normalize } from '../lib/kitchen.js';
import Sheet from '../components/Sheet.jsx';
import Composer from '../components/Composer.jsx';
import EmptyState from '../components/EmptyState.jsx';
import IconButton from '../components/IconButton.jsx';
import { AddToPantryIcon } from '../components/Icons.jsx';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function formatCurrency(amount) {
  return '₹' + (amount || 0).toLocaleString('en-IN');
}

// Normalise a raw list of typed fragments into deduped, lowercase entries,
// skipping anything already present (compared by normalize()).
function mergeItems(existing, rawList) {
  const seen = new Set(existing.map(normalize));
  const additions = [];
  for (const raw of rawList) {
    const v = (raw || '').trim().toLowerCase();
    if (!v) continue;
    const n = normalize(v);
    if (seen.has(n)) continue;
    seen.add(n);
    additions.push(v);
  }
  return additions;
}

const PANTRY_SEARCH_THRESHOLD = 20;

/* ── Grocery edit fields (items as a comma-joined text field) ────────────── */

const GROCERY_EDIT_FIELDS = [
  { key: 'amount', label: 'Amount', type: 'number', placeholder: 'Amount in rupees' },
  { key: 'note',   label: 'Note',   type: 'text',   placeholder: 'What was it for?' },
  { key: 'items',  label: 'Items bought', type: 'text', placeholder: 'tomato, onion, rice...' },
  { key: 'date',   label: 'Date',   type: 'date' },
];

/* ═════════════════════════════════════════════════════════════════════════ */
/* ChipInput — comma / Enter separated pill input (pantry + items-bought)     */
/* ═════════════════════════════════════════════════════════════════════════ */

function ChipInput({ items, onAdd, onRemove, placeholder }) {
  const [input, setInput] = useState('');

  const commit = useCallback((raw) => {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) onAdd(parts);
  }, [onAdd]);

  return (
    <div className="pantry-input">
      {items.map((item, idx) => (
        <span key={`${item}-${idx}`} className="ing-pill">
          {item}
          <button
            type="button"
            className="x"
            onClick={() => onRemove(item)}
            aria-label={`Remove ${item}`}
          >
            &#x2715;
          </button>
        </span>
      ))}
      <input
        type="text"
        placeholder={placeholder}
        value={input}
        onChange={(e) => {
          const val = e.target.value;
          if (val.includes(',')) {
            const parts = val.split(',');
            const last = parts.pop();
            commit(parts.join(','));
            setInput(last.trimStart());
          } else {
            setInput(val);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(input);
            setInput('');
          }
        }}
      />
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════ */
/* Pantry                                                                     */
/* ═════════════════════════════════════════════════════════════════════════ */

export default function Pantry({
  groceryItems,
  pantryItem, saveItem, deleteWithUndo, showToast,
}) {
  /* ── Pantry state ──────────────────────────────────────────────────────── */

  const [pantrySearch, setPantrySearch]   = useState('');
  const [showPantryMenu, setShowPantryMenu] = useState(false);

  /* ── Grocery state ─────────────────────────────────────────────────────── */

  const [addingGrocery, setAddingGrocery]     = useState(false);
  const [groceryAmount, setGroceryAmount]     = useState('');
  const [groceryNote, setGroceryNote]         = useState('');
  const [groceryDate, setGroceryDate]         = useState(() => localDateStr());
  const [groceryBought, setGroceryBought]     = useState([]);
  const [showGroceryDate, setShowGroceryDate] = useState(false);

  const [editingGrocery, setEditingGrocery]       = useState(null);
  const [editGroceryValues, setEditGroceryValues] = useState({});

  /* ── Derived: pantry ───────────────────────────────────────────────────── */

  const pantryItems = useMemo(() => pantryItem?.items || [], [pantryItem]);

  const showPantrySearch = pantryItems.length > PANTRY_SEARCH_THRESHOLD;

  const displayedPantry = useMemo(() => {
    if (!showPantrySearch || !pantrySearch.trim()) return pantryItems;
    const q = normalize(pantrySearch);
    return pantryItems.filter((i) => normalize(i).includes(q));
  }, [pantryItems, pantrySearch, showPantrySearch]);

  /* ── Pantry writes (shared singleton — same item Cook reads) ───────────── */

  const savePantry = useCallback((nextItems) => {
    if (pantryItem) {
      saveItem({ ...pantryItem, items: nextItems });
    } else {
      saveItem(newItem({ id: 'pantry', type: 'pantry', items: nextItems }));
    }
  }, [pantryItem, saveItem]);

  const addPantry = useCallback((rawList) => {
    const additions = mergeItems(pantryItems, rawList);
    if (additions.length === 0) return;
    savePantry([...pantryItems, ...additions]);
  }, [pantryItems, savePantry]);

  const removePantry = useCallback((item) => {
    const prev = pantryItems;
    savePantry(pantryItems.filter((i) => i !== item));
    showToast(`Removed ${item}`, () => savePantry(prev));
  }, [pantryItems, savePantry, showToast]);

  const clearPantry = useCallback(() => {
    const prev = pantryItems;
    setShowPantryMenu(false);
    if (prev.length === 0) return;
    savePantry([]);
    showToast('Pantry cleared', () => savePantry(prev));
  }, [pantryItems, savePantry, showToast]);

  // Merge a grocery entry's items into the pantry, undoable as one batch.
  const stockFromGrocery = useCallback((rawItems) => {
    const prev = pantryItems;
    const additions = mergeItems(prev, rawItems || []);
    if (additions.length === 0) {
      showToast('Already in your pantry');
      return;
    }
    savePantry([...prev, ...additions]);
    const n = additions.length;
    showToast(`Stocked ${n} item${n === 1 ? '' : 's'}`, () => savePantry(prev));
  }, [pantryItems, savePantry, showToast]);

  /* ── Derived: groceries grouped by day (newest first) ──────────────────── */

  const activeGrocery = useMemo(
    () => groceryItems.filter((g) => !g.deleted),
    [groceryItems],
  );

  const groceryByDate = useMemo(() => {
    const groups = {};
    for (const g of activeGrocery) {
      const d = g.date || 'unknown';
      if (!groups[d]) groups[d] = [];
      groups[d].push(g);
    }
    return groups;
  }, [activeGrocery]);

  const sortedGroceryDates = useMemo(
    () => Object.keys(groceryByDate).sort((a, b) => b.localeCompare(a)),
    [groceryByDate],
  );

  /* ── Grocery add ───────────────────────────────────────────────────────── */

  const isGroceryValid = useMemo(() => {
    const amount = parseFloat(groceryAmount);
    return !isNaN(amount) && amount > 0;
  }, [groceryAmount]);

  const startGroceryAdd = useCallback(() => {
    setAddingGrocery(true);
    setGroceryAmount('');
    setGroceryNote('');
    setGroceryDate(localDateStr());
    setGroceryBought([]);
    setShowGroceryDate(false);
  }, []);

  const cancelGroceryAdd = useCallback(() => {
    setAddingGrocery(false);
    setShowGroceryDate(false);
  }, []);

  const addBought = useCallback((rawList) => {
    setGroceryBought((prev) => {
      const additions = mergeItems(prev, rawList);
      if (additions.length === 0) return prev;
      return [...prev, ...additions];
    });
  }, []);

  const removeBought = useCallback((item) => {
    setGroceryBought((prev) => prev.filter((i) => i !== item));
  }, []);

  const handleAddGrocery = useCallback(() => {
    const amount = parseFloat(groceryAmount);
    if (isNaN(amount) || amount <= 0) return;
    const boughtItems = groceryBought.slice();
    saveItem(newItem({
      type: 'grocery',
      date: groceryDate || localDateStr(),
      amount,
      note: groceryNote.trim(),
      items: boughtItems,
    }));
    setAddingGrocery(false);
    setShowGroceryDate(false);
    setGroceryAmount('');
    setGroceryNote('');
    setGroceryBought([]);
    setGroceryDate(localDateStr());

    // The tracker loop: offer one-tap "Add to pantry" in the post-save toast
    // (our Toast supports a single action, so the undo slot becomes the stock
    // action). Entries without items just confirm.
    if (boughtItems.length > 0) {
      showToast('Added — tap to stock pantry', () => stockFromGrocery(boughtItems));
    } else {
      showToast('Grocery added');
    }
  }, [groceryAmount, groceryDate, groceryNote, groceryBought, saveItem, showToast, stockFromGrocery]);

  /* ── Grocery edit (Sheet + Composer) ───────────────────────────────────── */

  const openGroceryEdit = useCallback((grocery) => {
    setEditingGrocery(grocery);
    setEditGroceryValues({
      amount: grocery.amount || 0,
      note:   grocery.note || '',
      items:  (grocery.items || []).join(', '),
      date:   grocery.date || localDateStr(),
    });
  }, []);

  const closeGroceryEdit = useCallback(() => {
    setEditingGrocery(null);
    setEditGroceryValues({});
  }, []);

  const saveGroceryEdit = useCallback(() => {
    if (!editingGrocery) return;
    const items = (editGroceryValues.items || '')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    saveItem({
      ...editingGrocery,
      amount: Number(editGroceryValues.amount) || 0,
      note:   editGroceryValues.note,
      items,
      date:   editGroceryValues.date,
    });
    closeGroceryEdit();
  }, [editingGrocery, editGroceryValues, saveItem, closeGroceryEdit]);

  const deleteGroceryItem = useCallback(() => {
    if (!editingGrocery) return;
    deleteWithUndo(editingGrocery);
    closeGroceryEdit();
  }, [editingGrocery, deleteWithUndo, closeGroceryEdit]);

  /* ── Render ────────────────────────────────────────────────────────────── */

  const itemCount = pantryItems.length;

  return (
    <div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — IN THE KITCHEN                                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="pantry-section">
        <div className="pantry-head">
          <span className="eyebrow">
            In the kitchen &middot; {itemCount} item{itemCount === 1 ? '' : 's'}
          </span>
          {itemCount > 0 && (
            <IconButton
              icon="overflow"
              label="More actions"
              onClick={() => setShowPantryMenu((o) => !o)}
              size="sm"
              variant="ghost"
            />
          )}
          {showPantryMenu && (
            <div className="menu">
              <button type="button" className="danger" onClick={clearPantry}>
                Clear all
              </button>
            </div>
          )}
        </div>

        {showPantrySearch && (
          <div className="search">
            <input
              type="text"
              placeholder="Filter pantry..."
              value={pantrySearch}
              onChange={(e) => setPantrySearch(e.target.value)}
            />
            {pantrySearch && (
              <button
                type="button"
                className="search-x"
                onClick={() => setPantrySearch('')}
                aria-label="Clear filter"
              >
                &#x2715;
              </button>
            )}
          </div>
        )}

        <div className="pantry-cloud">
          <ChipInput
            items={displayedPantry}
            onAdd={addPantry}
            onRemove={removePantry}
            placeholder="Add ingredient..."
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — GROCERIES                                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="pantry-section">
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
                <div>
                  <span className="form-label-text">Items bought (optional)</span>
                  <ChipInput
                    items={groceryBought}
                    onAdd={addBought}
                    onRemove={removeBought}
                    placeholder="tomato, onion, rice..."
                  />
                </div>
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

        {sortedGroceryDates.length === 0 ? (
          <EmptyState message="No grocery entries yet." />
        ) : (
          sortedGroceryDates.map((date) => (
            <div key={date} className="section">
              <span className="eyebrow">{dayLabel(date)}</span>
              <div className="list">
                {groceryByDate[date].map((g) => (
                  <GroceryRow
                    key={g.id}
                    grocery={g}
                    onEdit={() => openGroceryEdit(g)}
                    onStock={() => stockFromGrocery(g.items || [])}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Grocery edit Sheet ── */}
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

/* ═════════════════════════════════════════════════════════════════════════ */
/* GroceryRow — one purchase entry; taps to edit, one-tap "Add to pantry".    */
/* ═════════════════════════════════════════════════════════════════════════ */

function GroceryRow({ grocery, onEdit, onStock }) {
  const items = grocery.items || [];
  const preview = items.slice(0, 3).join(', ');
  const moreCount = Math.max(0, items.length - 3);

  return (
    <div
      className="card"
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(); }
      }}
    >
      <div className="grocery-row">
        <span className="grocery-main">{grocery.note || 'Groceries'}</span>
        <strong className="grocery-amount">{formatCurrency(grocery.amount)}</strong>
      </div>
      {items.length > 0 && (
        <div className="grocery-foot">
          <span className="grocery-items-preview">
            {preview}{moreCount > 0 ? ` +${moreCount}` : ''}
          </span>
          <button
            type="button"
            className="add-to-pantry"
            onClick={(e) => { e.stopPropagation(); onStock(); }}
          >
            <AddToPantryIcon size={15} />
            Add to pantry
          </button>
        </div>
      )}
    </div>
  );
}

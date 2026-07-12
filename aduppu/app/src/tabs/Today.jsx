import React, { useState, useMemo, useCallback } from 'react';
import { localDateStr } from '../lib/dates.js';
import { pickDish } from '../lib/randomizer.js';
import { CUISINES } from '../lib/model.js';
import { newItem } from '../lib/merge.js';
import DietDot from '../components/DietDot.jsx';
import Chip from '../components/Chip.jsx';
import IconButton from '../components/IconButton.jsx';
import Sheet from '../components/Sheet.jsx';
import DishName from '../components/DishName.jsx';
import Composer from '../components/Composer.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { SearchIcon } from '../components/Icons.jsx';

/* -- constants ------------------------------------------------ */

const MEALS = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

const MODE_OPTIONS = [
  { value: 'home', label: 'Home cooked' },
  { value: 'out', label: 'Ordered' },
];

/* -- helpers -------------------------------------------------- */

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
  return key.replace(/(^|-)(\w)/g, (_, _sep, ch) => ' ' + ch.toUpperCase()).trim();
}

/* -- LogEntry sub-component ----------------------------------- */
/* Logged meal row. Tap opens edit Sheet. Same component Track will reuse. */

function LogEntry({ log, diet, onTap }) {
  return (
    <button type="button" className="log-entry" onClick={onTap}>
      <Chip type={log.mode === 'home' ? 'mode-home' : 'mode-out'} />
      <DietDot diet={diet} size="sm" />
      <span className="log-entry-name">{log.dish}</span>
      {log.cost > 0 && (
        <span className="log-entry-cost">{'₹'}{log.cost}</span>
      )}
      {log.notes && (
        <span className="log-entry-note">{log.notes}</span>
      )}
    </button>
  );
}

/* -- Today ---------------------------------------------------- */

export default function Today({
  items, dishes, plans, logs, groceryItems,
  pantryItem, prefsItem, saveItem, deleteWithUndo, showToast,
}) {
  /* -- state -------------------------------------------------- */
  const [logSheet, setLogSheet] = useState(null);       // { meal, log? }
  const [logValues, setLogValues] = useState({});
  const [showCuisineAsk, setShowCuisineAsk] = useState(false);
  const [showPicker, setShowPicker] = useState(null);   // { meal }
  const [pickerSearch, setPickerSearch] = useState('');

  /* -- derived data ------------------------------------------- */
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

  const dayCuisine = todayPlan?.cuisine || null;
  const allFavCuisines = prefsItem?.cuisines || [];
  const favCuisines = allFavCuisines.filter(k => !k.includes(':'));

  /* -- plan actions ------------------------------------------- */

  const reroll = useCallback(async (meal) => {
    const name = pickDish(meal, today, {
      dishes, plans, logs,
      cuisines: dayCuisine ? [dayCuisine] : (prefsItem?.cuisines || null),
      diet: prefsItem?.diet || 'all',
    });
    if (!name) return;
    const id = 'plan-' + today;
    const meals = {
      ...(todayPlan?.meals || { breakfast: '', lunch: '', dinner: '' }),
      [meal]: name,
    };
    await saveItem({ ...(todayPlan || {}), id, type: 'plan', date: today, meals });
  }, [today, dishes, plans, logs, todayPlan, dayCuisine, prefsItem, saveItem]);

  const pickFromCatalog = useCallback(async (meal, dishName) => {
    setShowPicker(null);
    setPickerSearch('');
    const id = 'plan-' + today;
    const meals = {
      ...(todayPlan?.meals || { breakfast: '', lunch: '', dinner: '' }),
      [meal]: dishName,
    };
    await saveItem({ ...(todayPlan || {}), id, type: 'plan', date: today, meals });
  }, [today, todayPlan, saveItem]);

  const clearSlot = useCallback(async (meal) => {
    const id = 'plan-' + today;
    const prevMeals = { ...(todayPlan?.meals || { breakfast: '', lunch: '', dinner: '' }) };
    const newMeals = { ...prevMeals, [meal]: '' };
    await saveItem({ ...(todayPlan || {}), id, type: 'plan', date: today, meals: newMeals });
    if (showToast) {
      showToast(`${MEAL_LABELS[meal]} cleared`, async () => {
        await saveItem({ ...(todayPlan || {}), id, type: 'plan', date: today, meals: prevMeals });
      });
    }
  }, [today, todayPlan, saveItem, showToast]);

  const fillDay = useCallback(async (cuisineKey) => {
    setShowCuisineAsk(false);
    const selectedCuisines = cuisineKey === 'mix'
      ? (prefsItem?.cuisines || null)
      : [cuisineKey];
    const meals = { ...(todayPlan?.meals || { breakfast: '', lunch: '', dinner: '' }) };
    const exclude = [];
    for (const meal of MEALS) {
      if (meals[meal]) continue;
      const name = pickDish(meal, today, {
        dishes, plans, logs, exclude,
        cuisines: selectedCuisines,
        diet: prefsItem?.diet || 'all',
      });
      if (name) {
        meals[meal] = name;
        exclude.push(name);
      }
    }
    const id = 'plan-' + today;
    const cuisine = cuisineKey === 'mix' ? '' : cuisineKey;
    await saveItem({ ...(todayPlan || {}), id, type: 'plan', date: today, meals, cuisine });
  }, [today, dishes, plans, logs, todayPlan, prefsItem, saveItem]);

  /* -- log actions -------------------------------------------- */

  const cookedThis = useCallback(async (meal, dishName) => {
    const item = newItem({
      type: 'log', date: today, meal,
      mode: 'home', dish: dishName, cost: 0, notes: '',
    });
    await saveItem(item);
    if (showToast) {
      showToast('Logged!', async () => {
        await saveItem({ ...item, deleted: true, deleted_at: Date.now() });
      });
    }
  }, [today, saveItem, showToast]);

  const openLogSheet = useCallback((meal, log) => {
    if (log) {
      setLogValues({
        dish: log.dish,
        meal: log.meal,
        mode: log.mode,
        cost: log.cost || '',
        notes: log.notes || '',
      });
      setLogSheet({ meal, log });
    } else {
      setLogValues({
        dish: '',
        meal,
        mode: 'home',
        cost: '',
        notes: '',
      });
      setLogSheet({ meal });
    }
  }, []);

  const closeLogSheet = useCallback(() => {
    setLogSheet(null);
    setLogValues({});
  }, []);

  const saveLog = useCallback(async () => {
    const d = (logValues.dish || '').trim();
    if (!d) return;
    const isEdit = !!logSheet?.log;
    const item = isEdit
      ? {
          ...logSheet.log,
          dish: d,
          meal: logValues.meal || logSheet.meal,
          mode: logValues.mode || 'home',
          cost: logValues.mode === 'out' ? (Number(logValues.cost) || 0) : 0,
          notes: (logValues.notes || '').trim(),
        }
      : newItem({
          type: 'log', date: today,
          meal: logValues.meal || logSheet.meal,
          mode: logValues.mode || 'home',
          dish: d,
          cost: logValues.mode === 'out' ? (Number(logValues.cost) || 0) : 0,
          notes: (logValues.notes || '').trim(),
        });
    await saveItem(item);
    closeLogSheet();
    if (showToast) showToast(isEdit ? 'Updated' : 'Meal logged');
  }, [logValues, logSheet, today, saveItem, closeLogSheet, showToast]);

  const deleteLog = useCallback(async () => {
    if (!logSheet?.log) return;
    deleteWithUndo(logSheet.log);
    closeLogSheet();
  }, [logSheet, deleteWithUndo, closeLogSheet]);

  /* -- summary ------------------------------------------------ */

  const summary = useMemo(() => {
    if (todayLogs.length === 0) return null;
    const cooked = todayLogs.filter(l => l.mode === 'home').length;
    const ordered = todayLogs.filter(l => l.mode === 'out').length;
    const spent = todayLogs.reduce((s, l) => s + (l.cost || 0), 0);
    return { cooked, ordered, spent };
  }, [todayLogs]);

  /* -- composer fields ---------------------------------------- */

  const logFields = useMemo(() => {
    const fields = [
      { key: 'dish', label: 'Dish', type: 'text', placeholder: 'What did you have?' },
      { key: 'meal', label: 'Meal', type: 'seg', options: MEAL_OPTIONS },
      { key: 'mode', label: 'Type', type: 'seg', options: MODE_OPTIONS },
    ];
    if (logValues.mode === 'out') {
      fields.push({ key: 'cost', label: 'Cost', type: 'number', placeholder: 'Amount spent' });
    }
    fields.push({ key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Optional notes' });
    return fields;
  }, [logValues.mode]);

  /* -- picker data -------------------------------------------- */

  const pickerDishes = useMemo(() => {
    if (!showPicker) return [];
    const meal = showPicker.meal;
    const search = pickerSearch.toLowerCase().trim();
    return dishes
      .filter(d => d.meal === meal || d.meal === 'any')
      .filter(d => !search || d.name.toLowerCase().includes(search))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [showPicker, pickerSearch, dishes]);

  /* -- render ------------------------------------------------- */

  return (
    <div>
      {/* Header row: date heading + Fill day */}
      <div className="row today-header">
        <div>
          <span className="eyebrow">Today</span>
          <div className="disp today-date">{dateDisplay}</div>
        </div>
        <div className="spacer" />
        <button
          type="button"
          className="btn small"
          onClick={() => setShowCuisineAsk(true)}
        >
          Fill day
        </button>
      </div>

      {/* Meal cards (hero) */}
      <div className="list">
        {MEALS.map(meal => {
          const planned = todayPlan?.meals?.[meal] || '';
          const mealLogs = todayLogs.filter(l => l.meal === meal);
          const diet = getDiet(planned);
          /* A5 fix: show "Cooked this" when THIS planned dish has no matching log */
          const plannedDishLogged = planned && mealLogs.some(l => l.dish === planned);

          return (
            <div key={meal} className="card">
              {/* 1. Chip row */}
              <div className="chip-row">
                <Chip type={`meal-${meal}`}>{MEAL_LABELS[meal]}</Chip>
                {planned && <DietDot diet={diet} size="sm" />}
                {dayCuisine && (
                  <Chip type="cuisine">{cuisineLabel(dayCuisine)}</Chip>
                )}
              </div>

              {/* 2. Dish name on its own line (A13 fix: 2-line clamp) */}
              {planned ? (
                <DishName name={planned} fontSize={15} />
              ) : (
                <span className="dish-name-empty">Nothing planned</span>
              )}

              {/* 3. Action row */}
              <div className="action-row">
                {/* A5/B1 fix: real success-tinted button, not a tiny text link */}
                {planned && !plannedDishLogged && (
                  <button
                    type="button"
                    className="btn success small"
                    onClick={() => cookedThis(meal, planned)}
                  >
                    Cooked this {'✓'}
                  </button>
                )}
                <div className="spacer" />
                <IconButton
                  icon="reroll"
                  label="Reroll"
                  onClick={() => reroll(meal)}
                  size="sm"
                  variant="ghost"
                />
                <IconButton
                  icon="pick"
                  label="Pick from catalog"
                  onClick={() => { setShowPicker({ meal }); setPickerSearch(''); }}
                  size="sm"
                  variant="ghost"
                />
                <IconButton
                  icon="clear"
                  label="Clear slot"
                  onClick={() => clearSlot(meal)}
                  size="sm"
                  variant="ghost"
                />
              </div>

              {/* 4. Logged entries */}
              {mealLogs.map(log => (
                <LogEntry
                  key={log.id}
                  log={log}
                  diet={getDiet(log.dish)}
                  onTap={() => openLogSheet(meal, log)}
                />
              ))}

              {/* 5. "+ Log a meal" trigger */}
              <button
                type="button"
                className="add-task"
                onClick={() => openLogSheet(meal)}
              >
                <span className="plus">+</span> Log a meal
              </button>
            </div>
          );
        })}
      </div>

      {/* Summary strip (A14 fix: natural sentence) */}
      {summary && (
        <div className="summary today-summary">
          <span><strong>{summary.cooked}</strong> cooked</span>
          {summary.ordered > 0 && (
            <span><strong>{summary.ordered}</strong> ordered</span>
          )}
          {summary.spent > 0 && (
            <span>{'₹'}<strong>{summary.spent}</strong> spent</span>
          )}
        </div>
      )}

      {/* Cuisine-ask Sheet (A12 fix: Fill day asks cuisine, like Plan) */}
      {showCuisineAsk && (
        <Sheet title="What are we cooking?" onClose={() => setShowCuisineAsk(false)}>
          <div className="seg wrap">
            <button type="button" className="on" autoFocus onClick={() => fillDay('mix')}>
              Mix
            </button>
            {favCuisines.map(key => (
              <button type="button" key={key} onClick={() => fillDay(key)}>
                {cuisineLabel(key)}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {/* Dish picker Sheet */}
      {showPicker && (
        <Sheet
          title={`Pick a dish — ${MEAL_LABELS[showPicker.meal]}`}
          onClose={() => { setShowPicker(null); setPickerSearch(''); }}
        >
          <div className="search">
            <SearchIcon size={17} />
            <input
              type="text"
              placeholder="Search dishes"
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              autoFocus
            />
            {pickerSearch && (
              <button
                type="button"
                className="search-x"
                onClick={() => setPickerSearch('')}
              >
                {'✕'}
              </button>
            )}
          </div>
          <div className="list">
            {pickerDishes.length === 0 && (
              <EmptyState message="No dishes found" />
            )}
            {pickerDishes.map(d => (
              <button
                key={d.id}
                type="button"
                className="log-entry"
                onClick={() => pickFromCatalog(showPicker.meal, d.name)}
              >
                <DietDot diet={d.diet} size="sm" />
                <span className="log-entry-name">{d.name}</span>
                {d.cuisine && (
                  <Chip type="cuisine">{cuisineLabel(d.cuisine)}</Chip>
                )}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {/* Log/edit Sheet with Composer (one editing model per 14.1.3) */}
      {logSheet && (
        <Sheet
          title={logSheet.log ? 'Edit log' : 'Log a meal'}
          onClose={closeLogSheet}
        >
          <Composer
            fields={logFields}
            values={logValues}
            onChange={setLogValues}
            onSave={saveLog}
            onCancel={closeLogSheet}
            onDelete={logSheet.log ? deleteLog : undefined}
            saveLabel={logSheet.log ? 'Save' : 'Log meal'}
          />
        </Sheet>
      )}
    </div>
  );
}

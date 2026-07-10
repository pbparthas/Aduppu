import React, { useState, useMemo, useCallback } from 'react';
import { localDateStr, addDays, weekDates, dayLabel } from '../lib/dates.js';
import { pickDish } from '../lib/randomizer.js';
import { CUISINES } from '../lib/model.js';
import { newItem } from '../lib/merge.js';
import DietDot from '../components/DietDot.jsx';
import Chip from '../components/Chip.jsx';
import IconButton from '../components/IconButton.jsx';
import Sheet from '../components/Sheet.jsx';
import DishName from '../components/DishName.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { SearchIcon, NextIcon, PrevIcon } from '../components/Icons.jsx';

/* -- constants ------------------------------------------------ */

const MEALS = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const MEAL_INITIALS = { breakfast: 'B', lunch: 'L', dinner: 'D' };
const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DIET_OPTIONS = [
  { value: 'veg', label: 'Veg' },
  { value: 'egg', label: 'Egg' },
  { value: 'nonveg', label: 'Non-veg' },
];

/* -- helpers -------------------------------------------------- */

function getDayAbbr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return DAY_ABBR[new Date(y, m - 1, d).getDay()];
}

function getDayNum(dateStr) {
  return parseInt(dateStr.split('-')[2], 10);
}

function getMonthYear(days) {
  const [y1, m1] = days[0].split('-').map(Number);
  const [y2, m2] = days[6].split('-').map(Number);
  if (m1 === m2) return `${MONTHS[m1 - 1]} ${y1}`;
  return `${MONTHS[m1 - 1]} / ${MONTHS[m2 - 1]} ${y2}`;
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
  return key.replace(/(^|-)(\w)/g, (_, _sep, ch) => ' ' + ch.toUpperCase()).trim();
}

function formatCuisineAskTitle(mode, day) {
  if (mode === 'week') return 'Fill this week';
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dt.getDay()];
  return `Fill ${weekday} ${d} ${MONTHS[m - 1]}`;
}

/* -- main component ------------------------------------------- */

export default function Plan({
  items, dishes, plans, logs, groceryItems,
  pantryItem, prefsItem, saveItem, deleteWithUndo, showToast,
}) {
  const today = localDateStr();

  const [weekAnchor, setWeekAnchor] = useState(today);
  const [selectedDay, setSelectedDay] = useState(today);
  const [showCuisineAsk, setShowCuisineAsk] = useState(null);  // { mode, day? }
  const [showPicker, setShowPicker] = useState(null);           // { day, meal }
  const [pickerSearch, setPickerSearch] = useState('');
  const [showOverflow, setShowOverflow] = useState(false);
  const [showNewDish, setShowNewDish] = useState(null);         // { name, meal }
  const [newDishValues, setNewDishValues] = useState({});

  /* -- derived data ------------------------------------------- */

  const days = useMemo(() => weekDates(weekAnchor), [weekAnchor]);

  const allFavCuisines = prefsItem?.cuisines || [];
  const favCuisines = allFavCuisines.filter(k => !k.includes(':'));

  /* -- lookups ------------------------------------------------ */

  const getPlan = useCallback(
    (day) => plans.find(p => p.date === day),
    [plans],
  );

  const getLogsForMeal = useCallback(
    (day, meal) => logs.filter(l => l.date === day && l.meal === meal),
    [logs],
  );

  const getDiet = useCallback(
    (name) => {
      if (!name) return null;
      return dishes.find(d => d.name === name)?.diet || null;
    },
    [dishes],
  );

  /* -- week navigation ---------------------------------------- */

  const changeWeek = useCallback((delta) => {
    const anchor = addDays(weekAnchor, delta * 7);
    setWeekAnchor(anchor);
    const newDays = weekDates(anchor);
    setSelectedDay(newDays.includes(today) ? today : newDays[0]);
  }, [weekAnchor, today]);

  /* -- plan persistence --------------------------------------- */

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

  /* -- reroll a single slot ----------------------------------- */

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

  /* -- fill day / fill week ----------------------------------- */

  const fillDay = useCallback(async (day, cuisineKey) => {
    const meals = { breakfast: '', lunch: '', dinner: '' };
    const exclude = [];
    const isMix = cuisineKey === 'mix';

    for (const meal of MEALS) {
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

    await savePlan(day, {
      meals,
      cuisine: isMix ? null : cuisineKey,
    });
  }, [dishes, plans, logs, prefsItem, savePlan]);

  const handleCuisineChoice = useCallback(async (cuisineKey) => {
    if (!showCuisineAsk) return;
    const { mode, day } = showCuisineAsk;
    setShowCuisineAsk(null);

    if (mode === 'day') {
      await fillDay(day, cuisineKey);
    } else {
      const todayStr = localDateStr();
      for (const d of days) {
        if (d >= todayStr) await fillDay(d, cuisineKey);
      }
    }
  }, [showCuisineAsk, days, fillDay]);

  /* -- clear with undo (A8 fix) ------------------------------- */

  const clearSlot = useCallback(async (day, meal) => {
    const existing = getPlan(day);
    const prevMeals = { ...(existing?.meals || { breakfast: '', lunch: '', dinner: '' }) };
    const prevName = prevMeals[meal];
    if (!prevName) return;

    const newMeals = { ...prevMeals, [meal]: '' };
    await savePlan(day, { meals: newMeals });

    if (showToast) {
      showToast(`${MEAL_LABELS[meal]} cleared`, async () => {
        await savePlan(day, { meals: prevMeals });
      });
    }
  }, [getPlan, savePlan, showToast]);

  const clearDay = useCallback(async (day) => {
    const existing = getPlan(day);
    const prevMeals = { ...(existing?.meals || { breakfast: '', lunch: '', dinner: '' }) };
    const prevCuisine = existing?.cuisine || null;
    const hasContent = MEALS.some(m => prevMeals[m]);
    if (!hasContent && !prevCuisine) return;

    await savePlan(day, { meals: { breakfast: '', lunch: '', dinner: '' }, cuisine: null });
    setShowOverflow(false);

    if (showToast) {
      showToast('Day cleared', async () => {
        await savePlan(day, { meals: prevMeals, cuisine: prevCuisine });
      });
    }
  }, [getPlan, savePlan, showToast]);

  const clearWeek = useCallback(async () => {
    const todayStr = localDateStr();
    const snapshots = [];
    for (const d of days) {
      if (d >= todayStr) {
        const existing = getPlan(d);
        snapshots.push({
          day: d,
          meals: { ...(existing?.meals || { breakfast: '', lunch: '', dinner: '' }) },
          cuisine: existing?.cuisine || null,
        });
        await savePlan(d, { meals: { breakfast: '', lunch: '', dinner: '' }, cuisine: null });
      }
    }
    setShowOverflow(false);

    if (showToast) {
      showToast('Week cleared', async () => {
        for (const snap of snapshots) {
          await savePlan(snap.day, { meals: snap.meals, cuisine: snap.cuisine });
        }
      });
    }
  }, [days, getPlan, savePlan, showToast]);

  /* -- remove cuisine from a day ------------------------------ */

  const removeCuisine = useCallback(async (day) => {
    await savePlan(day, { cuisine: null });
  }, [savePlan]);

  /* -- dish picker --------------------------------------------- */

  const pickerDishes = useMemo(() => {
    if (!showPicker) return [];
    const { meal } = showPicker;
    let list = dishes.filter(d => d.meal === meal && !d.deleted);

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

  const pickerHasExactMatch = useMemo(() => {
    if (!pickerSearch.trim()) return true;
    const q = pickerSearch.toLowerCase().trim();
    return pickerDishes.some(d => d.name.toLowerCase() === q);
  }, [pickerSearch, pickerDishes]);

  const pickFromCatalog = useCallback(async (meal, dishName) => {
    const day = showPicker?.day || selectedDay;
    await setSlot(day, meal, dishName);
    setShowPicker(null);
    setPickerSearch('');
  }, [showPicker, selectedDay, setSlot]);

  /* -- new dish from picker ----------------------------------- */

  const openNewDishSheet = useCallback(() => {
    if (!showPicker) return;
    const name = pickerSearch.trim();
    const meal = showPicker.meal;
    setShowNewDish({ name, meal });
    setNewDishValues({ name, meal, cuisine: '', diet: 'veg' });
  }, [showPicker, pickerSearch]);

  const saveNewDish = useCallback(async () => {
    const name = (newDishValues.name || '').trim();
    if (!name) return;
    const item = newItem({
      type: 'dish',
      name,
      meal: newDishValues.meal || showNewDish.meal,
      cuisine: newDishValues.cuisine || '',
      diet: newDishValues.diet || 'veg',
      ingredients: [],
      tags: [],
    });
    await saveItem(item);
    const day = showPicker?.day || selectedDay;
    await setSlot(day, showNewDish.meal, name);
    setShowNewDish(null);
    setNewDishValues({});
    setShowPicker(null);
    setPickerSearch('');
  }, [newDishValues, showNewDish, showPicker, selectedDay, saveItem, setSlot]);

  /* -- cuisine pick items ------------------------------------- */

  const cuisineItems = useMemo(() => {
    const result = [{ key: 'mix', label: 'Mix' }];
    for (const k of favCuisines) {
      result.push({ key: k, label: cuisineLabel(k) });
    }
    return result;
  }, [favCuisines]);

  /* -- selected day's plan ------------------------------------ */

  const selPlan = getPlan(selectedDay);

  /* -- render ------------------------------------------------- */

  return (
    <div>

      {/* -- Week navigation row (above pills) -- */}
      <div className="plan-nav">
        <IconButton
          icon="prev"
          label="Previous week"
          onClick={() => changeWeek(-1)}
          size="sm"
          variant="ghost"
        />
        <span className="plan-month">{getMonthYear(days)}</span>
        <IconButton
          icon="next"
          label="Next week"
          onClick={() => changeWeek(1)}
          size="sm"
          variant="ghost"
        />
      </div>

      {/* -- Week strip: 7 equal pills (A3 fix) -- */}
      <div className="plan-week">
        {days.map(day => {
          const isToday = day === today;
          const isSelected = day === selectedDay;
          const isPast = day < today;
          return (
            <button
              key={day}
              type="button"
              className={
                (isSelected ? 'on' : '') +
                (isToday ? ' today' : '')
              }
              onClick={() => setSelectedDay(day)}
              style={isPast && !isSelected ? { opacity: 0.5 } /* dynamic */ : undefined}
            >
              <span>{getDayAbbr(day)}</span>
              <span className="plan-date">{getDayNum(day)}</span>
            </button>
          );
        })}
      </div>

      {/* -- Selected day heading -- */}
      <div className="plan-day-hdr">
        <span className="disp plan-day-label">{dayLabel(selectedDay)}</span>
        {selPlan?.cuisine && (
          <Chip type="cuisine">
            {cuisineLabel(selPlan.cuisine)}
            <button
              type="button"
              className="plan-chip-remove"
              onClick={() => removeCuisine(selectedDay)}
              aria-label="Remove cuisine"
            >
              {'✕'}
            </button>
          </Chip>
        )}
      </div>

      {/* -- Three meal cards -- */}
      <div className="list">
        {MEALS.map(meal => {
          const planned = selPlan?.meals?.[meal] || '';
          const diet = getDiet(planned);
          const mealLogs = getLogsForMeal(selectedDay, meal);
          const plannedDishLogged = planned && mealLogs.some(l => l.dish === planned);

          return (
            <div key={meal} className="card">
              {/* 1. Chip row */}
              <div className="chip-row">
                <Chip type={`meal-${meal}`}>{MEAL_LABELS[meal]}</Chip>
                {planned && <DietDot diet={diet} size="sm" />}
                {selPlan?.cuisine && (
                  <Chip type="cuisine">{cuisineLabel(selPlan.cuisine)}</Chip>
                )}
              </div>

              {/* 2. Dish name on its own line */}
              {planned ? (
                <DishName name={planned} fontSize={15} />
              ) : (
                <span className="dish-name-empty">Nothing planned</span>
              )}

              {/* 3. Log status (A4 fix) */}
              {mealLogs.length > 0 && (
                plannedDishLogged ? (
                  <span className="plan-logged match">Had this</span>
                ) : (
                  <span className="plan-logged">
                    logged: {mealLogs[0].dish}
                  </span>
                )
              )}

              {/* 4. Action row */}
              <div className="action-row">
                <div className="spacer" />
                <IconButton
                  icon="reroll"
                  label="Reroll"
                  onClick={() => rerollSlot(selectedDay, meal)}
                  size="sm"
                  variant="ghost"
                />
                <IconButton
                  icon="pick"
                  label="Pick from catalog"
                  onClick={() => {
                    setShowPicker({ day: selectedDay, meal });
                    setPickerSearch('');
                  }}
                  size="sm"
                  variant="ghost"
                />
                <IconButton
                  icon="clear"
                  label="Clear slot"
                  onClick={() => clearSlot(selectedDay, meal)}
                  size="sm"
                  variant="ghost"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* -- Fill + Clear buttons -- */}
      <div className="plan-fill-clear">
        <div className="btn-row">
          <button
            type="button"
            className="btn accent"
            onClick={() => setShowCuisineAsk({ mode: 'day', day: selectedDay })}
          >
            Fill day
          </button>
          <button
            type="button"
            className="btn accent"
            onClick={() => setShowCuisineAsk({ mode: 'week' })}
          >
            Fill week
          </button>
          <div className="spacer" />
          <IconButton
            icon="overflow"
            label="More actions"
            onClick={() => setShowOverflow(o => !o)}
            size="sm"
            variant="ghost"
          />
        </div>

        {/* Overflow menu for clear actions */}
        {showOverflow && (
          <div className="menu">
            <button type="button" className="danger" onClick={() => clearDay(selectedDay)}>
              Clear day
            </button>
            <button type="button" className="danger" onClick={() => clearWeek()}>
              Clear week
            </button>
          </div>
        )}
      </div>

      {/* -- Week overview -- */}
      <div className="plan-overview">
        <span className="eyebrow">Week overview</span>

        <div className="card">
          {days.map(day => {
            const plan = getPlan(day);
            const isToday = day === today;
            const isPast = day < today;
            return (
              <button
                key={day}
                type="button"
                className={`plan-ov-row${isToday ? ' ov-today' : ''}`}
                onClick={() => setSelectedDay(day)}
                style={isPast ? { opacity: 0.5 } /* dynamic */ : undefined}
              >
                <div className="plan-ov-content">
                  <div className="plan-ov-line1">
                    <span className="plan-ov-day">
                      {getDayAbbr(day)} {getDayNum(day)}
                    </span>
                    {plan?.cuisine && (
                      <Chip type="cuisine">{cuisineLabel(plan.cuisine)}</Chip>
                    )}
                  </div>
                  <div className="plan-ov-meals">
                    {MEALS.map(meal => {
                      const name = plan?.meals?.[meal] || '';
                      return (
                        <span key={meal} className="plan-ov-meal">
                          <span className="plan-ov-initial">{MEAL_INITIALS[meal]}</span>
                          <span className={`plan-ov-name${name ? ' filled' : ''}`}>
                            {name || '--'}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
                <span className="plan-ov-chev">
                  <NextIcon size={14} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* -- Cuisine-ask Sheet (B10 fixes) -- */}
      {showCuisineAsk && (
        <Sheet
          title={formatCuisineAskTitle(showCuisineAsk.mode, showCuisineAsk.day)}
          onClose={() => setShowCuisineAsk(null)}
        >
          <div className="seg wrap">
            {cuisineItems.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleCuisineChoice(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="btn ghost"
              onClick={() => setShowCuisineAsk(null)}
            >
              Cancel
            </button>
          </div>
        </Sheet>
      )}

      {/* -- Catalog picker Sheet (A9 fix) -- */}
      {showPicker && (
        <Sheet
          title={`Pick -- ${MEAL_LABELS[showPicker.meal]}`}
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
                aria-label="Clear search"
              >
                {'✕'}
              </button>
            )}
          </div>
          <div className="sheet-body">
            {pickerDishes.length === 0 && !pickerSearch.trim() && (
              <EmptyState message="No dishes found" />
            )}
            {pickerDishes.map(d => (
              <button
                key={d.id}
                type="button"
                className="plan-picker-row"
                onClick={() => pickFromCatalog(showPicker.meal, d.name)}
              >
                <DietDot diet={d.diet} size="sm" />
                <span className="plan-picker-name">{d.name}</span>
                {d.cuisine && (
                  <Chip type="cuisine">{cuisineLabel(d.cuisine)}</Chip>
                )}
              </button>
            ))}
            {pickerSearch.trim() && !pickerHasExactMatch && (
              <button
                type="button"
                className="plan-use-text"
                onClick={openNewDishSheet}
              >
                Use '{pickerSearch.trim()}'
              </button>
            )}
          </div>
        </Sheet>
      )}

      {/* -- New dish Sheet (from picker "Use '<text>'") -- */}
      {showNewDish && (
        <Sheet
          title="New dish"
          onClose={() => { setShowNewDish(null); setNewDishValues({}); }}
        >
          <div className="form-stack">
            <label className="form-label">
              <span className="form-label-text">Name</span>
              <input
                type="text"
                className="form-input"
                value={newDishValues.name || ''}
                onChange={e => setNewDishValues(v => ({ ...v, name: e.target.value }))}
              />
            </label>
            <label className="form-label">
              <span className="form-label-text">Meal</span>
              <select
                className="form-input"
                value={newDishValues.meal || ''}
                onChange={e => setNewDishValues(v => ({ ...v, meal: e.target.value }))}
              >
                {MEALS.map(m => (
                  <option key={m} value={m}>{MEAL_LABELS[m]}</option>
                ))}
              </select>
            </label>
            <label className="form-label">
              <span className="form-label-text">Cuisine</span>
              <select
                className="form-input"
                value={newDishValues.cuisine || ''}
                onChange={e => setNewDishValues(v => ({ ...v, cuisine: e.target.value }))}
              >
                <option value="">None</option>
                {favCuisines.map(k => (
                  <option key={k} value={k}>{cuisineLabel(k)}</option>
                ))}
              </select>
            </label>
            <label className="form-label">
              <span className="form-label-text">Diet</span>
              <select
                className="form-input"
                value={newDishValues.diet || 'veg'}
                onChange={e => setNewDishValues(v => ({ ...v, diet: e.target.value }))}
              >
                {DIET_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <div className="btn-row">
              <button type="button" className="btn accent" onClick={saveNewDish}>
                Add and assign
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => { setShowNewDish(null); setNewDishValues({}); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

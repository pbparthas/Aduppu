// Repeat-avoiding meal picker (plan section 5.2).
// Diet is a hard filter — never violated by any fallback.

import { expandCuisines, DIET_ALLOWED } from './model.js';

export const NO_REPEAT_DAYS = { breakfast: 2, lunch: 10, dinner: 3 };

// Pick a dish for a given meal and date, avoiding recent repeats.
// Returns a dish name (string), or null if no dish exists for that meal.
//
// Arguments:
//   meal: 'breakfast' | 'lunch' | 'dinner'
//   date: 'YYYY-MM-DD' target date string
//   opts.dishes: array of dish items (the full catalog)
//   opts.plans: array of plan items (each has .date, .meals: { breakfast, lunch, dinner })
//   opts.logs: array of log items (each has .date, .dish, .meal)
//   opts.exclude: names to exclude (e.g. already-filled slots this day)
//   opts.cuisines: array of cuisine keys to filter by, or null for all
//   opts.diet: 'veg' | 'veg-egg' | 'all' — hard filter
export function pickDish(meal, date, { dishes, plans = [], logs = [], exclude = [], cuisines = null, diet = 'all' }) {
  const allowed = DIET_ALLOWED[diet] || DIET_ALLOWED.all;
  const allowedSet = new Set(allowed);

  // Step 0: Diet hard filter — never violated by any fallback
  const dietFiltered = dishes.filter(
    (d) => d.meal === meal && !d.deleted && allowedSet.has(d.diet || 'veg')
  );

  if (dietFiltered.length === 0) return null;

  // Step 1: Cuisine filter (when given)
  const cuisineSet = cuisines ? expandCuisines(cuisines) : null;
  const cuisineFiltered = cuisineSet
    ? dietFiltered.filter((d) => cuisineSet.has(d.cuisine))
    : dietFiltered;

  // Step 2: Build lastUsed[name] from plans + logs
  const lastUsed = {};
  for (const plan of plans) {
    if (!plan.meals || !plan.date || plan.date >= date) continue;
    const dishName = plan.meals[meal];
    if (dishName && (!lastUsed[dishName] || plan.date > lastUsed[dishName])) {
      lastUsed[dishName] = plan.date;
    }
  }
  for (const log of logs) {
    if (!log.dish || !log.date || log.meal !== meal || log.date >= date) continue;
    if (!lastUsed[log.dish] || log.date > lastUsed[log.dish]) {
      lastUsed[log.dish] = log.date;
    }
  }

  // Step 3: Pool = cuisine-filtered minus exclude minus recently used
  const excludeSet = new Set(exclude);
  const noRepeatDays = NO_REPEAT_DAYS[meal] || 3;
  const pool = cuisineFiltered.filter((d) => {
    if (excludeSet.has(d.name)) return false;
    const last = lastUsed[d.name];
    if (!last) return true;
    // Calculate days between last use and target date
    const lastDt = new Date(last + 'T00:00:00');
    const targetDt = new Date(date + 'T00:00:00');
    const daysDiff = Math.round((targetDt - lastDt) / (24 * 60 * 60 * 1000));
    return daysDiff > noRepeatDays;
  });

  // Step 4: If pool non-empty, uniform random pick
  if (pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)].name;
  }

  // Step 5: Relaxation fallbacks (diet is NEVER relaxed)

  // (a) LRU within cuisine filter
  if (cuisineFiltered.length > 0) {
    const eligible = cuisineFiltered.filter((d) => !excludeSet.has(d.name));
    if (eligible.length > 0) {
      // Pick the least-recently-used dish
      eligible.sort((a, b) => {
        const aLast = lastUsed[a.name] || '0000-00-00';
        const bLast = lastUsed[b.name] || '0000-00-00';
        return aLast < bLast ? -1 : aLast > bLast ? 1 : 0;
      });
      return eligible[0].name;
    }
  }

  // (b) Widen: try all diet-filtered dishes (favorites then all)
  const allEligible = dietFiltered.filter((d) => !excludeSet.has(d.name));
  if (allEligible.length > 0) {
    // LRU from the wider pool
    allEligible.sort((a, b) => {
      const aLast = lastUsed[a.name] || '0000-00-00';
      const bLast = lastUsed[b.name] || '0000-00-00';
      return aLast < bLast ? -1 : aLast > bLast ? 1 : 0;
    });
    return allEligible[0].name;
  }

  // Everything is excluded — last resort, pick from full diet-filtered set
  if (dietFiltered.length > 0) {
    return dietFiltered[Math.floor(Math.random() * dietFiltered.length)].name;
  }

  return null;
}

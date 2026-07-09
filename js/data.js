// ─────────────────────────────────────────────
// Aduppu v2 — Data Layer
// All data access goes through this module.
// Wraps localStorage and provides a sync hook for Firebase.
// ─────────────────────────────────────────────

// ── localStorage helpers ──
function lsGet(key, fallback) {
  try {
    var v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Storage full or unavailable — fail silently
  }
}

// ── Storage keys ──
var K = {
  DISHES:       "aduppu_dishes",
  PLAN:         "aduppu_plan",
  TRACK:        "aduppu_track",
  GROCERY:      "aduppu_grocery",
  RECIPES:      "aduppu_recipes",
  DISH_HISTORY: "aduppu_dish_history"
};

// ── Default dishes (South Indian vegetarian + egg, NO meat/chicken/fish) ──
var DEFAULTS = {
  breakfast: [
    { id: 1, name: "Idli",       ingredients: ["rice", "urad dal", "salt"] },
    { id: 2, name: "Dosa",       ingredients: ["rice", "urad dal", "oil", "salt"] },
    { id: 3, name: "Pongal",     ingredients: ["rice", "moong dal", "ghee", "pepper", "cumin", "ginger"] },
    { id: 4, name: "Upma",       ingredients: ["rava", "onion", "green chilli", "mustard", "curry leaves", "oil"] },
    { id: 5, name: "Idiyappam",  ingredients: ["rice flour", "salt", "oil"] },
    { id: 6, name: "Poori",      ingredients: ["wheat flour", "oil", "salt"] },
    { id: 7, name: "Kichadi",    ingredients: ["rava", "curd", "onion", "green chilli", "mustard", "curry leaves"] },
    { id: 8, name: "Adai",       ingredients: ["rice", "chana dal", "urad dal", "red chilli", "curry leaves"] }
  ],
  lunch: [
    { id: 101, name: "Sambar Rice",    ingredients: ["rice", "toor dal", "tomato", "tamarind", "onion", "sambar powder"] },
    { id: 102, name: "Rasam Rice",     ingredients: ["rice", "tomato", "tamarind", "pepper", "cumin", "garlic"] },
    { id: 103, name: "Curd Rice",      ingredients: ["rice", "curd", "mustard", "curry leaves", "green chilli", "ginger"] },
    { id: 104, name: "Lemon Rice",     ingredients: ["rice", "lemon", "turmeric", "peanuts", "mustard", "curry leaves"] },
    { id: 105, name: "Tamarind Rice",  ingredients: ["rice", "tamarind", "peanuts", "mustard", "curry leaves", "sesame"] },
    { id: 106, name: "Kootu",          ingredients: ["vegetables", "coconut", "urad dal", "mustard", "curry leaves"] },
    { id: 107, name: "Kara Kuzhambu",  ingredients: ["tamarind", "onion", "tomato", "coconut", "kuzhambu powder", "oil"] },
    { id: 108, name: "Mor Kuzhambu",   ingredients: ["curd", "coconut", "cumin", "green chilli", "turmeric"] },
    { id: 109, name: "Paruppu Rice",   ingredients: ["rice", "toor dal", "ghee", "pepper", "cumin", "mustard"] }
  ],
  dinner: [
    { id: 201, name: "Chapati with Kurma",  ingredients: ["wheat flour", "vegetables", "coconut milk", "onion", "tomato", "spices"] },
    { id: 202, name: "Idli with Chutney",   ingredients: ["rice", "urad dal", "salt", "coconut", "green chilli"] },
    { id: 203, name: "Dosa with Chutney",   ingredients: ["rice", "urad dal", "coconut", "green chilli"] },
    { id: 204, name: "Ven Pongal",          ingredients: ["rice", "moong dal", "ghee", "pepper", "cumin"] },
    { id: 205, name: "Roti with Dal",        ingredients: ["wheat flour", "toor dal", "tomato", "onion", "spices"] },
    { id: 206, name: "Upma",                ingredients: ["rava", "onion", "green chilli", "mustard", "curry leaves", "oil"] },
    { id: 207, name: "Pesarattu",           ingredients: ["green moong dal", "green chilli", "ginger", "onion", "oil"] },
    { id: 208, name: "Parotta with Salna",  ingredients: ["wheat flour", "oil", "onion", "tomato", "spices", "coconut milk"] }
  ]
};

// ── Constants ──
var DAYS   = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
var MEALS  = ["breakfast", "lunch", "dinner"];
var ME     = { breakfast: "\u{1F305}", lunch: "☀️", dinner: "\u{1F319}" };
var MLABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
var MPILL  = { breakfast: "pb", lunch: "pl", dinner: "pd" };

// ── Global mutable state ──
var dishes      = lsGet(K.DISHES, DEFAULTS);
var plan        = lsGet(K.PLAN, {});
var trackLog    = lsGet(K.TRACK, []);
var grocery     = lsGet(K.GROCERY, []);
var recipes     = lsGet(K.RECIPES, []);
var dishHistory = lsGet(K.DISH_HISTORY, { breakfast: {}, lunch: {}, dinner: {} });

// ── Date utilities ──
function today() {
  return new Date().toISOString().split("T")[0];
}

function todayName() {
  var d = new Date();
  // getDay(): 0=Sunday, 1=Monday ... 6=Saturday
  // We want: 0->6 (Sunday), 1->0 (Monday), ..., 6->5 (Saturday)
  return DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
}

// ── Firebase sync hook ──
// firebase.js will populate window.firebaseSync with a save() method.
// data.js checks if it exists before syncing.
window.firebaseSync = window.firebaseSync || null;

function syncToCloud() {
  if (window.firebaseSync && typeof window.firebaseSync.save === "function") {
    window.firebaseSync.save({
      dishes:      dishes,
      plan:        plan,
      trackLog:    trackLog,
      grocery:     grocery,
      recipes:     recipes,
      dishHistory: dishHistory
    });
  }
}

// ── Save functions ──
function saveAll() {
  lsSet(K.DISHES, dishes);
  lsSet(K.PLAN, plan);
  lsSet(K.TRACK, trackLog);
  lsSet(K.GROCERY, grocery);
  lsSet(K.RECIPES, recipes);
  lsSet(K.DISH_HISTORY, dishHistory);
  syncToCloud();
}

function saveDishes() {
  lsSet(K.DISHES, dishes);
  syncToCloud();
}

function savePlan() {
  lsSet(K.PLAN, plan);
  syncToCloud();
}

function saveTrack() {
  lsSet(K.TRACK, trackLog);
  syncToCloud();
}

function saveGrocery() {
  lsSet(K.GROCERY, grocery);
  syncToCloud();
}

function saveRecipes() {
  lsSet(K.RECIPES, recipes);
  syncToCloud();
}

function saveDishHistory() {
  lsSet(K.DISH_HISTORY, dishHistory);
  syncToCloud();
}

// ── Smart randomizer with repeat avoidance ──
// Repeat-avoidance windows (in days):
//   breakfast: 2 days
//   lunch:     10 days
//   dinner:    3 days
var REPEAT_WINDOW = { breakfast: 2, lunch: 10, dinner: 3 };

function _daysBetween(dateStrA, dateStrB) {
  // Returns number of days between two "YYYY-MM-DD" strings
  var a = new Date(dateStrA);
  var b = new Date(dateStrB);
  return Math.floor(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}

function smartRandomMeal(meal, excludeDishes) {
  excludeDishes = excludeDishes || [];

  var pool = dishes[meal];
  if (!pool || !pool.length) return null;

  var window_ = REPEAT_WINDOW[meal] || 2;
  var history = dishHistory[meal] || {};
  var todayStr = today();

  // Build a set of excluded dish names for fast lookup
  var excludeSet = {};
  for (var i = 0; i < excludeDishes.length; i++) {
    excludeSet[excludeDishes[i]] = true;
  }

  // Filter pool: exclude recently used AND explicitly excluded dishes
  var filtered = pool.filter(function (dish) {
    if (excludeSet[dish.name]) return false;
    var lastUsed = history[dish.name];
    if (!lastUsed) return true; // never used — eligible
    return _daysBetween(lastUsed, todayStr) >= window_;
  });

  var picked;

  if (filtered.length > 0) {
    // Pick randomly from eligible dishes
    picked = filtered[Math.floor(Math.random() * filtered.length)];
  } else {
    // Pool exhausted — relax constraint: pick least-recently-used
    // Also exclude the explicitly excluded dishes
    var relaxed = pool.filter(function (dish) {
      return !excludeSet[dish.name];
    });

    if (relaxed.length === 0) {
      // Even after relaxing, nothing available (all dishes are excluded)
      // Fall back to full pool
      relaxed = pool;
    }

    relaxed.sort(function (a, b) {
      var aDate = history[a.name] || "1970-01-01";
      var bDate = history[b.name] || "1970-01-01";
      return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
    });

    picked = relaxed[0];
  }

  // Record usage
  if (!dishHistory[meal]) dishHistory[meal] = {};
  dishHistory[meal][picked.name] = todayStr;
  saveDishHistory();

  return picked;
}

// ── Record dish usage ──
function recordDishUsage(meal, dishName) {
  if (!dishHistory[meal]) dishHistory[meal] = {};
  dishHistory[meal][dishName] = today();
  saveDishHistory();
}

// ── Ingredient matching ──
function tokenize(s) {
  return s.toLowerCase().trim().split(/\s+/);
}

function ingMatches(req, availList) {
  var rt = tokenize(req);
  return availList.some(function (a) {
    var at = tokenize(a);
    return rt.some(function (r) {
      return at.some(function (t) {
        return t.includes(r) || r.includes(t);
      });
    });
  });
}

function scoreMatch(dish, avail) {
  if (!avail.length) return { type: "unknown", score: 0, missing: [] };
  var matched = dish.ingredients.filter(function (r) { return ingMatches(r, avail); });
  var missing = dish.ingredients.filter(function (r) { return !ingMatches(r, avail); });
  var score = matched.length / dish.ingredients.length;
  return {
    type: score === 1 ? "full" : score >= 0.5 ? "partial" : "low",
    score: score,
    missing: missing
  };
}

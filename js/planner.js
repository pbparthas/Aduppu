// ─────────────────────────────────────────────
// Aduppu v2 — Planner Tab
// Weekly meal planning with grid and day views.
// Depends on: data.js (dishes, plan, trackLog, DAYS, MEALS, ME, MLABEL,
//   MPILL, today, todayName, savePlan, smartRandomMeal, escapeHtml)
// Depends on: app.js (toast, escapeHtml, showConfirm, switchTab)
// ─────────────────────────────────────────────

// ── State ──
var planView = "grid";
var selDay   = (typeof todayName === "function") ? todayName() : "Monday";

// ─────────────────────────────────────────────
// Day-index helpers
// ─────────────────────────────────────────────
function getDayIndex(dayName) {
  for (var i = 0; i < DAYS.length; i++) {
    if (DAYS[i] === dayName) return i;
  }
  return -1;
}

function isPastDay(dayName) {
  return getDayIndex(dayName) < getDayIndex(todayName());
}

// ─────────────────────────────────────────────
// Dish lookup helper
// ─────────────────────────────────────────────
function findDishByName(meal, name) {
  if (!name || !dishes[meal]) return null;
  for (var i = 0; i < dishes[meal].length; i++) {
    if (dishes[meal][i].name === name) return dishes[meal][i];
  }
  return null;
}

// ─────────────────────────────────────────────
// renderPlan — main planner renderer
// ─────────────────────────────────────────────
function renderPlan() {
  var tn       = todayName();
  var todayStr = today();
  var todayLogs = trackLog.filter(function(t) { return t.date === todayStr; });

  // ════════════════════════════════════════════
  // Grid view
  // ════════════════════════════════════════════
  var gridEl = document.getElementById("plan-grid");
  if (gridEl) {
    gridEl.innerHTML = DAYS.map(function(day) {
      var isToday = (day === tn);
      var past    = isPastDay(day);

      var classes = "day-card";
      if (isToday) classes += " today-highlight";
      if (past)    classes += " past-day";

      var dayStyle = past ? ' style="opacity:0.55;"' : '';

      return '<div class="' + classes + '"' + dayStyle + '>' +
        '<div class="day-hdr">' +
          '<span class="day-name">' + day.slice(0, 3) + (isToday ? ' &bull;' : '') + '</span>' +
          '<button class="btn-tiny" onclick="randDay(\'' + day + '\')">🎲</button>' +
        '</div>' +
        MEALS.map(function(meal) {
          var dishName  = (plan[day] && plan[day][meal]) ? plan[day][meal] : '';
          var hasActual = isToday && todayLogs.some(function(t) { return t.meal === meal; });

          return '<div class="meal-slot">' +
            '<div class="meal-lbl-tiny">' + ME[meal] + ' ' + meal.slice(0, 5) + '</div>' +
            '<div class="meal-val-row">' +
              '<span class="meal-val">' +
                (dishName
                  ? escapeHtml(dishName)
                  : '<span style="color:#ddd">&mdash;</span>') +
                (hasActual
                  ? '<span class="meal-actual-dot" title="Logged"></span>'
                  : '') +
              '</span>' +
              '<button class="btn-tiny" onclick="randMeal(\'' + day + '\',\'' + meal + '\')">↻</button>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    }).join('');
  }

  // ════════════════════════════════════════════
  // Day pills
  // ════════════════════════════════════════════
  var pillsEl = document.getElementById("day-pills");
  if (pillsEl) {
    pillsEl.innerHTML = DAYS.map(function(d) {
      return '<button class="btn-outline' + (d === selDay ? ' active' : '') + '" ' +
        'onclick="selectDay(\'' + d + '\')">' + d.slice(0, 3) + '</button>';
    }).join('');
  }

  // ════════════════════════════════════════════
  // Day view — 3 large meal cards
  // ════════════════════════════════════════════
  var dayMealsEl = document.getElementById("day-meals");
  if (!dayMealsEl) return;

  var selDayLogs = (selDay === tn)
    ? trackLog.filter(function(t) { return t.date === todayStr; })
    : [];

  dayMealsEl.innerHTML = MEALS.map(function(meal) {
    var dishName = (plan[selDay] && plan[selDay][meal]) ? plan[selDay][meal] : '';
    var dish     = findDishByName(meal, dishName);
    var logged   = selDayLogs.filter(function(t) { return t.meal === meal; });

    // Ingredient preview (first 3)
    var ingHTML = '';
    if (dish && dish.ingredients && dish.ingredients.length) {
      var preview = dish.ingredients.slice(0, 3).join(', ');
      if (dish.ingredients.length > 3) {
        preview += ' +' + (dish.ingredients.length - 3) + ' more';
      }
      ingHTML = '<div style="font-size:11px;color:#a07050;margin-bottom:6px;">' + preview + '</div>';
    }

    // Logged status
    var loggedHTML = '';
    if (logged.length) {
      loggedHTML = '<div class="meal-box-actual">✓ Had: ' +
        logged.map(function(e) { return escapeHtml(e.dish); }).join(', ') +
      '</div>';
    }

    return '<div class="meal-box">' +
      '<span class="pill ' + MPILL[meal] + '">' + ME[meal] + ' ' + MLABEL[meal] + '</span>' +
      '<div class="meal-box-dish">' +
        (dishName
          ? escapeHtml(dishName)
          : '<span style="color:#ccc;font-style:italic;font-size:13px">Not set</span>') +
      '</div>' +
      ingHTML +
      loggedHTML +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
        '<button class="btn" onclick="randMeal(\'' + selDay + '\',\'' + meal + '\')">🎲 Randomize</button>' +
        '<button class="btn-outline" onclick="openRecipePicker(\'' + selDay + '\',\'' + meal + '\')">📋 Pick from Recipes</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ─────────────────────────────────────────────
// View switching
// ─────────────────────────────────────────────
function setPlanView(v) {
  planView = v;
  var gridBtn = document.getElementById("vbtn-grid");
  var dayBtn  = document.getElementById("vbtn-day");
  if (gridBtn) gridBtn.classList.toggle("active", v === "grid");
  if (dayBtn)  dayBtn.classList.toggle("active", v === "day");

  var gridView = document.getElementById("plan-grid-view");
  var dayView  = document.getElementById("plan-day-view");
  if (gridView) gridView.style.display = (v === "grid") ? "block" : "none";
  if (dayView)  dayView.style.display  = (v === "day")  ? "block" : "none";

  renderPlan();
}

function selectDay(dayName) {
  selDay = dayName;
  renderPlan();
}

// ─────────────────────────────────────────────
// randMeal — smart-randomize a single meal slot
// ─────────────────────────────────────────────
function randMeal(day, meal) {
  var picked = smartRandomMeal(meal);
  if (!picked) return;
  if (!plan[day]) plan[day] = {};
  plan[day][meal] = picked.name;
  savePlan();
  renderPlan();
}

// ─────────────────────────────────────────────
// randDay — randomize all 3 meals for one day
//   (avoids picking the same dish twice in a day)
// ─────────────────────────────────────────────
function randDay(day) {
  if (!plan[day]) plan[day] = {};
  var exclude = [];
  MEALS.forEach(function(m) {
    var picked = smartRandomMeal(m, exclude);
    if (picked) {
      plan[day][m] = picked.name;
      exclude.push(picked.name);
    }
  });
  savePlan();
  renderPlan();
}

// ─────────────────────────────────────────────
// randomizeWeek — randomize every day, ensuring
//   no intra-day duplicates via excludeDishes
// ─────────────────────────────────────────────
function randomizeWeek() {
  DAYS.forEach(function(day) {
    if (!plan[day]) plan[day] = {};
    var exclude = [];
    MEALS.forEach(function(m) {
      var picked = smartRandomMeal(m, exclude);
      if (picked) {
        plan[day][m] = picked.name;
        exclude.push(picked.name);
      }
    });
  });
  savePlan();
  renderPlan();
  toast("Week randomized 🎲");
}

// ─────────────────────────────────────────────
// Recipe Picker — modal overlay
// ─────────────────────────────────────────────
function openRecipePicker(day, meal) {
  // Remove any existing picker
  closeRecipePicker();

  // Overlay
  var overlay = document.createElement('div');
  overlay.id = 'recipe-picker-overlay';
  overlay.style.cssText =
    'position:fixed;top:0;left:0;right:0;bottom:0;' +
    'background:rgba(0,0,0,0.45);z-index:200;' +
    'display:flex;align-items:center;justify-content:center;padding:20px;';

  // Click outside to close
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeRecipePicker();
  });

  // Modal card
  var modal = document.createElement('div');
  modal.style.cssText =
    'background:#fff;border-radius:14px;max-width:500px;width:100%;' +
    'max-height:80vh;overflow-y:auto;padding:20px;' +
    'box-shadow:0 8px 30px rgba(0,0,0,0.18);';

  modal.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
      '<h2 style="margin:0;">📋 Pick ' + MLABEL[meal] + '</h2>' +
      '<button class="btn-del" onclick="closeRecipePicker()">✕</button>' +
    '</div>' +
    '<div class="form-group">' +
      '<input type="text" id="rp-search" placeholder="Search dishes..." ' +
        'oninput="filterRecipePicker(\'' + day + '\',\'' + meal + '\')" ' +
        'style="margin-bottom:10px;"/>' +
    '</div>' +
    '<div id="rp-list"></div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Render initial list
  renderRecipePickerList(day, meal, '');

  // Focus search
  var searchEl = document.getElementById('rp-search');
  if (searchEl) searchEl.focus();
}

function closeRecipePicker() {
  var overlay = document.getElementById('recipe-picker-overlay');
  if (overlay) overlay.parentNode.removeChild(overlay);
}

function filterRecipePicker(day, meal) {
  var searchEl = document.getElementById('rp-search');
  var query = searchEl ? searchEl.value.trim().toLowerCase() : '';
  renderRecipePickerList(day, meal, query);
}

function renderRecipePickerList(day, meal, query) {
  var listEl = document.getElementById('rp-list');
  if (!listEl) return;

  var pool = dishes[meal] || [];
  var filtered = pool;

  if (query) {
    filtered = pool.filter(function(d) {
      if (d.name.toLowerCase().indexOf(query) !== -1) return true;
      return d.ingredients.some(function(ing) {
        return ing.toLowerCase().indexOf(query) !== -1;
      });
    });
  }

  if (!filtered.length) {
    listEl.innerHTML = '<div class="empty">No dishes found</div>';
    return;
  }

  listEl.innerHTML = filtered.map(function(d) {
    var ingPreview = d.ingredients.slice(0, 4).join(', ');
    if (d.ingredients.length > 4) {
      ingPreview += ' +' + (d.ingredients.length - 4) + ' more';
    }

    return '<div style="padding:10px;border:1px solid #e8d5be;border-radius:8px;' +
        'margin-bottom:8px;cursor:pointer;transition:background .15s;" ' +
      'onclick="pickRecipeById(\'' + day + '\',\'' + meal + '\',' + d.id + ')" ' +
      'onmouseover="this.style.background=\'#fff8f0\'" ' +
      'onmouseout="this.style.background=\'#fff\'">' +
      '<div style="font-weight:600;font-size:14px;">' + escapeHtml(d.name) + '</div>' +
      '<div style="font-size:11px;color:#a07050;margin-top:3px;">' + ingPreview + '</div>' +
    '</div>';
  }).join('');
}

function pickRecipeById(day, meal, dishId) {
  var pool = dishes[meal] || [];
  var dish = null;
  for (var i = 0; i < pool.length; i++) {
    if (pool[i].id === dishId) { dish = pool[i]; break; }
  }
  if (!dish) return;

  if (!plan[day]) plan[day] = {};
  plan[day][meal] = dish.name;
  savePlan();
  closeRecipePicker();
  renderPlan();
  toast('✓ Set ' + MLABEL[meal] + ' to ' + dish.name);
}

// ─────────────────────────────────────────────
// Aduppu v2 — Suggest Tab
// Find dishes based on available ingredients.
// Depends on: data.js (dishes, plan, MEALS, MLABEL, MPILL, ME,
//             DAYS, todayName, scoreMatch, savePlan)
// Depends on: app.js  (toast, escapeHtml)
// ─────────────────────────────────────────────

// ── State ──
var suggestIngredients = [];   // array of ingredient strings (pills)
var suggestResults     = null; // null until first search

// Internal state
var _suggestResultList  = [];  // combined results for index-based reference
var _suggestDebounceTimer = null;
var _suggestPendingIndex = -1; // index into _suggestResultList for day picker

// ─────────────────────────────────────────────
// Main render
// ─────────────────────────────────────────────

/**
 * Entry point for the Suggest tab.
 * Renders the ingredient pill area, input, and results.
 */
function renderSuggest() {
  var container = document.getElementById("tab-suggest");
  if (!container) return;

  var html = "";

  // ── Ingredient input card ──
  html +=
    '<div class="card">' +
      '<h2 style="margin-bottom:12px;">What\'s in your kitchen?</h2>';

  // Ingredient pills
  if (suggestIngredients.length > 0) {
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">';
    for (var i = 0; i < suggestIngredients.length; i++) {
      html +=
        '<span style="display:inline-flex;align-items:center;gap:4px;' +
          'background:#fff3e0;color:#e65100;border:1px solid #f0c090;' +
          'border-radius:16px;padding:4px 10px;font-size:12px;font-weight:600;">' +
          escapeHtml(suggestIngredients[i]) +
          '<button onclick="removeSuggestIngredient(' + i + ')" ' +
            'style="background:none;border:none;color:#c0392b;font-size:13px;' +
            'cursor:pointer;padding:0 0 0 2px;line-height:1;" title="Remove">✕</button>' +
        '</span>';
    }
    html += '</div>';
  }

  // Text input + buttons
  html +=
    '<label class="lbl">Add ingredients (comma separated)</label>' +
    '<div style="display:flex;gap:8px;margin-bottom:8px;">' +
      '<input type="text" id="suggest-input" ' +
        'placeholder="e.g. rice, urad dal, coconut, tomato" ' +
        'onkeydown="if(event.key===\'Enter\'){event.preventDefault();addSuggestIngredient();}" />' +
      '<button class="btn" style="white-space:nowrap;" onclick="addSuggestIngredient()">Add</button>' +
    '</div>';

  // Find button
  html +=
    '<button class="btn" style="width:100%;" onclick="findDishes()">Find Dishes</button>';

  html += '</div>'; // close card

  // ── Results ──
  html += '<div id="suggest-results">';
  if (suggestResults !== null) {
    html += _renderSuggestResults();
  }
  html += '</div>';

  container.innerHTML = html;
}

// ─────────────────────────────────────────────
// Ingredient management
// ─────────────────────────────────────────────

/**
 * Read from the input, split by comma, add each unique
 * ingredient to the pills, then auto-trigger search.
 */
function addSuggestIngredient() {
  var input = document.getElementById("suggest-input");
  if (!input) return;

  var raw = input.value;
  var parts = raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);

  if (parts.length === 0) return;

  for (var i = 0; i < parts.length; i++) {
    var lower = parts[i].toLowerCase();
    // Avoid duplicates
    var isDup = suggestIngredients.some(function (existing) {
      return existing.toLowerCase() === lower;
    });
    if (!isDup) {
      suggestIngredients.push(parts[i]);
    }
  }

  // Re-render to show updated pills
  renderSuggest();

  // Clear input after re-render
  var newInput = document.getElementById("suggest-input");
  if (newInput) {
    newInput.value = "";
    newInput.focus();
  }

  // Auto-trigger search with debounce
  _debouncedFindDishes();
}

/**
 * Remove an ingredient pill by index and auto-trigger search.
 */
function removeSuggestIngredient(index) {
  if (index >= 0 && index < suggestIngredients.length) {
    suggestIngredients.splice(index, 1);
  }

  // Auto-trigger or clear results
  if (suggestIngredients.length > 0) {
    _debouncedFindDishes();
  } else {
    suggestResults = null;
    _suggestResultList = [];
  }

  renderSuggest();
}

// ─────────────────────────────────────────────
// Find dishes
// ─────────────────────────────────────────────

/**
 * Debounced wrapper for findDishes.
 */
function _debouncedFindDishes() {
  if (_suggestDebounceTimer) clearTimeout(_suggestDebounceTimer);
  _suggestDebounceTimer = setTimeout(function () {
    if (suggestIngredients.length > 0) {
      findDishes();
    }
  }, 300);
}

/**
 * Score all dishes against suggestIngredients.
 * Separates into full and partial matches (score >= 0.5),
 * sorts partial by score descending, and renders results.
 */
function findDishes() {
  if (!suggestIngredients.length) {
    toast("Enter at least one ingredient");
    return;
  }

  var fullMatches    = [];
  var partialMatches = [];
  var resultIndex    = 0;

  _suggestResultList = [];

  for (var mi = 0; mi < MEALS.length; mi++) {
    var meal = MEALS[mi];
    var mealDishes = dishes[meal] || [];

    for (var di = 0; di < mealDishes.length; di++) {
      var dish = mealDishes[di];
      var result = scoreMatch(dish, suggestIngredients);

      if (result.type === "full") {
        fullMatches.push({
          index:  resultIndex,
          name:   dish.name,
          meal:   meal,
          score:  result.score,
          pct:    100,
          missing: [],
          ingredients: dish.ingredients
        });
        _suggestResultList[resultIndex] = { name: dish.name, meal: meal };
        resultIndex++;
      } else if (result.type === "partial") {
        partialMatches.push({
          index:  resultIndex,
          name:   dish.name,
          meal:   meal,
          score:  result.score,
          pct:    Math.round(result.score * 100),
          missing: result.missing,
          ingredients: dish.ingredients
        });
        _suggestResultList[resultIndex] = { name: dish.name, meal: meal };
        resultIndex++;
      }
    }
  }

  // Sort partial by score descending
  partialMatches.sort(function (a, b) { return b.score - a.score; });

  suggestResults = {
    full:    fullMatches,
    partial: partialMatches
  };

  // Re-render results area only
  var resultsEl = document.getElementById("suggest-results");
  if (resultsEl) {
    resultsEl.innerHTML = _renderSuggestResults();
  }
}

/**
 * Internal: renders the results HTML from suggestResults.
 */
function _renderSuggestResults() {
  if (!suggestResults) return "";

  var full    = suggestResults.full    || [];
  var partial = suggestResults.partial || [];
  var html    = "";

  // Full matches — "Can cook now"
  if (full.length > 0) {
    html +=
      '<div class="card">' +
        '<h2 style="margin-bottom:12px;">Can cook now ' +
          '<span style="font-size:13px;color:#888;font-weight:400">' + full.length + '</span>' +
        '</h2>' +
        '<div class="dish-grid">';

    for (var fi = 0; fi < full.length; fi++) {
      var f = full[fi];
      var fIngParts = [];
      for (var fii = 0; fii < f.ingredients.length; fii++) {
        fIngParts.push(escapeHtml(f.ingredients[fii]));
      }

      html +=
        '<div class="dish-card-full">' +
          '<div class="dish-name">' + escapeHtml(f.name) + '</div>' +
          '<span class="pill ' + MPILL[f.meal] + '">' + ME[f.meal] + ' ' + MLABEL[f.meal] + '</span>' +
          '<div class="dish-ing">' + fIngParts.join(", ") + '</div>' +
          '<button class="btn-sm" style="margin-top:6px;" ' +
            'onclick="addSuggestToPlanner(' + f.index + ')">📅 Add to Plan</button>' +
        '</div>';
    }

    html += '</div></div>';
  }

  // Partial matches — "Almost there"
  if (partial.length > 0) {
    html +=
      '<div class="card">' +
        '<h2 style="margin-bottom:12px;">Almost there ' +
          '<span style="font-size:13px;color:#888;font-weight:400">' + partial.length + '</span>' +
        '</h2>' +
        '<div class="dish-grid">';

    for (var pi = 0; pi < partial.length; pi++) {
      var p = partial[pi];
      var missingParts = [];
      for (var pmi = 0; pmi < p.missing.length; pmi++) {
        missingParts.push(escapeHtml(p.missing[pmi]));
      }

      html +=
        '<div class="dish-card-partial">' +
          '<div class="dish-name">' + escapeHtml(p.name) +
            ' <span style="font-size:11px;color:#aaa">' + p.pct + '%</span>' +
          '</div>' +
          '<span class="pill ' + MPILL[p.meal] + '">' + ME[p.meal] + ' ' + MLABEL[p.meal] + '</span>' +
          (missingParts.length
            ? '<div class="dish-missing">Need: ' + missingParts.join(", ") + '</div>'
            : '') +
          '<button class="btn-sm" style="margin-top:6px;" ' +
            'onclick="addSuggestToPlanner(' + p.index + ')">📅 Add to Plan</button>' +
        '</div>';
    }

    html += '</div></div>';
  }

  // No matches
  if (full.length === 0 && partial.length === 0) {
    html +=
      '<div class="card">' +
        '<div class="empty">' +
          'No matches found. Try adding more common ingredients like rice, dal, onion, tomato.' +
        '</div>' +
      '</div>';
  }

  return html;
}

// ─────────────────────────────────────────────
// Add to planner
// ─────────────────────────────────────────────

/**
 * Show a mini day picker overlay for assigning a dish
 * to the weekly plan. Accepts either:
 *   - (index) — looks up dish from _suggestResultList
 *   - (dishName, meal) — uses strings directly
 */
function addSuggestToPlanner(dishNameOrIndex, meal) {
  var dishName, dishMeal;

  if (typeof dishNameOrIndex === "number") {
    var r = _suggestResultList[dishNameOrIndex];
    if (!r) return;
    dishName = r.name;
    dishMeal = r.meal;
  } else {
    dishName = dishNameOrIndex;
    dishMeal = meal;
  }

  _suggestPendingIndex = -1; // not needed when we store name/meal below

  // Store pending assignment in closure-free globals
  window._suggestPendingDish = dishName;
  window._suggestPendingMeal = dishMeal;

  // Remove any existing overlay
  _closeSuggestPicker();

  // Build overlay
  var overlay = document.createElement("div");
  overlay.id = "suggest-day-overlay";
  overlay.style.cssText =
    "position:fixed;top:0;left:0;right:0;bottom:0;" +
    "background:rgba(0,0,0,.4);display:flex;align-items:center;" +
    "justify-content:center;z-index:999;";

  var dialog = document.createElement("div");
  dialog.style.cssText =
    "background:#fff;border-radius:14px;padding:20px 24px;" +
    "max-width:340px;width:90%;text-align:center;" +
    "box-shadow:0 8px 32px rgba(0,0,0,.18);";

  // Title
  var title = document.createElement("p");
  title.style.cssText = "font-weight:700;margin-bottom:14px;font-size:14px;color:#2d1a0e;";
  title.textContent = 'Add "' + dishName + '" to...';
  dialog.appendChild(title);

  // Day buttons
  var dayRow = document.createElement("div");
  dayRow.style.cssText =
    "display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:14px;";

  var currentDay = typeof todayName === "function" ? todayName() : "";

  for (var i = 0; i < DAYS.length; i++) {
    (function (day) {
      var btn = document.createElement("button");
      btn.className = "btn-sm";
      btn.textContent = day.slice(0, 3);
      btn.style.cssText = "min-width:42px;font-size:12px;" +
        (day === currentDay ? "border:2px solid var(--pri);background:var(--pri);color:#fff;" : "");
      btn.onclick = function () {
        _pickDayForSuggest(day);
      };
      dayRow.appendChild(btn);
    })(DAYS[i]);
  }
  dialog.appendChild(dayRow);

  // Cancel button
  var cancelBtn = document.createElement("button");
  cancelBtn.className = "btn-outline";
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.cssText = "font-size:12px;";
  cancelBtn.onclick = _closeSuggestPicker;
  dialog.appendChild(cancelBtn);

  overlay.appendChild(dialog);

  // Close on overlay background click
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) _closeSuggestPicker();
  });

  // Close on Escape
  overlay._keyHandler = function (e) {
    if (e.key === "Escape") _closeSuggestPicker();
  };
  document.addEventListener("keydown", overlay._keyHandler);

  document.body.appendChild(overlay);
}

/**
 * Close the day picker overlay.
 */
function _closeSuggestPicker() {
  var existing = document.getElementById("suggest-day-overlay");
  if (existing) {
    if (existing._keyHandler) {
      document.removeEventListener("keydown", existing._keyHandler);
    }
    existing.remove();
  }
  window._suggestPendingDish = null;
  window._suggestPendingMeal = null;
}

/**
 * Finalize: assign the pending dish to the chosen day's meal slot.
 */
function _pickDayForSuggest(day) {
  var dishName = window._suggestPendingDish;
  var dishMeal = window._suggestPendingMeal;
  if (!dishName || !dishMeal) return;

  if (!plan[day]) plan[day] = {};
  plan[day][dishMeal] = dishName;
  savePlan();

  toast('"' + dishName + '" added to ' + day + ' ' + MLABEL[dishMeal]);
  _closeSuggestPicker();
}

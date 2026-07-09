// ─────────────────────────────────────────────
// Aduppu v2 — Recipes & Dishes Tab
// Merged tab with two sub-views (Dishes / Recipes)
// toggled via a view-toggle control.
// Depends on: data.js (dishes, recipes, plan, MEALS, MLABEL, MPILL, ME,
//             DAYS, todayName, saveDishes, saveRecipes, savePlan)
// Depends on: app.js  (toast, escapeHtml, showConfirm, debounce)
// ─────────────────────────────────────────────

// ── State ──
var recipeView     = "dishes";   // "dishes" | "recipes"
var recipeSearch   = "";         // current search query
var editingDishId  = null;       // null or dish id being edited
var editingRecipeId = null;      // null or recipe id being edited

// ─────────────────────────────────────────────
// Tag color mapping
// ─────────────────────────────────────────────

/**
 * Returns { bg, color } for a tag string.
 * Known tags get a fixed color; unknown tags get a
 * hash-based consistent color from a warm palette.
 */
function getTagColor(tag) {
  var lower = (tag || "").toLowerCase().trim();

  var known = {
    "quick":    { bg: "#e8f5e9", color: "#2e7d32" },
    "spicy":    { bg: "#fbe9e7", color: "#d84315" },
    "weekend":  { bg: "#e3f2fd", color: "#1565c0" },
    "festival": { bg: "#f3e5f5", color: "#7b1fa2" },
    "one-pot":  { bg: "#e0f2f1", color: "#00695c" }
  };

  if (known[lower]) return known[lower];

  // Hash-based consistent color for unknown tags
  var hash = 0;
  for (var i = 0; i < lower.length; i++) {
    hash = ((hash << 5) - hash) + lower.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit int
  }

  var palette = [
    { bg: "#fff8e1", color: "#f57f17" },
    { bg: "#fce4ec", color: "#c62828" },
    { bg: "#e8eaf6", color: "#283593" },
    { bg: "#e0f7fa", color: "#00838f" },
    { bg: "#f1f8e9", color: "#558b2f" },
    { bg: "#fff3e0", color: "#e65100" }
  ];

  return palette[Math.abs(hash) % palette.length];
}

// ─────────────────────────────────────────────
// Main render
// ─────────────────────────────────────────────

/**
 * Entry point for the merged Recipes & Dishes tab.
 * Renders the view toggle, search bar, and delegates
 * to renderDishesView() or renderRecipesView().
 */
function renderRecipes() {
  var container = document.getElementById("tab-recipes");
  if (!container) return;

  var html = "";

  // View toggle + search
  html +=
    '<div class="card">' +
      '<div class="card-hdr">' +
        '<h2>Recipes &amp; Dishes</h2>' +
        '<div class="view-toggle">' +
          '<button class="' + (recipeView === "dishes" ? "active" : "") +
            '" onclick="setRecipeView(\'dishes\')">Dishes</button>' +
          '<button class="' + (recipeView === "recipes" ? "active" : "") +
            '" onclick="setRecipeView(\'recipes\')">Recipes</button>' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<input type="text" id="recipe-search" placeholder="Search by name, ingredient, tag..." ' +
          'value="' + escapeHtml(recipeSearch) + '" ' +
          'oninput="filterDishes(this.value)" />' +
      '</div>' +
    '</div>';

  // Sub-view
  if (recipeView === "dishes") {
    html += renderDishesView();
  } else {
    html += renderRecipesView();
  }

  container.innerHTML = html;

  // Restore search input focus and cursor if user was typing
  if (recipeSearch) {
    var input = document.getElementById("recipe-search");
    if (input) {
      input.focus();
      input.setSelectionRange(recipeSearch.length, recipeSearch.length);
    }
  }
}

/**
 * Switch between "dishes" and "recipes" sub-views.
 */
function setRecipeView(view) {
  recipeView = view;
  recipeSearch = "";
  editingDishId = null;
  editingRecipeId = null;
  renderRecipes();
}

/**
 * Update recipeSearch and re-render (used by search input
 * and the public filterDishes API).
 */
function filterDishes(query) {
  recipeSearch = query || "";
  renderRecipes();
}

// ─────────────────────────────────────────────
// Dishes sub-view
// ─────────────────────────────────────────────

/**
 * Returns HTML for the Dishes sub-view:
 * Add/Edit form + dishes grouped by meal type.
 */
function renderDishesView() {
  var html = "";

  // ── Add / Edit form ──
  html += '<div class="card" id="dish-form-card">';

  if (editingDishId !== null) {
    // Find the dish being edited
    var editDish = null;
    var editMeal = null;
    for (var mi = 0; mi < MEALS.length; mi++) {
      for (var di = 0; di < dishes[MEALS[mi]].length; di++) {
        if (dishes[MEALS[mi]][di].id === editingDishId) {
          editDish = dishes[MEALS[mi]][di];
          editMeal = MEALS[mi];
          break;
        }
      }
      if (editDish) break;
    }

    if (editDish) {
      html += '<h3>Edit Dish</h3>';
      html +=
        '<div class="form-row">' +
          '<div class="fc">' +
            '<label class="lbl">Dish Name</label>' +
            '<input type="text" id="edit-dish-name" value="' + escapeHtml(editDish.name) + '" />' +
          '</div>' +
          '<div class="fc-auto">' +
            '<label class="lbl">Meal</label>' +
            '<select id="edit-dish-meal">';
      for (var em = 0; em < MEALS.length; em++) {
        html += '<option value="' + MEALS[em] + '"' +
          (MEALS[em] === editMeal ? ' selected' : '') + '>' +
          MLABEL[MEALS[em]] + '</option>';
      }
      html +=
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="lbl">Ingredients (comma separated)</label>' +
          '<input type="text" id="edit-dish-ing" value="' +
            escapeHtml(editDish.ingredients.join(", ")) + '" />' +
        '</div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button class="btn" onclick="updateDish()">Update</button>' +
          '<button class="btn-outline" onclick="cancelEditDish()">Cancel</button>' +
        '</div>';
    } else {
      // Dish not found — clear editing state
      editingDishId = null;
    }
  }

  if (editingDishId === null) {
    html += '<h3>Add Dish</h3>';
    html +=
      '<div class="form-row">' +
        '<div class="fc">' +
          '<label class="lbl">Dish Name</label>' +
          '<input type="text" id="new-dish-name" placeholder="e.g. Kara Kuzhambu" />' +
        '</div>' +
        '<div class="fc-auto">' +
          '<label class="lbl">Meal</label>' +
          '<select id="new-dish-meal">';
    for (var am = 0; am < MEALS.length; am++) {
      html += '<option value="' + MEALS[am] + '">' + MLABEL[MEALS[am]] + '</option>';
    }
    html +=
          '</select>' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="lbl">Ingredients (comma separated)</label>' +
        '<input type="text" id="new-dish-ing" placeholder="e.g. tamarind, onion, coconut" />' +
      '</div>' +
      '<button class="btn" onclick="addDish()">Add Dish</button>';
  }

  html += '</div>'; // close form card

  // ── Dish list grouped by meal type ──
  var query = recipeSearch.toLowerCase().trim();

  for (var mi2 = 0; mi2 < MEALS.length; mi2++) {
    var meal = MEALS[mi2];
    var mealDishes = dishes[meal] || [];

    // Filter by search query
    var filtered = mealDishes;
    if (query) {
      filtered = mealDishes.filter(function (d) {
        if (d.name.toLowerCase().indexOf(query) !== -1) return true;
        return d.ingredients.some(function (ing) {
          return ing.toLowerCase().indexOf(query) !== -1;
        });
      });
    }

    html +=
      '<div class="card">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">' +
          '<span class="pill ' + MPILL[meal] + '">' + ME[meal] + ' ' + MLABEL[meal] + '</span>' +
          '<span style="font-size:13px;color:#aaa;font-weight:400">' + filtered.length + '</span>' +
        '</div>';

    if (filtered.length === 0) {
      html += '<div class="empty">' +
        (query ? 'No dishes match your search' : 'No dishes yet') + '</div>';
    } else {
      html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';

      for (var fi = 0; fi < filtered.length; fi++) {
        var d = filtered[fi];
        var ingSlice = d.ingredients.slice(0, 4);
        var ingPreview = "";
        for (var ii = 0; ii < ingSlice.length; ii++) {
          if (ii > 0) ingPreview += ", ";
          ingPreview += escapeHtml(ingSlice[ii]);
        }
        if (d.ingredients.length > 4) {
          ingPreview += " +" + (d.ingredients.length - 4) + " more";
        }

        html +=
          '<div class="dish-tag">' +
            '<div>' +
              '<div class="dish-tag-name">' + escapeHtml(d.name) + '</div>' +
              '<div class="dish-tag-ing">' + ingPreview + '</div>' +
            '</div>' +
            '<div style="display:flex;gap:4px;flex-shrink:0;">' +
              '<button class="btn-tiny" onclick="startEditDish(\'' + meal + '\',' + d.id + ')" title="Edit">✏️</button>' +
              '<button class="btn-del" onclick="delDish(\'' + meal + '\',' + d.id + ')">✕</button>' +
            '</div>' +
          '</div>';
      }

      html += '</div>'; // close flex container
    }

    html += '</div>'; // close card
  }

  return html;
}

/**
 * Add a new dish from the form inputs.
 */
function addDish() {
  var nameEl = document.getElementById("new-dish-name");
  var mealEl = document.getElementById("new-dish-meal");
  var ingEl  = document.getElementById("new-dish-ing");
  if (!nameEl || !mealEl || !ingEl) return;

  var name = nameEl.value.trim();
  var meal = mealEl.value;
  var ing  = ingEl.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);

  if (!name) { toast("Enter a dish name"); return; }

  dishes[meal].push({ id: Date.now(), name: name, ingredients: ing });
  saveDishes();
  renderRecipes();
  toast('"' + name + '" added to ' + MLABEL[meal]);
}

/**
 * Update the dish currently being edited.
 */
function updateDish() {
  if (editingDishId === null) return;

  var nameEl = document.getElementById("edit-dish-name");
  var mealEl = document.getElementById("edit-dish-meal");
  var ingEl  = document.getElementById("edit-dish-ing");
  if (!nameEl || !mealEl || !ingEl) return;

  var newName = nameEl.value.trim();
  var newMeal = mealEl.value;
  var newIng  = ingEl.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);

  if (!newName) { toast("Enter a dish name"); return; }

  // Find and update (or move between meals)
  var found = false;
  for (var mi = 0; mi < MEALS.length; mi++) {
    var m = MEALS[mi];
    for (var di = 0; di < dishes[m].length; di++) {
      if (dishes[m][di].id === editingDishId) {
        if (m !== newMeal) {
          // Meal changed — remove from old, add to new
          dishes[m].splice(di, 1);
          dishes[newMeal].push({ id: editingDishId, name: newName, ingredients: newIng });
        } else {
          dishes[m][di].name = newName;
          dishes[m][di].ingredients = newIng;
        }
        found = true;
        break;
      }
    }
    if (found) break;
  }

  editingDishId = null;
  saveDishes();
  renderRecipes();
  toast('"' + newName + '" updated');
}

/**
 * Enter edit mode for a dish — populates form and scrolls to it.
 */
function startEditDish(meal, id) {
  editingDishId = id;
  editingRecipeId = null;
  renderRecipes();

  var formCard = document.getElementById("dish-form-card");
  if (formCard) formCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Cancel dish editing — clears form and returns to add mode.
 */
function cancelEditDish() {
  editingDishId = null;
  renderRecipes();
}

/**
 * Delete a dish with confirmation.
 */
function delDish(meal, id) {
  var dish = null;
  for (var i = 0; i < dishes[meal].length; i++) {
    if (dishes[meal][i].id === id) { dish = dishes[meal][i]; break; }
  }
  var name = dish ? dish.name : "this dish";

  var doDelete = function () {
    dishes[meal] = dishes[meal].filter(function (d) { return d.id !== id; });
    saveDishes();
    if (editingDishId === id) editingDishId = null;
    renderRecipes();
    toast('"' + name + '" deleted');
  };

  if (typeof showConfirm === "function") {
    showConfirm('Delete "' + name + '"?', doDelete);
  } else {
    if (confirm('Delete "' + name + '"?')) {
      doDelete();
    }
  }
}

// ─────────────────────────────────────────────
// Recipes sub-view
// ─────────────────────────────────────────────

/**
 * Returns HTML for the Recipes sub-view:
 * Add/Edit form + recipe cards in a responsive grid.
 */
function renderRecipesView() {
  var html = "";

  // ── Add / Edit form ──
  html += '<div class="card" id="recipe-form-card">';

  if (editingRecipeId !== null) {
    var editRecipe = null;
    for (var ri = 0; ri < recipes.length; ri++) {
      if (recipes[ri].id === editingRecipeId) { editRecipe = recipes[ri]; break; }
    }
    if (editRecipe) {
      html += '<h3>Edit Recipe</h3>';
      html += _renderRecipeForm(editRecipe);
      html +=
        '<div style="display:flex;gap:8px;">' +
          '<button class="btn" onclick="updateRecipe()">Update</button>' +
          '<button class="btn-outline" onclick="cancelEditRecipe()">Cancel</button>' +
        '</div>';
    } else {
      editingRecipeId = null;
    }
  }

  if (editingRecipeId === null) {
    html += '<h3>Add Recipe</h3>';
    html += _renderRecipeForm(null);
    html += '<button class="btn" onclick="addRecipe()">Add Recipe</button>';
  }

  html += '</div>'; // close form card

  // ── Recipe cards ──
  var query = recipeSearch.toLowerCase().trim();
  var filtered = recipes;
  if (query) {
    filtered = recipes.filter(function (r) {
      if (r.name.toLowerCase().indexOf(query) !== -1) return true;
      if (r.reference && r.reference.toLowerCase().indexOf(query) !== -1) return true;
      if (r.tags && r.tags.some(function (t) {
        return t.toLowerCase().indexOf(query) !== -1;
      })) return true;
      if (r.ingredients && r.ingredients.some(function (ing) {
        return ing.toLowerCase().indexOf(query) !== -1;
      })) return true;
      return false;
    });
  }

  if (filtered.length === 0) {
    html += '<div class="card"><div class="empty">' +
      (query ? 'No recipes match your search' : 'No recipes yet. Add your first recipe above!') +
      '</div></div>';
  } else {
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">';
    for (var ci = 0; ci < filtered.length; ci++) {
      html += _renderRecipeCard(filtered[ci]);
    }
    html += '</div>';
  }

  return html;
}

/**
 * Internal: returns the form HTML for adding/editing a recipe.
 * If recipe is non-null, pre-fills the fields.
 */
function _renderRecipeForm(recipe) {
  var pfx = recipe ? "edit-recipe" : "new-recipe";
  var html = "";

  // Name + Meal type
  html +=
    '<div class="form-row">' +
      '<div class="fc-wide">' +
        '<label class="lbl">Name</label>' +
        '<input type="text" id="' + pfx + '-name" value="' +
          escapeHtml(recipe ? recipe.name : "") +
          '" placeholder="e.g. Amma\'s Sambar" />' +
      '</div>' +
      '<div class="fc-auto">' +
        '<label class="lbl">Meal Type</label>' +
        '<select id="' + pfx + '-meal">';

  var mealOpts   = ["breakfast", "lunch", "dinner", "any"];
  var mealLabels = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", any: "Any" };
  for (var i = 0; i < mealOpts.length; i++) {
    var sel = recipe && recipe.meal === mealOpts[i] ? " selected" : "";
    html += '<option value="' + mealOpts[i] + '"' + sel + '>' + mealLabels[mealOpts[i]] + '</option>';
  }

  html +=
        '</select>' +
      '</div>' +
    '</div>';

  // Reference
  html +=
    '<div class="form-group">' +
      '<label class="lbl">Reference (source / cookbook / URL)</label>' +
      '<input type="text" id="' + pfx + '-ref" value="' +
        escapeHtml(recipe ? (recipe.reference || "") : "") +
        '" placeholder="e.g. Amma\'s recipe, Hebbar\'s Kitchen" />' +
    '</div>';

  // Tags
  html +=
    '<div class="form-group">' +
      '<label class="lbl">Tags (comma separated)</label>' +
      '<input type="text" id="' + pfx + '-tags" value="' +
        escapeHtml(recipe ? (recipe.tags || []).join(", ") : "") +
        '" placeholder="e.g. quick, spicy, weekend" />' +
    '</div>';

  // Ingredients
  html +=
    '<div class="form-group">' +
      '<label class="lbl">Ingredients (comma separated)</label>' +
      '<input type="text" id="' + pfx + '-ing" value="' +
        escapeHtml(recipe ? (recipe.ingredients || []).join(", ") : "") +
        '" placeholder="e.g. toor dal, tomato, tamarind" />' +
    '</div>';

  // Notes
  html +=
    '<div class="form-group">' +
      '<label class="lbl">Notes / Instructions</label>' +
      '<textarea id="' + pfx + '-notes" placeholder="How to make it, tips, variations...">' +
        escapeHtml(recipe ? (recipe.notes || "") : "") +
      '</textarea>' +
    '</div>';

  return html;
}

/**
 * Internal: returns card HTML for a single recipe.
 */
function _renderRecipeCard(recipe) {
  var mealPill  = MPILL[recipe.meal] || "";
  var mealLabel = MLABEL[recipe.meal] || (recipe.meal === "any" ? "Any" : recipe.meal);
  var mealEmoji = ME[recipe.meal] || "";

  var html = '<div class="card" style="margin-bottom:0;">';

  // Name
  html += '<div style="font-size:16px;font-weight:700;color:#2d1a0e;margin-bottom:4px;">' +
    escapeHtml(recipe.name) + '</div>';

  // Reference
  if (recipe.reference) {
    html += '<div style="font-size:12px;color:#a07050;margin-bottom:6px;">Source: ' +
      escapeHtml(recipe.reference) + '</div>';
  }

  // Meal pill + tag pills
  html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">';
  if (mealPill) {
    html += '<span class="pill ' + mealPill + '">' + mealEmoji + ' ' + escapeHtml(mealLabel) + '</span>';
  } else {
    // "any" meal type — no predefined pill class
    html += '<span class="pill" style="background:#f5f0eb;color:#8c5a30;">' + escapeHtml(mealLabel) + '</span>';
  }

  if (recipe.tags && recipe.tags.length) {
    for (var ti = 0; ti < recipe.tags.length; ti++) {
      var tc = getTagColor(recipe.tags[ti]);
      html += '<span class="pill" style="background:' + tc.bg + ';color:' + tc.color + ';">' +
        escapeHtml(recipe.tags[ti]) + '</span>';
    }
  }
  html += '</div>';

  // Ingredients preview (first 5)
  if (recipe.ingredients && recipe.ingredients.length) {
    var showIng = recipe.ingredients.slice(0, 5);
    var ingParts = [];
    for (var si = 0; si < showIng.length; si++) {
      ingParts.push(escapeHtml(showIng[si]));
    }
    var ingText = ingParts.join(", ");
    if (recipe.ingredients.length > 5) {
      ingText += " +" + (recipe.ingredients.length - 5) + " more";
    }
    html += '<div style="font-size:12px;color:#6b4226;margin-bottom:6px;">' + ingText + '</div>';
  }

  // Notes preview (first 100 chars)
  if (recipe.notes) {
    var preview = recipe.notes.length > 100
      ? recipe.notes.substring(0, 100) + "..."
      : recipe.notes;
    html += '<div style="font-size:11px;color:#a07050;font-style:italic;margin-bottom:8px;">' +
      escapeHtml(preview) + '</div>';
  }

  // Action buttons
  html +=
    '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
      '<button class="btn-sm" onclick="addRecipeToPlanner(' + recipe.id + ')" title="Add to Planner">📅 Plan</button>' +
      '<button class="btn-sm" onclick="addRecipeToDishes(' + recipe.id + ')" title="Add as Dish">📋 Dish</button>' +
      '<button class="btn-tiny" onclick="startEditRecipe(' + recipe.id + ')" title="Edit">✏️</button>' +
      '<button class="btn-del" onclick="delRecipe(' + recipe.id + ')">✕</button>' +
    '</div>';

  // Inline planner picker (hidden by default)
  var defaultDay = typeof todayName === "function" ? todayName() : "Monday";
  var defaultMeal = recipe.meal !== "any" ? recipe.meal : "lunch";

  html +=
    '<div id="recipe-planner-' + recipe.id + '" style="display:none;margin-top:8px;padding:10px;' +
      'background:#f5ece0;border-radius:8px;">' +
      '<div style="font-size:11px;font-weight:700;color:#8c5a30;margin-bottom:6px;' +
        'text-transform:uppercase;letter-spacing:.5px;">Add to planner</div>' +
      '<div class="form-row">' +
        '<div class="fc">' +
          '<label class="lbl">Day</label>' +
          '<select id="recipe-plan-day-' + recipe.id + '">';

  for (var di = 0; di < DAYS.length; di++) {
    html += '<option value="' + DAYS[di] + '"' +
      (DAYS[di] === defaultDay ? ' selected' : '') + '>' + DAYS[di] + '</option>';
  }

  html +=
          '</select>' +
        '</div>' +
        '<div class="fc">' +
          '<label class="lbl">Meal</label>' +
          '<select id="recipe-plan-meal-' + recipe.id + '">';

  for (var pm = 0; pm < MEALS.length; pm++) {
    html += '<option value="' + MEALS[pm] + '"' +
      (MEALS[pm] === defaultMeal ? ' selected' : '') + '>' + MLABEL[MEALS[pm]] + '</option>';
  }

  html +=
          '</select>' +
        '</div>' +
        '<div class="fc-auto" style="display:flex;align-items:flex-end;">' +
          '<button class="btn" onclick="assignRecipeToPlan(' + recipe.id + ')">Assign</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  html += '</div>'; // close card
  return html;
}

/**
 * Add a new recipe from the form inputs.
 */
function addRecipe() {
  var nameEl = document.getElementById("new-recipe-name");
  if (!nameEl) return;

  var name = nameEl.value.trim();
  if (!name) { toast("Enter a recipe name"); return; }

  var mealEl = document.getElementById("new-recipe-meal");
  var refEl  = document.getElementById("new-recipe-ref");
  var tagsEl = document.getElementById("new-recipe-tags");
  var ingEl  = document.getElementById("new-recipe-ing");
  var noteEl = document.getElementById("new-recipe-notes");

  var recipe = {
    id:          Date.now(),
    name:        name,
    reference:   refEl ? refEl.value.trim() : "",
    meal:        mealEl ? mealEl.value : "breakfast",
    tags:        tagsEl ? tagsEl.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : [],
    ingredients: ingEl ? ingEl.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : [],
    notes:       noteEl ? noteEl.value.trim() : ""
  };

  recipes.push(recipe);
  saveRecipes();
  renderRecipes();
  toast('"' + name + '" recipe added');
}

/**
 * Update the recipe currently being edited.
 */
function updateRecipe() {
  if (editingRecipeId === null) return;

  var nameEl = document.getElementById("edit-recipe-name");
  if (!nameEl) return;

  var name = nameEl.value.trim();
  if (!name) { toast("Enter a recipe name"); return; }

  var mealEl = document.getElementById("edit-recipe-meal");
  var refEl  = document.getElementById("edit-recipe-ref");
  var tagsEl = document.getElementById("edit-recipe-tags");
  var ingEl  = document.getElementById("edit-recipe-ing");
  var noteEl = document.getElementById("edit-recipe-notes");

  for (var i = 0; i < recipes.length; i++) {
    if (recipes[i].id === editingRecipeId) {
      recipes[i].name        = name;
      recipes[i].reference   = refEl ? refEl.value.trim() : "";
      recipes[i].meal        = mealEl ? mealEl.value : "breakfast";
      recipes[i].tags        = tagsEl ? tagsEl.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : [];
      recipes[i].ingredients = ingEl ? ingEl.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : [];
      recipes[i].notes       = noteEl ? noteEl.value.trim() : "";
      break;
    }
  }

  editingRecipeId = null;
  saveRecipes();
  renderRecipes();
  toast('"' + name + '" recipe updated');
}

/**
 * Enter edit mode for a recipe — populates form and scrolls to it.
 */
function startEditRecipe(id) {
  editingRecipeId = id;
  editingDishId = null;
  renderRecipes();

  var formCard = document.getElementById("recipe-form-card");
  if (formCard) formCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Cancel recipe editing.
 */
function cancelEditRecipe() {
  editingRecipeId = null;
  renderRecipes();
}

/**
 * Delete a recipe with confirmation.
 */
function delRecipe(id) {
  var recipe = null;
  for (var i = 0; i < recipes.length; i++) {
    if (recipes[i].id === id) { recipe = recipes[i]; break; }
  }
  var name = recipe ? recipe.name : "this recipe";

  var doDelete = function () {
    recipes = recipes.filter(function (r) { return r.id !== id; });
    saveRecipes();
    if (editingRecipeId === id) editingRecipeId = null;
    renderRecipes();
    toast('"' + name + '" recipe deleted');
  };

  if (typeof showConfirm === "function") {
    showConfirm('Delete "' + name + '"?', doDelete);
  } else {
    if (confirm('Delete "' + name + '"?')) {
      doDelete();
    }
  }
}

/**
 * Copy a recipe's name, meal, and ingredients into the
 * dishes list as a new dish entry.
 */
function addRecipeToDishes(id) {
  var recipe = null;
  for (var i = 0; i < recipes.length; i++) {
    if (recipes[i].id === id) { recipe = recipes[i]; break; }
  }
  if (!recipe) return;

  // Determine target meal — "any" defaults to "lunch"
  var targetMeal = recipe.meal;
  if (targetMeal === "any") targetMeal = "lunch";

  // Check for duplicate
  var exists = dishes[targetMeal].some(function (d) {
    return d.name.toLowerCase() === recipe.name.toLowerCase();
  });
  if (exists) {
    toast('"' + recipe.name + '" already exists in ' + MLABEL[targetMeal]);
    return;
  }

  dishes[targetMeal].push({
    id:          Date.now(),
    name:        recipe.name,
    ingredients: recipe.ingredients.slice() // copy
  });
  saveDishes();
  toast('"' + recipe.name + '" added to ' + MLABEL[targetMeal] + ' dishes');
}

/**
 * Toggle the inline planner picker for a recipe card.
 */
function addRecipeToPlanner(id) {
  var el = document.getElementById("recipe-planner-" + id);
  if (!el) return;

  // Close any other open pickers first
  var allPickers = document.querySelectorAll("[id^='recipe-planner-']");
  for (var i = 0; i < allPickers.length; i++) {
    if (allPickers[i] !== el) {
      allPickers[i].style.display = "none";
    }
  }

  // Toggle this picker
  el.style.display = el.style.display === "none" ? "block" : "none";
}

/**
 * Finalize assigning a recipe to a planner slot.
 * Reads day and meal from the inline picker selects.
 */
function assignRecipeToPlan(id) {
  var dayEl  = document.getElementById("recipe-plan-day-" + id);
  var mealEl = document.getElementById("recipe-plan-meal-" + id);
  if (!dayEl || !mealEl) return;

  var recipe = null;
  for (var i = 0; i < recipes.length; i++) {
    if (recipes[i].id === id) { recipe = recipes[i]; break; }
  }
  if (!recipe) return;

  var day  = dayEl.value;
  var meal = mealEl.value;

  if (!plan[day]) plan[day] = {};
  plan[day][meal] = recipe.name;
  savePlan();

  // Hide picker
  var el = document.getElementById("recipe-planner-" + id);
  if (el) el.style.display = "none";

  toast('"' + recipe.name + '" added to ' + day + ' ' + MLABEL[meal]);
}

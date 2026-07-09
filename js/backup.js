// ─────────────────────────────────────────────
// Aduppu v2 — Backup (Export / Import / Clear)
// Depends on: data.js (K, lsGet, lsSet, DEFAULTS, syncToCloud, etc.)
// Depends on: app.js  (toast, showConfirm)
// ─────────────────────────────────────────────

// ── Export all data ──
function exportAllData() {
  var data = {
    version:    2,
    timestamp:  new Date().toISOString(),
    aduppu_dishes:       lsGet(K.DISHES, DEFAULTS),
    aduppu_plan:         lsGet(K.PLAN, {}),
    aduppu_track:        lsGet(K.TRACK, []),
    aduppu_grocery:      lsGet(K.GROCERY, []),
    aduppu_recipes:      lsGet(K.RECIPES, []),
    aduppu_dish_history: lsGet(K.DISH_HISTORY, { breakfast: {}, lunch: {}, dinner: {} })
  };

  var json = JSON.stringify(data, null, 2);
  var blob = new Blob([json], { type: "application/json" });
  var url = URL.createObjectURL(blob);

  var dateStr = today(); // "YYYY-MM-DD" from data.js
  var filename = "aduppu-backup-" + dateStr + ".json";

  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(function () {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);

  if (typeof toast === "function") {
    toast("Backup downloaded: " + filename);
  }
}

// ── Import data ──
// Reads a JSON file, validates it, restores all data.
// Returns a Promise that resolves on success, rejects on failure.
function importData(file) {
  return new Promise(function (resolve, reject) {
    if (!file) {
      var err = "No file selected";
      if (typeof toast === "function") toast(err);
      return reject(new Error(err));
    }

    var reader = new FileReader();

    reader.onerror = function () {
      var msg = "Failed to read file";
      if (typeof toast === "function") toast(msg);
      reject(new Error(msg));
    };

    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);

        // Validate expected keys — at minimum we need dishes
        var expectedKeys = [
          "aduppu_dishes",
          "aduppu_plan",
          "aduppu_track",
          "aduppu_grocery"
        ];

        var hasRequired = expectedKeys.some(function (key) {
          return data.hasOwnProperty(key);
        });

        if (!hasRequired) {
          var msg = "Invalid backup file: missing expected data keys";
          if (typeof toast === "function") toast(msg);
          return reject(new Error(msg));
        }

        // Overwrite localStorage
        if (data.aduppu_dishes !== undefined) {
          lsSet(K.DISHES, data.aduppu_dishes);
        }
        if (data.aduppu_plan !== undefined) {
          lsSet(K.PLAN, data.aduppu_plan);
        }
        if (data.aduppu_track !== undefined) {
          lsSet(K.TRACK, data.aduppu_track);
        }
        if (data.aduppu_grocery !== undefined) {
          lsSet(K.GROCERY, data.aduppu_grocery);
        }
        if (data.aduppu_recipes !== undefined) {
          lsSet(K.RECIPES, data.aduppu_recipes);
        }
        if (data.aduppu_dish_history !== undefined) {
          lsSet(K.DISH_HISTORY, data.aduppu_dish_history);
        }

        // Reload all global state from localStorage
        dishes      = lsGet(K.DISHES, DEFAULTS);
        plan        = lsGet(K.PLAN, {});
        trackLog    = lsGet(K.TRACK, []);
        grocery     = lsGet(K.GROCERY, []);
        recipes     = lsGet(K.RECIPES, []);
        dishHistory = lsGet(K.DISH_HISTORY, { breakfast: {}, lunch: {}, dinner: {} });

        // Sync to cloud if available
        syncToCloud();

        if (typeof toast === "function") {
          toast("Data restored successfully");
        }

        resolve(data);
      } catch (parseErr) {
        var msg = "Invalid JSON file";
        if (typeof toast === "function") toast(msg);
        reject(new Error(msg));
      }
    };

    reader.readAsText(file);
  });
}

// ── Clear all data ──
// Shows confirmation dialog first, then resets everything.
function clearAllData() {
  var doReset = function () {
    // Remove all aduppu_* keys from localStorage
    var keysToRemove = [
      K.DISHES,
      K.PLAN,
      K.TRACK,
      K.GROCERY,
      K.RECIPES,
      K.DISH_HISTORY
    ];

    for (var i = 0; i < keysToRemove.length; i++) {
      try {
        localStorage.removeItem(keysToRemove[i]);
      } catch (e) {
        // Ignore removal errors
      }
    }

    // Reset globals to defaults
    dishes      = JSON.parse(JSON.stringify(DEFAULTS));
    plan        = {};
    trackLog    = [];
    grocery     = [];
    recipes     = [];
    dishHistory = { breakfast: {}, lunch: {}, dinner: {} };

    // Sync cleared state to cloud
    syncToCloud();

    if (typeof toast === "function") {
      toast("All data cleared");
    }
  };

  // Use showConfirm from app.js if available, otherwise fall back to native confirm
  if (typeof showConfirm === "function") {
    showConfirm(
      "Clear All Data",
      "This will permanently delete all your dishes, plans, meal logs, grocery entries, recipes, and history. This cannot be undone.",
      doReset
    );
  } else {
    if (confirm("Clear all Aduppu data? This cannot be undone.")) {
      doReset();
    }
  }
}

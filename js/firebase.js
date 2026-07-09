// ─────────────────────────────────────────────
// firebase.js — Firebase Auth + Firestore sync for Aduppu v2
// Loaded via <script> after the Firebase compat SDK CDN scripts.
// Expects: window.firebase (from compat SDK), toast(), lsGet(), lsSet(),
//          K (localStorage keys), dishes, plan, trackLog, grocery,
//          renderToday(), renderPlan(), renderDishes(), renderTrack()
// ─────────────────────────────────────────────

// ═══════════════════════════════════════════════
// 1. Firebase Config
// ═══════════════════════════════════════════════

var firebaseConfig = {
  // TODO: Replace with your Firebase project config
  // Get this from: Firebase Console -> Project Settings -> Your apps -> Web app
  // Steps: https://console.firebase.google.com
  // 1. Create a project (free Spark plan)
  // 2. Add a Web app
  // 3. Copy the config object here
  // 4. Enable Google Auth in Authentication -> Sign-in method
  // 5. Create Firestore Database in test mode, then update rules
  // 6. Add your GitHub Pages domain to Authentication -> Settings -> Authorized domains
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ═══════════════════════════════════════════════
// 2. Internal state
// ═══════════════════════════════════════════════

var _firebaseApp = null;
var _firebaseAuth = null;
var _firebaseDb = null;
var _firebaseConfigured = false;
var _saveTimer = null;
var SAVE_DEBOUNCE_MS = 500;

window.isOfflineMode = false;

// ═══════════════════════════════════════════════
// 3. Initialization
// ═══════════════════════════════════════════════

function initFirebase() {
  // Guard: Firebase SDK not loaded (offline, CDN blocked, etc.)
  if (typeof window.firebase === "undefined") {
    console.warn("Aduppu: Firebase SDK not loaded. Running in offline mode.");
    _hideSignInButton();
    return;
  }

  // Guard: config not replaced with real values
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.warn("Aduppu: Firebase not configured. See js/firebase.js to set up.");
    _firebaseConfigured = false;
    _hideSignInButton();
    return;
  }

  try {
    _firebaseConfigured = true;
    _firebaseApp = firebase.initializeApp(firebaseConfig);
    _firebaseAuth = firebase.auth();
    _firebaseDb = firebase.firestore();

    // Enable offline persistence so Firestore works offline too
    _firebaseDb.enablePersistence({ synchronizeTabs: true }).catch(function (err) {
      // Multi-tab or unimplemented — non-fatal
      console.warn("Aduppu: Firestore persistence not enabled:", err.code);
    });

    // Auth state listener
    _firebaseAuth.onAuthStateChanged(function (user) {
      if (user) {
        _onSignIn(user);
      } else {
        _onSignOut();
      }
    });
  } catch (err) {
    console.error("Aduppu: Firebase init failed:", err);
    _firebaseConfigured = false;
    _hideSignInButton();
    _showToast("Firebase setup error. Using offline mode.");
  }
}

// ═══════════════════════════════════════════════
// 4. Auth functions
// ═══════════════════════════════════════════════

function signInWithGoogle() {
  if (!_firebaseConfigured || !_firebaseAuth) {
    _showToast("Firebase not configured");
    return;
  }

  var provider = new firebase.auth.GoogleAuthProvider();

  try {
    _firebaseAuth.signInWithPopup(provider).catch(function (err) {
      console.error("Aduppu: Sign-in error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        // User closed the popup — not an error worth showing
        return;
      }
      _showToast("Sign-in failed: " + (err.message || "Unknown error"));
    });
  } catch (err) {
    console.error("Aduppu: Sign-in exception:", err);
    _showToast("Sign-in failed. Please try again.");
  }
}

function firebaseSignOut() {
  if (!_firebaseAuth) return;

  try {
    _firebaseAuth.signOut().then(function () {
      // localStorage data is intentionally kept
      _showToast("Signed out. Your local data is still here.");
    }).catch(function (err) {
      console.error("Aduppu: Sign-out error:", err);
      _showToast("Sign-out failed. Please try again.");
    });
  } catch (err) {
    console.error("Aduppu: Sign-out exception:", err);
  }
}

// Internal auth state handlers
function _onSignIn(user) {
  window.isOfflineMode = false;
  hideAuthScreen();
  _updateUserDisplay(user);
  firebaseSync.enabled = true;

  // Load cloud data and merge with local
  firebaseSync.load().then(function (cloudData) {
    if (cloudData) {
      var localData = _getLocalData();
      var merged = mergeData(localData, cloudData);
      _applyData(merged);
      _showToast("Signed in as " + (user.displayName || user.email));
    } else {
      // No cloud data yet — push local data up
      firebaseSync.save(_getLocalData());
      _showToast("Signed in. Your data will sync across devices.");
    }
  }).catch(function (err) {
    console.error("Aduppu: Cloud data load failed:", err);
    _showToast("Signed in (offline mode — will sync when back online)");
  });
}

function _onSignOut() {
  firebaseSync.enabled = false;
  _clearUserDisplay();

  // Only show auth screen if user didn't choose "continue without sign-in"
  if (!window.isOfflineMode) {
    showAuthScreen();
  }
}

// ═══════════════════════════════════════════════
// 5. Auth UI
// ═══════════════════════════════════════════════

function showAuthScreen() {
  var screen = document.getElementById("auth-screen");
  if (!screen) return;

  screen.style.display = "flex";
  screen.style.opacity = "0";
  requestAnimationFrame(function () {
    screen.style.opacity = "1";
  });

  // Show/hide the Google button depending on config
  var googleBtn = document.getElementById("auth-google-btn");
  if (googleBtn) {
    googleBtn.style.display = _firebaseConfigured ? "flex" : "none";
  }
}

function hideAuthScreen() {
  var screen = document.getElementById("auth-screen");
  if (!screen) return;

  screen.style.opacity = "0";
  setTimeout(function () {
    screen.style.display = "none";
  }, 300);
}

function continueWithoutSignIn() {
  window.isOfflineMode = true;
  hideAuthScreen();
  _showSyncBanner();
}

function _hideSignInButton() {
  var googleBtn = document.getElementById("auth-google-btn");
  if (googleBtn) {
    googleBtn.style.display = "none";
  }
}

function _showSyncBanner() {
  var banner = document.getElementById("sync-banner");
  if (banner) {
    banner.style.display = "flex";
  }
}

// ═══════════════════════════════════════════════
// 6. Firestore sync
// ═══════════════════════════════════════════════

window.firebaseSync = {
  enabled: false,

  /**
   * Save all app data to Firestore at users/{uid}/data as a single document.
   * Debounced to avoid excessive writes.
   */
  save: function (data) {
    if (!this.enabled || !_firebaseDb || !_firebaseAuth) return Promise.resolve();

    var user = _firebaseAuth.currentUser;
    if (!user) return Promise.resolve();

    // Cancel any pending debounced save
    if (_saveTimer) {
      clearTimeout(_saveTimer);
    }

    return new Promise(function (resolve, reject) {
      _saveTimer = setTimeout(function () {
        _saveTimer = null;

        var payload = data || _getLocalData();
        payload.lastModified = firebase.firestore.FieldValue.serverTimestamp();
        payload.lastModifiedDevice = navigator.userAgent.slice(0, 100);

        try {
          _firebaseDb
            .collection("users")
            .doc(user.uid)
            .collection("data")
            .doc("appData")
            .set(payload, { merge: true })
            .then(function () {
              resolve();
            })
            .catch(function (err) {
              console.error("Aduppu: Firestore save failed:", err);
              _showToast("Sync failed. Data saved locally.");
              reject(err);
            });
        } catch (err) {
          console.error("Aduppu: Firestore save exception:", err);
          _showToast("Sync failed. Data saved locally.");
          reject(err);
        }
      }, SAVE_DEBOUNCE_MS);
    });
  },

  /**
   * Load data from Firestore. Returns the data object or null if none exists.
   */
  load: function () {
    if (!_firebaseDb || !_firebaseAuth) return Promise.resolve(null);

    var user = _firebaseAuth.currentUser;
    if (!user) return Promise.resolve(null);

    try {
      return _firebaseDb
        .collection("users")
        .doc(user.uid)
        .collection("data")
        .doc("appData")
        .get()
        .then(function (doc) {
          if (doc.exists) {
            var data = doc.data();
            // Strip Firestore metadata fields before returning
            delete data.lastModified;
            delete data.lastModifiedDevice;
            return data;
          }
          return null;
        })
        .catch(function (err) {
          console.error("Aduppu: Firestore load failed:", err);
          return null;
        });
    } catch (err) {
      console.error("Aduppu: Firestore load exception:", err);
      return Promise.resolve(null);
    }
  }
};

// ═══════════════════════════════════════════════
// 7. Merge logic
// ═══════════════════════════════════════════════

/**
 * Merge local data with cloud data.
 * - Arrays (trackLog, grocery, dishes.breakfast/lunch/dinner): merge by id,
 *   cloud wins on conflicts, keep unique entries from both sides.
 * - Objects (plan, dishHistory): deep merge, cloud wins on conflicts.
 */
function mergeData(local, cloud) {
  if (!local && !cloud) return {};
  if (!local) return cloud;
  if (!cloud) return local;

  var merged = {};

  // Merge dishes — each meal category is an array with id-based entries
  merged.dishes = _mergeDishes(
    local.dishes || {},
    cloud.dishes || {}
  );

  // Merge plan — object keyed by day name, cloud wins on conflicts
  merged.plan = _mergeObjects(
    local.plan || {},
    cloud.plan || {}
  );

  // Merge trackLog — array with id-based entries
  merged.trackLog = _mergeArraysById(
    local.trackLog || [],
    cloud.trackLog || []
  );

  // Merge grocery — array with id-based entries
  merged.grocery = _mergeArraysById(
    local.grocery || [],
    cloud.grocery || []
  );

  return merged;
}

/**
 * Merge two arrays of objects by their `id` field.
 * Cloud wins when the same id exists in both.
 * Unique entries from both sides are kept.
 */
function _mergeArraysById(localArr, cloudArr) {
  var map = {};

  // Local first
  for (var i = 0; i < localArr.length; i++) {
    var item = localArr[i];
    if (item && item.id != null) {
      map[item.id] = item;
    }
  }

  // Cloud overwrites on conflict
  for (var j = 0; j < cloudArr.length; j++) {
    var cItem = cloudArr[j];
    if (cItem && cItem.id != null) {
      map[cItem.id] = cItem;
    }
  }

  // Convert back to array, sorted by id descending (newest first)
  var result = [];
  for (var key in map) {
    if (map.hasOwnProperty(key)) {
      result.push(map[key]);
    }
  }
  result.sort(function (a, b) { return (b.id || 0) - (a.id || 0); });

  return result;
}

/**
 * Merge dishes — each meal type (breakfast/lunch/dinner) is an array.
 * Cloud wins on id conflicts.
 */
function _mergeDishes(localDishes, cloudDishes) {
  var meals = ["breakfast", "lunch", "dinner"];
  var merged = {};

  for (var i = 0; i < meals.length; i++) {
    var meal = meals[i];
    merged[meal] = _mergeArraysById(
      localDishes[meal] || [],
      cloudDishes[meal] || []
    );
    // Sort dishes by id ascending (original order)
    merged[meal].sort(function (a, b) { return (a.id || 0) - (b.id || 0); });
  }

  return merged;
}

/**
 * Deep merge two plain objects. Cloud (second argument) wins on conflicts.
 */
function _mergeObjects(local, cloud) {
  var merged = {};

  // Copy all local keys
  for (var key in local) {
    if (local.hasOwnProperty(key)) {
      merged[key] = local[key];
    }
  }

  // Cloud overwrites / adds
  for (var cKey in cloud) {
    if (cloud.hasOwnProperty(cKey)) {
      var localVal = merged[cKey];
      var cloudVal = cloud[cKey];

      if (
        localVal != null &&
        cloudVal != null &&
        typeof localVal === "object" &&
        typeof cloudVal === "object" &&
        !Array.isArray(localVal) &&
        !Array.isArray(cloudVal)
      ) {
        // Recurse for nested objects
        merged[cKey] = _mergeObjects(localVal, cloudVal);
      } else {
        // Cloud wins
        merged[cKey] = cloudVal;
      }
    }
  }

  return merged;
}

// ═══════════════════════════════════════════════
// 8. Data helpers — bridge to the main app globals
// ═══════════════════════════════════════════════

/**
 * Gather all app data from the main app globals and localStorage.
 */
function _getLocalData() {
  return {
    dishes: typeof dishes !== "undefined" ? dishes : lsGet(K.DISHES, {}),
    plan: typeof plan !== "undefined" ? plan : lsGet(K.PLAN, {}),
    trackLog: typeof trackLog !== "undefined" ? trackLog : lsGet(K.TRACK, []),
    grocery: typeof grocery !== "undefined" ? grocery : lsGet(K.GROCERY, [])
  };
}

/**
 * Apply merged data back to the app globals and localStorage, then re-render.
 */
function _applyData(data) {
  try {
    if (data.dishes) {
      dishes = data.dishes;
      lsSet(K.DISHES, dishes);
    }
    if (data.plan) {
      plan = data.plan;
      lsSet(K.PLAN, plan);
    }
    if (data.trackLog) {
      trackLog = data.trackLog;
      lsSet(K.TRACK, trackLog);
    }
    if (data.grocery) {
      grocery = data.grocery;
      lsSet(K.GROCERY, grocery);
    }

    // Re-render all tabs
    if (typeof renderToday === "function") renderToday();
    if (typeof renderPlan === "function") renderPlan();
    if (typeof renderDishes === "function") renderDishes();
    if (typeof renderTrack === "function") renderTrack();
  } catch (err) {
    console.error("Aduppu: Error applying merged data:", err);
  }
}

/**
 * Convenience function to trigger a sync save after any local data change.
 * Call this from the main app whenever data is modified (after lsSet calls).
 */
function syncAfterChange() {
  if (firebaseSync.enabled) {
    firebaseSync.save(_getLocalData());
  }
}

// ═══════════════════════════════════════════════
// 9. User display
// ═══════════════════════════════════════════════

/**
 * Get the current signed-in user's info, or null.
 */
function getCurrentUser() {
  if (!_firebaseAuth || !_firebaseAuth.currentUser) return null;

  var u = _firebaseAuth.currentUser;
  return {
    name: u.displayName || "",
    email: u.email || "",
    photoURL: u.photoURL || ""
  };
}

/**
 * Update the header to show the user's avatar and name.
 */
function _updateUserDisplay(user) {
  var container = document.getElementById("user-display");
  if (!container) return;

  var photoURL = user.photoURL || "";
  var displayName = user.displayName || user.email || "User";
  var initial = displayName.charAt(0).toUpperCase();

  var avatarHTML;
  if (photoURL) {
    avatarHTML =
      '<img src="' + photoURL + '" alt="' + displayName + '" ' +
      'style="width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,.5);" ' +
      'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" />' +
      '<span style="display:none;width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.25);' +
      'color:#fff;font-size:13px;font-weight:700;align-items:center;justify-content:center;">' + initial + '</span>';
  } else {
    avatarHTML =
      '<span style="display:flex;width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.25);' +
      'color:#fff;font-size:13px;font-weight:700;align-items:center;justify-content:center;">' + initial + '</span>';
  }

  container.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="firebaseSignOut()" title="Sign out">' +
      avatarHTML +
      '<span style="color:rgba(255,255,255,.9);font-size:12px;font-weight:600;max-width:100px;' +
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + displayName + '</span>' +
    '</div>';

  container.style.display = "flex";
}

/**
 * Clear the user display in the header.
 */
function _clearUserDisplay() {
  var container = document.getElementById("user-display");
  if (container) {
    container.innerHTML = "";
    container.style.display = "none";
  }
}

// ═══════════════════════════════════════════════
// 10. Error handling / helpers
// ═══════════════════════════════════════════════

/**
 * Show a toast message — uses the app's existing toast() if available,
 * falls back to console.log.
 */
function _showToast(msg) {
  if (typeof toast === "function") {
    toast(msg);
  } else {
    console.log("Aduppu:", msg);
  }
}

// ═══════════════════════════════════════════════
// 11. Expose functions on window scope
// ═══════════════════════════════════════════════

window.initFirebase = initFirebase;
window.signInWithGoogle = signInWithGoogle;
window.firebaseSignOut = firebaseSignOut;
window.showAuthScreen = showAuthScreen;
window.hideAuthScreen = hideAuthScreen;
window.continueWithoutSignIn = continueWithoutSignIn;
window.getCurrentUser = getCurrentUser;
window.mergeData = mergeData;
window.syncAfterChange = syncAfterChange;
// window.firebaseSync is already set above

// ═══════════════════════════════════════════════
// 12. Auto-init when the script loads
// ═══════════════════════════════════════════════

// If the DOM is already ready, init now; otherwise wait.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFirebase);
} else {
  initFirebase();
}

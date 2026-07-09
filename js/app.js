/* =============================================
   Aduppu v2 — app.js
   Main application logic: toast, tabs, confirm
   dialog, autocomplete, utilities, init, install
   prompt, service worker, user menu.
   Expects globals from data.js and firebase.js.
   ============================================= */

// ─────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────

/**
 * Escape HTML special characters to prevent XSS
 * when rendering user-entered content via innerHTML.
 */
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
window.escapeHtml = escapeHtml;

/**
 * Standard debounce: returns a function that delays
 * invoking fn until ms milliseconds have elapsed
 * since the last call.
 */
function debounce(fn, ms) {
  var timer;
  return function () {
    var ctx = this;
    var args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(ctx, args);
    }, ms);
  };
}
window.debounce = debounce;

/**
 * Format an ISO date string ("2025-07-09") into
 * a human-readable form like "9 Jul 2025".
 */
function formatDate(dateStr) {
  if (!dateStr) return "";
  var parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  var d = new Date(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10)
  );
  if (isNaN(d.getTime())) return dateStr;
  var months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
}
window.formatDate = formatDate;

// ─────────────────────────────────────────────
// Toast notification
// ─────────────────────────────────────────────

var _toastTimer = null;

/**
 * Show a toast message at the bottom of the screen.
 * Auto-hides after 2.5 seconds.
 */
function toast(msg) {
  var el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function () {
    el.classList.remove("show");
    _toastTimer = null;
  }, 2500);
}
window.toast = toast;

// ─────────────────────────────────────────────
// Tab switching
// ─────────────────────────────────────────────

var TABS = ["today", "planner", "recipes", "suggest", "track"];

/**
 * Switch to the named tab.
 *   tabName — one of: "today", "planner", "recipes", "suggest", "track"
 *
 * Deactivates all panels, header tab buttons, and bottom
 * nav items, then activates the matching ones and calls the
 * appropriate render function.
 */
function switchTab(tabName) {
  // Remove .active from all panels, tab buttons, nav items
  var panels = document.querySelectorAll(".tab-panel");
  var tabBtns = document.querySelectorAll(".tab-btn");
  var navItems = document.querySelectorAll(".nav-item");

  for (var i = 0; i < panels.length; i++) {
    panels[i].classList.remove("active");
  }
  for (var i = 0; i < tabBtns.length; i++) {
    tabBtns[i].classList.remove("active");
  }
  for (var i = 0; i < navItems.length; i++) {
    navItems[i].classList.remove("active");
  }

  // Activate the target panel
  var panel = document.getElementById("tab-" + tabName);
  if (panel) {
    panel.classList.add("active");
    // Add fade-in animation
    panel.classList.remove("fadeIn");
    // Force reflow so re-adding the class triggers the animation
    void panel.offsetWidth;
    panel.classList.add("fadeIn");
  }

  // Activate the matching header tab button and bottom nav item
  var idx = TABS.indexOf(tabName);
  if (idx >= 0) {
    if (tabBtns[idx]) tabBtns[idx].classList.add("active");
    if (navItems[idx]) navItems[idx].classList.add("active");
  }

  // Call the render function for the activated tab
  switch (tabName) {
    case "today":
      if (typeof renderToday === "function") renderToday();
      break;
    case "planner":
      if (typeof renderPlan === "function") renderPlan();
      break;
    case "recipes":
      if (typeof renderRecipes === "function") renderRecipes();
      break;
    case "suggest":
      if (typeof renderSuggest === "function") renderSuggest();
      break;
    case "track":
      if (typeof renderTrack === "function") renderTrack();
      break;
  }
}
window.switchTab = switchTab;

// ─────────────────────────────────────────────
// Confirm dialog
// ─────────────────────────────────────────────

var _confirmOverlay = null;

/**
 * Show a centered confirmation modal.
 *   message   — the prompt text
 *   onConfirm — callback invoked when user clicks "Confirm"
 *
 * HTML structure:
 *   div.confirm-overlay > div.confirm-dialog > p + buttons
 */
function showConfirm(message, onConfirm) {
  // Remove any existing overlay
  hideConfirm();

  var overlay = document.createElement("div");
  overlay.className = "confirm-overlay";

  var dialog = document.createElement("div");
  dialog.className = "confirm-dialog";

  var p = document.createElement("p");
  p.textContent = message;

  var btnRow = document.createElement("div");
  btnRow.className = "confirm-buttons";

  var cancelBtn = document.createElement("button");
  cancelBtn.className = "btn-outline";
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = function () {
    hideConfirm();
  };

  var confirmBtn = document.createElement("button");
  confirmBtn.className = "btn";
  confirmBtn.textContent = "Confirm";
  confirmBtn.onclick = function () {
    hideConfirm();
    if (typeof onConfirm === "function") onConfirm();
  };

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  dialog.appendChild(p);
  dialog.appendChild(btnRow);
  overlay.appendChild(dialog);

  // Close on overlay background click
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) hideConfirm();
  });

  // Close on Escape key
  overlay._keyHandler = function (e) {
    if (e.key === "Escape") hideConfirm();
  };
  document.addEventListener("keydown", overlay._keyHandler);

  document.body.appendChild(overlay);
  _confirmOverlay = overlay;

  // Force reflow then add visible class for animation
  void overlay.offsetWidth;
  overlay.classList.add("visible");
}
window.showConfirm = showConfirm;

function hideConfirm() {
  if (_confirmOverlay) {
    if (_confirmOverlay._keyHandler) {
      document.removeEventListener("keydown", _confirmOverlay._keyHandler);
    }
    _confirmOverlay.remove();
    _confirmOverlay = null;
  }
}
window.hideConfirm = hideConfirm;

// ─────────────────────────────────────────────
// Autocomplete
// ─────────────────────────────────────────────

/**
 * Attach autocomplete behavior to an input element.
 *   inputId        — the id of the <input> element
 *   getSuggestions  — function(value) => string[]
 *
 * Shows a dropdown below the input with matching suggestions.
 * Supports keyboard navigation (ArrowUp/ArrowDown/Enter/Escape)
 * and mouse click to select. Debounced at 200ms.
 */
function setupAutocomplete(inputId, getSuggestions) {
  var input = document.getElementById(inputId);
  if (!input) return;

  var dropdown = null;
  var activeIdx = -1;
  var items = [];

  function createDropdown() {
    removeDropdown();
    dropdown = document.createElement("div");
    dropdown.className = "autocomplete-dropdown";
    // Position relative to input
    var rect = input.getBoundingClientRect();
    dropdown.style.position = "absolute";
    dropdown.style.left = rect.left + window.scrollX + "px";
    dropdown.style.top = rect.bottom + window.scrollY + "px";
    dropdown.style.width = rect.width + "px";
    dropdown.style.zIndex = "1000";
    document.body.appendChild(dropdown);
    return dropdown;
  }

  function removeDropdown() {
    if (dropdown) {
      dropdown.remove();
      dropdown = null;
    }
    activeIdx = -1;
    items = [];
  }

  function render(suggestions) {
    if (!suggestions.length) {
      removeDropdown();
      return;
    }
    createDropdown();
    items = suggestions;
    activeIdx = -1;

    for (var i = 0; i < suggestions.length; i++) {
      (function (index) {
        var div = document.createElement("div");
        div.className = "autocomplete-item";
        div.textContent = suggestions[index];
        div.addEventListener("mousedown", function (e) {
          e.preventDefault(); // keep focus on input
          input.value = suggestions[index];
          removeDropdown();
          // Dispatch input event so any listeners are notified
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        dropdown.appendChild(div);
      })(i);
    }
  }

  function highlight(idx) {
    if (!dropdown) return;
    var divs = dropdown.querySelectorAll(".autocomplete-item");
    for (var j = 0; j < divs.length; j++) {
      divs[j].classList.remove("active");
    }
    if (idx >= 0 && idx < divs.length) {
      divs[idx].classList.add("active");
      // Scroll into view if needed
      divs[idx].scrollIntoView({ block: "nearest" });
    }
  }

  var debouncedShow = debounce(function () {
    var val = input.value.trim();
    if (!val) {
      removeDropdown();
      return;
    }
    var suggestions = getSuggestions(val);
    render(suggestions.slice(0, 10)); // limit to 10 suggestions
  }, 200);

  input.addEventListener("input", debouncedShow);

  input.addEventListener("keydown", function (e) {
    if (!dropdown || !items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIdx = (activeIdx + 1) % items.length;
      highlight(activeIdx);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIdx = activeIdx <= 0 ? items.length - 1 : activeIdx - 1;
      highlight(activeIdx);
    } else if (e.key === "Enter") {
      if (activeIdx >= 0 && activeIdx < items.length) {
        e.preventDefault();
        input.value = items[activeIdx];
        removeDropdown();
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } else if (e.key === "Escape") {
      removeDropdown();
    }
  });

  input.addEventListener("blur", function () {
    // Small delay to allow mousedown on dropdown to fire first
    setTimeout(removeDropdown, 150);
  });

  // Reposition on window resize / scroll
  var reposition = debounce(function () {
    if (dropdown) {
      var rect = input.getBoundingClientRect();
      dropdown.style.left = rect.left + window.scrollX + "px";
      dropdown.style.top = rect.bottom + window.scrollY + "px";
      dropdown.style.width = rect.width + "px";
    }
  }, 50);
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, true);
}
window.setupAutocomplete = setupAutocomplete;

// ─────────────────────────────────────────────
// Install prompt handling
// ─────────────────────────────────────────────

var deferredPrompt = null;

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    var banner = document.getElementById("install-banner");
    if (banner) banner.classList.add("show");
  });

  // iOS detection — no beforeinstallprompt on Safari
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone;
  if (isIOS && !isStandalone) {
    var banner = document.getElementById("install-banner");
    if (banner) banner.classList.add("show");
  }
}

/**
 * Trigger the native install prompt (called from an
 * "Install" button in the banner, if present).
 */
function promptInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function (result) {
      if (result.outcome === "accepted") {
        toast("App installed!");
      }
      deferredPrompt = null;
      var banner = document.getElementById("install-banner");
      if (banner) banner.classList.remove("show");
    });
  }
}
window.promptInstall = promptInstall;

// ─────────────────────────────────────────────
// Service Worker registration
// ─────────────────────────────────────────────

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js")
      .then(function (reg) {
        // Service worker registered successfully
      })
      .catch(function (err) {
        console.warn("Service worker registration failed:", err);
      });
  }
}

// ─────────────────────────────────────────────
// User menu (header sign-in / avatar dropdown)
// ─────────────────────────────────────────────

/**
 * Render the user menu area in the header.
 * When signed in: shows avatar image + dropdown with
 *   "Sign Out" and "Export Data" options.
 * When not signed in: shows a "Sign In" button.
 */
function renderUserMenu() {
  var container = document.getElementById("user-menu");
  if (!container) return;

  var user = typeof getCurrentUser === "function" ? getCurrentUser() : null;

  if (user) {
    var photoUrl = user.photoURL || "";
    var displayName = escapeHtml(user.displayName || user.email || "User");
    var avatarHtml = photoUrl
      ? '<img src="' +
        escapeHtml(photoUrl) +
        '" alt="' +
        displayName +
        '" class="user-avatar" />'
      : '<div class="user-avatar user-avatar-placeholder">' +
        displayName.charAt(0).toUpperCase() +
        "</div>";

    container.innerHTML =
      '<div class="user-menu-wrapper">' +
      '<button class="user-menu-btn" onclick="toggleUserDropdown()" aria-label="User menu">' +
      avatarHtml +
      "</button>" +
      '<div id="user-dropdown" class="user-dropdown">' +
      '<div class="user-dropdown-name">' +
      displayName +
      "</div>" +
      '<button class="user-dropdown-item" onclick="handleSignOut()">Sign Out</button>' +
      '<button class="user-dropdown-item" onclick="handleExportData()">Export Data</button>' +
      "</div>" +
      "</div>";
  } else {
    container.innerHTML =
      '<button class="btn-sm user-sign-in-btn" onclick="handleSignIn()">Sign In</button>';
  }
}
window.renderUserMenu = renderUserMenu;

function toggleUserDropdown() {
  var dd = document.getElementById("user-dropdown");
  if (dd) dd.classList.toggle("visible");
}
window.toggleUserDropdown = toggleUserDropdown;

// Close dropdown when clicking outside
document.addEventListener("click", function (e) {
  var dd = document.getElementById("user-dropdown");
  if (!dd) return;
  var wrapper = dd.closest(".user-menu-wrapper");
  if (wrapper && !wrapper.contains(e.target)) {
    dd.classList.remove("visible");
  }
});

function handleSignIn() {
  if (typeof signInWithGoogle === "function") {
    signInWithGoogle().then(function () {
      renderUserMenu();
      toast("Signed in successfully");
    }).catch(function (err) {
      console.error("Sign-in error:", err);
      toast("Sign-in failed");
    });
  }
}
window.handleSignIn = handleSignIn;

function handleSignOut() {
  if (typeof signOut === "function") {
    signOut().then(function () {
      renderUserMenu();
      toast("Signed out");
    }).catch(function (err) {
      console.error("Sign-out error:", err);
    });
  }
  var dd = document.getElementById("user-dropdown");
  if (dd) dd.classList.remove("visible");
}
window.handleSignOut = handleSignOut;

function handleExportData() {
  // Delegate to backup.js if available, otherwise simple JSON export
  if (typeof exportAllData === "function") {
    exportAllData();
  } else {
    // Fallback: gather all aduppu_ keys from localStorage
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf("aduppu_") === 0) {
        try {
          data[key] = JSON.parse(localStorage.getItem(key));
        } catch (e) {
          data[key] = localStorage.getItem(key);
        }
      }
    }
    var blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "aduppu-backup-" + today() + ".json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Data exported");
  }
  var dd = document.getElementById("user-dropdown");
  if (dd) dd.classList.remove("visible");
}
window.handleExportData = handleExportData;

// ─────────────────────────────────────────────
// Get all dish names (for autocomplete)
// ─────────────────────────────────────────────

/**
 * Returns an array of all dish name strings across
 * all meal types, for use as autocomplete suggestions.
 * Filters by a search prefix (case-insensitive).
 */
function getAllDishSuggestions(query) {
  var q = query.toLowerCase();
  var names = [];
  var seen = {};
  var mealTypes = typeof MEALS !== "undefined" ? MEALS : ["breakfast", "lunch", "dinner"];

  for (var m = 0; m < mealTypes.length; m++) {
    var mealDishes = typeof dishes !== "undefined" ? dishes[mealTypes[m]] : [];
    if (!mealDishes) continue;
    for (var d = 0; d < mealDishes.length; d++) {
      var name = mealDishes[d].name;
      if (!seen[name] && name.toLowerCase().indexOf(q) !== -1) {
        names.push(name);
        seen[name] = true;
      }
    }
  }
  return names;
}
window.getAllDishSuggestions = getAllDishSuggestions;

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────

/**
 * Main initialization function — called on DOMContentLoaded.
 *
 * - Sets today's date on the grocery date input
 * - Sets selDay to todayName()
 * - Calls initFirebase()
 * - Renders all tabs
 * - Sets up autocomplete on the quick-log dish input
 * - On mobile (< 600px), defaults Plan tab to day view
 * - Sets up install prompt listener
 * - Shows iOS install tip if applicable
 * - Registers the service worker
 * - Renders the user menu
 */
function initApp() {
  // Set today's date on the grocery date input
  var gDateInput = document.getElementById("g-date");
  if (gDateInput) {
    gDateInput.value = typeof today === "function" ? today() : new Date().toISOString().split("T")[0];
  }

  // Set selDay to today's day name
  if (typeof todayName === "function") {
    window.selDay = todayName();
  }

  // Initialize Firebase (auth + Firestore)
  if (typeof initFirebase === "function") {
    initFirebase();
  }

  // Render all tabs
  if (typeof renderToday === "function") renderToday();
  if (typeof renderPlan === "function") renderPlan();
  if (typeof renderRecipes === "function") renderRecipes();
  if (typeof renderSuggest === "function") renderSuggest();
  if (typeof renderTrack === "function") renderTrack();

  // Set up autocomplete on the quick-log dish input
  setupAutocomplete("ql-dish", getAllDishSuggestions);

  // On mobile (< 600px), default Plan tab to day view
  if (window.innerWidth < 600) {
    if (typeof setPlanView === "function") {
      setPlanView("day");
    }
  }

  // Install prompt handling
  setupInstallPrompt();

  // Register service worker (real file, not blob)
  registerServiceWorker();

  // Render user menu in header
  renderUserMenu();
}
window.initApp = initApp;

// ─────────────────────────────────────────────
// DOMContentLoaded — kick off the app
// ─────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", initApp);

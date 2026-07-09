// ─────────────────────────────────────────────
// Aduppu v2 — Today Tab
// Renders the Today view and handles quick meal logging.
// Depends on: data.js (dishes, plan, trackLog, DAYS, MEALS, ME, MLABEL,
//   MPILL, today, todayName, savePlan, saveTrack, smartRandomMeal,
//   recordDishUsage, lsSet, K)
// Depends on: app.js (toast, escapeHtml, showConfirm, switchTab)
// ─────────────────────────────────────────────

// ── State ──
var qlMeal = "breakfast";
var qlType = "home";

// ─────────────────────────────────────────────
// renderToday — main Today-tab renderer
// ─────────────────────────────────────────────
function renderToday() {
  var day = todayName();
  var d = new Date();

  // Date label — e.g. "Wednesday, 9 July"
  var dateLabel = document.getElementById("today-date-label");
  if (dateLabel) {
    dateLabel.textContent = d.toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long"
    });
  }

  var todayStr = today();
  var todayEntries = trackLog.filter(function(t) { return t.date === todayStr; });

  // ── Build meal cards ──
  var html = MEALS.map(function(meal) {
    var planned = (plan[day] && plan[day][meal]) ? plan[day][meal] : null;
    var logged = todayEntries.filter(function(t) { return t.meal === meal; });

    // Logged entries
    var loggedHTML;
    if (logged.length) {
      loggedHTML = logged.map(function(e) {
        return '<div class="actual-logged">' +
          '<span class="pill ' + (e.type === "home" ? "phome" : "pout") + '">' +
            (e.type === "home" ? "🏠" : "🛵") + '</span>' +
          '<span class="actual-logged-dish">' + escapeHtml(e.dish) + '</span>' +
          (e.cost ? '<span style="font-weight:700;color:#c62828;font-size:12px;">₹' + e.cost + '</span>' : '') +
          '<button class="btn-del" onclick="deleteLogEntry(' + e.id + ')" title="Delete">✕</button>' +
          '<button class="btn-del" onclick="editLogEntry(' + e.id + ')" title="Edit" style="margin-left:4px;">✎</button>' +
        '</div>' +
        (e.notes ? '<div class="note-txt">📝 ' + escapeHtml(e.notes) + '</div>' : '');
      }).join('');
    } else {
      loggedHTML = '<div style="font-size:12px;color:#bbb;font-style:italic;margin-top:4px;">Nothing logged yet</div>';
    }

    // Inline quick-log form (collapsed by default)
    var inlineQL =
      '<div id="ql-inline-' + meal + '" style="display:none;margin-top:10px;' +
          'padding-top:10px;border-top:1px dashed #e0c9b0;">' +
        '<div class="form-group">' +
          '<input type="text" id="ql-idish-' + meal + '" ' +
            'placeholder="What did you have?" ' +
            'style="font-size:13px;padding:7px 10px;" ' +
            'onkeydown="if(event.key===\'Enter\')submitInlineQL(\'' + meal + '\')"/>' +
        '</div>' +
        '<div style="display:flex;gap:6px;margin-bottom:8px;">' +
          '<button id="ql-ihome-' + meal + '" ' +
            'class="btn-outline active" ' +
            'style="flex:1;padding:5px 8px;font-size:11px;" ' +
            'onclick="setInlineQLType(\'' + meal + '\',\'home\')">' +
            '🏠 Cooked</button>' +
          '<button id="ql-iout-' + meal + '" ' +
            'class="btn-outline" ' +
            'style="flex:1;padding:5px 8px;font-size:11px;" ' +
            'onclick="setInlineQLType(\'' + meal + '\',\'out\')">' +
            '🛵 Ordered</button>' +
        '</div>' +
        '<div id="ql-icost-row-' + meal + '" style="display:none;" class="form-group">' +
          '<input type="number" id="ql-icost-' + meal + '" ' +
            'placeholder="Cost (₹)" style="font-size:13px;padding:7px 10px;"/>' +
        '</div>' +
        '<div class="form-group">' +
          '<textarea id="ql-inotes-' + meal + '" ' +
            'placeholder="Notes (optional)" ' +
            'style="font-size:12px;padding:7px 10px;min-height:36px;"></textarea>' +
        '</div>' +
        '<button class="btn" style="width:100%;padding:7px;font-size:12px;" ' +
          'onclick="submitInlineQL(\'' + meal + '\')">Log ✓</button>' +
      '</div>';

    return '<div class="today-meal">' +
      '<div class="today-meal-hdr">' +
        '<span class="pill ' + MPILL[meal] + '">' + ME[meal] + ' ' + MLABEL[meal] + '</span>' +
        '<button class="btn-tiny" onclick="randMeal(\'' + day + '\',\'' + meal + '\');renderToday()">' +
          '🎲</button>' +
      '</div>' +
      '<div class="today-plan">Planned: <span>' +
        (planned
          ? escapeHtml(planned)
          : '<em style="color:#ccc;font-weight:400">Not set</em>') +
      '</span></div>' +
      '<div class="today-actual">' + loggedHTML + '</div>' +
      '<button class="btn-log-quick" onclick="toggleInlineQL(\'' + meal + '\')" ' +
        'style="margin-top:8px;">Quick Log</button>' +
      inlineQL +
    '</div>';
  }).join('');

  var mealsEl = document.getElementById("today-meals");
  if (mealsEl) mealsEl.innerHTML = html;

  // ── Daily summary card ──
  var card = document.getElementById("today-log-card");
  if (!card) return;

  if (todayEntries.length) {
    var cookedCount  = todayEntries.filter(function(t) { return t.type === "home"; }).length;
    var orderedCount = todayEntries.filter(function(t) { return t.type === "out"; }).length;
    var totalSpend   = todayEntries.reduce(function(s, t) { return s + (t.cost || 0); }, 0);

    card.innerHTML =
      '<div class="card">' +
        '<h3>📊 Today\'s Summary</h3>' +
        '<div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
          '<div style="background:#f0faf2;border-radius:8px;padding:8px 14px;text-align:center;">' +
            '<div style="font-size:20px;font-weight:700;color:#2e7d32;">' + cookedCount + '</div>' +
            '<div style="font-size:10px;color:#5a8a5a;text-transform:uppercase;">Cooked</div>' +
          '</div>' +
          '<div style="background:#fce4ec;border-radius:8px;padding:8px 14px;text-align:center;">' +
            '<div style="font-size:20px;font-weight:700;color:#c62828;">' + orderedCount + '</div>' +
            '<div style="font-size:10px;color:#a05050;text-transform:uppercase;">Ordered</div>' +
          '</div>' +
          '<div style="background:#fff3e0;border-radius:8px;padding:8px 14px;text-align:center;">' +
            '<div style="font-size:20px;font-weight:700;color:var(--pri);">₹' + totalSpend.toFixed(0) + '</div>' +
            '<div style="font-size:10px;color:#a07030;text-transform:uppercase;">Spent</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  } else {
    card.innerHTML = '';
  }
}

// ─────────────────────────────────────────────
// Inline quick-log helpers
// ─────────────────────────────────────────────
function toggleInlineQL(meal) {
  var el = document.getElementById('ql-inline-' + meal);
  if (!el) return;
  var wasHidden = (el.style.display === 'none');

  // Collapse every inline QL form first
  MEALS.forEach(function(m) {
    var e = document.getElementById('ql-inline-' + m);
    if (e) e.style.display = 'none';
  });

  if (wasHidden) {
    el.style.display = 'block';
    var dishInput = document.getElementById('ql-idish-' + meal);
    if (dishInput) dishInput.focus();
  }
}

function setInlineQLType(meal, type) {
  var homeBtn = document.getElementById('ql-ihome-' + meal);
  var outBtn  = document.getElementById('ql-iout-' + meal);
  if (homeBtn) homeBtn.classList.toggle('active', type === 'home');
  if (outBtn)  outBtn.classList.toggle('active', type === 'out');
  var costRow = document.getElementById('ql-icost-row-' + meal);
  if (costRow) costRow.style.display = (type === 'out') ? 'block' : 'none';
  qlType = type;
}

function submitInlineQL(meal) {
  var dishInput = document.getElementById('ql-idish-' + meal);
  var dish = dishInput ? dishInput.value.trim() : '';
  if (!dish) { toast('Please enter what you had'); return; }

  // Copy values into the standalone form so quickLog() can read them
  var mainDish  = document.getElementById('ql-dish');
  var mainCost  = document.getElementById('ql-cost');
  var mainNotes = document.getElementById('ql-notes');
  if (mainDish)  mainDish.value  = dish;

  var costInput = document.getElementById('ql-icost-' + meal);
  if (mainCost)  mainCost.value  = costInput ? costInput.value : '';

  var notesInput = document.getElementById('ql-inotes-' + meal);
  if (mainNotes) mainNotes.value = notesInput ? notesInput.value : '';

  qlMeal = meal;
  quickLog();
}

// ─────────────────────────────────────────────
// randomizeToday — smart-randomize all 3 meal slots
// ─────────────────────────────────────────────
function randomizeToday() {
  var day = todayName();
  if (!plan[day]) plan[day] = {};

  MEALS.forEach(function(m) {
    var picked = smartRandomMeal(m);
    if (picked) plan[day][m] = picked.name;
  });

  savePlan();
  renderToday();
  toast("Today's meals randomized 🎲");
}

// ─────────────────────────────────────────────
// Standalone quick-log form helpers
// ─────────────────────────────────────────────
function setQLMeal(meal) {
  qlMeal = meal;
  MEALS.forEach(function(m) {
    var btn = document.getElementById('ql-' + m[0]);
    if (btn) btn.classList.toggle('active', m === meal);
  });
}

function setQLType(type) {
  qlType = type;
  var homeBtn = document.getElementById('ql-home');
  var outBtn  = document.getElementById('ql-out');
  if (homeBtn) homeBtn.classList.toggle('active', type === 'home');
  if (outBtn)  outBtn.classList.toggle('active', type === 'out');
  var costRow = document.getElementById('ql-cost-row');
  if (costRow) costRow.style.display = (type === 'out') ? 'block' : 'none';
}

// ─────────────────────────────────────────────
// quickLog — create a track-log entry
// ─────────────────────────────────────────────
function quickLog() {
  var dishEl  = document.getElementById('ql-dish');
  var dish    = dishEl ? dishEl.value.trim() : '';
  if (!dish) { toast('Please enter what you had'); return; }

  var costEl  = document.getElementById('ql-cost');
  var notesEl = document.getElementById('ql-notes');

  var entry = {
    id:    Date.now(),
    date:  today(),
    meal:  qlMeal,
    type:  qlType,
    dish:  dish,
    cost:  qlType === 'out' ? (parseFloat(costEl ? costEl.value : '0') || 0) : 0,
    notes: notesEl ? notesEl.value.trim() : ''
  };

  trackLog.unshift(entry);
  saveTrack();
  recordDishUsage(qlMeal, dish);

  // Clear form fields
  if (dishEl)  dishEl.value  = '';
  if (costEl)  costEl.value  = '';
  if (notesEl) notesEl.value = '';

  toast('✓ Logged: ' + dish);
  renderToday();
  if (typeof renderTrack === 'function') renderTrack();
}

// ─────────────────────────────────────────────
// deleteLogEntry — remove with confirmation
// ─────────────────────────────────────────────
function deleteLogEntry(id) {
  showConfirm('Delete this log entry?', function() {
    trackLog = trackLog.filter(function(e) { return e.id !== id; });
    saveTrack();
    renderToday();
    if (typeof renderTrack === 'function') renderTrack();
    toast('Entry deleted');
  });
}

// ─────────────────────────────────────────────
// editLogEntry — populate form with existing data
// ─────────────────────────────────────────────
function editLogEntry(id) {
  var entry = null;
  var idx   = -1;
  for (var i = 0; i < trackLog.length; i++) {
    if (trackLog[i].id === id) { entry = trackLog[i]; idx = i; break; }
  }
  if (!entry) return;

  // Populate the standalone quick-log form
  setQLMeal(entry.meal);
  setQLType(entry.type);

  var dishEl  = document.getElementById('ql-dish');
  var costEl  = document.getElementById('ql-cost');
  var notesEl = document.getElementById('ql-notes');

  if (dishEl)  dishEl.value  = entry.dish;
  if (costEl)  costEl.value  = entry.cost || '';
  if (notesEl) notesEl.value = entry.notes || '';

  // Remove the entry so the user can re-log after editing
  trackLog.splice(idx, 1);
  saveTrack();

  renderToday();

  // Scroll to the standalone form and focus
  if (dishEl) {
    dishEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    dishEl.focus();
  }
}

// ─────────────────────────────────────────────
// Aduppu v2 — Track Tab
// Depends on: data.js  (trackLog, grocery, K, lsSet, today, saveTrack, saveGrocery)
// Depends on: app.js   (toast, escapeHtml, showConfirm)
// Depends on: backup.js (exportAllData, importData, clearAllData)
// ─────────────────────────────────────────────

// ── State ──
var trackRange  = "7days";   // "7days" | "30days" | "all"
var trackFilter = "all";     // "all"   | "home"   | "out"

// ── Date formatting helper ──
function formatDateShort(dateStr) {
  var months = ["Jan","Feb","Mar","Apr","May","Jun",
                "Jul","Aug","Sep","Oct","Nov","Dec"];
  var parts = dateStr.split("-");
  var day   = parseInt(parts[2], 10);
  var month = months[parseInt(parts[1], 10) - 1];
  return day + " " + month;
}

// ── Date range filtering ──
function getFilteredLogs() {
  var now = new Date(today());
  var filtered = trackLog;

  if (trackRange === "7days") {
    var cutoff7 = new Date(now);
    cutoff7.setDate(cutoff7.getDate() - 7);
    var cutoffStr7 = cutoff7.toISOString().split("T")[0];
    filtered = filtered.filter(function (entry) {
      return entry.date >= cutoffStr7;
    });
  } else if (trackRange === "30days") {
    var cutoff30 = new Date(now);
    cutoff30.setDate(cutoff30.getDate() - 30);
    var cutoffStr30 = cutoff30.toISOString().split("T")[0];
    filtered = filtered.filter(function (entry) {
      return entry.date >= cutoffStr30;
    });
  }
  // "all" — no date filter

  if (trackFilter === "home") {
    filtered = filtered.filter(function (entry) { return entry.type === "home"; });
  } else if (trackFilter === "out") {
    filtered = filtered.filter(function (entry) { return entry.type === "out"; });
  }

  return filtered;
}

// ── State setters ──
function setTrackRange(range) {
  trackRange = range;
  renderTrack();
}

function setTrackFilter(filter) {
  trackFilter = filter;
  renderTrack();
}

// ── Delete a track entry ──
function deleteTrackEntry(id) {
  var doDelete = function () {
    trackLog = trackLog.filter(function (entry) { return entry.id !== id; });
    saveTrack();
    renderTrack();
    toast("Meal entry deleted");
  };

  if (typeof showConfirm === "function") {
    showConfirm("Delete Entry", "Remove this meal log entry?", doDelete);
  } else {
    if (confirm("Remove this meal log entry?")) {
      doDelete();
    }
  }
}

// ── Grocery functions ──
function logGrocery() {
  var amountEl = document.getElementById("g-amount");
  var amount = parseFloat(amountEl.value);
  if (!amount || amount <= 0) {
    toast("Enter a valid amount");
    return;
  }

  var dateEl = document.getElementById("g-date");
  var noteEl = document.getElementById("g-note");

  var entry = {
    id:     Date.now(),
    date:   dateEl.value || today(),
    amount: amount,
    note:   noteEl.value.trim()
  };

  grocery.unshift(entry);
  saveGrocery();

  amountEl.value = "";
  noteEl.value   = "";

  toast("Grocery entry added");
  renderTrack();
}

function deleteGrocery(id) {
  var doDelete = function () {
    grocery = grocery.filter(function (entry) { return entry.id !== id; });
    saveGrocery();
    renderTrack();
    toast("Grocery entry deleted");
  };

  if (typeof showConfirm === "function") {
    showConfirm("Delete Entry", "Remove this grocery entry?", doDelete);
  } else {
    if (confirm("Remove this grocery entry?")) {
      doDelete();
    }
  }
}

// ── Spending trend chart ──
function renderSpendChart() {
  var now   = new Date(today());
  var bars  = [];
  var i, j, label, total;

  if (trackRange === "30days") {
    // 4 weekly buckets
    for (i = 3; i >= 0; i--) {
      var weekEnd   = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - (i * 7));
      var weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);

      var startStr = weekStart.toISOString().split("T")[0];
      var endStr   = weekEnd.toISOString().split("T")[0];

      total = 0;
      for (j = 0; j < trackLog.length; j++) {
        if (trackLog[j].type === "out" &&
            trackLog[j].date >= startStr &&
            trackLog[j].date <= endStr) {
          total += trackLog[j].cost || 0;
        }
      }

      label = formatDateShort(startStr);
      bars.push({ label: label, value: total });
    }
  } else {
    // Last 7 days
    for (i = 6; i >= 0; i--) {
      var d = new Date(now);
      d.setDate(d.getDate() - i);
      var dayStr = d.toISOString().split("T")[0];

      total = 0;
      for (j = 0; j < trackLog.length; j++) {
        if (trackLog[j].type === "out" && trackLog[j].date === dayStr) {
          total += trackLog[j].cost || 0;
        }
      }

      label = formatDateShort(dayStr);
      bars.push({ label: label, value: total });
    }
  }

  var maxVal = 0;
  for (i = 0; i < bars.length; i++) {
    if (bars[i].value > maxVal) maxVal = bars[i].value;
  }

  if (maxVal === 0) {
    return '<div class="empty">No order spending to chart yet.</div>';
  }

  var barHtml = "";
  for (i = 0; i < bars.length; i++) {
    var pct = Math.round((bars[i].value / maxVal) * 100);
    var height = Math.max(pct, 4); // min 4% so zero bars are still visible as a sliver
    if (bars[i].value === 0) height = 2;

    barHtml +=
      '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">' +
        '<div style="font-size:10px;font-weight:700;color:var(--pri);">' +
          (bars[i].value > 0 ? "₹" + bars[i].value : "") +
        '</div>' +
        '<div style="width:100%;max-width:40px;background:#f5ece0;border-radius:6px 6px 0 0;' +
          'height:120px;display:flex;align-items:flex-end;">' +
          '<div style="width:100%;height:' + height + '%;background:linear-gradient(180deg,var(--pri2),var(--pri));' +
            'border-radius:6px 6px 0 0;min-height:2px;transition:height .3s;"></div>' +
        '</div>' +
        '<div style="font-size:9px;color:#a07050;white-space:nowrap;">' + bars[i].label + '</div>' +
      '</div>';
  }

  return '<div style="display:flex;gap:6px;align-items:flex-end;padding:8px 0;">' + barHtml + '</div>';
}

// ── Meal log ──
function renderMealLog(logs) {
  if (!logs.length) {
    return '<div class="empty">No meal entries for this period.</div>';
  }

  var displayed = logs.slice(0, 50);
  var html = "";

  for (var i = 0; i < displayed.length; i++) {
    var t = displayed[i];
    html +=
      '<div class="track-row">' +
        '<span style="color:#a07050;font-size:11px;min-width:56px;">' + formatDateShort(t.date) + '</span>' +
        '<span class="pill ' + MPILL[t.meal] + '">' + ME[t.meal] + '</span>' +
        '<span class="pill ' + (t.type === "home" ? "phome" : "pout") + '">' +
          (t.type === "home" ? "🏠" : "🛵") +
        '</span>' +
        '<span class="track-dish">' + escapeHtml(t.dish) + '</span>' +
        (t.cost ? '<span style="font-weight:700;color:#c62828;font-size:12px;">₹' + t.cost + '</span>' : '') +
        '<button class="btn-del" onclick="deleteTrackEntry(' + t.id + ')" title="Delete">✕</button>' +
      '</div>' +
      (t.notes ? '<div class="note-txt" style="padding-left:8px;margin-bottom:4px;">📝 ' + escapeHtml(t.notes) + '</div>' : '');
  }

  return html;
}

// ── Main render ──
function renderTrack() {
  var container = document.getElementById("tab-track");
  if (!container) return;

  var logs = getFilteredLogs();

  // Compute stats from filtered logs
  var homeCount = 0;
  var outCount  = 0;
  var outSpend  = 0;
  for (var i = 0; i < logs.length; i++) {
    if (logs[i].type === "home") homeCount++;
    if (logs[i].type === "out") {
      outCount++;
      outSpend += logs[i].cost || 0;
    }
  }

  // Grocery spend (always computed from full grocery array, filtered by range)
  var grocerySpend = 0;
  var now = new Date(today());
  for (var g = 0; g < grocery.length; g++) {
    var include = true;
    if (trackRange === "7days") {
      var cut7 = new Date(now);
      cut7.setDate(cut7.getDate() - 7);
      include = grocery[g].date >= cut7.toISOString().split("T")[0];
    } else if (trackRange === "30days") {
      var cut30 = new Date(now);
      cut30.setDate(cut30.getDate() - 30);
      include = grocery[g].date >= cut30.toISOString().split("T")[0];
    }
    if (include) grocerySpend += grocery[g].amount || 0;
  }

  // Period label for summary
  var periodLabel = "week";
  if (trackRange === "30days") periodLabel = "month";
  if (trackRange === "all")    periodLabel = "period";

  // ── Build HTML ──
  var html = "";

  // 1. Date range picker pills
  html +=
    '<div class="card">' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
        '<button class="btn-outline' + (trackRange === "7days"  ? " active" : "") + '" onclick="setTrackRange(\'7days\')">Last 7 days</button>' +
        '<button class="btn-outline' + (trackRange === "30days" ? " active" : "") + '" onclick="setTrackRange(\'30days\')">This month</button>' +
        '<button class="btn-outline' + (trackRange === "all"    ? " active" : "") + '" onclick="setTrackRange(\'all\')">All time</button>' +
      '</div>' +
    '</div>';

  // 2. Natural language summary
  html += '<div class="card">';
  if (logs.length === 0 && homeCount === 0 && outCount === 0) {
    html += '<div style="font-size:14px;color:#a07050;font-style:italic;">No meals logged yet. Start tracking from the Today tab!</div>';
  } else {
    html +=
      '<div style="font-size:14px;color:#2d1a0e;line-height:1.6;">' +
        'You cooked <strong>' + homeCount + '</strong> meal' + (homeCount !== 1 ? 's' : '') +
        ' and ordered <strong>' + outCount + '</strong> this ' + periodLabel + '.' +
        (outSpend > 0 ? ' Spent <strong>₹' + outSpend.toFixed(0) + '</strong> on orders.' : '') +
      '</div>';
  }
  html += '</div>';

  // 3. Stats grid (4 boxes)
  var stats = [
    { label: "Home Cooked", value: homeCount,                          unit: "meals" },
    { label: "Ordered Out",  value: outCount,                           unit: "times" },
    { label: "Order Spend",  value: "₹" + outSpend.toFixed(0),     unit: ""      },
    { label: "Grocery Spend",value: "₹" + grocerySpend.toFixed(0), unit: ""      }
  ];

  html += '<div class="stats-grid" id="stats-grid">';
  for (var s = 0; s < stats.length; s++) {
    html +=
      '<div class="stat-box">' +
        '<div class="stat-num">' + stats[s].value + '</div>' +
        (stats[s].unit ? '<div class="stat-unit">' + stats[s].unit + '</div>' : '') +
        '<div class="stat-lbl">' + stats[s].label + '</div>' +
      '</div>';
  }
  html += '</div>';

  // 4. Spending trend bar chart
  html +=
    '<div class="card">' +
      '<h3>📈 Spending Trend</h3>' +
      renderSpendChart() +
    '</div>';

  // 5. Grocery section
  html +=
    '<div class="card">' +
      '<h3>🛒 Log Grocery Spend</h3>' +
      '<div class="form-row">' +
        '<div class="fc">' +
          '<label class="lbl">Date</label>' +
          '<input type="date" id="g-date" value="' + today() + '"/>' +
        '</div>' +
        '<div class="fc">' +
          '<label class="lbl">Amount (₹)</label>' +
          '<input type="number" id="g-amount" placeholder="0"/>' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="lbl">Note (optional)</label>' +
        '<input type="text" id="g-note" placeholder="e.g. weekly vegetables, rice…"/>' +
      '</div>' +
      '<button class="btn" onclick="logGrocery()">Add Entry</button>';

  // Recent grocery entries (last 10)
  if (grocery.length > 0) {
    html +=
      '<div class="divider"></div>' +
      '<div style="font-size:11px;font-weight:700;color:#8c5a30;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;">Recent Entries</div>';

    var recentGrocery = grocery.slice(0, 10);
    for (var rg = 0; rg < recentGrocery.length; rg++) {
      var ge = recentGrocery[rg];
      html +=
        '<div class="track-row">' +
          '<span style="color:#a07050;font-size:12px;min-width:56px;">' + formatDateShort(ge.date) + '</span>' +
          '<span style="flex:1;">' + escapeHtml(ge.note || "Groceries") + '</span>' +
          '<span style="font-weight:700;color:#2e7d32;">₹' + ge.amount + '</span>' +
          '<button class="btn-del" onclick="deleteGrocery(' + ge.id + ')" title="Delete">✕</button>' +
        '</div>';
    }
  }

  html += '</div>'; // close grocery card

  // 6. Meal log with filter pills
  html +=
    '<div class="card" id="meal-log-card">' +
      '<h3>📋 Meal Log</h3>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">' +
        '<button class="btn-outline' + (trackFilter === "all"  ? " active" : "") + '" onclick="setTrackFilter(\'all\')">All</button>' +
        '<button class="btn-outline' + (trackFilter === "home" ? " active" : "") + '" onclick="setTrackFilter(\'home\')">Home Cooked</button>' +
        '<button class="btn-outline' + (trackFilter === "out"  ? " active" : "") + '" onclick="setTrackFilter(\'out\')">Ordered Out</button>' +
      '</div>' +
      renderMealLog(logs) +
    '</div>';

  // 7. Export / Import / Clear section
  html +=
    '<div class="card">' +
      '<h3>📦 Data Management</h3>' +
      '<div style="display:flex;flex-direction:column;gap:10px;">' +
        '<button class="btn" onclick="exportAllData()" style="width:100%;">' +
          '📥 Export All Data' +
        '</button>' +
        '<div>' +
          '<input type="file" id="import-file-input" accept=".json" style="display:none;" ' +
            'onchange="handleImportFile(this)"/>' +
          '<button class="btn-outline" style="width:100%;" ' +
            'onclick="document.getElementById(\'import-file-input\').click()">' +
            '📤 Import Data' +
          '</button>' +
        '</div>' +
        '<button class="btn" onclick="clearAllData()" ' +
          'style="width:100%;background:#c0392b;margin-top:4px;">' +
          '🗑 Clear All Data' +
        '</button>' +
      '</div>' +
    '</div>';

  container.innerHTML = html;
}

// ── Import file handler ──
function handleImportFile(input) {
  if (!input.files || !input.files[0]) return;

  importData(input.files[0]).then(function () {
    // Reload globals after import
    trackLog = lsGet(K.TRACK, []);
    grocery  = lsGet(K.GROCERY, []);
    renderTrack();
  }).catch(function () {
    // importData already toasts the error
  });

  // Reset the file input so the same file can be re-selected
  input.value = "";
}

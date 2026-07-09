import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createIdbStore } from './lib/store-idb.js';
import { createAuth } from './lib/auth.js';
import { createDriveClient } from './lib/drive.js';
import { createSyncEngine } from './lib/sync.js';
import { newItem } from './lib/merge.js';
import { getMode, applyMode } from './lib/theme.js';
import { canInstall, wasInstalled, isStandalone, isIOS, subscribeInstall, promptInstall } from './lib/pwaInstall.js';
import { CUISINES, expandCuisines, DIET_ALLOWED, seedCuisine, exportAll, importAll } from './lib/model.js';
import { localDateStr, weekDates, dayLabel } from './lib/dates.js';

import Today from './tabs/Today.jsx';
import Plan from './tabs/Plan.jsx';
import Cook from './tabs/Cook.jsx';
import Track from './tabs/Track.jsx';

const store = createIdbStore();

// Long-press to enter multi-select; a normal tap runs onClick. A press that
// crosses the hold threshold suppresses the click that follows it.
function useLongPress(onLong, onClick) {
  const timer = useRef(null);
  const fired = useRef(false);
  const start = () => { fired.current = false; timer.current = setTimeout(() => { fired.current = true; onLong(); }, 450); };
  const cancel = () => clearTimeout(timer.current);
  return {
    onPointerDown: start, onPointerUp: cancel, onPointerLeave: cancel, onPointerMove: cancel,
    onClick: (e) => { if (fired.current) { e.preventDefault(); e.stopPropagation(); return; } onClick(e); },
  };
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" />
      </svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && <button className="search-x" aria-label="Clear search" onClick={() => onChange('')}>&#x2715;</button>}
    </div>
  );
}

// Group items by date field (log.date or created_at fallback), newest first.
const startOfDay = (ts) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
function dayHeading(ts) {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return new Date(ts).toLocaleDateString(undefined, { weekday: 'long' });
  const d = new Date(ts);
  const opts = d.getFullYear() === new Date().getFullYear()
    ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' };
  return d.toLocaleDateString(undefined, opts);
}
function groupByDate(items) {
  const dateTs = (i) => {
    if (i.date) { const d = new Date(i.date + 'T00:00:00'); return d.getTime(); }
    return i.created_at || i.updated_at;
  };
  const sorted = [...items].sort((a, b) => dateTs(b) - dateTs(a));
  const groups = [];
  let cur = null;
  for (const it of sorted) {
    const key = startOfDay(dateTs(it));
    if (!cur || cur.key !== key) { cur = { key, label: dayHeading(dateTs(it)), items: [] }; groups.push(cur); }
    cur.items.push(it);
  }
  return groups;
}

// The owner's OAuth Client ID (public by design -- it only identifies the app
// to Google; access still requires signing in to the matching account).
// Empty by default -- shows SetupScreen until the owner bakes one in.
const DEFAULT_CLIENT_ID = '934726535844-mu79uunbbckj8v67i3gb5vk619grn86o.apps.googleusercontent.com';

/* Aduppu mark -- a stroke-based SVG clay pot on three hearth stones with a
   three-tongue flame above, in accent. Legible at 16px. Uses currentColor
   for the pot/stones and var(--accent) for the flame. */
function Logo({ size = 30 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* Three hearth stones */}
      <ellipse cx="14" cy="56" rx="7" ry="4" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <ellipse cx="32" cy="58" rx="7" ry="4" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <ellipse cx="50" cy="56" rx="7" ry="4" fill="none" stroke="currentColor" strokeWidth="2.2" />
      {/* Clay pot body */}
      <path d="M18 50 Q18 38 22 32 Q26 26 32 26 Q38 26 42 32 Q46 38 46 50 Z"
            fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      {/* Pot rim */}
      <path d="M16 50 Q16 48 18 48 L46 48 Q48 48 48 50"
            fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      {/* Pot handles */}
      <path d="M18 40 Q12 40 14 46" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M46 40 Q52 40 50 46" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Three-tongue flame */}
      <path d="M32 24 Q30 18 32 10 Q34 18 32 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      <path d="M27 24 Q26 19 28 14 Q30 19 28 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M37 24 Q38 19 36 14 Q34 19 36 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const CalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" strokeLinecap="round" />
  </svg>
);

const STATUS_LABEL = {
  'local only': 'local', syncing: 'syncing...', synced: 'synced',
  offline: 'offline', 'sign in to sync': 'tap to sync', 'update-needed': 'update app',
};

// Diet card data for onboarding and settings.
const DIET_OPTIONS = [
  { key: 'veg', label: 'Vegetarian', color: '#2e7d32' },
  { key: 'veg-egg', label: 'Veg + Egg', color: '#f9a825' },
  { key: 'all', label: 'Everything', color: '#c62828' },
];

export default function App() {
  const [clientId, setClientId] = useState(() => localStorage.getItem('ad_client_id') || DEFAULT_CLIENT_ID);
  const [signedIn, setSignedIn] = useState(false);
  const [status, setStatus] = useState('local only');
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('today'); // 'today' | 'plan' | 'cook' | 'track' | 'settings'
  const [mode, setMode] = useState(getMode);
  const [query, setQuery] = useState('');
  const [undoToast, setUndoToast] = useState(null); // { item, timer }
  const [toast, setToast] = useState(null); // simple text toast for seeding feedback
  // First sync completion flag -- for onboarding gate (signed-in users wait
  // for first sync so existing Drive prefs skip the onboarding screen).
  const [firstSyncDone, setFirstSyncDone] = useState(false);
  // First-run sign-in gate: shown only when the user has neither signed in
  // before nor chosen to skip.
  const [showSignIn, setShowSignIn] = useState(() =>
    localStorage.getItem('ad_signed_in') !== '1' && localStorage.getItem('ad_skip_signin') !== '1');

  const goTab = (t) => { setQuery(''); setTab(t); };

  const { auth, engine } = useMemo(() => {
    if (!clientId) return {};
    const auth = createAuth(clientId);
    const drive = createDriveClient({ getToken: () => auth.getToken() });
    const engine = createSyncEngine({
      store,
      drive,
      onStatus: (s) => {
        if (s === 'auth-needed') { setSignedIn(false); setStatus('sign in to sync'); return; }
        setStatus(s);
        if (s === 'synced') { setSignedIn(true); setFirstSyncDone(true); refresh(); }
      },
    });
    return { auth, drive, engine };
  }, [clientId]);

  const refresh = useCallback(async () => {
    const all = await store.allItems();
    setItems(all);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!auth?.isSignedIn()) {
      // Not signed in -- mark first sync done so local-only users skip
      // the sync wait in the onboarding gate.
      setFirstSyncDone(true);
      return;
    }
    setSignedIn(true);
    localStorage.setItem('ad_signed_in', '1');
    const tick = () => engine.sync().then(() => engine.gc()).then(refresh).catch(() => {});
    tick();
    const t = setInterval(tick, 30000);
    window.addEventListener('focus', tick);
    return () => { clearInterval(t); window.removeEventListener('focus', tick); };
  }, [auth, engine, refresh]);

  function setAppMode(m) { applyMode(m); setMode(m); }

  async function saveItem(partial) {
    const existing = partial.id ? await store.getItem(partial.id) : null;
    const item = { ...(existing || newItem({})), ...partial, updated_at: Date.now(), dirty: 1 };
    await store.putItem(item);
    engine?.schedule();
    await refresh();
    return item;
  }

  // Delete with undo toast: tombstone immediately, show toast for 5s.
  // One toast at a time -- new delete replaces the old one.
  function deleteWithUndo(item) {
    // Clear any existing undo toast
    if (undoToast) clearTimeout(undoToast.timer);

    // Tombstone immediately
    saveItem({ id: item.id, deleted: true, deleted_at: Date.now() });

    const timer = setTimeout(() => setUndoToast(null), 5000);
    setUndoToast({
      item,
      timer,
    });
  }

  function undoDelete() {
    if (!undoToast) return;
    clearTimeout(undoToast.timer);
    saveItem({ id: undoToast.item.id, deleted: false, deleted_at: null });
    setUndoToast(null);
  }

  async function signIn() {
    try {
      await auth.signIn();
      setSignedIn(true);
      setShowSignIn(false);
      localStorage.setItem('ad_signed_in', '1');
      engine.sync();
    } catch (e) {
      setStatus('sign-in failed: ' + e.message);
    }
  }

  function skipSignIn() {
    localStorage.setItem('ad_skip_signin', '1');
    setShowSignIn(false);
  }

  function signOut() {
    auth.signOut();
    setSignedIn(false);
    setStatus('local only');
    localStorage.removeItem('ad_skip_signin');
    localStorage.removeItem('ad_signed_in');
    setShowSignIn(true);
  }

  // --- Derived state ---
  const dishes = useMemo(() => items.filter((i) => i.type === 'dish' && !i.deleted), [items]);
  const plans = useMemo(() => items.filter((i) => i.type === 'plan' && !i.deleted), [items]);
  const logs = useMemo(() => items.filter((i) => i.type === 'log' && !i.deleted), [items]);
  const groceryItems = useMemo(() => items.filter((i) => i.type === 'grocery' && !i.deleted), [items]);
  const pantryItem = useMemo(() => items.find((i) => i.id === 'pantry') || null, [items]);
  const prefsItem = useMemo(() => items.find((i) => i.id === 'prefs') || null, [items]);

  // --- Gates ---
  if (!clientId) return <SetupScreen onSave={(id) => { localStorage.setItem('ad_client_id', id); setClientId(id); }} />;
  if (showSignIn) return <SignInScreen onSignIn={signIn} onSkip={skipSignIn} status={status} />;

  // Onboarding gate: show when no prefs item exists locally.
  // For signed-in users, only after first sync completes (existing Drive prefs = reinstall: skip).
  const needsOnboarding = !prefsItem && firstSyncDone;
  if (needsOnboarding) {
    return (
      <OnboardingScreen
        saveItem={saveItem}
        store={store}
        engine={engine}
        refresh={refresh}
      />
    );
  }

  const statusKey = status.split(' ')[0];

  const tabProps = { items, dishes, plans, logs, groceryItems, pantryItem, prefsItem, saveItem, deleteWithUndo };

  return (
    <div className="shell">
      <header className="hdr">
        <div className="hdr-inner">
          <a className="brand" href="#" onClick={(e) => { e.preventDefault(); goTab('today'); }}>
            <Logo size={30} />
            <span className="word">Aduppu</span>
          </a>
          <span className="spacer" />
          <span className={'status ' + statusKey}>{STATUS_LABEL[status] || status}</span>
          <button
            className={'gear' + (tab === 'settings' ? ' active' : '')}
            aria-label="Settings"
            onClick={() => goTab('settings')}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M12 2.5v2.5M12 19v2.5M4.2 6.5l1.8 1.8M18 15.7l1.8 1.8M2.5 12H5M19 12h2.5M4.2 17.5l1.8-1.8M18 8.3l1.8-1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {tab === 'today' && <main className="screen"><Today {...tabProps} /></main>}
      {tab === 'plan' && <main className="screen"><Plan {...tabProps} /></main>}
      {tab === 'cook' && <main className="screen"><Cook {...tabProps} /></main>}
      {tab === 'track' && <main className="screen"><Track {...tabProps} /></main>}

      {tab === 'settings' && (
        <Settings
          mode={mode} setAppMode={setAppMode}
          signedIn={signedIn} status={status} statusKey={statusKey}
          onSignIn={signIn} onSignOut={signOut}
          items={items} dishes={dishes}
          prefsItem={prefsItem} saveItem={saveItem}
          store={store} engine={engine} refresh={refresh}
        />
      )}

      <nav className="tabs" aria-label="Sections">
        <div className="tabs-inner">
          <button className={'tab' + (tab === 'today' ? ' on' : '')} onClick={() => goTab('today')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <circle cx="12" cy="16" r="5" />
              <path d="M12 2v3M4.2 7.8l2.1 2.1M19.8 7.8l-2.1 2.1M2 16h3M19 16h3" strokeLinecap="round" />
            </svg>
            TODAY
          </button>
          <button className={'tab' + (tab === 'plan' ? ' on' : '')} onClick={() => goTab('plan')}>
            <CalIcon />
            PLAN
          </button>
          <button className={'tab' + (tab === 'cook' ? ' on' : '')} onClick={() => goTab('cook')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M5 18h14" strokeLinecap="round" />
              <path d="M5 18c0-5 2-8 7-8s7 3 7 8" />
              <path d="M8 10V7M12 10V5M16 10V7" strokeLinecap="round" />
            </svg>
            COOK
          </button>
          <button className={'tab' + (tab === 'track' ? ' on' : '')} onClick={() => goTab('track')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M3 20l5-7 4 4 5-9 4 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            TRACK
          </button>
        </div>
      </nav>

      {/* Undo toast */}
      {undoToast && (
        <div className="undo-toast">
          <span>Deleted {undoToast.item.name || undoToast.item.title || 'item'}</span>
          <button className="btn" onClick={undoDelete}>Undo</button>
        </div>
      )}

      {/* Simple text toast for seeding feedback */}
      {toast && (
        <div className="toast">{toast}</div>
      )}
    </div>
  );
}

// ---- Onboarding Screen ----

function OnboardingScreen({ saveItem, store, engine, refresh }) {
  const [step, setStep] = useState(1);
  const [diet, setDiet] = useState(null); // 'veg' | 'veg-egg' | 'all'
  const [selectedCuisines, setSelectedCuisines] = useState(new Set());
  const [expandedRegion, setExpandedRegion] = useState(null);
  const [busy, setBusy] = useState(false);

  // Pickable cuisines (exclude 'other' -- no seeds, not pickable at onboarding)
  const pickable = CUISINES.filter((c) => c.key !== 'other');

  function toggleCuisine(key) {
    setSelectedCuisines((prev) => {
      const next = new Set(prev);
      const region = pickable.find((c) => c.key === key);
      if (region) {
        // Toggling a region key
        if (next.has(key)) {
          next.delete(key);
          // Also remove any subs of this region
          if (region.subs) region.subs.forEach((s) => next.delete(s.key));
        } else {
          next.add(key);
          // Selecting region = all its subs
          if (region.subs) region.subs.forEach((s) => next.add(s.key));
        }
      } else {
        // Toggling a sub key
        const parent = pickable.find((c) => c.subs?.some((s) => s.key === key));
        if (next.has(key)) {
          next.delete(key);
          // If no subs remain, remove the parent region too
          if (parent && parent.subs.every((s) => !next.has(s.key))) {
            next.delete(parent.key);
          }
        } else {
          next.add(key);
          // Add parent region key (region-level dishes are the common base)
          if (parent) next.add(parent.key);
          // If all subs are now selected, that's fine -- equivalent to region
        }
      }
      return next;
    });
  }

  async function finish() {
    if (busy) return;
    setBusy(true);
    try {
      // Create prefs item
      const cuisineKeys = [...selectedCuisines];
      await saveItem({
        id: 'prefs',
        type: 'prefs',
        diet,
        cuisines: cuisineKeys,
      });

      // Seed each selected cuisine key (diet-filtered)
      const expanded = expandCuisines(cuisineKeys);
      for (const key of expanded) {
        await seedCuisine(store, key, diet);
      }

      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-inner">
        <div className="signin-brand">
          <Logo size={52} />
          <span className="word big">Aduppu</span>
        </div>

        {step === 1 && (
          <div className="onboard-step">
            <h2 className="onboard-heading">How do you eat?</h2>
            <div className="diet-cards">
              {DIET_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  className={'diet-card' + (diet === opt.key ? ' selected' : '')}
                  onClick={() => setDiet(opt.key)}
                >
                  <span className="diet-dot" style={{ backgroundColor: opt.color }} />
                  <span className="diet-label">{opt.label}</span>
                </button>
              ))}
            </div>
            <button
              className="btn accent wide"
              disabled={!diet}
              onClick={() => setStep(2)}
            >
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="onboard-step">
            <h2 className="onboard-heading">Which cuisines do you cook?</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              Pick your favourites — Aduppu seeds each one with everyday dishes. You can change this anytime in Settings.
            </p>
            <CuisinePicker
              pickable={pickable}
              selected={selectedCuisines}
              expandedRegion={expandedRegion}
              setExpandedRegion={setExpandedRegion}
              onToggle={toggleCuisine}
            />
            <div className="onboard-nav">
              <button className="btn ghost" onClick={() => setStep(1)}>Back</button>
              <button
                className="btn accent wide"
                disabled={selectedCuisines.size === 0 || busy}
                onClick={finish}
              >
                {busy ? 'Setting up...' : 'Continue'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Shared Cuisine Picker ----

function CuisinePicker({ pickable, selected, expandedRegion, setExpandedRegion, onToggle, className }) {
  return (
    <div className={'cuisine-cards' + (className ? ' ' + className : '')}>
      {pickable.map((region) => {
        const hasSubs = region.subs && region.subs.length > 0;
        const regionOn = selected.has(region.key);
        const expanded = expandedRegion === region.key;
        const subsOn = hasSubs ? region.subs.filter((s) => selected.has(s.key)) : [];
        const allSubsOn = hasSubs && subsOn.length === region.subs.length;
        const someSubsOn = subsOn.length > 0 && !allSubsOn;

        const checkClass = (regionOn || allSubsOn) ? 'on' : someSubsOn ? 'partial' : '';

        return (
          <div key={region.key} className="cuisine-group">
            <div className="cuisine-row" onClick={() => onToggle(region.key)}>
              <span className={'cuisine-check ' + checkClass}>
                {(regionOn || allSubsOn || someSubsOn) ? '✓' : ''}
              </span>
              <span className="cuisine-name">{region.label}</span>
              {hasSubs && (
                <span className="cuisine-hint">
                  {subsOn.length > 0
                    ? subsOn.map((s) => s.label).join(', ')
                    : region.subs.slice(0, 2).map((s) => s.label).join(', ') + '…'}
                </span>
              )}
              {hasSubs && (
                <span
                  className={'cuisine-chev' + (expanded ? ' open' : '')}
                  onClick={(e) => { e.stopPropagation(); setExpandedRegion(expanded ? null : region.key); }}
                >
                  ▾
                </span>
              )}
            </div>
            {hasSubs && expanded && (
              <div className="sub-list">
                {region.subs.map((sub) => (
                  <div key={sub.key} className="sub-row" onClick={() => onToggle(sub.key)}>
                    <span className={'sub-check' + (selected.has(sub.key) ? ' on' : '')}>
                      {selected.has(sub.key) ? '✓' : ''}
                    </span>
                    <span>{sub.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- Settings Screen ----

function Settings({ mode, setAppMode, signedIn, status, statusKey, onSignIn, onSignOut, items, dishes, prefsItem, saveItem, store, engine, refresh }) {
  const [, bumpInstall] = useState(0);
  const installed = wasInstalled() || isStandalone();
  const installable = canInstall();
  const [storage, setStorage] = useState(null);
  const [toast, setToast] = useState(null);
  const [expandedRegion, setExpandedRegion] = useState(null);

  const itemCount = items.filter((i) => !i.deleted).length;

  useEffect(() => {
    const unsub = subscribeInstall(() => bumpInstall((n) => n + 1));
    (async () => {
      try {
        const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
        const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
        setStorage({ persisted, usedMB: est?.usage ? (est.usage / 1048576).toFixed(1) : null });
      } catch { /* unsupported */ }
    })();
    return unsub;
  }, []);

  async function keepData() {
    try { const ok = await navigator.storage.persist(); setStorage((s) => ({ ...s, persisted: ok })); } catch { /* blocked */ }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Diet editing: widening triggers re-seed with toast.
  const DIET_RANK = { veg: 0, 'veg-egg': 1, all: 2 };
  async function changeDiet(newDiet) {
    if (!prefsItem || prefsItem.diet === newDiet) return;
    const widened = DIET_RANK[newDiet] > DIET_RANK[prefsItem.diet];
    await saveItem({ id: 'prefs', diet: newDiet });
    if (widened) {
      // Re-seed all enabled cuisines for the wider diet
      const expanded = expandCuisines(prefsItem.cuisines || []);
      for (const key of expanded) {
        await seedCuisine(store, key, newDiet);
      }
      await refresh();
      showToast('Diet widened -- new dishes added to your catalog.');
    }
  }

  // Cuisine editing: enabling new cuisine triggers seeding with toast.
  const currentCuisines = new Set(prefsItem?.cuisines || []);
  const pickable = CUISINES.filter((c) => c.key !== 'other');

  async function toggleSettingsCuisine(key) {
    if (!prefsItem) return;
    const prev = new Set(prefsItem.cuisines || []);
    const next = new Set(prev);
    const region = pickable.find((c) => c.key === key);

    if (region) {
      if (next.has(key)) {
        next.delete(key);
        if (region.subs) region.subs.forEach((s) => next.delete(s.key));
      } else {
        next.add(key);
        if (region.subs) region.subs.forEach((s) => next.add(s.key));
      }
    } else {
      const parent = pickable.find((c) => c.subs?.some((s) => s.key === key));
      if (next.has(key)) {
        next.delete(key);
        if (parent && parent.subs.every((s) => !next.has(s.key))) {
          next.delete(parent.key);
        }
      } else {
        next.add(key);
        if (parent) next.add(parent.key);
      }
    }

    // Minimum 1 cuisine
    if (next.size === 0) return;

    const newKeys = [...next];
    await saveItem({ id: 'prefs', cuisines: newKeys });

    // Seed any newly added cuisine keys
    const added = newKeys.filter((k) => !prev.has(k));
    if (added.length > 0) {
      const diet = prefsItem.diet || 'all';
      for (const k of added) {
        await seedCuisine(store, k, diet);
      }
      await refresh();
      showToast('New cuisine added -- dishes seeded.');
    }
  }

  async function reseedAll() {
    if (!prefsItem) return;
    const diet = prefsItem.diet || 'all';
    const allKeys = expandCuisines(prefsItem.cuisines || []);
    let total = 0;
    for (const key of allKeys) {
      total += await seedCuisine(store, key, diet);
    }
    await refresh();
    showToast(total > 0 ? `Seeded ${total} new dishes.` : 'All cuisines already seeded.');
  }

  async function handleExport() {
    try {
      const blob = await exportAll(store);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aduppu-backup-${localDateStr()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup exported.');
    } catch (e) {
      showToast('Export failed: ' + e.message);
    }
  }

  async function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const result = await importAll(store, json);
        engine?.schedule();
        await refresh();
        showToast(`Imported ${result.imported} item${result.imported === 1 ? '' : 's'}.`);
      } catch (err) {
        showToast('Import failed: ' + err.message);
      }
    };
    input.click();
  }

  return (
    <main className="screen">
      <span className="eyebrow">Settings</span>

      <div className="card set-card">
        <span className="eyebrow">Appearance</span>
        <div className="toggle">
          {[['paper', 'Paper'], ['dark', 'Lights out']].map(([m, label]) => (
            <button key={m} className={mode === m ? 'on' : ''} onClick={() => setAppMode(m)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="card set-card">
        <span className="eyebrow">Diet</span>
        <div className="diet-cards settings">
          {DIET_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={'diet-card' + (prefsItem?.diet === opt.key ? ' selected' : '')}
              onClick={() => changeDiet(opt.key)}
            >
              <span className="diet-dot" style={{ backgroundColor: opt.color }} />
              <span className="diet-label">{opt.label}</span>
            </button>
          ))}
        </div>
        <p className="lead" style={{ marginTop: 8 }}>Widening your diet preference adds new seed dishes to your catalog.</p>
      </div>

      <div className="card set-card">
        <span className="eyebrow">Cuisines</span>
        <CuisinePicker
          className="settings"
          pickable={pickable}
          selected={currentCuisines}
          expandedRegion={expandedRegion}
          setExpandedRegion={setExpandedRegion}
          onToggle={toggleSettingsCuisine}
        />
        <p className="lead" style={{ marginTop: 8 }}>Enabling a new cuisine seeds its signature dishes into your catalog. Disabling one keeps its dishes in Cook.</p>
        <div className="btn-row">
          <button className="btn" onClick={reseedAll}>Re-seed all cuisines</button>
        </div>
      </div>

      <div className="card set-card">
        <span className="eyebrow">Account &amp; sync</span>
        <div className="set-row">
          <span>Google Drive</span>
          <span className={'status-pill' + (signedIn ? '' : ' off')} style={{ marginLeft: 'auto' }}>
            {signedIn ? (STATUS_LABEL[status] || status) : 'not connected'}
          </span>
        </div>
        <div className="set-row"><span>Stored on this device</span><span className="val">{itemCount} item{itemCount === 1 ? '' : 's'}</span></div>
        <div className="btn-row">
          {signedIn
            ? <button className="btn" onClick={onSignOut}>Sign out</button>
            : <button className="btn accent" onClick={onSignIn}>Connect Google Drive</button>}
        </div>
        <p className="lead" style={{ marginTop: 12 }}>Your data syncs only through your own Drive -- no server of ours ever sees it.</p>
      </div>

      <div className="card set-card">
        <span className="eyebrow">App &amp; storage</span>
        <div className="set-row">
          <span>On this device</span>
          <span className="val">{itemCount} item{itemCount === 1 ? '' : 's'}{storage?.usedMB ? ` · ${storage.usedMB} MB` : ''}</span>
        </div>
        <div className="set-row">
          <span>Install app</span>
          <span className={'status-pill' + (installed ? '' : ' off')} style={{ marginLeft: 'auto' }}>
            {installed ? 'installed' : installable ? 'ready' : 'in browser'}
          </span>
        </div>
        <div className="set-row">
          <span>Offline copy</span>
          <span className={'status-pill' + (storage?.persisted ? '' : ' off')} style={{ marginLeft: 'auto' }}>
            {storage?.persisted ? 'kept' : storage?.persisted === false ? 'best-effort' : '—'}
          </span>
        </div>
        <div className="btn-row">
          {!installed && installable && (
            <button className="btn accent" onClick={() => promptInstall()}>Install app</button>
          )}
          {storage?.persisted === false && <button className="btn" onClick={keepData}>Keep data on device</button>}
        </div>
        <div className="btn-row">
          <button className="btn" onClick={handleExport}>Export backup</button>
          <button className="btn" onClick={handleImport}>Import backup</button>
        </div>
        {!installed && !installable && (
          <p className="lead" style={{ marginTop: 12 }}>
            {isIOS()
              ? 'To install: tap the Share icon in Safari, then "Add to Home Screen".'
              : 'Your browser didn\'t offer an automatic install. In Chrome or Edge, open the menu and choose "Install app", or tap the install icon in the address bar.'}
          </p>
        )}
        <p className="lead" style={{ marginTop: 12 }}>
          {installed ? 'Installed -- runs offline and opens like its own app. ' : 'Works offline once installed. '}
          Your data stays on this device and in your Drive.
        </p>
      </div>

      <div className="card set-card" style={{ color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
        <span className="eyebrow" style={{ marginBottom: 8 }}>About</span>
        Aduppu &mdash; your kitchen's rhythm, planned from your own kitchen, synced through your
        own Google Drive. Data lives in your Drive as plain JSON that outlives the app.
        No accounts of ours, no analytics. <em>&#x0B85;&#x0B9F;&#x0BC1;&#x0BAA;&#x0BCD;&#x0BAA;&#x0BC1;</em> = hearth.
      </div>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

// ---- Sign-in / Setup screens ----

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function SignInScreen({ onSignIn, onSkip, status }) {
  const [busy, setBusy] = useState(false);
  const failed = typeof status === 'string' && status.startsWith('sign-in failed');
  return (
    <div className="signin">
      <div className="signin-inner">
        <div className="signin-brand"><Logo size={62} /><span className="word big">Aduppu</span></div>
        <p className="signin-tag">Your meals, planned from your own kitchen &mdash; synced through your own Google Drive.</p>
        <button
          className="btn google wide"
          disabled={busy}
          onClick={async () => { setBusy(true); await onSignIn(); setBusy(false); }}
        >
          {busy ? 'Connecting...' : <><GoogleG /> Continue with Google</>}
        </button>
        {failed && <p className="error" style={{ textAlign: 'center' }}>{status.replace(/^sign-in failed:\s*/, '') || 'Sign-in didn\'t complete -- try again.'}</p>}
        <button className="btn ghost" onClick={onSkip}>Use without signing in</button>
        <p className="signin-note">Aduppu syncs only through your own Drive -- no server of ours ever sees your data. You can connect later from Settings.</p>
      </div>
    </div>
  );
}

function SetupScreen({ onSave }) {
  const [value, setValue] = useState('');
  return (
    <div className="setup">
      <div className="brand"><Logo size={44} /> <span className="word big">Aduppu</span></div>
      <p>
        One-time setup: this app syncs through <strong>your own Google Drive</strong>, so it
        needs a Google OAuth Client ID you create for yourself. Follow{' '}
        <a href="https://github.com/niceBhaworworksps/Aduppu/blob/main/aduppu/docs/GOOGLE_SETUP.md" target="_blank" rel="noreferrer">
          the setup guide
        </a>{' '}
        (~15 minutes), then paste the Client ID here.
      </p>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="1234567890-abc...apps.googleusercontent.com" />
      <button className="btn accent" disabled={!value.includes('.apps.googleusercontent.com')} onClick={() => onSave(value.trim())}>
        Save
      </button>
      <p className="lead">The Client ID is not a secret -- it only identifies the app to Google. Your data never touches any server except Google Drive.</p>
    </div>
  );
}

export { useLongPress, SearchBar, groupByDate, Logo, CalIcon, STATUS_LABEL, DIET_OPTIONS };

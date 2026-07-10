# Aduppu v3 — UI/UX Review (2026-07-10)

Full review of the shipped app (aduppu.orionforge.dev, branch head `20eb046`),
done by driving the real app at phone size (390×844, both themes, every flow)
plus a read of all view code. Screenshots referenced below live in the review
session; findings are reproducible from a fresh browser profile.

## Verdict

**Do not tear the app down. Rebuild the view layer.**

The foundation — `lib/` (sync engine, Drive client, auth, model/seeds,
randomizer, kitchen matcher, dates), the Worker, PWA plumbing, and the App
shell's data wiring — is sound, tested, and per spec. Every problem found
lives in the ~2,500 lines of presentation code (`tabs/*.jsx`, the render half
of `App.jsx`) and in seed-data quality. Rewriting that layer against the
component spec in PLAN.md §14 is cheaper and safer than continuing to patch:
the bug pattern is systemic (see root causes), so spot fixes will keep
regressing.

## Root causes (why there have been "too many bugs, too many fixes")

1. **The design system was bypassed.** `styles.css` holds the ported Nisaba
   system, but the tabs are built from ad-hoc inline `style={{...}}` objects
   (Today.jsx and Plan.jsx are ~60% inline styles). Every screen re-invents
   spacing, buttons, and rows — so every fix in one place regresses another.
2. **No shared primitives.** `DietDot` is implemented **three times** with
   three different appearances (FSSAI square in Today/Cook, bare circle in
   Plan). There are **three toast systems** (App undo-toast, Today toast,
   Settings toast), **three editing paradigms** (Save/Cancel forms in Today,
   silent save-on-blur in Cook, fake Save buttons in Track), and per-tab
   copies of meal chips and cuisine label lookups.
3. **Spec deviations stacked up.** The red "tap to sync" pill in local mode,
   Today's Fill-day skipping the cuisine ask, missing FSSAI dots in Plan —
   each small deviation multiplied confusion.
4. **Layout math never verified at 390px.** Nested `.screen` wrappers and an
   overflowing week strip shipped because screens weren't screenshot-checked
   on a phone viewport.

---

## A. Broken behaviors (bugs)

| # | Finding | Where |
|---|---------|-------|
| A1 | **Red "tap to sync" pill permanently shown in local-only mode.** User chose "Use without signing in", yet every screen shows an alarm-red pill; it isn't even tappable. Cause: `saveItem()` always calls `engine.schedule()`, sync fails auth, status becomes `sign in to sync`. Spec requires a neutral gray `local` pill. | `App.jsx:188`, `App.jsx:151` |
| A2 | **Double `.screen` nesting on every tab.** App wraps tabs in `<main className="screen">` and each tab renders its own `.screen` — double padding (32px insets on a 390px phone), nested `<main>` elements (invalid HTML). | `App.jsx:295-298` + each tab's root |
| A3 | **Plan week strip overflows the viewport: Sunday and the › arrow are clipped off-screen.** Sunday is unreachable except by tapping the week-overview row. 7 flex-children + 2 arrows don't fit; no wrap/scroll handling. | `Plan.jsx:275-312` |
| A4 | **"✓ had this" lies.** It shows when *any* log exists for that meal — logging an *ordered idli* marks the planned *upma* as "had this". Should compare the log's dish to the planned dish (or at minimum phrase as "logged"). | `Plan.jsx:96-99` |
| A5 | **"Cooked ✓" disappears once any log exists for the meal** — after logging an ordered breakfast you can no longer one-tap-log the planned dish. Condition should be "planned dish not yet logged", not "no logs at all". | `Today.jsx:233` |
| A6 | **Track's edit form has fake Save/Cancel buttons.** Both call `onTap` (just closes). Fields actually save on blur — so "Cancel" doesn't cancel and "Save" doesn't save. | `Track.jsx:572-593` |
| A7 | **"This month" range is actually last-30-days**, and the range toggle governs only stats/groceries — the meal-log calendar below ignores it. Two clashing mental models on one screen. | `Track.jsx:43-47` |
| A8 | **Clear slot / Clear day / Clear week are destructive with no undo and no confirm** — and the slot-✕ sits 28px from the reroll 🎲, so mis-taps silently wipe a chosen meal. `deleteWithUndo` exists but isn't used for plan clears. | `Today.jsx:92-105`, `Plan.jsx:196-209` |
| A9 | **Plan inline edit commits on blur after 200ms** — tapping anywhere saves whatever half-typed text is in the field as the meal (creating phantom dishes with no cuisine/diet). Escape is the only cancel, which doesn't exist on mobile keyboards. | `Plan.jsx:364` |
| A10 | **Kitchen matcher misses obvious matches.** With rice, urad dal, coconut, onion, tomato, toor dal + staples ON, "Can cook now" is empty — Idli/Dosa don't match because seeds use variant vocabulary ("idli rice", "parboiled rice", "black chickpea"). Exact-normalized matching + inconsistent seed vocabulary = the feature's core promise fails. | `kitchen.js` + seed data |
| A11 | **Sub-cuisine selection is indistinguishable from region selection.** Picking only Kerala→Malabar renders Kerala with the same full ✓ as fully-selected Tamil Nadu (the `partial` class exists but still renders "✓" and the accent fill). | `App.jsx:505-511` |
| A12 | **Today's "Fill day" never asks the cuisine** (spec: both fill actions open the ask sheet). Plan's does. Same button, two behaviors. | `Today.jsx:107-123` |
| A13 | Today card titles are single-line `nowrap` ellipsis ("Malabar Parotta …") with no way to read the full name; Plan wraps the same name to 4 lines. Both extremes are wrong (truncate ↔ ragged cards). | `Today.jsx:217`, `Plan.jsx` meal rows |
| A14 | The summary strip renders "Home **0** cooked  Order **1** ordered  Spent **120**" — broken grammar, duplicated words, missing ₹. | `Today.jsx:333-339` |
| A15 | Toasts overlap content (fixed at `bottom: 90` over the summary card) and three different toast implementations behave differently. | `Today.jsx:345`, `App.jsx:342-352`, `Settings` |

## B. Unintuitive interactions

- **B1 — "Cooked ✓" is a tiny green text link**, easy to miss and reads as a
  *status label*, not the app's most important action. It deserves a real
  button.
- **B2 — Three editing paradigms.** Today: tap row → inline form with
  Save/Cancel. Cook: expand card → fields that silently save on blur (no
  feedback whatsoever). Track: form with fake buttons (A6). The user can never
  predict what tapping/typing will do. One editing model is needed.
- **B3 — Cook's expanded card is a database form** (five labelled fields +
  dropdown + tags input) crammed between list rows. Browsing and editing are
  interleaved; expanding shoves the list around.
- **B4 — "Log it" (Kitchen mode) writes a log instantly** — no meal/mode/cost
  ask, no toast, no undo. Users won't know it worked or what it did.
- **B5 — Today's hero button is "Fill day"** — planning, on the logging
  screen, duplicating Plan's job and pushing the actual daily action (log
  what you ate) below the fold of attention.
- **B6 — Emoji as icons** (🎲 dice, 📋 clipboard) in an otherwise stroke-icon
  system; color emoji glare, especially in dark mode, and read as buttons
  inconsistently.
- **B7 — Onboarding**: no step indicator (1 of 2), the diet step floats in
  dead space mid-screen, tapping a region row toggles selection while the
  chevron expands — many users will tap the row *expecting* expansion and
  accidentally select everything. Sub-list opening pushes the whole page.
- **B8 — Week overview rows** truncate dishes to uselessness ("Appam …",
  "Malaba…") and give no hint they're tappable.
- **B9 — Grocery composer** leads with a date field (should default to today
  and be tucked away); "Add" with an invalid amount silently does nothing.
- **B10 — Cuisine-ask sheet** has no title context ("Fill *Friday*…"), no
  cancel affordance beyond tapping the scrim, and its "Mix" pill is
  pre-highlighted in a way that reads as *already applied*.
- **B11 — Accessibility**: many tap-targets are `div onClick` (cuisine rows,
  log rows, suggestion rows) — no keyboard/focus/ARIA; small ✕ targets;
  muted-on-paper text at 11px in several places.

## C. Visual / design-system drift

- Diet dots: three variants (bordered FSSAI square vs bare circle); sizes
  vary 10–14px; Plan's version isn't FSSAI at all (A11 cousin).
- The onboarding diet cards use raw hex greens/reds that don't participate in
  the theme (fine for FSSAI, but the *card* selection state uses them too).
- Spacing rhythm differs per tab (inline margins 4/6/8/10/12/14/16/20/24
  are all present); cards-in-cards on Today (logged rows) use a different
  radius+background than the same rows on Track.
- The date heading uses the display font at 24px/700 — heavier than anything
  in Nisaba's hierarchy; competes with the wordmark directly above it.
- `EDITOR_INPUT` is a JS style object because "no dedicated CSS class exists"
  (its own comment admits the drift) — form inputs differ between Cook and
  the `form-input` class used elsewhere.
- Kitchen "Can cook now" green left-border is a new one-off accent device.

## D. Content (seed data) quality

Trust in the whole app hinges on the seeds being *right*. Spot checks found:
- Wrong cuisine tags ("Roti with Dal" as Tamil Nadu).
- Wrong meal slots (Puttu with Pazhampori as *dinner*; Kerala Parotta with
  egg tagged breakfast).
- Odd ingredient lists ("Paniyaram — Need: carrot").
- Vocabulary inconsistency that breaks matching (A10): "black chickpea" vs
  "kadala", "rice" vs "idli rice" vs "rice flour" unnormalized across dishes.
A native-speaker-level QA pass over all ~350 seeds (cuisine, meal, diet,
ingredient vocabulary) is required — this is as important as any code fix.

## E. What's working (keep as-is)

- Architecture and data layer: sync, Drive, auth flows, IDB, export/import.
- Onboarding *flow order* (sign-in → diet → cuisines) and seeding mechanics.
- The overall visual identity: paper/dark themes, terracotta, logo, wordmark,
  FSSAI dots (where correctly rendered), stat tiles, Settings layout.
- Cuisine-ask sheet concept, calendar heat-dots on Track, bulk-select on logs.

---

# The fix: PLAN.md §14

PLAN.md §14 (added alongside this review) is the implementation spec for the
view-layer rebuild: shared primitives, one editing model, per-screen
redlines, the seed QA pass, and an acceptance checklist that requires
phone-viewport screenshots of every screen in both themes before the work is
called done. Implementer: read this file for the *why*, §14 for the *what*.

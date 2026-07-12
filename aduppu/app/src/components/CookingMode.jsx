/* CookingMode — full-screen step checklist for cooking a planned dish (§16.3).
   Large glanceable type, tappable steps, collapsible ingredient quantities,
   best-effort screen wake-lock. Ticked state is transient (not persisted). */

import { useState, useEffect, useRef, useCallback } from 'react';
import IconButton from './IconButton.jsx';
import { ChevronDownIcon, CheckIcon } from './Icons.jsx';

export default function CookingMode({ dishName, recipe, onClose, onCooked }) {
  const steps = recipe?.steps || [];
  const ingredients = recipe?.ingredients_full || [];

  const [ticked, setTicked] = useState(() => new Set());
  const [ingOpen, setIngOpen] = useState(true);
  const wakeRef = useRef(null);

  /* Screen wake-lock: best-effort, re-acquired when the tab returns visible
     (locks drop while the page is hidden). */
  useEffect(() => {
    let cancelled = false;

    const acquire = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          const lock = await navigator.wakeLock.request('screen');
          if (cancelled) { try { await lock.release(); } catch { /* ignore */ } }
          else wakeRef.current = lock;
        }
      } catch { /* unsupported or denied — glancing still works */ }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !wakeRef.current) acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (wakeRef.current) {
        try { wakeRef.current.release(); } catch { /* ignore */ }
        wakeRef.current = null;
      }
    };
  }, []);

  /* Escape exits cooking mode. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleStep = useCallback((i) => {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }, []);

  const allDone = steps.length > 0 && ticked.size === steps.length;

  return (
    <div
      className="cooking-mode"
      role="dialog"
      aria-modal="true"
      aria-label={`Cooking ${dishName}`}
    >
      <div className="cooking-header">
        <h2 className="cooking-title">{dishName}</h2>
        <IconButton
          icon="close"
          label="Exit cooking mode"
          onClick={onClose}
          size="lg"
          variant="ghost"
        />
      </div>

      {ingredients.length > 0 && (
        <div className="cooking-ingredients">
          <button
            type="button"
            className="cooking-ing-toggle"
            onClick={() => setIngOpen((o) => !o)}
            aria-expanded={ingOpen}
          >
            <span>Ingredients</span>
            <ChevronDownIcon size={20} className={ingOpen ? 'chev open' : 'chev'} />
          </button>
          {ingOpen && (
            <ul className="cooking-ing-list">
              {ingredients.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="cooking-steps">
        {steps.map((step, i) => {
          const done = ticked.has(i);
          return (
            <button
              type="button"
              key={i}
              className={done ? 'cooking-step done' : 'cooking-step'}
              onClick={() => toggleStep(i)}
              aria-pressed={done}
            >
              <span className="cooking-step-box">
                {done && <CheckIcon size={18} />}
              </span>
              <span className="cooking-step-num">{i + 1}</span>
              <span className="cooking-step-text">{step}</span>
            </button>
          );
        })}
      </div>

      <div className="cooking-foot">
        <button
          type="button"
          className={allDone ? 'btn accent wide' : 'btn wide'}
          onClick={onCooked}
        >
          Cooked this {'✓'}
        </button>
      </div>
    </div>
  );
}

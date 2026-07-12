/* Sheet — bottom sheet overlay with title, close affordance, safe-area padding.
   Focus-traps inside; Escape closes; animates in (slide up). */

import { useEffect, useRef, useCallback } from 'react';
import IconButton from './IconButton.jsx';

export default function Sheet({ title, children, onClose, wide }) {
  const panelRef = useRef(null);
  const previousFocus = useRef(null);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }

    /* Focus trap: Tab / Shift+Tab cycle within the panel */
    if (e.key === 'Tab' && panelRef.current) {
      const focusable = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }, [onClose]);

  useEffect(() => {
    previousFocus.current = document.activeElement;
    document.addEventListener('keydown', handleKeyDown);

    /* Signal to the app that a bottom sheet is open, so the toast can lift
       to the top of the screen and never overlap the sheet's action row. */
    document.body.classList.add('sheet-open');

    /* Focus the panel so keyboard users land inside */
    if (panelRef.current) {
      const firstFocusable = panelRef.current.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable) firstFocusable.focus();
      else panelRef.current.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('sheet-open');
      if (previousFocus.current && previousFocus.current.focus) {
        previousFocus.current.focus();
      }
    };
  }, [handleKeyDown]);

  const panelCls = wide ? 'panel sheet-wide' : 'panel';

  return (
    <div className="overlay sheet-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={panelCls}
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-header">
          <h2 className="sheet-title">{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} size="md" variant="ghost" />
        </div>
        <div className="sheet-body">
          {children}
        </div>
      </div>
    </div>
  );
}

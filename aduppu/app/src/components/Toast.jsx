/* Toast — single app-wide toast system.
   One at a time, positioned above the tab bar.
   Auto-dismisses after toast.timer or 5s. */

import { useEffect, useRef } from 'react';

export default function Toast({ toast, onDismiss }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!toast) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    const delay = toast.timer || 5000;
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{toast.msg}</span>
      {toast.undoFn && (
        <button
          type="button"
          className="toast-undo"
          onClick={() => {
            toast.undoFn();
            onDismiss();
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}

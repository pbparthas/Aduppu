/* DishName — two-line clamped dish name.
   Shows full name in a Sheet on tap if text is actually truncated. */

import { useRef, useState, useCallback } from 'react';
import Sheet from './Sheet.jsx';

export default function DishName({ name, fontSize = 15 }) {
  const textRef = useRef(null);
  const [showFull, setShowFull] = useState(false);

  const handleTap = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    /* Check if text is actually truncated (scrollHeight > clientHeight) */
    if (el.scrollHeight > el.clientHeight + 1) {
      setShowFull(true);
    }
  }, []);

  return (
    <>
      <span
        ref={textRef}
        className="dish-name"
        style={{ fontSize: `${fontSize}px` }}  /* dynamic */
        onClick={handleTap}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTap(); }}
      >
        {name}
      </span>
      {showFull && (
        <Sheet title="Dish name" onClose={() => setShowFull(false)}>
          <p style={{ fontSize: '16px', lineHeight: '1.5' }}>{name}</p>
        </Sheet>
      )}
    </>
  );
}

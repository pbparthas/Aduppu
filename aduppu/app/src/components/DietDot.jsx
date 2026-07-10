/* DietDot — FSSAI bordered-square variant.
   One implementation, used everywhere. Returns null for null/undefined diet. */

const SIZES = { sm: 10, md: 14, lg: 18 };

const COLORS = {
  veg: '#228B22',
  egg: '#DAA520',
  nonveg: '#8B4513',
};

export default function DietDot({ diet, size = 'md' }) {
  if (!diet) return null;

  const px = SIZES[size] || SIZES.md;
  const color = COLORS[diet];
  if (!color) return null;

  const cls = `diet-dot ${diet} ${size}`;

  /* FSSAI pattern: square border with colored symbol inside.
     Veg/Egg = circle, Nonveg = triangle pointing up. */
  return (
    <span className={cls} title={diet}>
      <svg
        width={px}
        height={px}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* bordered square */}
        <rect
          x="4" y="4" width="92" height="92" rx="6"
          fill="none" stroke={color} strokeWidth="8"
        />

        {diet === 'nonveg' ? (
          /* triangle for non-veg */
          <polygon
            points="50,22 80,78 20,78"
            fill={color}
          />
        ) : (
          /* circle for veg and egg */
          <circle cx="50" cy="50" r="22" fill={color} />
        )}
      </svg>
    </span>
  );
}

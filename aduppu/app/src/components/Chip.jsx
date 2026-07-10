/* Chip — consolidated chip component for all chip types.
   Renders <button> when onClick is provided, <span> otherwise. */

const TYPE_CLASS = {
  'meal-breakfast': 'breakfast',
  'meal-lunch': 'lunch',
  'meal-dinner': 'dinner',
  'cuisine': 'cuisine',
  'mode-home': '',
  'mode-out': '',
  'tag': 'grain',
  'plain': 'plain',
};

const MODE_LABELS = {
  'mode-home': 'Home',
  'mode-out': 'Order',
};

export default function Chip({ type, children, onClick, className, ...rest }) {
  const typeClass = TYPE_CLASS[type] ?? '';
  const cls = ['chip', typeClass, className].filter(Boolean).join(' ');
  const label = MODE_LABELS[type] || children;

  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} {...rest}>
        {label}
      </button>
    );
  }

  return (
    <span className={cls} {...rest}>
      {label}
    </span>
  );
}

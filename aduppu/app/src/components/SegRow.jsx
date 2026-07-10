/* SegRow — segmented toggle row.
   Each button is a proper <button> with 44px min height. */

export default function SegRow({ items, value, onChange }) {
  return (
    <div className="seg">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={value === item.key ? 'on' : ''}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

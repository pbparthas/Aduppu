/* IconButton — accessible icon button with 44px minimum tap target.
   Uses stroke SVG icons from Icons.jsx. */

import {
  RerollIcon, PickIcon, ClearIcon, CloseIcon,
  PrevIcon, NextIcon, OverflowIcon, EditIcon, DeleteIcon,
} from './Icons.jsx';

const ICON_MAP = {
  reroll: RerollIcon,
  pick: PickIcon,
  clear: ClearIcon,
  close: CloseIcon,
  prev: PrevIcon,
  next: NextIcon,
  overflow: OverflowIcon,
  edit: EditIcon,
  delete: DeleteIcon,
};

const ICON_SIZES = { sm: 16, md: 20, lg: 24 };

export default function IconButton({
  icon,
  label,
  onClick,
  size = 'md',
  variant = 'ghost',
  disabled,
  className,
}) {
  const IconComponent = ICON_MAP[icon];
  if (!IconComponent) return null;

  const iconPx = ICON_SIZES[size] || ICON_SIZES.md;
  const cls = ['icon-btn', variant, className].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <IconComponent size={iconPx} />
    </button>
  );
}

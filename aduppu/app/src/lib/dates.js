// Local date helpers — IST-safe: never use toISOString() for calendar dates
// (it returns UTC; before 05:30 IST that's *yesterday*).

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// 'YYYY-MM-DD' from local time (getFullYear/getMonth/getDate)
export function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// String in, string out — add n days to a 'YYYY-MM-DD' date string
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return localDateStr(dt);
}

// [Mon..Sun] containing the anchor date, as date strings
export function weekDates(anchor = localDateStr()) {
  const [y, m, d] = anchor.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  // getDay(): 0=Sun..6=Sat; we want Mon=0
  const dow = (dt.getDay() + 6) % 7; // Mon=0, Tue=1, ..., Sun=6
  const monday = addDays(anchor, -dow);
  const result = [];
  for (let i = 0; i < 7; i++) {
    result.push(addDays(monday, i));
  }
  return result;
}

// Human-friendly label: 'Today' / 'Yesterday' / 'Tomorrow' / weekday / '9 Jul'
export function dayLabel(dateStr) {
  const today = localDateStr();
  if (dateStr === today) return 'Today';
  if (dateStr === addDays(today, -1)) return 'Yesterday';
  if (dateStr === addDays(today, 1)) return 'Tomorrow';

  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const todayDt = new Date();
  todayDt.setHours(0, 0, 0, 0);
  const diffMs = dt.getTime() - todayDt.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  // Within the current week (±6 days): show weekday name
  if (Math.abs(diffDays) <= 6) {
    return WEEKDAYS[dt.getDay()];
  }

  // Otherwise: '9 Jul' format
  return `${d} ${MONTHS[m - 1]}`;
}

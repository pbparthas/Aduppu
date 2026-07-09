// Pantry matching — replaces v1's substring matcher with exact normalized
// matching ("rice" != "rice flour"), plural insensitivity.

export const STAPLES = [
  'salt', 'oil', 'water', 'mustard', 'mustard seeds', 'curry leaves',
  'turmeric', 'ghee', 'sugar', 'asafoetida', 'cumin', 'jeera',
];

// Lowercase, trim, collapse spaces, strip trailing 's' per word
export function normalize(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => w.replace(/s$/, ''))
    .join(' ');
}

// Match a dish against the user's pantry
// dish: { ingredients: [...] }
// pantry: string[] (raw pantry entries)
// options.staplesOn: if true (default), staples are considered always available
// Returns { status: 'full'|'partial'|'none', have: string[], missing: string[], score: number }
export function matchDish(dish, pantry, { staplesOn = true } = {}) {
  const ingredients = dish.ingredients || [];
  if (ingredients.length === 0) return { status: 'full', have: [], missing: [], score: 1 };

  const normalizedPantry = new Set(pantry.map(normalize));
  const normalizedStaples = new Set(STAPLES.map(normalize));

  const have = [];
  const missing = [];

  for (const ing of ingredients) {
    const n = normalize(ing);
    if (staplesOn && normalizedStaples.has(n)) {
      have.push(ing);
    } else if (normalizedPantry.has(n)) {
      have.push(ing);
    } else {
      missing.push(ing);
    }
  }

  const required = staplesOn
    ? ingredients.filter((ing) => !normalizedStaples.has(normalize(ing)))
    : ingredients;
  const requiredHave = required.filter((ing) => normalizedPantry.has(normalize(ing)));
  const score = required.length === 0 ? 1 : requiredHave.length / required.length;

  const status = missing.length === 0 ? 'full' : score >= 0.5 ? 'partial' : 'none';

  return { status, have, missing, score };
}

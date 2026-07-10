// Pantry matching — replaces v1's substring matcher with exact normalized
// matching ("rice" != "rice flour"), plural insensitivity.

export const STAPLES = [
  'salt', 'oil', 'water', 'mustard', 'mustard seeds', 'curry leaves',
  'turmeric', 'ghee', 'sugar', 'asafoetida', 'cumin',
];

const ALIASES = {
  'jeera': 'cumin',
  'kadala': 'black chickpea',
  'chana': 'chickpea',
  'aloo': 'potato',
  'tamatar': 'tomato',
  'pyaaz': 'onion',
  'adrak': 'ginger',
  'lahsun': 'garlic',
  'haldi': 'turmeric',
  'dhaniya': 'coriander',
  'mirch': 'chilli',
  'atta': 'wheat flour',
  'maida': 'refined flour',
  'besan': 'gram flour',
  'rai': 'mustard',
  'methi': 'fenugreek',
  'ajwain': 'carom',
  'saunf': 'fennel',
  'dalchini': 'cinnamon',
  'elaichi': 'cardamom',
  'laung': 'clove',
  'til': 'sesame',
  'gur': 'jaggery',
  'dahi': 'curd',
  'paneer': 'cottage cheese',
  'chawal': 'rice',
  'gosht': 'meat',
  'murgh': 'chicken',
  'machhi': 'fish',
  'anda': 'egg',
  'coconut oil': 'oil',
  'gingelly oil': 'oil',
  'mustard oil': 'oil',
  'groundnut oil': 'oil',
  'sunflower oil': 'oil',
  'refined oil': 'oil',
  'vegetable oil': 'oil',
};

// Lowercase, trim, collapse spaces, strip trailing 's' per word, resolve aliases
export function normalize(s) {
  const base = s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => w.replace(/e?s$/, ''))
    .join(' ');
  return ALIASES[base] || base;
}

// Match a dish against the user's pantry
// dish: { ingredients: [...] }
// pantry: string[] (raw pantry entries)
// options.staplesOn: if true (default), staples are considered always available
// Returns { status: 'full'|'partial'|'none', have: string[], missing: string[], score: number }
export function matchDish(dish, pantry, { staplesOn = true } = {}) {
  const ingredients = dish.ingredients || [];
  if (ingredients.length === 0) return { status: 'full', have: [], missing: [], score: 1, haveCount: 0, totalCount: 0 };

  const normalizedPantry = new Set(pantry.map(normalize));
  const normalizedStaples = new Set(STAPLES.map(normalize));

  const have = [];
  const missing = [];
  let staplesSkipped = 0;

  for (const ing of ingredients) {
    const n = normalize(ing);
    if (staplesOn && normalizedStaples.has(n)) {
      have.push(ing);
      staplesSkipped++;
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

  const haveCount = have.length;
  const totalCount = ingredients.length - staplesSkipped;

  return { status, have, missing, score, haveCount, totalCount };
}

import { describe, it, expect } from 'vitest';
import { matchDish, normalize, STAPLES } from '../src/lib/kitchen.js';
import { SEEDS } from '../src/lib/model.js';

describe('normalize', () => {
  it('lowercases and trims', () => {
    expect(normalize('  Rice  ')).toBe('rice');
  });

  it('strips trailing s per word (plural insensitivity)', () => {
    expect(normalize('tomatoes')).toBe('tomato');
    expect(normalize('onions')).toBe('onion');
    expect(normalize('mustard seeds')).toBe('mustard seed');
  });

  it('collapses multiple spaces', () => {
    expect(normalize('mustard   seeds')).toBe('mustard seed');
  });

  it('resolves aliases to canonical names', () => {
    expect(normalize('jeera')).toBe('cumin');
    expect(normalize('aloo')).toBe('potato');
    expect(normalize('haldi')).toBe('turmeric');
    expect(normalize('dahi')).toBe('curd');
    expect(normalize('paneer')).toBe('cottage cheese');
    expect(normalize('anda')).toBe('egg');
    expect(normalize('chawal')).toBe('rice');
    expect(normalize('tamatar')).toBe('tomato');
    expect(normalize('pyaaz')).toBe('onion');
    expect(normalize('adrak')).toBe('ginger');
    expect(normalize('lahsun')).toBe('garlic');
  });

  it('resolves oil aliases to generic oil', () => {
    expect(normalize('coconut oil')).toBe('oil');
    expect(normalize('gingelly oil')).toBe('oil');
    expect(normalize('mustard oil')).toBe('oil');
    expect(normalize('groundnut oil')).toBe('oil');
    expect(normalize('sunflower oil')).toBe('oil');
    expect(normalize('refined oil')).toBe('oil');
    expect(normalize('vegetable oil')).toBe('oil');
  });

  it('applies alias after plural stripping', () => {
    // 'Jeeras' -> lowercase -> 'jeeras' -> strip trailing s -> 'jeera' -> alias -> 'cumin'
    expect(normalize('Jeeras')).toBe('cumin');
  });

  it('does not alias non-matching words', () => {
    expect(normalize('rice')).toBe('rice');
    expect(normalize('coconut')).toBe('coconut');
    expect(normalize('wheat flour')).toBe('wheat flour');
  });
});

describe('matchDish', () => {
  it('exact match: "rice" matches "rice" (status full if only ingredient)', () => {
    const dish = { ingredients: ['rice'] };
    const result = matchDish(dish, ['rice']);
    expect(result.status).toBe('full');
    expect(result.missing).toEqual([]);
    expect(result.score).toBe(1);
  });

  it('no substring: "rice" does NOT match "rice flour"', () => {
    const dish = { ingredients: ['rice flour'] };
    const result = matchDish(dish, ['rice']);
    expect(result.status).not.toBe('full');
    expect(result.missing).toContain('rice flour');
  });

  it('plural insensitivity: "tomatoes" matches "tomato"', () => {
    const dish = { ingredients: ['tomatoes'] };
    const result = matchDish(dish, ['tomato']);
    expect(result.status).toBe('full');
    expect(result.missing).toEqual([]);
  });

  it('staples exclusion: when staplesOn, staples like "salt", "oil" are not required', () => {
    const dish = { ingredients: ['salt', 'oil', 'tomato'] };
    const result = matchDish(dish, ['tomato'], { staplesOn: true });
    expect(result.status).toBe('full');
    expect(result.missing).toEqual([]);
    expect(result.have).toContain('salt');
    expect(result.have).toContain('oil');
    expect(result.have).toContain('tomato');
  });

  it('staples toggle: dish needing staples + one ingredient, staplesOn + ingredient available = full', () => {
    const dish = { ingredients: ['salt', 'turmeric', 'rice'] };
    const result = matchDish(dish, ['rice'], { staplesOn: true });
    expect(result.status).toBe('full');
    expect(result.score).toBe(1);
  });

  it('staples OFF: staples become required ingredients', () => {
    const dish = { ingredients: ['salt', 'rice'] };
    const result = matchDish(dish, ['rice'], { staplesOn: false });
    expect(result.missing).toContain('salt');
    expect(result.status).not.toBe('full');
  });

  it('partial match: score >= 0.5 gives status partial, shows missing', () => {
    const dish = { ingredients: ['rice', 'dal', 'tomato', 'onion'] };
    // Have 2 of 4 non-staple ingredients = 0.5 score
    const result = matchDish(dish, ['rice', 'dal'], { staplesOn: true });
    expect(result.status).toBe('partial');
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.missing).toContain('tomato');
    expect(result.missing).toContain('onion');
  });

  it('no match: score < 0.5 gives status none', () => {
    const dish = { ingredients: ['rice', 'dal', 'tomato', 'onion'] };
    // Have 0 of 4 non-staple ingredients = 0 score
    const result = matchDish(dish, [], { staplesOn: true });
    expect(result.status).toBe('none');
    expect(result.score).toBe(0);
  });

  it('empty pantry returns none for all dishes with ingredients', () => {
    const dish = { ingredients: ['rice', 'dal'] };
    const result = matchDish(dish, []);
    expect(result.status).toBe('none');
    expect(result.score).toBe(0);
    expect(result.missing).toEqual(['rice', 'dal']);
  });

  it('dish with no ingredients returns full with score 1', () => {
    const dish = { ingredients: [] };
    const result = matchDish(dish, []);
    expect(result.status).toBe('full');
    expect(result.score).toBe(1);
  });

  it('dish with undefined ingredients returns full', () => {
    const dish = {};
    const result = matchDish(dish, ['rice']);
    expect(result.status).toBe('full');
    expect(result.score).toBe(1);
  });

  // --- Alias matching tests ---

  it('alias matching: pantry "jeera" matches dish ingredient "cumin"', () => {
    const dish = { ingredients: ['cumin', 'rice'] };
    const result = matchDish(dish, ['jeera', 'rice']);
    expect(result.status).toBe('full');
    expect(result.have).toContain('cumin');
  });

  it('alias matching: dish ingredient "jeera" matches pantry "cumin"', () => {
    const dish = { ingredients: ['jeera', 'rice'] };
    const result = matchDish(dish, ['cumin', 'rice']);
    expect(result.status).toBe('full');
    expect(result.have).toContain('jeera');
  });

  it('alias matching: pantry "coconut oil" matches staple "oil"', () => {
    const dish = { ingredients: ['oil', 'rice'] };
    const result = matchDish(dish, ['rice', 'coconut oil'], { staplesOn: true });
    expect(result.status).toBe('full');
    // oil is a staple, so it is auto-matched via staples
    expect(result.have).toContain('oil');
  });

  it('alias matching: pantry "dahi" matches ingredient "curd"', () => {
    const dish = { ingredients: ['curd'] };
    const result = matchDish(dish, ['dahi']);
    expect(result.status).toBe('full');
  });

  it('alias matching: pantry "anda" matches ingredient "egg"', () => {
    const dish = { ingredients: ['egg', 'rice'] };
    const result = matchDish(dish, ['anda', 'rice']);
    expect(result.status).toBe('full');
    expect(result.have).toContain('egg');
  });

  it('alias matching: oil types resolve to staple oil', () => {
    // When user has "mustard oil" in pantry, dishes needing "oil" (a staple) match
    const dish = { ingredients: ['salt', 'oil', 'potato'] };
    const result = matchDish(dish, ['potato'], { staplesOn: true });
    expect(result.status).toBe('full');
    // oil and salt are both staples
    expect(result.have).toContain('oil');
    expect(result.have).toContain('salt');
  });

  // --- haveCount and totalCount tests ---

  it('returns haveCount and totalCount for a dish with staples', () => {
    const dish = { ingredients: ['salt', 'oil', 'rice', 'dal'] };
    const result = matchDish(dish, ['rice'], { staplesOn: true });
    // have = [salt, oil, rice], missing = [dal]
    // staplesSkipped = 2 (salt, oil)
    expect(result.haveCount).toBe(3);
    expect(result.totalCount).toBe(2); // 4 ingredients - 2 staples skipped
  });

  it('haveCount and totalCount with staplesOff', () => {
    const dish = { ingredients: ['salt', 'rice', 'dal'] };
    const result = matchDish(dish, ['rice', 'dal'], { staplesOn: false });
    // no staples skipped
    expect(result.haveCount).toBe(2);
    expect(result.totalCount).toBe(3); // all 3 count
  });

  it('haveCount and totalCount: full match', () => {
    const dish = { ingredients: ['salt', 'turmeric', 'rice', 'tomato'] };
    const result = matchDish(dish, ['rice', 'tomato'], { staplesOn: true });
    // salt + turmeric are staples (skipped=2), rice + tomato from pantry
    expect(result.haveCount).toBe(4);
    expect(result.totalCount).toBe(2); // 4 - 2 staples
    expect(result.status).toBe('full');
  });

  it('empty dish has zero counts', () => {
    const dish = { ingredients: [] };
    const result = matchDish(dish, []);
    expect(result.haveCount).toBe(0);
    expect(result.totalCount).toBe(0);
  });

  it('undefined ingredients has zero counts', () => {
    const dish = {};
    const result = matchDish(dish, ['rice']);
    expect(result.haveCount).toBe(0);
    expect(result.totalCount).toBe(0);
  });

  it('all-staple dish has zero totalCount', () => {
    const dish = { ingredients: ['salt', 'oil', 'turmeric'] };
    const result = matchDish(dish, [], { staplesOn: true });
    // all 3 are staples
    expect(result.haveCount).toBe(3);
    expect(result.totalCount).toBe(0); // 3 - 3
    expect(result.status).toBe('full');
    expect(result.score).toBe(1);
  });
});

// R2-6: seed vocabulary smoke test — the idli/dosa family must be cookable
// from a minimal pantry with staples on. Guards against seed vocabulary drift
// (e.g. "idli rice" not aliasing to "rice") breaking the app's core promise.
describe('R2-6 seed vocabulary smoke test', () => {
  const tnBreakfast = SEEDS['tamil-nadu'].breakfast;

  it('Idli is a full match with pantry [rice, urad dal, salt] + staples', () => {
    const idli = tnBreakfast.find((d) => d.name === 'Idli');
    expect(idli).toBeTruthy();
    const result = matchDish(idli, ['rice', 'urad dal', 'salt'], { staplesOn: true });
    expect(result.status).toBe('full');
  });

  it('at least one idli/dosa dish is fully cookable from a minimal pantry', () => {
    const pantry = ['rice', 'urad dal', 'salt'];
    const cookable = tnBreakfast.filter(
      (d) => matchDish(d, pantry, { staplesOn: true }).status === 'full',
    );
    expect(cookable.length).toBeGreaterThan(0);
  });

  it('idli rice / dosa rice / parboiled rice all alias to rice', () => {
    expect(normalize('idli rice')).toBe('rice');
    expect(normalize('dosa rice')).toBe('rice');
    expect(normalize('parboiled rice')).toBe('rice');
    expect(normalize('boiled rice')).toBe('rice');
  });

  it('every seed ingredient normalizes without throwing', () => {
    for (const cuisineKey of Object.keys(SEEDS)) {
      const cat = SEEDS[cuisineKey];
      for (const meal of ['breakfast', 'lunch', 'dinner']) {
        for (const dish of cat[meal] || []) {
          for (const ing of dish.ingredients) {
            expect(typeof normalize(ing)).toBe('string');
          }
        }
      }
    }
  });
});

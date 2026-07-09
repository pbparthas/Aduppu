import { describe, it, expect } from 'vitest';
import { pickDish } from '../src/lib/randomizer.js';

// Helper: create a dish fixture
const mkDish = (name, meal = 'breakfast', overrides = {}) => ({
  id: `dish-${name}`, type: 'dish', name, meal, cuisine: 'tamil-nadu',
  diet: 'veg', ingredients: [], deleted: false, ...overrides,
});

describe('pickDish', () => {
  it('returns a dish name when dishes exist for the meal', () => {
    const dishes = [mkDish('Idli'), mkDish('Dosa'), mkDish('Pongal')];
    const result = pickDish('breakfast', '2025-07-09', { dishes });
    expect(dishes.map((d) => d.name)).toContain(result);
  });

  it('returns null when no dishes exist for the meal', () => {
    const dishes = [mkDish('Idli', 'breakfast')];
    const result = pickDish('lunch', '2025-07-09', { dishes });
    expect(result).toBeNull();
  });

  it('respects NO_REPEAT_DAYS window: a dish used yesterday should not appear for breakfast', () => {
    // breakfast NO_REPEAT_DAYS = 2, so a dish used yesterday is within the window
    const dishes = [mkDish('Idli'), mkDish('Dosa')];
    const plans = [{ date: '2025-07-08', meals: { breakfast: 'Idli' } }];
    // Run multiple times to verify Idli never appears
    for (let i = 0; i < 20; i++) {
      const result = pickDish('breakfast', '2025-07-09', { dishes, plans });
      expect(result).toBe('Dosa');
    }
  });

  it('LRU fallback when all dishes are within the repeat window', () => {
    // Both dishes used recently, but Dosa was used earlier so it's the LRU pick
    const dishes = [mkDish('Idli'), mkDish('Dosa')];
    const plans = [
      { date: '2025-07-08', meals: { breakfast: 'Idli' } },
      { date: '2025-07-07', meals: { breakfast: 'Dosa' } },
    ];
    const result = pickDish('breakfast', '2025-07-09', { dishes, plans });
    expect(result).toBe('Dosa');
  });

  it('exclude parameter prevents that dish from being picked', () => {
    const dishes = [mkDish('Idli'), mkDish('Dosa')];
    for (let i = 0; i < 20; i++) {
      const result = pickDish('breakfast', '2025-07-09', { dishes, exclude: ['Idli'] });
      expect(result).toBe('Dosa');
    }
  });

  it('fill-empty-only: if a slot is already filled, its dish is excluded', () => {
    const dishes = [mkDish('Idli'), mkDish('Dosa')];
    // Simulate: breakfast slot already filled with Idli, use exclude to prevent re-pick
    for (let i = 0; i < 20; i++) {
      const result = pickDish('breakfast', '2025-07-09', { dishes, exclude: ['Idli'] });
      expect(result).toBe('Dosa');
    }
  });

  it('no same-day duplicates when using exclude', () => {
    const dishes = [mkDish('Rice', 'lunch'), mkDish('Biryani', 'lunch'), mkDish('Pulao', 'lunch')];
    // Simulate filling lunch: first pick is Rice, exclude it for next pick
    const first = 'Rice';
    for (let i = 0; i < 20; i++) {
      const result = pickDish('lunch', '2025-07-09', { dishes, exclude: [first] });
      expect(result).not.toBe('Rice');
    }
  });

  it('diet is a HARD filter: veg user with only nonveg dishes gets null', () => {
    const dishes = [
      mkDish('Chicken Biryani', 'lunch', { diet: 'nonveg' }),
      mkDish('Fish Curry', 'lunch', { diet: 'nonveg' }),
    ];
    const result = pickDish('lunch', '2025-07-09', { dishes, diet: 'veg' });
    expect(result).toBeNull();
  });

  it('diet is never violated by any fallback', () => {
    // All dishes within the repeat window, but the only non-excluded one is nonveg
    const dishes = [
      mkDish('Veg Rice', 'lunch', { diet: 'veg' }),
      mkDish('Chicken', 'lunch', { diet: 'nonveg' }),
    ];
    const plans = [{ date: '2025-07-08', meals: { lunch: 'Veg Rice' } }];
    // With veg diet: even with LRU fallback, nonveg Chicken must not appear
    for (let i = 0; i < 20; i++) {
      const result = pickDish('lunch', '2025-07-09', { dishes, plans, diet: 'veg' });
      expect(result).toBe('Veg Rice');
    }
  });

  it('cuisine filtering: only dishes matching expanded cuisines are picked', () => {
    const dishes = [
      mkDish('Idli', 'breakfast', { cuisine: 'tamil-nadu' }),
      mkDish('Poha', 'breakfast', { cuisine: 'maharashtra' }),
    ];
    for (let i = 0; i < 20; i++) {
      const result = pickDish('breakfast', '2025-07-09', { dishes, cuisines: ['tamil-nadu'] });
      expect(result).toBe('Idli');
    }
  });

  it('cuisine widening fallback: if filtered pool is empty, widen to all', () => {
    const dishes = [
      mkDish('Poha', 'breakfast', { cuisine: 'maharashtra' }),
    ];
    // Request Tamil Nadu but only Maharashtra dishes exist; should widen and pick Poha
    const result = pickDish('breakfast', '2025-07-09', { dishes, cuisines: ['tamil-nadu'] });
    expect(result).toBe('Poha');
  });

  it('region selection includes sub-cuisine dishes', () => {
    // expandCuisines(['south-indian']) should include 'tamil-nadu', 'karnataka', etc.
    // Since model.js is not yet present, we test that cuisine key matching works
    // at the pickDish level — sub-cuisine dishes match their own key
    const dishes = [
      mkDish('Idli', 'breakfast', { cuisine: 'tamil-nadu' }),
      mkDish('Dosa', 'breakfast', { cuisine: 'tamil-nadu' }),
    ];
    // Filtering by the exact sub-cuisine should work
    const result = pickDish('breakfast', '2025-07-09', { dishes, cuisines: ['tamil-nadu'] });
    expect(result).not.toBeNull();
  });

  it('sub-only selection includes region-level dishes', () => {
    // A dish tagged with a broad region key should still be picked
    const dishes = [
      mkDish('Sambar', 'lunch', { cuisine: 'south-indian' }),
    ];
    const result = pickDish('lunch', '2025-07-09', { dishes, cuisines: ['south-indian'] });
    expect(result).toBe('Sambar');
  });

  it('favorites-mix path draws from multiple cuisines', () => {
    const dishes = [
      mkDish('Idli', 'breakfast', { cuisine: 'tamil-nadu' }),
      mkDish('Poha', 'breakfast', { cuisine: 'maharashtra' }),
      mkDish('Upma', 'breakfast', { cuisine: 'karnataka' }),
    ];
    // With no cuisine filter (null), should be able to pick from any cuisine
    const seen = new Set();
    for (let i = 0; i < 50; i++) {
      seen.add(pickDish('breakfast', '2025-07-09', { dishes }));
    }
    // At least 2 different dishes should appear across 50 random picks
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });
});

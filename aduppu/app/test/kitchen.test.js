import { describe, it, expect } from 'vitest';
import { matchDish, normalize, STAPLES } from '../src/lib/kitchen.js';

describe('normalize', () => {
  it('lowercases and trims', () => {
    expect(normalize('  Rice  ')).toBe('rice');
  });

  it('strips trailing s per word (plural insensitivity)', () => {
    expect(normalize('tomatoes')).toBe('tomato');
    // normalize only strips trailing 's', not 'ves' -> 'f'
    expect(normalize('curry leaves')).toBe('curry leave');
  });

  it('collapses multiple spaces', () => {
    expect(normalize('mustard   seeds')).toBe('mustard seed');
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
});

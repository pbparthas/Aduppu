import { describe, it, expect } from 'vitest';
import { resolveItem, newItem } from '../src/lib/merge.js';

const dish = (over = {}) => ({
  id: 'x', type: 'dish', name: 'Idli', meal: 'breakfast', cuisine: 'tamil-nadu',
  diet: 'veg', ingredients: ['rice', 'urad dal'], deleted: false, updated_at: 100, ...over,
});

describe('resolveItem (LWW)', () => {
  it('remote wins outright when local is clean (not dirty)', () => {
    const { winner, conflictCopy } = resolveItem(
      dish({ name: 'Dosa' }),
      dish({ name: 'Idli', dirty: 0 }),
    );
    expect(winner.name).toBe('Dosa');
    expect(conflictCopy).toBeNull();
  });

  it('remote wins when there is no local copy', () => {
    const { winner, conflictCopy } = resolveItem(dish(), undefined);
    expect(winner.name).toBe('Idli');
    expect(conflictCopy).toBeNull();
  });

  it('newer local wins over older remote (LWW)', () => {
    const remote = dish({ name: 'Dosa', updated_at: 100 });
    const local = dish({ name: 'Masala Dosa', updated_at: 200, dirty: 1 });
    const { winner, conflictCopy } = resolveItem(remote, local);
    expect(winner.name).toBe('Masala Dosa');
    expect(conflictCopy).toBeNull();
  });

  it('newer remote wins over older dirty local (LWW)', () => {
    const remote = dish({ name: 'Rava Dosa', updated_at: 300 });
    const local = dish({ name: 'Masala Dosa', updated_at: 200, dirty: 1 });
    const { winner, conflictCopy } = resolveItem(remote, local);
    expect(winner.name).toBe('Rava Dosa');
    expect(conflictCopy).toBeNull();
  });

  it('equal timestamps converge on remote', () => {
    const remote = dish({ name: 'Dosa', updated_at: 100 });
    const local = dish({ name: 'Idli', updated_at: 100, dirty: 1 });
    const { winner } = resolveItem(remote, local);
    expect(winner.name).toBe('Dosa');
  });

  it('never produces a conflict copy for any item type', () => {
    const remote = dish({ name: 'remote-edit', updated_at: 300 });
    const local = dish({ name: 'local-edit', updated_at: 200, dirty: 1 });
    expect(resolveItem(remote, local).conflictCopy).toBeNull();

    const remote2 = dish({ name: 'remote-edit', updated_at: 100 });
    const local2 = dish({ name: 'local-edit', updated_at: 200, dirty: 1 });
    expect(resolveItem(remote2, local2).conflictCopy).toBeNull();
  });

  it('delete vs. edit: newer action wins with no conflict copy', () => {
    const remote = dish({ deleted: true, updated_at: 300 });
    const local = dish({ name: 'still editing', updated_at: 200, dirty: 1 });
    const { winner, conflictCopy } = resolveItem(remote, local);
    expect(winner.deleted).toBe(true);
    expect(conflictCopy).toBeNull();
  });

  it('log items resolve by LWW just like dishes', () => {
    const remote = { id: 'l1', type: 'log', date: '2025-07-01', meal: 'lunch', dish: 'Rice', deleted: false, updated_at: 200 };
    const local = { ...remote, dish: 'Biryani', updated_at: 300, dirty: 1 };
    const { winner, conflictCopy } = resolveItem(remote, local);
    expect(winner.dish).toBe('Biryani');
    expect(conflictCopy).toBeNull();
  });
});

describe('newItem', () => {
  it('creates a dish with proper defaults', () => {
    const item = newItem({ name: 'Upma', type: 'dish', meal: 'breakfast' });
    expect(item.id).toBeDefined();
    expect(item.type).toBe('dish');
    expect(item.name).toBe('Upma');
    expect(item.deleted).toBe(false);
    expect(item.deleted_at).toBeNull();
    expect(item.dirty).toBe(0);
    expect(typeof item.created_at).toBe('number');
    expect(typeof item.updated_at).toBe('number');
  });

  it('defaults type to dish when no type specified', () => {
    const item = newItem({ name: 'Pongal' });
    expect(item.type).toBe('dish');
  });

  it('allows overriding defaults', () => {
    const item = newItem({ type: 'log', date: '2025-07-01', meal: 'lunch', dish: 'Rice' });
    expect(item.type).toBe('log');
    expect(item.date).toBe('2025-07-01');
  });

  it('generates unique ids', () => {
    const a = newItem({ name: 'A' });
    const b = newItem({ name: 'B' });
    expect(a.id).not.toBe(b.id);
  });
});

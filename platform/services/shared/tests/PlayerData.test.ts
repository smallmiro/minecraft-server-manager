import { describe, it, expect } from 'vitest';
import { PlayerData } from '../src/domain/value-objects/PlayerData.js';
import { Dimension } from '../src/domain/value-objects/WorldInfo.js';

describe('PlayerData', () => {
  it('exposes NBT-derived player state via getters', () => {
    const data = PlayerData.create({
      x: -85.25,
      y: 82,
      z: 121.46,
      dimension: Dimension.Nether,
      health: 15.5,
      food: 18,
      xpLevel: 7,
      gameMode: 'creative',
      inventory: { slotsUsed: 2, items: [{ id: 'minecraft:diamond', count: 12 }] },
    });

    expect(data.x).toBe(-85.25);
    expect(data.y).toBe(82);
    expect(data.z).toBe(121.46);
    expect(data.dimension).toBe(Dimension.Nether);
    expect(data.health).toBe(15.5);
    expect(data.food).toBe(18);
    expect(data.xpLevel).toBe(7);
    expect(data.gameMode).toBe('creative');
    expect(data.inventory).toEqual({
      slotsUsed: 2,
      items: [{ id: 'minecraft:diamond', count: 12 }],
    });
  });

  it('serializes dimension as its string enum value', () => {
    const data = PlayerData.create({
      x: 0,
      y: 64,
      z: 0,
      dimension: Dimension.Overworld,
      gameMode: 'survival',
      inventory: { slotsUsed: 0, items: [] },
    });

    expect(data.toJSON()).toEqual({
      x: 0,
      y: 64,
      z: 0,
      dimension: 'overworld',
      health: undefined,
      food: undefined,
      xpLevel: undefined,
      gameMode: 'survival',
      inventory: { slotsUsed: 0, items: [] },
    });
  });
});

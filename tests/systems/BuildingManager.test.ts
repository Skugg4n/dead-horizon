import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GameState } from '../../src/config/types';

// Mock Phaser scene with event system
function createMockScene() {
  return {
    events: {
      emit: vi.fn(),
      on: vi.fn(),
    },
  };
}

function createTestGameState(): GameState {
  return {
    version: '0.1.1',
    player: {
      character: 'soldier',
      skills: {
        combat_melee: 0,
        combat_pistol: 0,
        combat_rifle: 0,
        combat_shotgun: 0,
        looting: 0,
        building: 0,
      },
      hp: 100,
      maxHp: 100,
    },
    inventory: {
      weapons: [],
      resources: {
        scrap: 50,
        food: 20,
        ammo: 10,
        parts: 5,
        meds: 5,
      },
      loadedAmmo: 0,
    },
    base: {
      structures: [],
      level: 0,
    },
    refugees: [],
    progress: {
      currentWave: 1,
      highestWave: 1,
      totalRuns: 0,
      totalKills: 0,
    },
    map: {
      fogOfWar: [],
      explored: [],
    },
  };
}

const STRUCTURE_DATA = [
  {
    id: 'barricade',
    name: 'Barricade',
    hp: 50,
    cost: { scrap: 5 },
    apCost: 1,
    maxLevel: 3,
    effect: 'slowsEnemies',
  },
  {
    id: 'wall',
    name: 'Wall',
    hp: 150,
    cost: { scrap: 15 },
    apCost: 2,
    maxLevel: 3,
    effect: 'blocksEnemies',
  },
  {
    id: 'pillbox',
    name: 'Pillbox',
    hp: 100,
    cost: { scrap: 20, parts: 2 },
    apCost: 2,
    maxLevel: 3,
    effect: 'refugeeShootingPosition',
  },
];

import { BuildingManager } from '../../src/systems/BuildingManager';

describe('BuildingManager', () => {
  let manager: BuildingManager;
  let mockScene: ReturnType<typeof createMockScene>;
  let gameState: GameState;

  beforeEach(() => {
    mockScene = createMockScene();
    gameState = createTestGameState();
    manager = new BuildingManager(mockScene as never, gameState, STRUCTURE_DATA);
  });

  describe('getStructureData', () => {
    it('returns data for known structure', () => {
      const data = manager.getStructureData('barricade');
      expect(data).toBeDefined();
      expect(data?.name).toBe('Barricade');
      expect(data?.hp).toBe(50);
    });

    it('returns undefined for unknown structure', () => {
      expect(manager.getStructureData('nonexistent')).toBeUndefined();
    });
  });

  describe('getAllStructureData', () => {
    it('returns all structure definitions', () => {
      const all = manager.getAllStructureData();
      expect(all).toHaveLength(3);
    });
  });

  describe('canAfford', () => {
    it('returns true when resources are sufficient', () => {
      expect(manager.canAfford('barricade')).toBe(true);
    });

    it('returns false when resources are insufficient', () => {
      gameState.inventory.resources.scrap = 2;
      expect(manager.canAfford('barricade')).toBe(false);
    });

    it('checks multiple resource types', () => {
      expect(manager.canAfford('pillbox')).toBe(true);
      gameState.inventory.resources.parts = 0;
      expect(manager.canAfford('pillbox')).toBe(false);
    });

    it('returns false for unknown structure', () => {
      expect(manager.canAfford('nonexistent')).toBe(false);
    });
  });

  describe('hasEnoughAP', () => {
    it('returns true when AP is sufficient', () => {
      expect(manager.hasEnoughAP('barricade', 5)).toBe(true);
    });

    it('returns false when AP is insufficient', () => {
      expect(manager.hasEnoughAP('wall', 1)).toBe(false);
    });

    it('returns true when AP exactly matches cost', () => {
      expect(manager.hasEnoughAP('barricade', 1)).toBe(true);
    });
  });

  describe('isPositionFree', () => {
    it('returns true for empty position', () => {
      expect(manager.isPositionFree(0, 0)).toBe(true);
    });

    it('returns false for occupied position', () => {
      manager.place('barricade', 64, 64, 12);
      expect(manager.isPositionFree(64, 64)).toBe(false);
    });
  });

  describe('place', () => {
    it('places a structure and returns instance with remaining AP', () => {
      const result = manager.place('barricade', 64, 64, 12);
      expect(result).not.toBeNull();
      expect(result?.apRemaining).toBe(11);
      expect(result?.instance.structureId).toBe('barricade');
      expect(result?.instance.x).toBe(64);
      expect(result?.instance.y).toBe(64);
      expect(result?.instance.level).toBe(1);
      expect(result?.instance.hp).toBe(50);
    });

    it('deducts resources on placement', () => {
      manager.place('barricade', 64, 64, 12);
      expect(gameState.inventory.resources.scrap).toBe(45);
    });

    it('adds structure to gameState', () => {
      manager.place('barricade', 64, 64, 12);
      expect(gameState.base.structures).toHaveLength(1);
    });

    it('emits structure-placed event', () => {
      manager.place('barricade', 64, 64, 12);
      expect(mockScene.events.emit).toHaveBeenCalledWith(
        'structure-placed',
        expect.objectContaining({ structureId: 'barricade' })
      );
    });

    it('returns null when not enough AP', () => {
      const result = manager.place('wall', 64, 64, 1);
      expect(result).toBeNull();
    });

    it('returns null when cannot afford', () => {
      gameState.inventory.resources.scrap = 0;
      const result = manager.place('barricade', 64, 64, 12);
      expect(result).toBeNull();
    });

    it('returns null when position is occupied', () => {
      manager.place('barricade', 64, 64, 12);
      const result = manager.place('wall', 64, 64, 10);
      expect(result).toBeNull();
    });

    it('returns null for unknown structure', () => {
      const result = manager.place('nonexistent', 64, 64, 12);
      expect(result).toBeNull();
    });
  });

  describe('upgrade', () => {
    it('upgrades a placed structure', () => {
      const placed = manager.place('barricade', 64, 64, 12);
      expect(placed).not.toBeNull();

      const result = manager.upgrade(placed!.instance.id, placed!.apRemaining);
      expect(result).not.toBeNull();
      expect(result?.apRemaining).toBe(10);

      // Check level increased
      expect(gameState.base.structures[0]?.level).toBe(2);
    });

    it('increases HP on upgrade', () => {
      const placed = manager.place('barricade', 64, 64, 12);
      expect(placed).not.toBeNull();

      manager.upgrade(placed!.instance.id, placed!.apRemaining);
      // HP should be base * (1 + 0.5 * (level-1)) = 50 * 1.5 = 75
      expect(gameState.base.structures[0]?.maxHp).toBe(75);
      expect(gameState.base.structures[0]?.hp).toBe(75);
    });

    it('returns null at max level', () => {
      const placed = manager.place('barricade', 64, 64, 12);
      expect(placed).not.toBeNull();

      // Upgrade to max (level 3)
      manager.upgrade(placed!.instance.id, 11);
      manager.upgrade(placed!.instance.id, 10);
      const result = manager.upgrade(placed!.instance.id, 9);
      expect(result).toBeNull();
    });
  });

  describe('sell', () => {
    it('removes structure and refunds 50% of base cost', () => {
      const placed = manager.place('barricade', 64, 64, 12);
      expect(placed).not.toBeNull();

      // scrap went from 50 to 45 after building
      const result = manager.sell(placed!.instance.id);
      expect(result).toBe(true);
      // Refund: floor(5 * 0.5) = 2
      expect(gameState.inventory.resources.scrap).toBe(47);
      expect(gameState.base.structures).toHaveLength(0);
    });

    it('returns false for nonexistent instance', () => {
      expect(manager.sell('nonexistent')).toBe(false);
    });

    it('emits structure-destroyed event', () => {
      const placed = manager.place('barricade', 64, 64, 12);
      expect(placed).not.toBeNull();
      mockScene.events.emit.mockClear();

      manager.sell(placed!.instance.id);
      expect(mockScene.events.emit).toHaveBeenCalledWith(
        'structure-destroyed',
        expect.objectContaining({ structureId: 'barricade' })
      );
    });
  });

  describe('damageStructure', () => {
    it('reduces structure HP', () => {
      const placed = manager.place('barricade', 64, 64, 12);
      expect(placed).not.toBeNull();

      const destroyed = manager.damageStructure(placed!.instance.id, 20);
      expect(destroyed).toBe(false);
      expect(gameState.base.structures[0]?.hp).toBe(30);
    });

    it('destroys structure when HP reaches 0', () => {
      const placed = manager.place('barricade', 64, 64, 12);
      expect(placed).not.toBeNull();

      const destroyed = manager.damageStructure(placed!.instance.id, 50);
      expect(destroyed).toBe(true);
      expect(gameState.base.structures).toHaveLength(0);
    });
  });

  describe('getStructureAt', () => {
    it('finds structure at grid position', () => {
      manager.place('barricade', 64, 64, 12);
      // getStructureAt snaps to grid, so passing exact grid coords
      const found = manager.getStructureAt(64, 64);
      expect(found).toBeDefined();
      expect(found?.structureId).toBe('barricade');
    });

    it('returns undefined for empty position', () => {
      expect(manager.getStructureAt(0, 0)).toBeUndefined();
    });
  });
});

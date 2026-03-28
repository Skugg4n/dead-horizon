import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GameState, ResourceType } from '../../src/config/types';

// Mock Phaser scene with event system
function createMockScene() {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
  return {
    events: {
      emit: vi.fn((event: string, ...args: unknown[]) => {
        const handlers = listeners.get(event);
        if (handlers) {
          handlers.forEach(h => h(...args));
        }
      }),
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!listeners.has(event)) {
          listeners.set(event, []);
        }
        listeners.get(event)?.push(handler);
      }),
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
        scrap: 10,
        food: 5,
        ammo: 10,
        parts: 0,
        meds: 2,
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

// Import dynamically to avoid Phaser import issues in test environment
// We test the logic by importing the module directly
import { ResourceManager } from '../../src/systems/ResourceManager';

describe('ResourceManager', () => {
  let manager: ResourceManager;
  let mockScene: ReturnType<typeof createMockScene>;
  let gameState: GameState;

  beforeEach(() => {
    mockScene = createMockScene();
    gameState = createTestGameState();
    // Cast mock scene since ResourceManager only uses scene.events
    manager = new ResourceManager(mockScene as never, gameState);
  });

  describe('get', () => {
    it('returns correct initial resource value', () => {
      expect(manager.get('scrap')).toBe(10);
      expect(manager.get('food')).toBe(5);
      expect(manager.get('ammo')).toBe(10);
      expect(manager.get('parts')).toBe(0);
      expect(manager.get('meds')).toBe(2);
    });
  });

  describe('getAll', () => {
    it('returns a copy of all resources', () => {
      const all = manager.getAll();
      expect(all).toEqual({
        scrap: 10,
        food: 5,
        ammo: 10,
        parts: 0,
        meds: 2,
      });
    });

    it('returns a copy, not a reference', () => {
      const all = manager.getAll();
      all.scrap = 999;
      expect(manager.get('scrap')).toBe(10);
    });
  });

  describe('add', () => {
    it('adds resources correctly', () => {
      manager.add('scrap', 5);
      expect(manager.get('scrap')).toBe(15);
    });

    it('ignores zero or negative amounts', () => {
      manager.add('scrap', 0);
      expect(manager.get('scrap')).toBe(10);
      manager.add('scrap', -5);
      expect(manager.get('scrap')).toBe(10);
    });

    it('emits resource-changed event', () => {
      manager.add('food', 3);
      expect(mockScene.events.emit).toHaveBeenCalledWith('resource-changed', {
        type: 'food',
        amount: 3,
        total: 8,
      });
    });
  });

  describe('spend', () => {
    it('spends resources and returns true when affordable', () => {
      const result = manager.spend('scrap', 5);
      expect(result).toBe(true);
      expect(manager.get('scrap')).toBe(5);
    });

    it('returns false and does not deduct when not enough', () => {
      const result = manager.spend('scrap', 20);
      expect(result).toBe(false);
      expect(manager.get('scrap')).toBe(10);
    });

    it('allows spending exact amount', () => {
      const result = manager.spend('scrap', 10);
      expect(result).toBe(true);
      expect(manager.get('scrap')).toBe(0);
    });

    it('returns true for zero amount without changing anything', () => {
      const result = manager.spend('scrap', 0);
      expect(result).toBe(true);
      expect(manager.get('scrap')).toBe(10);
    });

    it('emits resource-changed event with negative amount', () => {
      manager.spend('meds', 1);
      expect(mockScene.events.emit).toHaveBeenCalledWith('resource-changed', {
        type: 'meds',
        amount: -1,
        total: 1,
      });
    });
  });

  describe('canAfford', () => {
    it('returns true when all resources are sufficient', () => {
      expect(manager.canAfford({ scrap: 5, food: 3 })).toBe(true);
    });

    it('returns false when any resource is insufficient', () => {
      expect(manager.canAfford({ scrap: 5, parts: 1 })).toBe(false);
    });

    it('returns true for empty cost', () => {
      expect(manager.canAfford({})).toBe(true);
    });

    it('returns true when cost exactly matches available', () => {
      expect(manager.canAfford({ scrap: 10, food: 5, meds: 2 })).toBe(true);
    });
  });

  describe('syncToState', () => {
    it('syncs modified resources back to game state', () => {
      manager.add('scrap', 5);
      manager.spend('food', 2);

      const state = createTestGameState();
      manager.syncToState(state);

      expect(state.inventory.resources.scrap).toBe(15);
      expect(state.inventory.resources.food).toBe(3);
    });
  });
});

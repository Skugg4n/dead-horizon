import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  GameState,
  WeaponInstance,
  RefugeeInstance,
} from '../../src/config/types';

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
    version: '0.5.0',
    player: {
      character: 'soldier',
      skills: {
        combat_melee: 0,
        combat_pistol: 0,
        combat_rifle: 0,
        combat_shotgun: 0,
        looting: 0,
        building: 0,
        speed_agility: 0,
        leadership: 0,
        survival: 0,
        stealth: 0,
      },
      hp: 100,
      maxHp: 100,
    },
    inventory: {
      weapons: [],
      resources: { scrap: 20, food: 10, ammo: 15, parts: 5, meds: 5 },
      loadedAmmo: 0,
    },
    base: { structures: [], level: 1 },
    refugees: [],
    progress: { currentWave: 1, highestWave: 1, totalRuns: 0, totalKills: 0 },
    zone: 'forest',
    achievements: [],
    stats: { structuresPlaced: 0, lootRunsCompleted: 0, itemsCrafted: 0 },
    zoneProgress: {},
    map: { fogOfWar: [], explored: [] },
  };
}

function createTestWeapon(overrides?: Partial<WeaponInstance>): WeaponInstance {
  return {
    id: 'w1',
    weaponId: 'rusty_knife',
    rarity: 'common',
    level: 1,
    xp: 0,
    durability: 10,
    maxDurability: 50,
    upgrades: [],
    ...overrides,
  };
}

import { CraftingManager } from '../../src/systems/CraftingManager';

describe('CraftingManager', () => {
  let manager: CraftingManager;
  let mockScene: ReturnType<typeof createMockScene>;
  let gameState: GameState;
  let ap: number;

  beforeEach(() => {
    mockScene = createMockScene();
    gameState = createTestGameState();
    ap = 12;
    manager = new CraftingManager(
      mockScene as never,
      gameState,
      () => ap,
      (cost: number) => { ap -= cost; },
    );
  });

  describe('getAllRecipes', () => {
    it('returns all recipes', () => {
      const recipes = manager.getAllRecipes();
      expect(recipes.length).toBeGreaterThanOrEqual(5);
    });

    it('each recipe has required fields', () => {
      for (const recipe of manager.getAllRecipes()) {
        expect(recipe.id).toBeDefined();
        expect(recipe.name).toBeDefined();
        expect(recipe.ingredients).toBeDefined();
        expect(recipe.result).toBeDefined();
        expect(typeof recipe.apCost).toBe('number');
      }
    });
  });

  describe('canCraft', () => {
    it('returns true when all resources and AP are sufficient', () => {
      // ammo_pack: scrap 5, parts 1, AP 1
      expect(manager.canCraft('ammo_pack')).toBe(true);
    });

    it('returns false when missing a resource', () => {
      gameState.inventory.resources.parts = 0;
      // ammo_pack needs parts 1
      expect(manager.canCraft('ammo_pack')).toBe(false);
    });

    it('returns false when not enough AP', () => {
      ap = 0;
      expect(manager.canCraft('ammo_pack')).toBe(false);
    });

    it('returns false for unknown recipe', () => {
      expect(manager.canCraft('nonexistent')).toBe(false);
    });

    it('returns true for zero AP cost recipe when AP is 0', () => {
      ap = 0;
      // weapon_repair_kit has apCost 0
      expect(manager.canCraft('weapon_repair_kit')).toBe(true);
    });
  });

  describe('craft -- resource deduction', () => {
    it('deducts ingredients on successful craft', () => {
      // ammo_pack: scrap 5, parts 1
      manager.craft('ammo_pack');
      expect(gameState.inventory.resources.scrap).toBe(15); // 20 - 5
      expect(gameState.inventory.resources.parts).toBe(4); // 5 - 1
    });

    it('deducts AP on successful craft', () => {
      // ammo_pack: apCost 1
      manager.craft('ammo_pack');
      expect(ap).toBe(11);
    });

    it('returns true on success', () => {
      expect(manager.craft('ammo_pack')).toBe(true);
    });

    it('returns false when cannot craft', () => {
      gameState.inventory.resources.scrap = 0;
      expect(manager.craft('ammo_pack')).toBe(false);
    });

    it('does not deduct resources when cannot craft', () => {
      gameState.inventory.resources.scrap = 0;
      manager.craft('ammo_pack');
      expect(gameState.inventory.resources.parts).toBe(5); // unchanged
    });

    it('increments itemsCrafted stat', () => {
      manager.craft('ammo_pack');
      expect(gameState.stats.itemsCrafted).toBe(1);
    });

    it('emits item-crafted event', () => {
      manager.craft('ammo_pack');
      expect(mockScene.events.emit).toHaveBeenCalledWith(
        'item-crafted',
        expect.objectContaining({ recipeId: 'ammo_pack' }),
      );
    });
  });

  describe('craft -- result types', () => {
    it('ammo_pack adds ammo', () => {
      manager.craft('ammo_pack');
      expect(gameState.inventory.resources.ammo).toBe(20); // 15 + 5
    });

    it('rations add food', () => {
      // rations: food 3, meds 1 -> food 5
      manager.craft('rations');
      expect(gameState.inventory.resources.food).toBe(12); // 10 - 3 + 5
    });

    it('weapon_repair_kit repairs most damaged weapon', () => {
      const w1 = createTestWeapon({ id: 'w1', durability: 10, maxDurability: 50 });
      const w2 = createTestWeapon({ id: 'w2', durability: 30, maxDurability: 50 });
      gameState.inventory.weapons.push(w1, w2);

      manager.craft('weapon_repair_kit');
      // w1 was more damaged (10/50 vs 30/50), should be fully repaired
      expect(w1.durability).toBe(50);
      expect(w2.durability).toBe(30); // unchanged
    });

    it('medkit heals injured refugee', () => {
      gameState.refugees.push({
        id: 'r1',
        name: 'Ash',
        hp: 20,
        maxHp: 50,
        status: 'injured',
        job: null,
        skillBonus: 'Tough',
      });

      manager.craft('medkit');
      expect(gameState.refugees[0]?.hp).toBe(50);
      expect(gameState.refugees[0]?.status).toBe('healthy');
    });
  });
});

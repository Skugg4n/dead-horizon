import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  GameState,
  WeaponInstance,
  RefugeeInstance,
  ResourceType,
} from '../../src/config/types';
import {
  COMPANION_STRENGTH,
  ENCOUNTER_LOOT_MULTIPLIER,
  ENCOUNTER_THRESHOLDS,
} from '../../src/config/constants';

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
    version: '0.4.0',
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
      resources: { scrap: 10, food: 10, ammo: 10, parts: 0, meds: 2 },
      loadedAmmo: 0,
    },
    base: { structures: [], level: 0 },
    refugees: [],
    progress: { currentWave: 1, highestWave: 1, totalRuns: 0, totalKills: 0 },
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
    durability: 50,
    maxDurability: 50,
    upgrades: [],
    ...overrides,
  };
}

function createTestRefugee(overrides?: Partial<RefugeeInstance>): RefugeeInstance {
  return {
    id: 'ref_1',
    name: 'Ash',
    hp: 50,
    maxHp: 50,
    status: 'healthy',
    job: null,
    skillBonus: 'Good shot',
    ...overrides,
  };
}

import { LootManager } from '../../src/systems/LootManager';
import type { LootResult } from '../../src/systems/LootManager';

describe('LootManager', () => {
  let manager: LootManager;
  let mockScene: ReturnType<typeof createMockScene>;
  let gameState: GameState;

  beforeEach(() => {
    mockScene = createMockScene();
    gameState = createTestGameState();
    manager = new LootManager(mockScene as never, gameState);
  });

  describe('getDestinations', () => {
    it('returns all loot destinations', () => {
      const dests = manager.getDestinations();
      expect(dests.length).toBeGreaterThanOrEqual(3);
    });

    it('each destination has required fields', () => {
      for (const dest of manager.getDestinations()) {
        expect(dest.id).toBeDefined();
        expect(dest.name).toBeDefined();
        expect(dest.apCost).toBeGreaterThan(0);
        expect(typeof dest.encounterChance).toBe('number');
        expect(Array.isArray(dest.loot)).toBe(true);
      }
    });
  });

  describe('calculateStrength', () => {
    it('returns 0 with no weapons and no companions', () => {
      expect(manager.calculateStrength([], 0)).toBe(0);
    });

    it('sums weapon damage values', () => {
      // rusty_knife has damage 15
      const weapons = [createTestWeapon({ weaponId: 'rusty_knife' })];
      expect(manager.calculateStrength(weapons, 0)).toBe(15);
    });

    it('adds companion strength', () => {
      expect(manager.calculateStrength([], 2)).toBe(2 * COMPANION_STRENGTH);
    });

    it('combines weapons and companions', () => {
      const weapons = [createTestWeapon({ weaponId: 'rusty_knife' })];
      expect(manager.calculateStrength(weapons, 1)).toBe(15 + COMPANION_STRENGTH);
    });

    it('handles unknown weapon gracefully (0 damage)', () => {
      const weapons = [createTestWeapon({ weaponId: 'nonexistent' })];
      expect(manager.calculateStrength(weapons, 0)).toBe(0);
    });
  });

  describe('executeLootRun', () => {
    it('returns loot result for valid destination', () => {
      const result = manager.executeLootRun('nearby_houses', [], []);
      expect(result.destination.id).toBe('nearby_houses');
      expect(result.encounterResolved || result.encounter).toBeDefined();
    });

    it('throws for unknown destination', () => {
      expect(() => manager.executeLootRun('nonexistent', [], [])).toThrow();
    });

    it('adds destination to explored list', () => {
      manager.executeLootRun('nearby_houses', [], []);
      expect(gameState.map.explored).toContain('nearby_houses');
    });

    it('does not duplicate explored entries', () => {
      manager.executeLootRun('nearby_houses', [], []);
      manager.executeLootRun('nearby_houses', [], []);
      const count = gameState.map.explored.filter(e => e === 'nearby_houses').length;
      expect(count).toBe(1);
    });

    it('encounter is boolean', () => {
      const result = manager.executeLootRun('nearby_houses', [], []);
      expect(typeof result.encounter).toBe('boolean');
    });

    it('encounterResolved is true when no encounter', () => {
      // Run many times -- when no encounter, should be resolved
      for (let i = 0; i < 50; i++) {
        const result = manager.executeLootRun('nearby_houses', [], []);
        if (!result.encounter) {
          expect(result.encounterResolved).toBe(true);
        }
      }
    });
  });

  describe('resolveFight', () => {
    it('win: multiplies loot by ENCOUNTER_LOOT_MULTIPLIER', () => {
      const result: LootResult = {
        destination: manager.getDestinations()[0],
        loot: { scrap: 10, food: 4 },
        encounter: true,
        encounterResolved: false,
        encounterOutcome: 'none',
        rescuedRefugee: false,
        injuredCompanions: [],
      };

      // Need strength >= threshold for nearby_houses (50)
      // rusty_knife = 15 damage + 2 companions * 20 = 55 >= 50
      const weapons = [createTestWeapon({ weaponId: 'rusty_knife' })];
      const companions = [createTestRefugee({ id: 'c1' }), createTestRefugee({ id: 'c2' })];

      const resolved = manager.resolveFight(result, weapons, companions);
      expect(resolved.encounterOutcome).toBe('win');
      expect(resolved.encounterResolved).toBe(true);
      expect(resolved.loot.scrap).toBe(Math.round(10 * ENCOUNTER_LOOT_MULTIPLIER));
      expect(resolved.loot.food).toBe(Math.round(4 * ENCOUNTER_LOOT_MULTIPLIER));
    });

    it('lose: clears all loot', () => {
      const result: LootResult = {
        destination: manager.getDestinations()[0],
        loot: { scrap: 10, food: 4 },
        encounter: true,
        encounterResolved: false,
        encounterOutcome: 'none',
        rescuedRefugee: false,
        injuredCompanions: [],
      };

      // No weapons, no companions = 0 strength < threshold
      const resolved = manager.resolveFight(result, [], []);
      expect(resolved.encounterOutcome).toBe('lose');
      expect(Object.keys(resolved.loot)).toHaveLength(0);
    });

    it('lose: companions can be injured', () => {
      // Use military_outpost (threshold 100) so 1 companion (strength 20) loses
      const milDest = manager.getDestinations().find(d => d.id === 'military_outpost')!;

      const companions = [
        createTestRefugee({ id: 'c1' }),
        createTestRefugee({ id: 'c2' }),
        createTestRefugee({ id: 'c3' }),
      ];

      // Run many times to check that injuries can happen (probabilistic)
      let anyInjured = false;
      for (let i = 0; i < 100; i++) {
        const testResult: LootResult = {
          destination: milDest,
          loot: { scrap: 10 },
          encounter: true,
          encounterResolved: false,
          encounterOutcome: 'none',
          rescuedRefugee: false,
          injuredCompanions: [],
        };
        const resolved = manager.resolveFight(testResult, [], [...companions]);
        if (resolved.injuredCompanions.length > 0) {
          anyInjured = true;
          break;
        }
      }
      // With 40% chance per companion and 3 companions, probability of zero injuries in 100 runs is negligible
      expect(anyInjured).toBe(true);
    });
  });

  describe('resolveFlee', () => {
    it('removes one loot type', () => {
      const result: LootResult = {
        destination: manager.getDestinations()[0],
        loot: { scrap: 10, food: 4, ammo: 2 },
        encounter: true,
        encounterResolved: false,
        encounterOutcome: 'none',
        rescuedRefugee: false,
        injuredCompanions: [],
      };

      const resolved = manager.resolveFlee(result);
      expect(resolved.encounterOutcome).toBe('flee');
      expect(resolved.encounterResolved).toBe(true);
      // Should have one fewer loot type
      expect(Object.keys(resolved.loot).length).toBe(2);
    });

    it('handles empty loot gracefully', () => {
      const result: LootResult = {
        destination: manager.getDestinations()[0],
        loot: {},
        encounter: true,
        encounterResolved: false,
        encounterOutcome: 'none',
        rescuedRefugee: false,
        injuredCompanions: [],
      };

      const resolved = manager.resolveFlee(result);
      expect(resolved.encounterOutcome).toBe('flee');
      expect(Object.keys(resolved.loot)).toHaveLength(0);
    });

    it('no companions are injured', () => {
      const result: LootResult = {
        destination: manager.getDestinations()[0],
        loot: { scrap: 10 },
        encounter: true,
        encounterResolved: false,
        encounterOutcome: 'none',
        rescuedRefugee: false,
        injuredCompanions: [],
      };

      const resolved = manager.resolveFlee(result);
      expect(resolved.injuredCompanions).toHaveLength(0);
    });
  });

  describe('awardLootingXP', () => {
    it('emits award-looting-xp event', () => {
      manager.awardLootingXP();
      expect(mockScene.events.emit).toHaveBeenCalledWith('award-looting-xp', 50);
    });
  });
});

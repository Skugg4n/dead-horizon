import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  GameState,
  StructureInstance,
  RefugeeInstance,
} from '../../src/config/types';
import type { EventChoice, EventData } from '../../src/ui/EventDialog';

// Mock Phaser scene with cameras and event system
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
    cameras: {
      main: {
        shake: vi.fn(),
      },
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
      resources: { scrap: 20, food: 10, ammo: 15, parts: 5, meds: 3 },
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

function createTestStructure(overrides?: Partial<StructureInstance>): StructureInstance {
  return {
    id: 's1',
    structureId: 'wall',
    level: 1,
    hp: 50,
    maxHp: 50,
    x: 100,
    y: 100,
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

import { EventManager } from '../../src/systems/EventManager';

describe('EventManager', () => {
  let manager: EventManager;
  let mockScene: ReturnType<typeof createMockScene>;
  let gameState: GameState;

  beforeEach(() => {
    mockScene = createMockScene();
    gameState = createTestGameState();
    manager = new EventManager(mockScene as never, gameState);
  });

  describe('rollEvent', () => {
    it('returns null when random roll exceeds event chance', () => {
      // eventChance is 0.3, so random >= 0.3 means no event
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      expect(manager.rollEvent()).toBeNull();
      vi.restoreAllMocks();
    });

    it('returns an EventData when random roll is below event chance', () => {
      // First call: check chance (< 0.3 triggers event)
      // Second call: pick random event from array
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.1) // triggers event
        .mockReturnValueOnce(0.0); // picks first event
      const event = manager.rollEvent();
      expect(event).not.toBeNull();
      expect(event?.id).toBeDefined();
      expect(event?.name).toBeDefined();
      expect(event?.choices).toBeDefined();
      vi.restoreAllMocks();
    });
  });

  describe('applyChoice -- resource changes', () => {
    it('adds resources from positive effects', () => {
      const event: EventData = {
        id: 'test',
        name: 'Test',
        description: 'Test event',
        type: 'trader',
        choices: [{ text: 'Buy', effect: { ammo: 5 } }],
      };
      const choice = event.choices[0]!;
      manager.applyChoice(event, choice);
      expect(gameState.inventory.resources.ammo).toBe(20); // 15 + 5
    });

    it('deducts resources from negative effects', () => {
      const event: EventData = {
        id: 'test',
        name: 'Test',
        description: 'Test event',
        type: 'trader',
        choices: [{ text: 'Buy', effect: { scrap: -10, ammo: 5 } }],
      };
      const choice = event.choices[0]!;
      manager.applyChoice(event, choice);
      expect(gameState.inventory.resources.scrap).toBe(10); // 20 - 10
      expect(gameState.inventory.resources.ammo).toBe(20); // 15 + 5
    });

    it('does not go below 0 for resources', () => {
      gameState.inventory.resources.scrap = 3;
      const event: EventData = {
        id: 'test',
        name: 'Test',
        description: 'Test event',
        type: 'trader',
        choices: [{ text: 'Buy', effect: { scrap: -10 } }],
      };
      const choice = event.choices[0]!;
      manager.applyChoice(event, choice);
      expect(gameState.inventory.resources.scrap).toBe(0);
    });

    it('returns description of applied effects', () => {
      const event: EventData = {
        id: 'test',
        name: 'Test',
        description: 'Test event',
        type: 'trader',
        choices: [{ text: 'Buy', effect: { scrap: -10, ammo: 5 } }],
      };
      const choice = event.choices[0]!;
      const result = manager.applyChoice(event, choice);
      expect(result).toContain('ammo');
      expect(result).toContain('scrap');
    });

    it('returns "No effect" for empty effects', () => {
      const event: EventData = {
        id: 'test',
        name: 'Test',
        description: 'Test event',
        type: 'trader',
        choices: [{ text: 'Decline', effect: {} }],
      };
      const choice = event.choices[0]!;
      const result = manager.applyChoice(event, choice);
      expect(result).toBe('No effect');
    });
  });

  describe('applyChoice -- lose_refugee', () => {
    it('removes a healthy refugee from the roster', () => {
      gameState.refugees.push(
        createTestRefugee({ id: 'r1', name: 'Ash' }),
        createTestRefugee({ id: 'r2', name: 'Raven' }),
      );

      const event: EventData = {
        id: 'moral_refugee',
        name: 'Desperate Refugee',
        description: 'Test',
        type: 'moral',
        choices: [{ text: 'Let go', effect: { food: -3, lose_refugee: true } }],
      };
      const choice = event.choices[0]!;

      vi.spyOn(Math, 'random').mockReturnValue(0.0); // pick first refugee
      manager.applyChoice(event, choice);
      vi.restoreAllMocks();

      expect(gameState.refugees).toHaveLength(1);
    });

    it('does not remove injured refugees', () => {
      gameState.refugees.push(
        createTestRefugee({ id: 'r1', name: 'Ash', status: 'injured' }),
      );

      const event: EventData = {
        id: 'moral_refugee',
        name: 'Test',
        description: 'Test',
        type: 'moral',
        choices: [{ text: 'Let go', effect: { lose_refugee: true } }],
      };
      const choice = event.choices[0]!;
      manager.applyChoice(event, choice);

      // Injured refugee should not be removed
      expect(gameState.refugees).toHaveLength(1);
    });

    it('handles no refugees gracefully', () => {
      const event: EventData = {
        id: 'moral_refugee',
        name: 'Test',
        description: 'Test',
        type: 'moral',
        choices: [{ text: 'Let go', effect: { lose_refugee: true } }],
      };
      const choice = event.choices[0]!;
      const result = manager.applyChoice(event, choice);
      // Should not crash, result should still be valid
      expect(typeof result).toBe('string');
    });
  });

  describe('applyChoice -- fog_penalty', () => {
    it('sets fog penalty value', () => {
      const event: EventData = {
        id: 'weather_rain',
        name: 'Heavy Rain',
        description: 'Test',
        type: 'weather_rain',
        choices: [{ text: 'Hunker down', effect: { fog_penalty: 2 } }],
      };
      const choice = event.choices[0]!;
      manager.applyChoice(event, choice);
      expect(manager.getFogPenalty()).toBe(2);
    });

    it('defaults to 0 fog penalty', () => {
      expect(manager.getFogPenalty()).toBe(0);
    });
  });

  describe('applyChoice -- structure_damage (storm)', () => {
    it('damages all structures', () => {
      gameState.base.structures.push(
        createTestStructure({ id: 's1', hp: 50, maxHp: 50 }),
        createTestStructure({ id: 's2', hp: 30, maxHp: 50 }),
      );

      const event: EventData = {
        id: 'weather_storm',
        name: 'Storm',
        description: 'Test',
        type: 'weather_storm',
        choices: [{ text: 'Brace', effect: { structure_damage: 10 } }],
      };
      const choice = event.choices[0]!;
      manager.applyChoice(event, choice);

      expect(gameState.base.structures[0]?.hp).toBe(40);
      expect(gameState.base.structures[1]?.hp).toBe(20);
    });

    it('removes destroyed structures (hp <= 0)', () => {
      gameState.base.structures.push(
        createTestStructure({ id: 's1', hp: 5, maxHp: 50 }),
        createTestStructure({ id: 's2', hp: 50, maxHp: 50 }),
      );

      const event: EventData = {
        id: 'weather_storm',
        name: 'Storm',
        description: 'Test',
        type: 'weather_storm',
        choices: [{ text: 'Brace', effect: { structure_damage: 10 } }],
      };
      const choice = event.choices[0]!;
      manager.applyChoice(event, choice);

      expect(gameState.base.structures).toHaveLength(1);
      expect(gameState.base.structures[0]?.id).toBe('s2');
    });

    it('triggers camera shake', () => {
      const event: EventData = {
        id: 'weather_storm',
        name: 'Storm',
        description: 'Test',
        type: 'weather_storm',
        choices: [{ text: 'Brace', effect: { structure_damage: 10 } }],
      };
      const choice = event.choices[0]!;
      manager.applyChoice(event, choice);
      expect(mockScene.cameras.main.shake).toHaveBeenCalled();
    });
  });

  describe('applyChoice -- supply cache', () => {
    it('adds random resources', () => {
      const totalBefore = Object.values(gameState.inventory.resources).reduce((a, b) => a + b, 0);

      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.5) // amount within range
        .mockReturnValueOnce(0.0); // picks first resource type (scrap)

      const event: EventData = {
        id: 'supply_cache',
        name: 'Supply Cache',
        description: 'Test',
        type: 'supply_cache',
        choices: [{ text: 'Collect', effect: { random_resource_min: 5, random_resource_max: 8 } }],
      };
      const choice = event.choices[0]!;
      manager.applyChoice(event, choice);

      vi.restoreAllMocks();

      const totalAfter = Object.values(gameState.inventory.resources).reduce((a, b) => a + b, 0);
      expect(totalAfter).toBeGreaterThan(totalBefore);
    });
  });

  describe('applyChoice -- horde_multiplier', () => {
    it('sets horde multiplier', () => {
      const event: EventData = {
        id: 'horde_warning',
        name: 'Horde Warning',
        description: 'Test',
        type: 'horde_warning',
        choices: [{ text: 'Prepare', effect: { horde_multiplier: 1.25 } }],
      };
      const choice = event.choices[0]!;
      manager.applyChoice(event, choice);
      expect(manager.getHordeMultiplier()).toBe(1.25);
    });

    it('defaults to 1.0 horde multiplier', () => {
      expect(manager.getHordeMultiplier()).toBe(1.0);
    });
  });
});

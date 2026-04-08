import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GameState, RefugeeInstance, StructureInstance } from '../../src/config/types';
import {
  REFUGEE_MAX_HP,
  REFUGEE_FOOD_PER_DAY,
  REFUGEE_FOOD_STARVE_DAMAGE,
  REFUGEE_HEAL_MEDS_COST,
  REFUGEES_PER_SHELTER,
} from '../../src/config/constants';

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
      resources: {
        scrap: 10,
        food: 10,
        ammo: 10,
        parts: 0,
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

function createTestRefugee(overrides?: Partial<RefugeeInstance>): RefugeeInstance {
  return {
    id: 'ref_1',
    name: 'Ash',
    hp: REFUGEE_MAX_HP,
    maxHp: REFUGEE_MAX_HP,
    status: 'healthy',
    job: null,
    skillBonus: 'Good shot',
    bonusType: 'food',
    ...overrides,
  };
}

function createShelter(id: string = 'shelter_1'): StructureInstance {
  return {
    id,
    structureId: 'shelter',
    level: 1,
    hp: 100,
    maxHp: 100,
    x: 0,
    y: 0,
  };
}

import { RefugeeManager } from '../../src/systems/RefugeeManager';

describe('RefugeeManager', () => {
  let manager: RefugeeManager;
  let mockScene: ReturnType<typeof createMockScene>;
  let gameState: GameState;

  beforeEach(() => {
    mockScene = createMockScene();
    gameState = createTestGameState();
    manager = new RefugeeManager(mockScene as never, gameState);
  });

  describe('addRefugee', () => {
    it('adds a refugee with correct default values', () => {
      // Base level 0, no shelters = max 1 refugee
      const refugee = manager.addRefugee();
      expect(refugee).not.toBeNull();
      expect(refugee?.hp).toBe(REFUGEE_MAX_HP);
      expect(refugee?.maxHp).toBe(REFUGEE_MAX_HP);
      expect(refugee?.status).toBe('healthy');
      expect(refugee?.job).toBeNull();
    });

    it('emits refugee-arrived event', () => {
      manager.addRefugee();
      expect(mockScene.events.emit).toHaveBeenCalledWith(
        'refugee-arrived',
        expect.objectContaining({ status: 'healthy' })
      );
    });

    it('returns null when at max capacity (no shelters)', () => {
      // No shelters = max 1 refugee
      manager.addRefugee();
      const second = manager.addRefugee();
      expect(second).toBeNull();
    });

    it('respects shelter capacity', () => {
      // Add 1 shelter = REFUGEES_PER_SHELTER capacity
      gameState.base.structures.push(createShelter());
      manager = new RefugeeManager(mockScene as never, gameState);

      for (let i = 0; i < REFUGEES_PER_SHELTER; i++) {
        expect(manager.addRefugee()).not.toBeNull();
      }
      // One more should fail
      expect(manager.addRefugee()).toBeNull();
    });
  });

  describe('removeRefugee', () => {
    it('removes an existing refugee', () => {
      const refugee = manager.addRefugee();
      expect(manager.getAll()).toHaveLength(1);
      manager.removeRefugee(refugee!.id);
      expect(manager.getAll()).toHaveLength(0);
    });

    it('does nothing for unknown id', () => {
      manager.addRefugee();
      manager.removeRefugee('nonexistent');
      expect(manager.getAll()).toHaveLength(1);
    });
  });

  describe('getMaxRefugees', () => {
    it('returns 1 with no shelters', () => {
      expect(manager.getMaxRefugees()).toBe(1);
    });

    it('returns shelterCount * REFUGEES_PER_SHELTER with shelters', () => {
      gameState.base.structures.push(createShelter('s1'));
      gameState.base.structures.push(createShelter('s2'));
      manager = new RefugeeManager(mockScene as never, gameState);
      expect(manager.getMaxRefugees()).toBe(2 * REFUGEES_PER_SHELTER);
    });
  });

  describe('assignJob', () => {
    it('assigns a job to a healthy refugee', () => {
      const refugee = manager.addRefugee()!;
      const result = manager.assignJob(refugee.id, 'gather_food');
      expect(result).toBe(true);
      expect(manager.getById(refugee.id)?.job).toBe('gather_food');
    });

    it('returns false for unknown refugee', () => {
      expect(manager.assignJob('nonexistent', 'gather_food')).toBe(false);
    });

    it('prevents injured refugees from non-rest jobs', () => {
      gameState.refugees = [createTestRefugee({ status: 'injured', job: 'rest' })];
      manager = new RefugeeManager(mockScene as never, gameState);

      expect(manager.assignJob('ref_1', 'gather_food')).toBe(false);
      expect(manager.getById('ref_1')?.job).toBe('rest');
    });

    it('allows injured refugees to rest', () => {
      gameState.refugees = [createTestRefugee({ status: 'injured', job: null })];
      manager = new RefugeeManager(mockScene as never, gameState);

      expect(manager.assignJob('ref_1', 'rest')).toBe(true);
      expect(manager.getById('ref_1')?.job).toBe('rest');
    });
  });

  describe('consumeFood', () => {
    it('consumes food for all refugees plus player', () => {
      gameState.refugees = [createTestRefugee()];
      gameState.inventory.resources.food = 10;
      manager = new RefugeeManager(mockScene as never, gameState);

      const result = manager.consumeFood();
      // 1 refugee + 1 player = 2 food needed
      expect(result.needed).toBe(1 * REFUGEE_FOOD_PER_DAY + 1);
      expect(result.missing).toBe(0);
      expect(gameState.inventory.resources.food).toBe(10 - result.needed);
    });

    it('starves refugees when food is insufficient', () => {
      gameState.refugees = [createTestRefugee({ id: 'r1' }), createTestRefugee({ id: 'r2', name: 'Raven' })];
      gameState.inventory.resources.food = 1; // not enough for 2 refugees + player
      manager = new RefugeeManager(mockScene as never, gameState);

      const result = manager.consumeFood();
      expect(result.missing).toBeGreaterThan(0);
      // Refugees take REFUGEE_FOOD_STARVE_DAMAGE when starving
    });

    it('removes dead refugees (hp <= 0)', () => {
      const weakRefugee = createTestRefugee({ id: 'weak', hp: 5 });
      gameState.refugees = [weakRefugee];
      gameState.inventory.resources.food = 0; // 0 food for 1 refugee + player
      manager = new RefugeeManager(mockScene as never, gameState);

      manager.consumeFood();
      // With REFUGEE_FOOD_STARVE_DAMAGE = 10, hp 5 -> -5 -> dead
      if (REFUGEE_FOOD_STARVE_DAMAGE >= 5) {
        expect(manager.getAll().find(r => r.id === 'weak')).toBeUndefined();
      }
    });

    it('emits refugee-died for dead refugees', () => {
      const weakRefugee = createTestRefugee({ id: 'weak', hp: 1 });
      gameState.refugees = [weakRefugee];
      gameState.inventory.resources.food = 0;
      manager = new RefugeeManager(mockScene as never, gameState);

      manager.consumeFood();
      expect(mockScene.events.emit).toHaveBeenCalledWith(
        'refugee-died',
        expect.objectContaining({ id: 'weak' })
      );
    });
  });

  describe('processHealing', () => {
    it('heals injured refugee on rest job when meds available', () => {
      const injured = createTestRefugee({ status: 'injured', job: 'rest', hp: 20 });
      gameState.refugees = [injured];
      gameState.inventory.resources.meds = 5;
      manager = new RefugeeManager(mockScene as never, gameState);

      const messages = manager.processHealing();
      expect(messages.length).toBe(1);
      expect(manager.getById('ref_1')?.hp).toBe(REFUGEE_MAX_HP);
      expect(manager.getById('ref_1')?.status).toBe('healthy');
      expect(gameState.inventory.resources.meds).toBe(5 - REFUGEE_HEAL_MEDS_COST);
    });

    it('does not heal when no meds available', () => {
      const injured = createTestRefugee({ status: 'injured', job: 'rest', hp: 20 });
      gameState.refugees = [injured];
      gameState.inventory.resources.meds = 0;
      manager = new RefugeeManager(mockScene as never, gameState);

      const messages = manager.processHealing();
      expect(messages.length).toBe(0);
      expect(manager.getById('ref_1')?.hp).toBe(20);
    });

    it('heals injured refugee regardless of job (Camp Crew auto-heal)', () => {
      const injured = createTestRefugee({ status: 'injured', job: null, hp: 20 });
      gameState.refugees = [injured];
      gameState.inventory.resources.meds = 5;
      manager = new RefugeeManager(mockScene as never, gameState);

      const messages = manager.processHealing();
      // Camp Crew: all injured refugees heal automatically if meds available
      expect(messages.length).toBe(1);
    });

    it('emits refugee-healed event', () => {
      const injured = createTestRefugee({ status: 'injured', job: 'rest', hp: 20 });
      gameState.refugees = [injured];
      gameState.inventory.resources.meds = 5;
      manager = new RefugeeManager(mockScene as never, gameState);

      manager.processHealing();
      expect(mockScene.events.emit).toHaveBeenCalledWith(
        'refugee-healed',
        expect.objectContaining({ id: 'ref_1' })
      );
    });
  });

  describe('applyDailyBonuses (Camp Crew)', () => {
    it('healthy food-bonus refugee produces +1 food', () => {
      gameState.refugees = [createTestRefugee({ bonusType: 'food' })];
      manager = new RefugeeManager(mockScene as never, gameState);

      const result = manager.applyDailyBonuses();
      expect(result.food).toBe(1);
    });

    it('healthy scrap-bonus refugee produces +1 scrap', () => {
      gameState.refugees = [createTestRefugee({ bonusType: 'scrap' })];
      manager = new RefugeeManager(mockScene as never, gameState);

      const result = manager.applyDailyBonuses();
      expect(result.scrap).toBe(1);
    });

    it('injured refugee does not produce', () => {
      gameState.refugees = [createTestRefugee({ status: 'injured', bonusType: 'food' })];
      manager = new RefugeeManager(mockScene as never, gameState);

      const result = manager.applyDailyBonuses();
      expect(result.food).toBe(0);
    });

    it('repair-bonus refugee contributes repair bonus', () => {
      gameState.refugees = [createTestRefugee({ bonusType: 'repair' })];
      manager = new RefugeeManager(mockScene as never, gameState);

      const result = manager.applyDailyBonuses();
      expect(result.repairBonus).toBe(1);
    });
  });

  describe('damageRefugeeInPillbox', () => {
    it('damages refugee and sets injured status', () => {
      gameState.refugees = [createTestRefugee({ hp: REFUGEE_MAX_HP })];
      manager = new RefugeeManager(mockScene as never, gameState);

      manager.damageRefugeeInPillbox('ref_1', 10);
      const ref = manager.getById('ref_1');
      expect(ref?.hp).toBe(REFUGEE_MAX_HP - 10);
      expect(ref?.status).toBe('injured');
      expect(ref?.job).toBe('rest');
    });

    it('Tough refugee takes 50% damage', () => {
      gameState.refugees = [createTestRefugee({ hp: REFUGEE_MAX_HP, skillBonus: 'Tough' })];
      manager = new RefugeeManager(mockScene as never, gameState);

      manager.damageRefugeeInPillbox('ref_1', 10);
      // 10 * 0.5 = 5 damage
      expect(manager.getById('ref_1')?.hp).toBe(REFUGEE_MAX_HP - 5);
    });

    it('removes and emits refugee-died when hp reaches 0', () => {
      gameState.refugees = [createTestRefugee({ hp: 5 })];
      manager = new RefugeeManager(mockScene as never, gameState);

      manager.damageRefugeeInPillbox('ref_1', 10);
      expect(manager.getAll()).toHaveLength(0);
      expect(mockScene.events.emit).toHaveBeenCalledWith(
        'refugee-died',
        expect.objectContaining({ id: 'ref_1' })
      );
    });
  });

  describe('getByStatus and getByJob', () => {
    it('filters by status', () => {
      gameState.refugees = [
        createTestRefugee({ id: 'r1', status: 'healthy' }),
        createTestRefugee({ id: 'r2', name: 'Raven', status: 'injured' }),
      ];
      manager = new RefugeeManager(mockScene as never, gameState);

      expect(manager.getByStatus('healthy')).toHaveLength(1);
      expect(manager.getByStatus('injured')).toHaveLength(1);
    });

    it('filters by job', () => {
      gameState.refugees = [
        createTestRefugee({ id: 'r1', job: 'gather_food' }),
        createTestRefugee({ id: 'r2', name: 'Raven', job: 'repair' }),
        createTestRefugee({ id: 'r3', name: 'Flint', job: 'gather_food' }),
      ];
      manager = new RefugeeManager(mockScene as never, gameState);

      expect(manager.getByJob('gather_food')).toHaveLength(2);
      expect(manager.getByJob('repair')).toHaveLength(1);
    });
  });

  describe('syncToState', () => {
    it('syncs refugees back to game state', () => {
      manager.addRefugee();
      manager.syncToState();
      expect(gameState.refugees).toHaveLength(1);
    });

    it('reflects removals', () => {
      const refugee = manager.addRefugee()!;
      manager.removeRefugee(refugee.id);
      manager.syncToState();
      expect(gameState.refugees).toHaveLength(0);
    });
  });

  describe('getPillboxRefugees', () => {
    it('returns all healthy refugees (Camp Crew: no job assignment needed)', () => {
      // v5.3+ Camp Crew change: any healthy refugee auto-mans pillboxes.
      // Job assignment is no longer required for pillbox duty.
      gameState.refugees = [
        createTestRefugee({ id: 'r1', status: 'healthy', job: 'pillbox' }),
        createTestRefugee({ id: 'r2', name: 'Raven', status: 'injured', job: 'pillbox' }),
        createTestRefugee({ id: 'r3', status: 'healthy', job: 'gather_food' }),
      ];
      manager = new RefugeeManager(mockScene as never, gameState);

      const pillbox = manager.getPillboxRefugees();
      // r1 and r3 are healthy (r2 is injured and excluded)
      expect(pillbox).toHaveLength(2);
      expect(pillbox.map(r => r.id)).toContain('r1');
      expect(pillbox.map(r => r.id)).toContain('r3');
    });
  });
});

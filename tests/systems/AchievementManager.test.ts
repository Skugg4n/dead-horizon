import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GameState, RefugeeInstance, WeaponInstance } from '../../src/config/types';

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
      main: { width: 800, height: 600 },
    },
    add: {
      graphics: vi.fn(() => ({
        fillStyle: vi.fn().mockReturnThis(),
        fillRect: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        strokeRect: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
      text: vi.fn(() => ({
        setOrigin: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
    },
    tweens: {
      add: vi.fn(),
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
    base: { structures: [], level: 0 },
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
    durability: 50,
    maxDurability: 50,
    upgrades: [],
    ...overrides,
  };
}

function createTestRefugee(overrides?: Partial<RefugeeInstance>): RefugeeInstance {
  return {
    id: 'r1',
    name: 'Ash',
    hp: 50,
    maxHp: 50,
    status: 'healthy',
    job: null,
    skillBonus: 'Tough',
    ...overrides,
  };
}

import { AchievementManager } from '../../src/systems/AchievementManager';

describe('AchievementManager', () => {
  let manager: AchievementManager;
  let mockScene: ReturnType<typeof createMockScene>;
  let gameState: GameState;

  beforeEach(() => {
    mockScene = createMockScene();
    gameState = createTestGameState();
    manager = new AchievementManager(mockScene as never, gameState);
  });

  describe('checkAll -- total_kills condition', () => {
    it('unlocks "first_blood" when totalKills >= 1', () => {
      gameState.progress.totalKills = 1;
      manager.checkAll();
      expect(gameState.achievements).toContain('first_blood');
    });

    it('does not unlock "first_blood" at 0 kills', () => {
      gameState.progress.totalKills = 0;
      manager.checkAll();
      expect(gameState.achievements).not.toContain('first_blood');
    });

    it('unlocks "zombie_slayer" at 100 kills', () => {
      gameState.progress.totalKills = 100;
      manager.checkAll();
      expect(gameState.achievements).toContain('zombie_slayer');
    });

    it('does not duplicate already unlocked achievements', () => {
      gameState.progress.totalKills = 5;
      manager.checkAll();
      manager.checkAll();
      const count = gameState.achievements.filter(a => a === 'first_blood').length;
      expect(count).toBe(1);
    });
  });

  describe('checkAll -- highest_wave condition', () => {
    it('unlocks "wave_survivor" at wave 5', () => {
      gameState.progress.highestWave = 5;
      manager.checkAll();
      expect(gameState.achievements).toContain('wave_survivor');
    });

    it('does not unlock "wave_survivor" at wave 4', () => {
      gameState.progress.highestWave = 4;
      manager.checkAll();
      expect(gameState.achievements).not.toContain('wave_survivor');
    });
  });

  describe('checkAll -- structures_placed condition', () => {
    it('unlocks "builder" at 10 structures placed', () => {
      gameState.stats.structuresPlaced = 10;
      manager.checkAll();
      expect(gameState.achievements).toContain('builder');
    });
  });

  describe('checkAll -- loot_runs condition', () => {
    it('unlocks "scavenger" at 5 loot runs', () => {
      gameState.stats.lootRunsCompleted = 5;
      manager.checkAll();
      expect(gameState.achievements).toContain('scavenger');
    });
  });

  describe('checkAll -- refugees condition', () => {
    it('unlocks "community" with 5 refugees', () => {
      for (let i = 0; i < 5; i++) {
        gameState.refugees.push(createTestRefugee({ id: `r${i}` }));
      }
      manager.checkAll();
      expect(gameState.achievements).toContain('community');
    });
  });

  describe('checkAll -- weapons condition', () => {
    it('unlocks "arsenal" with 4 weapons', () => {
      for (let i = 0; i < 4; i++) {
        gameState.inventory.weapons.push(createTestWeapon({ id: `w${i}` }));
      }
      manager.checkAll();
      expect(gameState.achievements).toContain('arsenal');
    });
  });

  describe('checkAll -- items_crafted condition', () => {
    it('unlocks "master_craftsman" at 10 items crafted', () => {
      gameState.stats.itemsCrafted = 10;
      manager.checkAll();
      expect(gameState.achievements).toContain('master_craftsman');
    });
  });

  describe('checkAll -- base_level condition', () => {
    it('unlocks "fully_upgraded" at base level 3', () => {
      gameState.base.level = 3;
      manager.checkAll();
      expect(gameState.achievements).toContain('fully_upgraded');
    });
  });

  describe('checkAll -- emits events', () => {
    it('emits achievement-unlocked for each new achievement', () => {
      gameState.progress.totalKills = 1;
      manager.checkAll();
      expect(mockScene.events.emit).toHaveBeenCalledWith(
        'achievement-unlocked',
        expect.objectContaining({ id: 'first_blood' }),
      );
    });

    it('does not emit for already unlocked achievements', () => {
      gameState.achievements.push('first_blood');
      gameState.progress.totalKills = 1;
      manager.checkAll();
      expect(mockScene.events.emit).not.toHaveBeenCalledWith(
        'achievement-unlocked',
        expect.objectContaining({ id: 'first_blood' }),
      );
    });
  });

  describe('unlockNoDamage', () => {
    it('unlocks "untouchable" achievement', () => {
      manager.unlockNoDamage();
      expect(gameState.achievements).toContain('untouchable');
    });

    it('does not duplicate if already unlocked', () => {
      manager.unlockNoDamage();
      manager.unlockNoDamage();
      const count = gameState.achievements.filter(a => a === 'untouchable').length;
      expect(count).toBe(1);
    });

    it('emits achievement-unlocked event', () => {
      manager.unlockNoDamage();
      expect(mockScene.events.emit).toHaveBeenCalledWith(
        'achievement-unlocked',
        expect.objectContaining({ id: 'untouchable' }),
      );
    });
  });

  describe('getAllWithStatus', () => {
    it('returns all achievements with unlock status', () => {
      const all = manager.getAllWithStatus();
      expect(all.length).toBeGreaterThanOrEqual(10);
      for (const entry of all) {
        expect(entry.data.id).toBeDefined();
        expect(typeof entry.unlocked).toBe('boolean');
      }
    });

    it('marks unlocked achievements correctly', () => {
      gameState.achievements.push('first_blood');
      const all = manager.getAllWithStatus();
      const firstBlood = all.find(a => a.data.id === 'first_blood');
      expect(firstBlood?.unlocked).toBe(true);
    });

    it('marks locked achievements correctly', () => {
      const all = manager.getAllWithStatus();
      const firstBlood = all.find(a => a.data.id === 'first_blood');
      expect(firstBlood?.unlocked).toBe(false);
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GameState, SkillType } from '../../src/config/types';

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
    version: '0.2.3',
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

import { SkillManager } from '../../src/systems/SkillManager';

describe('SkillManager', () => {
  let manager: SkillManager;
  let mockScene: ReturnType<typeof createMockScene>;
  let gameState: GameState;

  beforeEach(() => {
    mockScene = createMockScene();
    gameState = createTestGameState();
    manager = new SkillManager(mockScene as never, gameState);
  });

  describe('getXP', () => {
    it('returns 0 for fresh skills', () => {
      expect(manager.getXP('combat_melee')).toBe(0);
      expect(manager.getXP('looting')).toBe(0);
    });

    it('returns initial XP from game state', () => {
      gameState.player.skills.combat_melee = 50;
      manager = new SkillManager(mockScene as never, gameState);
      expect(manager.getXP('combat_melee')).toBe(50);
    });
  });

  describe('getLevel', () => {
    it('returns 0 with no XP', () => {
      expect(manager.getLevel('combat_melee')).toBe(0);
    });

    it('returns level 1 after reaching first threshold', () => {
      // combat_melee xpPerLevel: [100, 250, 500, ...]
      // Need 100 XP cumulative for level 1
      gameState.player.skills.combat_melee = 100;
      manager = new SkillManager(mockScene as never, gameState);
      expect(manager.getLevel('combat_melee')).toBe(1);
    });

    it('returns level 2 after reaching second threshold', () => {
      // Need 100 + 250 = 350 cumulative for level 2
      gameState.player.skills.combat_melee = 350;
      manager = new SkillManager(mockScene as never, gameState);
      expect(manager.getLevel('combat_melee')).toBe(2);
    });

    it('does not exceed max level', () => {
      // Max level is 10. Total XP for all levels:
      // 100+250+500+800+1200+1700+2300+3000+3800+5000 = 18650
      gameState.player.skills.combat_melee = 999999;
      manager = new SkillManager(mockScene as never, gameState);
      expect(manager.getLevel('combat_melee')).toBe(10);
    });

    it('returns 0 just below threshold', () => {
      gameState.player.skills.combat_melee = 99;
      manager = new SkillManager(mockScene as never, gameState);
      expect(manager.getLevel('combat_melee')).toBe(0);
    });
  });

  describe('addXP', () => {
    it('adds XP to a skill', () => {
      manager.addXP('combat_melee', 50);
      expect(manager.getXP('combat_melee')).toBe(50);
    });

    it('accumulates XP across multiple calls', () => {
      manager.addXP('combat_melee', 30);
      manager.addXP('combat_melee', 20);
      expect(manager.getXP('combat_melee')).toBe(50);
    });

    it('returns true when skill levels up', () => {
      const result = manager.addXP('combat_melee', 100);
      expect(result).toBe(true);
      expect(manager.getLevel('combat_melee')).toBe(1);
    });

    it('returns false when skill does not level up', () => {
      const result = manager.addXP('combat_melee', 50);
      expect(result).toBe(false);
      expect(manager.getLevel('combat_melee')).toBe(0);
    });

    it('emits skill-leveled event on level up', () => {
      manager.addXP('combat_melee', 100);
      expect(mockScene.events.emit).toHaveBeenCalledWith('skill-leveled', {
        skill: 'combat_melee',
        newLevel: 1,
      });
    });

    it('does not emit event when no level up', () => {
      manager.addXP('combat_melee', 50);
      expect(mockScene.events.emit).not.toHaveBeenCalled();
    });
  });

  describe('getBonus', () => {
    it('returns 0 at level 0', () => {
      expect(manager.getBonus('combat_melee', 'damage')).toBe(0);
    });

    it('returns correct bonus at level 1', () => {
      // combat_melee effectPerLevel: { damage: 0.05, attackSpeed: 0.03 }
      gameState.player.skills.combat_melee = 100; // level 1
      manager = new SkillManager(mockScene as never, gameState);

      expect(manager.getBonus('combat_melee', 'damage')).toBeCloseTo(0.05);
      expect(manager.getBonus('combat_melee', 'attackSpeed')).toBeCloseTo(0.03);
    });

    it('scales linearly with level', () => {
      // Level 2 = 100 + 250 = 350 XP
      gameState.player.skills.combat_melee = 350;
      manager = new SkillManager(mockScene as never, gameState);

      expect(manager.getBonus('combat_melee', 'damage')).toBeCloseTo(0.10);
      expect(manager.getBonus('combat_melee', 'attackSpeed')).toBeCloseTo(0.06);
    });

    it('returns 0 for unknown effect name', () => {
      gameState.player.skills.combat_melee = 100;
      manager = new SkillManager(mockScene as never, gameState);

      expect(manager.getBonus('combat_melee', 'nonexistent')).toBe(0);
    });
  });

  describe('getXPForLevel', () => {
    it('returns 0 for level 0', () => {
      expect(manager.getXPForLevel('combat_melee', 0)).toBe(0);
    });

    it('returns cumulative XP for level 1', () => {
      expect(manager.getXPForLevel('combat_melee', 1)).toBe(100);
    });

    it('returns cumulative XP for level 2', () => {
      expect(manager.getXPForLevel('combat_melee', 2)).toBe(350);
    });
  });

  describe('getAllSkills', () => {
    it('returns all 6 skills', () => {
      const skills = manager.getAllSkills();
      expect(skills).toHaveLength(6);
    });

    it('includes xp and level for each skill', () => {
      gameState.player.skills.combat_melee = 100;
      manager = new SkillManager(mockScene as never, gameState);

      const skills = manager.getAllSkills();
      const melee = skills.find(s => s.data.id === 'combat_melee');
      expect(melee).toBeDefined();
      expect(melee?.xp).toBe(100);
      expect(melee?.level).toBe(1);
    });
  });

  describe('getSkillData (static)', () => {
    it('returns data for known skill', () => {
      const data = SkillManager.getSkillData('combat_melee');
      expect(data).toBeDefined();
      expect(data?.name).toBe('Melee Combat');
      expect(data?.maxLevel).toBe(10);
    });

    it('returns undefined for unknown skill', () => {
      expect(SkillManager.getSkillData('nonexistent' as SkillType)).toBeUndefined();
    });
  });

  describe('syncToState', () => {
    it('syncs modified XP back to game state', () => {
      manager.addXP('combat_melee', 50);
      manager.addXP('looting', 30);

      const newState = createTestGameState();
      manager.syncToState(newState);

      expect(newState.player.skills.combat_melee).toBe(50);
      expect(newState.player.skills.looting).toBe(30);
      expect(newState.player.skills.combat_pistol).toBe(0);
    });
  });
});

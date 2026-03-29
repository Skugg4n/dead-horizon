import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GameState, ZoneId } from '../../src/config/types';

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

import { ZoneManager } from '../../src/systems/ZoneManager';

describe('ZoneManager', () => {
  let manager: ZoneManager;
  let mockScene: ReturnType<typeof createMockScene>;
  let gameState: GameState;

  beforeEach(() => {
    mockScene = createMockScene();
    gameState = createTestGameState();
    manager = new ZoneManager(mockScene as never, gameState);
  });

  describe('getCurrentZone', () => {
    it('returns forest zone by default', () => {
      const zone = manager.getCurrentZone();
      expect(zone.id).toBe('forest');
      expect(zone.name).toBe('Forest');
    });

    it('returns correct zone after switching', () => {
      // Unlock city first
      gameState.zoneProgress.forest = { highestWaveCleared: 5 };
      manager.setZone('city');
      const zone = manager.getCurrentZone();
      expect(zone.id).toBe('city');
    });
  });

  describe('isUnlocked', () => {
    it('forest is always unlocked (no unlock condition)', () => {
      expect(manager.isUnlocked('forest')).toBe(true);
    });

    it('city is locked by default', () => {
      expect(manager.isUnlocked('city')).toBe(false);
    });

    it('city is unlocked after clearing forest wave 5', () => {
      gameState.zoneProgress.forest = { highestWaveCleared: 5 };
      expect(manager.isUnlocked('city')).toBe(true);
    });

    it('city stays locked at forest wave 4', () => {
      gameState.zoneProgress.forest = { highestWaveCleared: 4 };
      expect(manager.isUnlocked('city')).toBe(false);
    });

    it('military is locked without city wave 5', () => {
      gameState.zoneProgress.forest = { highestWaveCleared: 5 };
      expect(manager.isUnlocked('military')).toBe(false);
    });

    it('military is unlocked after clearing city wave 5', () => {
      gameState.zoneProgress.city = { highestWaveCleared: 5 };
      expect(manager.isUnlocked('military')).toBe(true);
    });

    it('returns false for unknown zone id', () => {
      expect(manager.isUnlocked('nonexistent' as ZoneId)).toBe(false);
    });
  });

  describe('setZone', () => {
    it('switches to an unlocked zone and returns true', () => {
      gameState.zoneProgress.forest = { highestWaveCleared: 5 };
      const result = manager.setZone('city');
      expect(result).toBe(true);
      expect(gameState.zone).toBe('city');
    });

    it('returns false for a locked zone', () => {
      const result = manager.setZone('city');
      expect(result).toBe(false);
      expect(gameState.zone).toBe('forest'); // unchanged
    });

    it('emits zone-changed event on success', () => {
      gameState.zoneProgress.forest = { highestWaveCleared: 5 };
      manager.setZone('city');
      expect(mockScene.events.emit).toHaveBeenCalledWith('zone-changed', 'city');
    });

    it('does not emit event on failure', () => {
      manager.setZone('city');
      expect(mockScene.events.emit).not.toHaveBeenCalled();
    });
  });

  describe('getUnlockedZones', () => {
    it('returns only forest by default', () => {
      const unlocked = manager.getUnlockedZones();
      expect(unlocked).toHaveLength(1);
      expect(unlocked[0]?.id).toBe('forest');
    });

    it('returns forest and city after forest wave 5', () => {
      gameState.zoneProgress.forest = { highestWaveCleared: 5 };
      const unlocked = manager.getUnlockedZones();
      expect(unlocked).toHaveLength(2);
      expect(unlocked.map(z => z.id)).toContain('city');
    });

    it('returns all zones when all conditions met', () => {
      gameState.zoneProgress.forest = { highestWaveCleared: 5 };
      gameState.zoneProgress.city = { highestWaveCleared: 5 };
      const unlocked = manager.getUnlockedZones();
      expect(unlocked).toHaveLength(3);
    });
  });

  describe('getAllZones', () => {
    it('returns all 3 zones', () => {
      expect(manager.getAllZones()).toHaveLength(3);
    });

    it('each zone has required fields', () => {
      for (const zone of manager.getAllZones()) {
        expect(zone.id).toBeDefined();
        expect(zone.name).toBeDefined();
        expect(zone.description).toBeDefined();
        expect(zone.waveFile).toBeDefined();
        expect(typeof zone.lootMultiplier).toBe('number');
      }
    });
  });

  describe('recordWaveCleared', () => {
    it('records wave progress for current zone', () => {
      manager.recordWaveCleared(3);
      expect(gameState.zoneProgress.forest?.highestWaveCleared).toBe(3);
    });

    it('updates to higher wave', () => {
      manager.recordWaveCleared(3);
      manager.recordWaveCleared(5);
      expect(gameState.zoneProgress.forest?.highestWaveCleared).toBe(5);
    });

    it('does not downgrade wave progress', () => {
      manager.recordWaveCleared(5);
      manager.recordWaveCleared(3);
      expect(gameState.zoneProgress.forest?.highestWaveCleared).toBe(5);
    });

    it('initializes zone progress if not present', () => {
      expect(gameState.zoneProgress.forest).toBeUndefined();
      manager.recordWaveCleared(1);
      expect(gameState.zoneProgress.forest).toBeDefined();
    });
  });
});

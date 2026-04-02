import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  GameState,
  WeaponInstance,
  WeaponUpgradeType,
} from '../../src/config/types';

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
        parts: 10,
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

function createTestWeapon(overrides?: Partial<WeaponInstance>): WeaponInstance {
  return {
    id: 'test_weapon_1',
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

import { WeaponManager } from '../../src/systems/WeaponManager';

describe('WeaponManager', () => {
  let manager: WeaponManager;
  let mockScene: ReturnType<typeof createMockScene>;
  let gameState: GameState;

  beforeEach(() => {
    mockScene = createMockScene();
    gameState = createTestGameState();
    manager = new WeaponManager(mockScene as never, gameState);
  });

  describe('getWeapons', () => {
    it('returns empty array when no weapons', () => {
      expect(manager.getWeapons()).toEqual([]);
    });

    it('returns weapons from game state', () => {
      const weapon = createTestWeapon();
      gameState.inventory.weapons.push(weapon);
      expect(manager.getWeapons()).toHaveLength(1);
      expect(manager.getWeapons()[0]?.weaponId).toBe('rusty_knife');
    });
  });

  describe('getEquipped', () => {
    it('returns null when no weapons', () => {
      expect(manager.getEquipped()).toBeNull();
    });

    it('returns first weapon by default', () => {
      gameState.inventory.weapons.push(createTestWeapon());
      // Re-create manager so constructor picks up the weapon
      manager = new WeaponManager(mockScene as never, gameState);
      expect(manager.getEquipped()).not.toBeNull();
      expect(manager.getEquipped()?.id).toBe('test_weapon_1');
    });
  });

  describe('switchWeapon', () => {
    it('switches to valid slot', () => {
      gameState.inventory.weapons.push(
        createTestWeapon({ id: 'w1', weaponId: 'rusty_knife' }),
        createTestWeapon({ id: 'w2', weaponId: 'worn_pistol' })
      );
      manager = new WeaponManager(mockScene as never, gameState);

      manager.switchWeapon(1);
      expect(manager.getEquipped()?.id).toBe('w2');
      expect(manager.getEquippedIndex()).toBe(1);
    });

    it('ignores invalid slot (negative)', () => {
      gameState.inventory.weapons.push(createTestWeapon());
      manager = new WeaponManager(mockScene as never, gameState);

      manager.switchWeapon(-1);
      expect(manager.getEquippedIndex()).toBe(0);
    });

    it('ignores invalid slot (out of range)', () => {
      gameState.inventory.weapons.push(createTestWeapon());
      manager = new WeaponManager(mockScene as never, gameState);

      manager.switchWeapon(5);
      expect(manager.getEquippedIndex()).toBe(0);
    });

    it('emits weapon-switched event', () => {
      gameState.inventory.weapons.push(
        createTestWeapon({ id: 'w1' }),
        createTestWeapon({ id: 'w2' })
      );
      manager = new WeaponManager(mockScene as never, gameState);

      manager.switchWeapon(1);
      expect(mockScene.events.emit).toHaveBeenCalledWith('weapon-switched', expect.objectContaining({ id: 'w2' }));
    });
  });

  describe('equip', () => {
    it('equips weapon by id', () => {
      gameState.inventory.weapons.push(
        createTestWeapon({ id: 'w1' }),
        createTestWeapon({ id: 'w2' })
      );
      manager = new WeaponManager(mockScene as never, gameState);

      manager.equip('w2');
      expect(manager.getEquippedIndex()).toBe(1);
    });

    it('does nothing for unknown weapon id', () => {
      gameState.inventory.weapons.push(createTestWeapon({ id: 'w1' }));
      manager = new WeaponManager(mockScene as never, gameState);

      manager.equip('nonexistent');
      expect(manager.getEquippedIndex()).toBe(0);
    });
  });

  describe('getWeaponData (static)', () => {
    it('returns data for known weapon', () => {
      const data = WeaponManager.getWeaponData('rusty_knife');
      expect(data).toBeDefined();
      expect(data?.name).toBe('Rusty Knife');
      expect(data?.class).toBe('melee');
      expect(data?.damage).toBe(15);
    });

    it('returns undefined for unknown weapon', () => {
      expect(WeaponManager.getWeaponData('nonexistent')).toBeUndefined();
    });
  });

  describe('getWeaponStats', () => {
    it('returns base stats for common level 1 weapon', () => {
      const weapon = createTestWeapon({ weaponId: 'rusty_knife', rarity: 'common', level: 1 });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      const stats = manager.getWeaponStats(weapon);
      expect(stats.damage).toBe(15); // common mult = 1.0, level 1 no bonus
      expect(stats.range).toBe(40);
      expect(stats.noiseLevel).toBe(0);
      expect(stats.weaponClass).toBe('melee');
      expect(stats.name).toBe('Rusty Knife');
    });

    it('applies rarity multiplier', () => {
      const weapon = createTestWeapon({ weaponId: 'rusty_knife', rarity: 'uncommon', level: 1 });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      const stats = manager.getWeaponStats(weapon);
      // 15 * 1.15 = 17.25, rounded = 17
      expect(stats.damage).toBe(17);
    });

    it('applies level 3 damage multiplier', () => {
      const weapon = createTestWeapon({ weaponId: 'rusty_knife', rarity: 'common', level: 3 });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      const stats = manager.getWeaponStats(weapon);
      // 15 * 1.0 * 1.10 = 16.5, rounded = 17
      expect(stats.damage).toBe(17);
    });

    it('applies level 2 fire rate multiplier', () => {
      const weapon = createTestWeapon({ weaponId: 'rusty_knife', rarity: 'common', level: 2 });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      const stats = manager.getWeaponStats(weapon);
      // 500 * 0.90 = 450
      expect(stats.fireRate).toBe(450);
    });

    it('applies damage_boost upgrade', () => {
      const weapon = createTestWeapon({
        weaponId: 'rusty_knife',
        rarity: 'common',
        level: 1,
        upgrades: [{ id: 'damage_boost', level: 1 }],
      });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      const stats = manager.getWeaponStats(weapon);
      // 15 * 1.15 = 17.25, rounded = 17
      expect(stats.damage).toBe(17);
    });

    it('applies suppressor upgrade', () => {
      const weapon = createTestWeapon({
        weaponId: 'worn_pistol',
        rarity: 'common',
        level: 1,
        upgrades: [{ id: 'suppressor', level: 1 }],
      });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      const stats = manager.getWeaponStats(weapon);
      // noiseLevel 2 - 1 = 1
      expect(stats.noiseLevel).toBe(1);
    });

    it('applies scope upgrade', () => {
      const weapon = createTestWeapon({
        weaponId: 'worn_pistol',
        rarity: 'common',
        level: 1,
        upgrades: [{ id: 'scope', level: 1 }],
      });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      const stats = manager.getWeaponStats(weapon);
      // 200 * 1.15 = 230
      expect(stats.range).toBe(230);
    });

    it('returns fallback stats for unknown weaponId', () => {
      const weapon = createTestWeapon({ weaponId: 'nonexistent' });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      const stats = manager.getWeaponStats(weapon);
      expect(stats.damage).toBe(1);
      expect(stats.name).toBe('Unknown');
    });
  });

  describe('addXP and leveling', () => {
    it('adds XP to weapon', () => {
      const weapon = createTestWeapon({ id: 'w1', level: 1, xp: 0 });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      manager.addXP('w1', 5);
      expect(weapon.xp).toBe(5);
    });

    it('levels up weapon when XP threshold reached', () => {
      // xpPerLevel = [0, 10, 25, 50, 100]
      // At level 1, need xpPerLevel[1] = 10 XP to level up
      const weapon = createTestWeapon({ id: 'w1', level: 1, xp: 0 });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      manager.addXP('w1', 10);
      expect(weapon.level).toBe(2);
      expect(weapon.xp).toBe(0); // XP reset after leveling
    });

    it('emits weapon-leveled event on level up', () => {
      const weapon = createTestWeapon({ id: 'w1', level: 1, xp: 0 });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      manager.addXP('w1', 10);
      expect(mockScene.events.emit).toHaveBeenCalledWith('weapon-leveled', expect.objectContaining({ id: 'w1', level: 2 }));
    });

    it('does not level past max level 5', () => {
      const weapon = createTestWeapon({ id: 'w1', level: 5, xp: 0 });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      manager.addXP('w1', 1000);
      expect(weapon.level).toBe(5);
    });

    it('does nothing for nonexistent weapon', () => {
      manager.addXP('nonexistent', 10);
      // Should not throw
    });
  });

  describe('getXPForNextLevel', () => {
    it('returns XP needed for next level', () => {
      const weapon = createTestWeapon({ level: 1 });
      const needed = manager.getXPForNextLevel(weapon);
      // xpPerLevel[1] = 10
      expect(needed).toBe(10);
    });

    it('returns 0 at max level', () => {
      const weapon = createTestWeapon({ level: 5 });
      expect(manager.getXPForNextLevel(weapon)).toBe(0);
    });
  });

  describe('durability', () => {
    it('decreases durability by 1', () => {
      const weapon = createTestWeapon({ id: 'w1', durability: 50 });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      manager.decreaseDurability('w1');
      expect(weapon.durability).toBe(49);
    });

    it('does not go below 0', () => {
      const weapon = createTestWeapon({ id: 'w1', durability: 0 });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      manager.decreaseDurability('w1');
      expect(weapon.durability).toBe(0);
    });

    it('emits weapon-broken at 0 durability', () => {
      const weapon = createTestWeapon({ id: 'w1', durability: 1 });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      manager.decreaseDurability('w1');
      expect(mockScene.events.emit).toHaveBeenCalledWith('weapon-broken', expect.objectContaining({ id: 'w1' }));
    });

    it('isBroken returns true when durability is 0', () => {
      const weapon = createTestWeapon({ durability: 0 });
      expect(manager.isBroken(weapon)).toBe(true);
    });

    it('isBroken returns false when durability > 0', () => {
      const weapon = createTestWeapon({ durability: 1 });
      expect(manager.isBroken(weapon)).toBe(false);
    });
  });

  describe('repair', () => {
    it('repairs weapon to max durability and costs 1 parts', () => {
      const weapon = createTestWeapon({ id: 'w1', durability: 10, maxDurability: 50 });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      const result = manager.repair('w1');
      expect(result).toBe(true);
      expect(weapon.durability).toBe(50);
      expect(gameState.inventory.resources.parts).toBe(9);
    });

    it('returns false when already at max durability', () => {
      const weapon = createTestWeapon({ id: 'w1', durability: 50, maxDurability: 50 });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      expect(manager.repair('w1')).toBe(false);
    });

    it('returns false when not enough parts', () => {
      const weapon = createTestWeapon({ id: 'w1', durability: 10, maxDurability: 50 });
      gameState.inventory.weapons.push(weapon);
      gameState.inventory.resources.parts = 0;
      manager = new WeaponManager(mockScene as never, gameState);

      expect(manager.repair('w1')).toBe(false);
    });

    it('returns false for nonexistent weapon', () => {
      expect(manager.repair('nonexistent')).toBe(false);
    });
  });

  describe('upgrades', () => {
    it('canUpgrade returns true when affordable and not already applied', () => {
      const weapon = createTestWeapon({ id: 'w1', upgrades: [] });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      expect(manager.canUpgrade('w1', 'damage_boost')).toBe(true);
    });

    it('canUpgrade returns true for leveling up existing upgrade', () => {
      // With tiered upgrades, canUpgrade should return true if not at max level
      const weapon = createTestWeapon({ id: 'w1', upgrades: [{ id: 'damage_boost', level: 1 }] });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      // Level 1 of 3 -- should be upgradeable to level 2
      expect(manager.canUpgrade('w1', 'damage_boost')).toBe(true);
    });

    it('canUpgrade returns false when not enough parts', () => {
      const weapon = createTestWeapon({ id: 'w1', upgrades: [] });
      gameState.inventory.weapons.push(weapon);
      gameState.inventory.resources.parts = 0;
      manager = new WeaponManager(mockScene as never, gameState);

      expect(manager.canUpgrade('w1', 'damage_boost')).toBe(false);
    });

    it('upgrade applies upgrade and deducts parts', () => {
      const weapon = createTestWeapon({ id: 'w1', upgrades: [] });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      const result = manager.upgrade('w1', 'damage_boost');
      expect(result).toBe(true);
      // Upgrades are now WeaponUpgrade[] objects, not strings
      expect(weapon.upgrades.some(u => u.id === 'damage_boost')).toBe(true);
      // damage_boost level 1 costs 3 parts
      expect(gameState.inventory.resources.parts).toBe(7);
    });

    it('reinforcement upgrade tracked in upgrades array', () => {
      const weapon = createTestWeapon({ id: 'w1', upgrades: [], maxDurability: 50 });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      manager.upgrade('w1', 'reinforcement');
      expect(weapon.upgrades.some(u => u.id === 'reinforcement')).toBe(true);
    });

    it('upgrade returns false when max slots reached', () => {
      const weapon = createTestWeapon({
        id: 'w1',
        upgrades: [
          { id: 'damage_boost', level: 1 },
          { id: 'reinforcement', level: 1 },
          { id: 'quick_grip', level: 1 },
        ],
      });
      gameState.inventory.weapons.push(weapon);
      manager = new WeaponManager(mockScene as never, gameState);

      // 3 slots full, new upgrade should fail
      expect(manager.upgrade('w1', 'scope')).toBe(false);
    });
  });

  describe('createWeaponInstance (static)', () => {
    it('creates weapon instance from data', () => {
      const instance = WeaponManager.createWeaponInstance('rusty_knife');
      expect(instance).not.toBeNull();
      expect(instance?.weaponId).toBe('rusty_knife');
      expect(instance?.rarity).toBe('common');
      expect(instance?.level).toBe(1);
      expect(instance?.xp).toBe(0);
      expect(instance?.durability).toBe(50);
      expect(instance?.maxDurability).toBe(50);
      expect(instance?.upgrades).toEqual([]);
    });

    it('allows overriding rarity', () => {
      const instance = WeaponManager.createWeaponInstance('rusty_knife', 'legendary');
      expect(instance?.rarity).toBe('legendary');
    });

    it('returns null for unknown weapon', () => {
      expect(WeaponManager.createWeaponInstance('nonexistent')).toBeNull();
    });
  });

  describe('getUpgradeData (static)', () => {
    it('returns upgrade data for known upgrade', () => {
      const data = WeaponManager.getUpgradeData('suppressor');
      expect(data).toBeDefined();
      expect(data?.name).toBe('Suppressor');
      expect(data?.partsCost).toBe(4);
    });

    it('returns undefined for unknown upgrade', () => {
      expect(WeaponManager.getUpgradeData('nonexistent' as WeaponUpgradeType)).toBeUndefined();
    });
  });

  describe('getAllUpgradeData (static)', () => {
    it('returns all upgrade definitions', () => {
      const all = WeaponManager.getAllUpgradeData();
      expect(all.length).toBeGreaterThanOrEqual(5);
    });
  });
});

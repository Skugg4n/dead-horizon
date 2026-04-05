import type { GameState, CharacterType, SkillType, ResourceType, ZoneId, WeaponUpgrade, WeaponUpgradeType } from '../config/types';
import { GAME_VERSION, PLAYER_MAX_HP, BASE_MAX_HP } from '../config/constants';

const SAVE_KEY = 'dead-horizon-save';

/**
 * Migrate a single weapon's upgrades array from the old string[] format
 * (pre-v2.0) to the new WeaponUpgrade[] format.
 *
 * Old format example: ["damage_boost", "scope"]
 * New format example: [{ id: "damage_boost", level: 1 }, { id: "scope", level: 1 }]
 *
 * If the array already contains objects we leave them untouched.
 */
function migrateUpgrades(raw: unknown[]): WeaponUpgrade[] {
  return raw.map(entry => {
    if (typeof entry === 'string') {
      // Legacy string entry -- treat as level 1 of that upgrade type
      return { id: entry as WeaponUpgradeType, level: 1 };
    }
    // Already an object (new format)
    const u = entry as { id?: unknown; level?: unknown };
    return {
      id: (u.id ?? '') as WeaponUpgradeType,
      level: typeof u.level === 'number' ? u.level : 1,
    };
  });
}

function createDefaultState(): GameState {
  return {
    version: GAME_VERSION,
    player: {
      character: 'soldier' as CharacterType,
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
      } as Record<SkillType, number>,
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
    },
    inventory: {
      weapons: [
        {
          id: 'rusty_knife_default',
          weaponId: 'rusty_knife',
          rarity: 'common' as const,
          level: 1,
          xp: 0,
          durability: 50,
          maxDurability: 50,
          upgrades: [],
        },
        {
          id: 'worn_pistol_default',
          weaponId: 'worn_pistol',
          rarity: 'common' as const,
          level: 1,
          xp: 0,
          durability: 40,
          maxDurability: 40,
          upgrades: [],
        },
      ],
      resources: {
        scrap: 10,
        food: 5,
        ammo: 10,
        parts: 2,
        meds: 2,
      } as Record<ResourceType, number>,
      loadedAmmo: 0,
    },
    base: {
      structures: [],
      level: 0,
      hp: BASE_MAX_HP,
      maxHp: BASE_MAX_HP,
    },
    refugees: [],
    progress: {
      currentWave: 1,
      highestWave: 1,
      totalRuns: 0,
      totalKills: 0,
    },
    zone: 'forest' as ZoneId,
    mapSeed: Math.floor(Math.random() * 100000),
    achievements: [],
    stats: {
      structuresPlaced: 0,
      lootRunsCompleted: 0,
      itemsCrafted: 0,
    },
    zoneProgress: {},
    // Default: no weapons pre-equipped; auto-equip runs on first NightScene start
    equipped: {
      primaryWeaponId: null,
      secondaryWeaponId: null,
    },
    map: {
      fogOfWar: [],
      explored: [],
    },
    unlockedBlueprints: [],
  };
}

function save(state: GameState): void {
  try {
    console.log(`[SaveManager] save mapSeed=${state.mapSeed}`);
    const json = JSON.stringify(state);
    localStorage.setItem(SAVE_KEY, json);
  } catch (e) {
    console.error('Failed to save game state:', e);
  }
}

function load(): GameState {
  try {
    const json = localStorage.getItem(SAVE_KEY);
    if (json) {
      const saved = JSON.parse(json) as Partial<GameState>;
      console.log(`[SaveManager] load saved.mapSeed=${saved.mapSeed}`);
      // Merge with defaults to handle missing fields from older saves
      const defaults = createDefaultState();
      const state: GameState = {
        ...defaults,
        ...saved,
        player: { ...defaults.player, ...(saved.player ?? {}) },
        inventory: {
          ...defaults.inventory,
          ...(saved.inventory ?? {}),
          resources: { ...defaults.inventory.resources, ...(saved.inventory?.resources ?? {}) },
          // Ensure every weapon has a valid WeaponUpgrade[] upgrades array.
          // Old saves (pre-v1.4) had no upgrades field at all.
          // Saves from v1.4-v1.9 stored upgrades as string[].
          // New saves (v2.0+) store upgrades as WeaponUpgrade[].
          weapons: (saved.inventory?.weapons ?? defaults.inventory.weapons).map(w => ({
            ...w,
            upgrades: migrateUpgrades(w.upgrades ?? []),
          })),
          loadedAmmo: saved.inventory?.loadedAmmo ?? defaults.inventory.loadedAmmo,
        },
        base: {
          ...defaults.base,
          ...(saved.base ?? {}),
          // Ensure every structure has hp and maxHp -- old saves may lack these fields
          structures: (saved.base?.structures ?? defaults.base.structures).map(s => ({
            ...s,
            hp: s.hp ?? s.maxHp ?? 100,
            maxHp: s.maxHp ?? s.hp ?? 100,
          })),
          // Migration: ensure base HP exists for saves before v1.7.0
          hp: (saved.base as { hp?: number } | undefined)?.hp ?? BASE_MAX_HP,
          maxHp: (saved.base as { maxHp?: number } | undefined)?.maxHp ?? BASE_MAX_HP,
        },
        progress: { ...defaults.progress, ...(saved.progress ?? {}) },
        map: { ...defaults.map, ...(saved.map ?? {}) },
        stats: { ...defaults.stats, ...(saved.stats ?? {}) },
        zone: saved.zone ?? defaults.zone,
        zoneProgress: saved.zoneProgress ?? defaults.zoneProgress,
        // mapSeed: inherited from ...defaults (random) then overwritten by ...saved if present
        // No explicit line needed -- the spread on lines above handles it.
        achievements: saved.achievements ?? defaults.achievements,
        refugees: saved.refugees ?? defaults.refugees,
        // Migration: old saves lack the equipped field entirely -- start with null/null so
        // NightScene's auto-equip logic runs and picks the two best weapons.
        equipped: {
          primaryWeaponId: (saved as Partial<GameState>).equipped?.primaryWeaponId ?? null,
          secondaryWeaponId: (saved as Partial<GameState>).equipped?.secondaryWeaponId ?? null,
        },
        // Migration: old saves lack unlockedBlueprints -- default to empty array
        unlockedBlueprints: saved.unlockedBlueprints ?? defaults.unlockedBlueprints,
      };
      // Ensure all skill keys exist
      for (const key of Object.keys(defaults.player.skills)) {
        const sk = key as SkillType;
        if (state.player.skills[sk] === undefined) {
          state.player.skills[sk] = 0;
        }
      }
      return state;
    }
  } catch (e) {
    // Corrupted save -- clear it so the game does not get stuck in a boot loop.
    // This can happen if the game crashed mid-write or the save format is invalid.
    console.warn('[SaveManager] Corrupted save detected, clearing and using defaults:', e);
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // If we can't even clear localStorage we just move on
    }
  }
  return createDefaultState();
}

function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export const SaveManager = {
  createDefaultState,
  save,
  load,
  hasSave,
  clearSave,
};

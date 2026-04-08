import type { GameState, CharacterType, SkillType, ResourceType, ZoneId, WeaponUpgrade, WeaponUpgradeType, ArmorInstance, ShieldInstance } from '../config/types';
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
      armorInventory: [] as ArmorInstance[],
      shieldInventory: [] as ShieldInstance[],
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
      equippedArmor: null,
      equippedShield: null,
    },
    map: {
      fogOfWar: [],
      explored: [],
    },
    unlockedBlueprints: [],
    endlessHighScore: 0,
    endlessNight: 0,
    meta: {
      legacyPoints: 0,
      unlockedPerks: [],
    },
    // Challenge mode defaults: no active challenge, no completions, timer at 0
    activeChallenge: null,
    challengeCompletions: [],
    speedRunTimer: 0,
  };
}

function save(state: GameState): void {
  try {
    // Debug: show call stack to find WHO triggers save
    const stack = new Error().stack ?? '';
    const caller = stack.split('\n')[2]?.trim() ?? 'unknown';
    console.log(`[SaveManager] save mapSeed=${state.mapSeed} zone=${state.zone} wave=${state.progress.currentWave} | from: ${caller}`);
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
      console.log(`[SaveManager] load raw: mapSeed=${saved.mapSeed} zone=${saved.zone} wave=${saved.progress?.currentWave}`);
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
          weapons: (() => {
            try {
              return (saved.inventory?.weapons ?? defaults.inventory.weapons).map(w => ({
                ...w,
                level: w.level ?? 1,
                xp: w.xp ?? 0,
                upgrades: migrateUpgrades(w.upgrades ?? []),
              }));
            } catch {
              console.warn('[SaveManager] weapon migration failed, using saved weapons as-is');
              return saved.inventory?.weapons ?? defaults.inventory.weapons;
            }
          })(),
          loadedAmmo: saved.inventory?.loadedAmmo ?? defaults.inventory.loadedAmmo,
          // Migration: armor/shield inventories added in v5.1.0
          armorInventory: (saved.inventory as Partial<GameState['inventory']>)?.armorInventory ?? [],
          shieldInventory: (saved.inventory as Partial<GameState['inventory']>)?.shieldInventory ?? [],
        },
        base: {
          ...defaults.base,
          ...(saved.base ?? {}),
          // Ensure every structure has hp and maxHp -- old saves may lack these fields
          structures: (() => {
            try {
              return (saved.base?.structures ?? defaults.base.structures).map(s => ({
                ...s,
            hp: s.hp ?? s.maxHp ?? 100,
            maxHp: s.maxHp ?? s.hp ?? 100,
          }));
            } catch {
              console.warn('[SaveManager] structure migration failed, using saved structures as-is');
              return saved.base?.structures ?? defaults.base.structures;
            }
          })(),
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
          // Migration: armor/shield equip slots added in v5.1.0
          equippedArmor: (saved as Partial<GameState>).equipped?.equippedArmor ?? null,
          equippedShield: (saved as Partial<GameState>).equipped?.equippedShield ?? null,
        },
        // Migration: old saves lack unlockedBlueprints -- default to empty array
        unlockedBlueprints: saved.unlockedBlueprints ?? defaults.unlockedBlueprints,
        // Migration: endless mode and meta-progression fields added in v3.2.0
        endlessHighScore: (saved as Partial<GameState>).endlessHighScore ?? 0,
        endlessNight: (saved as Partial<GameState>).endlessNight ?? 0,
        meta: {
          legacyPoints: (saved as Partial<GameState>).meta?.legacyPoints ?? 0,
          unlockedPerks: (saved as Partial<GameState>).meta?.unlockedPerks ?? [],
        },
        // Migration: challenge mode fields added later; default to no active challenge
        activeChallenge: (saved as Partial<GameState>).activeChallenge ?? null,
        challengeCompletions: (saved as Partial<GameState>).challengeCompletions ?? [],
        speedRunTimer: (saved as Partial<GameState>).speedRunTimer ?? 0,
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
    // Save load failed -- try a minimal recovery: parse raw JSON and merge
    // with bare-minimum fields so the player doesn't lose zone/wave progress.
    console.error('[SaveManager] Failed to load save, attempting minimal recovery:', e);
    try {
      const rawJson = localStorage.getItem(SAVE_KEY);
      if (rawJson) {
        const raw = JSON.parse(rawJson) as Partial<GameState>;
        const defaults = createDefaultState();
        // Preserve the most critical fields from the raw save
        return {
          ...defaults,
          ...raw,
          zone: raw.zone ?? defaults.zone,
          progress: { ...defaults.progress, ...(raw.progress ?? {}) },
          inventory: { ...defaults.inventory, ...(raw.inventory ?? {}),
            weapons: raw.inventory?.weapons ?? defaults.inventory.weapons,
            resources: { ...defaults.inventory.resources, ...(raw.inventory?.resources ?? {}) },
          },
          base: { ...defaults.base, ...(raw.base ?? {}) },
          mapSeed: raw.mapSeed ?? defaults.mapSeed,
        } as GameState;
      }
    } catch {
      // Recovery also failed -- truly corrupted
      console.error('[SaveManager] Recovery failed, using defaults');
    }
  }
  console.warn('[SaveManager] RETURNING DEFAULTS -- this will create a fresh game state!');
  console.warn('[SaveManager] If save existed, it may be overwritten if DayScene saves this state.');
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

import type { GameState, CharacterType, SkillType, ResourceType, ZoneId, WeaponUpgrade, WeaponUpgradeType, ArmorInstance, ShieldInstance } from '../config/types';
import { GAME_VERSION, PLAYER_MAX_HP, BASE_MAX_HP } from '../config/constants';

const SAVE_KEY = 'dead-horizon-save';
const BACKUP_KEY = 'dead-horizon-save-backup';
const SAFE_KEY = 'dead-horizon-save-safe'; // Rolling "known-good" snapshot, only updated on successful load

// Heuristic used to detect "default-like" states we don't want overwriting a real save.
// A real save has either structures built, refugees, multiple weapons, or non-default progress.
function looksLikeProgress(state: Partial<GameState> | null | undefined): boolean {
  if (!state) return false;
  const structures = state.base?.structures?.length ?? 0;
  const refugees = state.refugees?.length ?? 0;
  const weapons = state.inventory?.weapons?.length ?? 0;
  const wave = state.progress?.currentWave ?? 1;
  const totalRuns = state.progress?.totalRuns ?? 0;
  const totalKills = state.progress?.totalKills ?? 0;
  const zoneProgressCount = Object.keys(state.zoneProgress ?? {}).length;
  return (
    structures > 0 ||
    refugees > 0 ||
    weapons > 2 ||
    wave > 1 ||
    totalRuns > 0 ||
    totalKills > 0 ||
    zoneProgressCount > 0
  );
}

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
    const json = JSON.stringify(state);
    const progressLike = looksLikeProgress(state);

    // ---- Guard: never overwrite a good save with a default-looking state ----
    // If the state we're asked to save looks "empty" (no structures, night 1,
    // totalRuns 0), but the existing save DOES look like real progress, refuse
    // to overwrite. This is the last line of defense against save wipes.
    if (!progressLike) {
      try {
        const existing = localStorage.getItem(SAVE_KEY);
        if (existing) {
          const parsed = JSON.parse(existing) as Partial<GameState>;
          if (looksLikeProgress(parsed)) {
            console.warn('[SaveManager] REFUSED to overwrite a real save with a default-looking state.');
            return;
          }
        }
      } catch {
        // If we can't parse the existing save, allow the write (nothing to protect).
      }
    }

    // ---- Rotate: move old primary into backup slot before writing new primary ----
    try {
      const previous = localStorage.getItem(SAVE_KEY);
      if (previous) {
        localStorage.setItem(BACKUP_KEY, previous);
      }
    } catch {
      // Backup rotation failed -- continue with primary save anyway
    }

    localStorage.setItem(SAVE_KEY, json);

    // ---- Snapshot the known-good save whenever it looks like real progress ----
    if (progressLike) {
      try { localStorage.setItem(SAFE_KEY, json); } catch { /* ignore quota */ }
    }

    console.log(`[SaveManager] save mapSeed=${state.mapSeed} progress=${progressLike}`);
  } catch (e) {
    console.error('Failed to save game state:', e);
  }
}

/**
 * Parse a raw JSON string into a hydrated GameState, running all field
 * migrations. Returns null if parsing fails.
 */
function parseAndHydrate(json: string): GameState | null {
  try {
    const saved = JSON.parse(json) as Partial<GameState>;
    const defaults = createDefaultState();
    const state: GameState = {
      ...defaults,
      ...saved,
      player: { ...defaults.player, ...(saved.player ?? {}) },
      inventory: {
        ...defaults.inventory,
        ...(saved.inventory ?? {}),
        resources: { ...defaults.inventory.resources, ...(saved.inventory?.resources ?? {}) },
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
        armorInventory: (saved.inventory as Partial<GameState['inventory']>)?.armorInventory ?? [],
        shieldInventory: (saved.inventory as Partial<GameState['inventory']>)?.shieldInventory ?? [],
      },
      base: {
        ...defaults.base,
        ...(saved.base ?? {}),
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
        hp: (saved.base as { hp?: number } | undefined)?.hp ?? BASE_MAX_HP,
        maxHp: (saved.base as { maxHp?: number } | undefined)?.maxHp ?? BASE_MAX_HP,
      },
      progress: { ...defaults.progress, ...(saved.progress ?? {}) },
      map: { ...defaults.map, ...(saved.map ?? {}) },
      stats: { ...defaults.stats, ...(saved.stats ?? {}) },
      zone: saved.zone ?? defaults.zone,
      zoneProgress: saved.zoneProgress ?? defaults.zoneProgress,
      achievements: saved.achievements ?? defaults.achievements,
      refugees: saved.refugees ?? defaults.refugees,
      equipped: {
        primaryWeaponId: (saved as Partial<GameState>).equipped?.primaryWeaponId ?? null,
        secondaryWeaponId: (saved as Partial<GameState>).equipped?.secondaryWeaponId ?? null,
        equippedArmor: (saved as Partial<GameState>).equipped?.equippedArmor ?? null,
        equippedShield: (saved as Partial<GameState>).equipped?.equippedShield ?? null,
      },
      unlockedBlueprints: saved.unlockedBlueprints ?? defaults.unlockedBlueprints,
      endlessHighScore: (saved as Partial<GameState>).endlessHighScore ?? 0,
      endlessNight: (saved as Partial<GameState>).endlessNight ?? 0,
      meta: {
        legacyPoints: (saved as Partial<GameState>).meta?.legacyPoints ?? 0,
        unlockedPerks: (saved as Partial<GameState>).meta?.unlockedPerks ?? [],
      },
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
  } catch (e) {
    console.error('[SaveManager] parseAndHydrate failed:', e);
    return null;
  }
}

function load(): GameState {
  // Try each slot in order: primary -> backup -> safe snapshot
  // For each slot, parse + hydrate. Prefer the first slot that yields
  // a state that *looks* like real progress. If none do, fall back to
  // the first parseable slot. Last resort: defaults.
  const slots: Array<{ key: string; label: string }> = [
    { key: SAVE_KEY, label: 'primary' },
    { key: BACKUP_KEY, label: 'backup' },
    { key: SAFE_KEY, label: 'safe' },
  ];

  let firstParseable: GameState | null = null;
  let firstParseableLabel = '';

  for (const slot of slots) {
    let json: string | null = null;
    try {
      json = localStorage.getItem(slot.key);
    } catch {
      continue;
    }
    if (!json) continue;

    const hydrated = parseAndHydrate(json);
    if (!hydrated) continue;

    if (firstParseable === null) {
      firstParseable = hydrated;
      firstParseableLabel = slot.label;
    }

    if (looksLikeProgress(hydrated)) {
      console.log(`[SaveManager] load from ${slot.label} mapSeed=${hydrated.mapSeed}`);
      // Heal the primary slot so future loads don't need to look at backups.
      if (slot.key !== SAVE_KEY) {
        try { localStorage.setItem(SAVE_KEY, json); } catch { /* ignore */ }
      }
      // Always refresh the safe snapshot when we've confirmed real progress.
      try { localStorage.setItem(SAFE_KEY, json); } catch { /* ignore */ }
      return hydrated;
    }
  }

  if (firstParseable !== null) {
    console.log(`[SaveManager] load fell back to parseable ${firstParseableLabel} slot (no progress-like save found)`);
    return firstParseable;
  }

  console.warn('[SaveManager] no parseable save in any slot -- returning defaults');
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

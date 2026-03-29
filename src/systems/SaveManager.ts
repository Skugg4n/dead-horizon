import type { GameState, CharacterType, SkillType, ResourceType, ZoneId } from '../config/types';
import { GAME_VERSION, PLAYER_MAX_HP } from '../config/constants';

const SAVE_KEY = 'dead-horizon-save';

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
        parts: 0,
        meds: 2,
      } as Record<ResourceType, number>,
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
    zone: 'forest' as ZoneId,
    achievements: [],
    stats: {
      structuresPlaced: 0,
      lootRunsCompleted: 0,
      itemsCrafted: 0,
    },
    zoneProgress: {},
    map: {
      fogOfWar: [],
      explored: [],
    },
  };
}

function save(state: GameState): void {
  try {
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
          // Ensure every weapon has the 'upgrades' array -- old saves (pre-v1.4) stored
          // weapons without this field, causing WeaponManager.getWeaponStats() to crash
          // when iterating upgrades.
          weapons: (saved.inventory?.weapons ?? defaults.inventory.weapons).map(w => ({
            ...w,
            upgrades: w.upgrades ?? [],
          })),
          loadedAmmo: saved.inventory?.loadedAmmo ?? defaults.inventory.loadedAmmo,
        },
        base: {
          ...defaults.base,
          ...(saved.base ?? {}),
          // Ensure every structure has hp and maxHp -- old saves may lack these fields,
          // causing NaN arithmetic in BuildingManager.takeDamage() and NightScene.
          structures: (saved.base?.structures ?? defaults.base.structures).map(s => ({
            ...s,
            hp: s.hp ?? s.maxHp ?? 100,
            maxHp: s.maxHp ?? s.hp ?? 100,
          })),
        },
        progress: { ...defaults.progress, ...(saved.progress ?? {}) },
        map: { ...defaults.map, ...(saved.map ?? {}) },
        stats: { ...defaults.stats, ...(saved.stats ?? {}) },
        zoneProgress: saved.zoneProgress ?? defaults.zoneProgress,
        achievements: saved.achievements ?? defaults.achievements,
        refugees: saved.refugees ?? defaults.refugees,
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
    console.error('Failed to load game state:', e);
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

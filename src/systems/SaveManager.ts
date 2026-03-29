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
      return JSON.parse(json) as GameState;
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

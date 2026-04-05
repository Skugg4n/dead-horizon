// Dead Horizon -- Loot run system
// Handles loot rolling, encounters, fight resolution, and loot run execution

import Phaser from 'phaser';
import type {
  GameState,
  WeaponInstance,
  WeaponData,
  RefugeeInstance,
  ResourceType,
} from '../config/types';
import {
  XP_PER_LOOT_RUN,
  ENCOUNTER_THRESHOLDS,
  COMPANION_STRENGTH,
  REFUGEE_INJURY_CHANCE,
  ENCOUNTER_LOOT_MULTIPLIER,
  ENCOUNTER_RESCUE_CHANCE,
} from '../config/constants';
import lootTablesJson from '../data/loot-tables.json';
import blueprintsJson from '../data/blueprints.json';
import weaponsJson from '../data/weapons.json';
import type { BlueprintData } from '../config/types';

export interface LootDestination {
  id: string;
  zone: string;
  name: string;
  apCost: number;
  encounterChance: number;
  loot: LootEntry[];
}

interface WeaponDropEntry {
  weaponId: string;
  chance: number;
  destinations: string[];
}

interface LootEntry {
  resource: ResourceType;
  min: number;
  max: number;
  chance: number;
}

export interface LootResult {
  destination: LootDestination;
  loot: Partial<Record<ResourceType, number>>;
  // weaponDropId is set if a weapon was found during this loot run (null otherwise)
  weaponDropId: string | null;
  encounter: boolean;
  encounterResolved: boolean;
  encounterOutcome: 'none' | 'win' | 'lose' | 'flee';
  rescuedRefugee: boolean;
  injuredCompanions: string[];
  // Blueprint found during this run (null if none)
  foundBlueprintId: string | null;
}

const destinations = lootTablesJson.destinations as unknown as LootDestination[];
const weaponDropEntries = lootTablesJson.weaponDrops as unknown as WeaponDropEntry[];
const weaponDataList = weaponsJson.weapons as WeaponData[];
const allBlueprints = blueprintsJson.blueprints as BlueprintData[];

// Build weapon damage lookup
const weaponDamageMap = new Map<string, number>();
for (const w of weaponDataList) {
  weaponDamageMap.set(w.id, w.damage);
}

export class LootManager {
  private scene: Phaser.Scene;
  private gameState: GameState;

  constructor(scene: Phaser.Scene, gameState: GameState) {
    this.scene = scene;
    this.gameState = gameState;
  }

  /**
   * Returns destinations filtered to the current zone.
   * Falls back to all destinations if no matching zone entries exist.
   */
  getDestinations(): LootDestination[] {
    const currentZone = this.gameState.zone;
    const zoneDestinations = destinations.filter(d => d.zone === currentZone);
    // Safety fallback: if the zone has no destinations (e.g. old save with unknown zone)
    // return all destinations so the player is never stuck with an empty list.
    return zoneDestinations.length > 0 ? zoneDestinations : destinations;
  }

  /**
   * Roll for a blueprint drop at a given destination.
   * Only blueprints that match the destination AND are not yet unlocked are eligible.
   * Returns the blueprint id of the first successful roll, or null.
   */
  private rollBlueprintDrop(destinationId: string): string | null {
    const alreadyUnlocked = this.gameState.unlockedBlueprints ?? [];
    const eligible = allBlueprints.filter(
      bp => bp.destinations.includes(destinationId) && !alreadyUnlocked.includes(bp.id),
    );
    for (const bp of eligible) {
      if (Math.random() < bp.dropChance) {
        return bp.id;
      }
    }
    return null;
  }

  /**
   * Roll for a weapon drop at a given destination.
   * Checks all weapon drop entries whose destinations include the given id.
   * Returns the weaponId of the first successful roll, or null.
   */
  private rollWeaponDrop(destinationId: string): string | null {
    const eligible = weaponDropEntries.filter(e => e.destinations.includes(destinationId));
    for (const entry of eligible) {
      if (Math.random() < entry.chance) {
        return entry.weaponId;
      }
    }
    return null;
  }

  /** Roll loot from a destination's loot table */
  private rollLoot(destination: LootDestination): Partial<Record<ResourceType, number>> {
    const loot: Partial<Record<ResourceType, number>> = {};
    for (const entry of destination.loot) {
      if (Math.random() < entry.chance) {
        const amount = Math.floor(Math.random() * (entry.max - entry.min + 1)) + entry.min;
        if (amount > 0) {
          loot[entry.resource] = (loot[entry.resource] ?? 0) + amount;
        }
      }
    }
    return loot;
  }

  /** Calculate fight strength: sum of weapon damages + companions * COMPANION_STRENGTH */
  calculateStrength(weapons: WeaponInstance[], companionCount: number): number {
    let strength = 0;
    for (const w of weapons) {
      strength += weaponDamageMap.get(w.weaponId) ?? 0;
    }
    strength += companionCount * COMPANION_STRENGTH;
    return strength;
  }

  /** Get the encounter threshold for a destination */
  private getThreshold(destinationId: string): number {
    return ENCOUNTER_THRESHOLDS[destinationId] ?? 50;
  }

  /** Execute a full loot run (rolls loot, checks encounter, does NOT resolve encounter) */
  executeLootRun(destinationId: string): LootResult {
    const destination = destinations.find(d => d.id === destinationId);
    if (!destination) {
      throw new Error(`Unknown destination: ${destinationId}`);
    }

    // Roll base loot
    const loot = this.rollLoot(destination);

    // Roll for weapon drop (independent of resource loot)
    const weaponDropId = this.rollWeaponDrop(destinationId);

    // Roll for blueprint drop (only if not already unlocked)
    const foundBlueprintId = this.rollBlueprintDrop(destinationId);
    // If a blueprint was found, unlock it immediately in the game state
    if (foundBlueprintId !== null) {
      (this.gameState.unlockedBlueprints ??= []).push(foundBlueprintId);
      console.log(`[LootManager] Blueprint found and unlocked: ${foundBlueprintId}`);
    }

    // Check for encounter
    const encounter = Math.random() < destination.encounterChance;

    const result: LootResult = {
      destination,
      loot,
      weaponDropId,
      foundBlueprintId,
      encounter,
      encounterResolved: !encounter,
      encounterOutcome: encounter ? 'none' : 'none',
      rescuedRefugee: false,
      injuredCompanions: [],
    };

    // Track explored destination
    if (!this.gameState.map.explored.includes(destinationId)) {
      this.gameState.map.explored.push(destinationId);
    }

    return result;
  }

  /** Resolve encounter with fight */
  resolveFight(
    result: LootResult,
    weapons: WeaponInstance[],
    companions: RefugeeInstance[],
  ): LootResult {
    const strength = this.calculateStrength(weapons, companions.length);
    const threshold = this.getThreshold(result.destination.id);
    const win = strength >= threshold;

    if (win) {
      // Multiply loot by 1.5x
      for (const key of Object.keys(result.loot) as ResourceType[]) {
        const val = result.loot[key];
        if (val !== undefined) {
          result.loot[key] = Math.round(val * ENCOUNTER_LOOT_MULTIPLIER);
        }
      }
      // 30% chance to rescue a refugee
      result.rescuedRefugee = Math.random() < ENCOUNTER_RESCUE_CHANCE;
      result.encounterOutcome = 'win';
    } else {
      // Lose: lose all loot
      result.loot = {};
      // Each companion has 40% chance to be injured
      for (const companion of companions) {
        if (Math.random() < REFUGEE_INJURY_CHANCE) {
          result.injuredCompanions.push(companion.id);
        }
      }
      result.encounterOutcome = 'lose';
    }

    result.encounterResolved = true;
    return result;
  }

  /** Resolve encounter with flee -- lose 1 random loot type, everyone escapes */
  resolveFlee(result: LootResult): LootResult {
    const lootKeys = Object.keys(result.loot) as ResourceType[];
    if (lootKeys.length > 0) {
      const idx = Math.floor(Math.random() * lootKeys.length);
      const removeKey = lootKeys[idx];
      if (removeKey !== undefined) {
        const filtered: Partial<Record<ResourceType, number>> = {};
        for (const key of Object.keys(result.loot) as ResourceType[]) {
          if (key !== removeKey) {
            filtered[key] = result.loot[key];
          }
        }
        result.loot = filtered;
      }
    }
    result.encounterOutcome = 'flee';
    result.encounterResolved = true;
    return result;
  }

  /** Award looting XP after a completed run */
  awardLootingXP(): void {
    this.scene.events.emit('award-looting-xp', XP_PER_LOOT_RUN);
  }
}

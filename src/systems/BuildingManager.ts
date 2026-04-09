import Phaser from 'phaser';
import { SaveManager } from './SaveManager';
import { TILE_SIZE } from '../config/constants';
import type { GameState, StructureInstance, ResourceType } from '../config/types';

/** Per-level upgrade definition loaded from structures.json upgrades field. */
export interface StructureUpgradeLevel {
  cost: Record<string, number>;
  apCost: number;
  trapDamage?: number;
  trapDurability?: number;
  cooldownMs?: number;
  overheatMax?: number;
  nightDuration?: number;
}

export interface StructureData {
  id: string;
  name: string;
  /** UI category used by BuildMenu tabs: 'primitive' | 'machine' | 'special' */
  category: string;
  /** Short human-readable effect description shown in BuildMenu. */
  description: string;
  hp: number;
  cost: Record<string, number>;
  apCost: number;
  maxLevel: number;
  effect: string;
  trapDamage?: number;
  foodPerDay?: number;
  // Spike Strip
  trapDurability?: number;
  crippleDuration?: number;
  // Bear Trap
  stunDuration?: number;
  // Landmine
  aoeRadius?: number;
  // Sandbags / Oil Slick
  slowFactor?: number;
  // Oil Slick / Tar Pit / Fire Pit
  widthTiles?: number;
  nightDuration?: number;
  // Glass Shards
  zoneRadius?: number;
  damagePerSecond?: number;
  /** Level-specific upgrade data keyed by target level ("2", "3"). */
  upgrades?: Record<string, StructureUpgradeLevel>;
}

/**
 * BuildingManager handles all structure placement, upgrades, and removal.
 * Uses Phaser event system for communication:
 *   'structure-placed' (instance)
 *   'structure-destroyed' (instance)
 *   'structure-upgraded' (instance)
 */
export class BuildingManager {
  private scene: Phaser.Scene;
  private gameState: GameState;
  private structureDataMap: Map<string, StructureData> = new Map();

  constructor(scene: Phaser.Scene, gameState: GameState, structureDataList: StructureData[]) {
    this.scene = scene;
    this.gameState = gameState;

    for (const s of structureDataList) {
      this.structureDataMap.set(s.id, s);
    }
  }

  getStructureData(structureId: string): StructureData | undefined {
    return this.structureDataMap.get(structureId);
  }

  getAllStructureData(): StructureData[] {
    return Array.from(this.structureDataMap.values());
  }

  /** Get structures available at the current base level */
  getAvailableStructures(unlockedIds: string[]): StructureData[] {
    return Array.from(this.structureDataMap.values()).filter(s =>
      unlockedIds.includes(s.id)
    );
  }

  /** Get structures locked at the current base level */
  getLockedStructures(unlockedIds: string[]): StructureData[] {
    return Array.from(this.structureDataMap.values()).filter(s =>
      !unlockedIds.includes(s.id)
    );
  }

  /** Check if player can afford to build a structure */
  canAfford(structureId: string): boolean {
    const data = this.structureDataMap.get(structureId);
    if (!data) return false;

    for (const [resource, amount] of Object.entries(data.cost)) {
      const have = this.gameState.inventory.resources[resource as ResourceType] ?? 0;
      if (have < amount) return false;
    }
    return true;
  }

  /** Check if there is enough AP to build */
  hasEnoughAP(structureId: string, currentAP: number): boolean {
    const data = this.structureDataMap.get(structureId);
    if (!data) return false;
    return currentAP >= data.apCost;
  }

  /**
   * Check if a structure can be placed at (x, y) with the given rotation.
   * For multi-tile structures (widthTiles > 1) all covered tiles must be free.
   * Checks against every existing structure's full footprint too, so two
   * multi-tile structures can't partially overlap.
   */
  isPositionFree(x: number, y: number, structureId?: string, rotation: 0 | 1 = 0): boolean {
    const data = structureId ? this.structureDataMap.get(structureId) : undefined;
    const tiles = data?.widthTiles ?? 1;
    const placeW = rotation === 1 ? 1 : tiles;
    const placeH = rotation === 1 ? tiles : 1;

    // Tile ranges covered by the new structure
    const newLeft = x;
    const newTop = y;
    const newRight = x + placeW * TILE_SIZE;
    const newBot = y + placeH * TILE_SIZE;

    for (const s of this.gameState.base.structures) {
      const sData = this.structureDataMap.get(s.structureId);
      const sTiles = sData?.widthTiles ?? 1;
      const sRot = s.rotation ?? 0;
      const sW = sRot === 1 ? 1 : sTiles;
      const sH = sRot === 1 ? sTiles : 1;
      const sLeft = s.x;
      const sTop = s.y;
      const sRight = s.x + sW * TILE_SIZE;
      const sBot = s.y + sH * TILE_SIZE;

      // AABB overlap
      if (newLeft < sRight && newRight > sLeft && newTop < sBot && newBot > sTop) {
        return false;
      }
    }
    return true;
  }

  /**
   * Debounce: reject place() calls within PLACE_DEBOUNCE_MS of the previous
   * successful placement. This defends against the user reporting in BG8
   * where one shock_wire click resulted in 4 instances -- the root cause
   * could be trackpad multi-tap, double pointerdown, or a UI handler
   * leaking through. Rate-limiting is the most reliable defense.
   */
  private lastPlaceTimeMs: number = 0;
  private static readonly PLACE_DEBOUNCE_MS = 80;

  /** Monotonic counter so instance IDs are unique even within a single ms. */
  private static placeCounter: number = 0;

  /**
   * Place a structure. Returns the instance if successful, null otherwise.
   * Deducts resources and AP cost from currentAP (returned as new value).
   * `rotation` is stored on multi-tile instances (0 = horizontal, 1 = vertical).
   */
  place(
    structureId: string,
    gridX: number,
    gridY: number,
    currentAP: number,
    rotation: 0 | 1 = 0,
  ): { instance: StructureInstance; apRemaining: number } | null {
    const data = this.structureDataMap.get(structureId);
    if (!data) return null;

    // Debounce: reject rapid-fire placement
    const now = Date.now();
    if (now - this.lastPlaceTimeMs < BuildingManager.PLACE_DEBOUNCE_MS) {
      console.warn(`[BuildingManager] place() DEBOUNCED: ${structureId} @ (${gridX},${gridY}) dt=${now - this.lastPlaceTimeMs}ms`);
      return null;
    }

    if (currentAP < data.apCost) return null;
    if (!this.canAfford(structureId)) return null;
    if (!this.isPositionFree(gridX, gridY, structureId, rotation)) return null;

    // Deduct resources
    for (const [resource, amount] of Object.entries(data.cost)) {
      this.gameState.inventory.resources[resource as ResourceType] -= amount;
    }

    BuildingManager.placeCounter++;
    const instance: StructureInstance = {
      id: `${structureId}_${now}_${BuildingManager.placeCounter}`,
      structureId,
      level: 1,
      hp: data.hp,
      maxHp: data.hp,
      x: gridX,
      y: gridY,
      rotation: (data.widthTiles && data.widthTiles > 1) ? rotation : 0,
    };

    this.gameState.base.structures.push(instance);
    this.lastPlaceTimeMs = now;
    console.log(`[BuildingManager] placed ${structureId} @ (${gridX},${gridY}) id=${instance.id}`);
    this.scene.events.emit('structure-placed', instance);

    return { instance, apRemaining: currentAP - data.apCost };
  }

  /**
   * Returns the upgrade definition for the next level of a structure instance,
   * or null if the structure is already at max level or has no upgrade data.
   */
  getNextUpgrade(instance: StructureInstance): StructureUpgradeLevel | null {
    const data = this.structureDataMap.get(instance.structureId);
    if (!data) return null;
    if (instance.level >= data.maxLevel) return null;
    const nextLevel = (instance.level + 1).toString();
    return data.upgrades?.[nextLevel] ?? null;
  }

  /**
   * Check if the player can afford the upgrade cost for the next level.
   * Falls back to the base build cost if no per-level upgrade data exists.
   */
  canAffordUpgrade(instance: StructureInstance): boolean {
    const upgrade = this.getNextUpgrade(instance);
    const costMap = upgrade ? upgrade.cost : this.structureDataMap.get(instance.structureId)?.cost ?? {};
    for (const [resource, amount] of Object.entries(costMap)) {
      const have = this.gameState.inventory.resources[resource as ResourceType] ?? 0;
      if (have < amount) return false;
    }
    return true;
  }

  /**
   * Check if there is enough AP for the next upgrade.
   * Falls back to the base apCost if no per-level upgrade data exists.
   */
  hasEnoughAPForUpgrade(instance: StructureInstance, currentAP: number): boolean {
    const upgrade = this.getNextUpgrade(instance);
    const apCost = upgrade ? upgrade.apCost : (this.structureDataMap.get(instance.structureId)?.apCost ?? 1);
    return currentAP >= apCost;
  }

  /**
   * Upgrade a structure by instance id.
   * Uses per-level upgrade cost from structures.json if available,
   * otherwise falls back to the base build cost (legacy path for barricade/wall/etc).
   * Returns new AP remaining or null if upgrade failed.
   */
  upgrade(instanceId: string, currentAP: number): { apRemaining: number } | null {
    const instance = this.gameState.base.structures.find(s => s.id === instanceId);
    if (!instance) return null;

    const data = this.structureDataMap.get(instance.structureId);
    if (!data) return null;

    if (instance.level >= data.maxLevel) return null;

    // Determine upgrade cost and AP cost for the target level
    const nextLevelKey = (instance.level + 1).toString();
    const upgradeDef = data.upgrades?.[nextLevelKey];
    const costMap = upgradeDef ? upgradeDef.cost : data.cost;
    const apCost  = upgradeDef ? upgradeDef.apCost : data.apCost;

    if (currentAP < apCost) return null;

    // Verify player can afford
    for (const [resource, amount] of Object.entries(costMap)) {
      const have = this.gameState.inventory.resources[resource as ResourceType] ?? 0;
      if (have < amount) return null;
    }

    // Deduct resources
    for (const [resource, amount] of Object.entries(costMap)) {
      this.gameState.inventory.resources[resource as ResourceType] -= amount;
    }

    instance.level += 1;
    // Increase HP by 50% per level
    const newMaxHp = Math.floor(data.hp * (1 + 0.5 * (instance.level - 1)));
    instance.maxHp = newMaxHp;
    instance.hp = newMaxHp;

    this.scene.events.emit('structure-upgraded', instance);

    return { apRemaining: currentAP - apCost };
  }

  /**
   * Sell/remove a structure. Refunds 50% of base cost (rounded down).
   */
  sell(instanceId: string): boolean {
    const idx = this.gameState.base.structures.findIndex(s => s.id === instanceId);
    if (idx === -1) return false;

    const instance = this.gameState.base.structures[idx];
    if (!instance) return false;
    const data = this.structureDataMap.get(instance.structureId);

    // Refund 75% of base cost (selling loses only 25%)
    if (data) {
      for (const [resource, amount] of Object.entries(data.cost)) {
        const refund = Math.ceil(amount * 0.75);
        this.gameState.inventory.resources[resource as ResourceType] += refund;
      }
    }

    this.gameState.base.structures.splice(idx, 1);
    this.scene.events.emit('structure-destroyed', instance);

    return true;
  }

  /** Apply damage to a structure (used during night phase) */
  damageStructure(instanceId: string, damage: number): boolean {
    const instance = this.gameState.base.structures.find(s => s.id === instanceId);
    if (!instance) return false;

    instance.hp -= damage;
    if (instance.hp <= 0) {
      instance.hp = 0;
      this.sell(instanceId);
      return true; // destroyed
    }
    return false;
  }

  /** Find structure at a world position (snapped to grid) */
  getStructureAt(worldX: number, worldY: number): StructureInstance | undefined {
    const gridX = Math.floor(worldX / TILE_SIZE) * TILE_SIZE;
    const gridY = Math.floor(worldY / TILE_SIZE) * TILE_SIZE;
    return this.gameState.base.structures.find(s => s.x === gridX && s.y === gridY);
  }

  save(): void {
    SaveManager.save(this.gameState);
  }
}

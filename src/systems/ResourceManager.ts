import Phaser from 'phaser';
import type { ResourceType, GameState } from '../config/types';

interface ResourceChangeEvent {
  type: ResourceType;
  amount: number;
  total: number;
}

export class ResourceManager {
  private scene: Phaser.Scene;
  private resources: Record<ResourceType, number>;

  constructor(scene: Phaser.Scene, gameState: GameState) {
    this.scene = scene;
    this.resources = { ...gameState.inventory.resources };
  }

  get(type: ResourceType): number {
    return this.resources[type];
  }

  getAll(): Record<ResourceType, number> {
    return { ...this.resources };
  }

  add(type: ResourceType, amount: number): void {
    if (amount <= 0) return;
    this.resources[type] += amount;
    this.emitChange(type, amount);
  }

  spend(type: ResourceType, amount: number): boolean {
    if (amount <= 0) return true;
    if (this.resources[type] < amount) return false;
    this.resources[type] -= amount;
    this.emitChange(type, -amount);
    return true;
  }

  canAfford(costs: Partial<Record<ResourceType, number>>): boolean {
    for (const [type, amount] of Object.entries(costs)) {
      if (amount !== undefined && this.resources[type as ResourceType] < amount) {
        return false;
      }
    }
    return true;
  }

  // Deduct daily food: 1 per refugee + 1 for player
  consumeDailyFood(refugeeCount: number): void {
    const needed = refugeeCount + 1;
    const available = this.resources.food;

    if (available >= needed) {
      this.spend('food', needed);
    } else {
      // Spend whatever food is available
      if (available > 0) {
        this.spend('food', available);
      }
      console.warn(`Not enough food! Needed ${needed}, had ${available}. Refugees may take damage.`);
    }
  }

  // Sync resources back to game state for saving
  syncToState(gameState: GameState): void {
    gameState.inventory.resources = { ...this.resources };
  }

  private emitChange(type: ResourceType, amount: number): void {
    const event: ResourceChangeEvent = {
      type,
      amount,
      total: this.resources[type],
    };
    this.scene.events.emit('resource-changed', event);
  }
}

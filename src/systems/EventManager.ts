// Dead Horizon -- Random event system
// Triggers events at the start of each day with configurable chance

import Phaser from 'phaser';
import type { GameState, ResourceType } from '../config/types';
import type { EventChoice, EventData } from '../ui/EventDialog';
import eventsData from '../data/events.json';

export class EventManager {
  private scene: Phaser.Scene;
  private gameState: GameState;
  private hordeMultiplier: number = 1.0;
  private fogPenalty: number = 0;

  constructor(scene: Phaser.Scene, gameState: GameState) {
    this.scene = scene;
    this.gameState = gameState;
  }

  /** Roll for a random event. Returns the event data if one triggers, null otherwise. */
  rollEvent(): EventData | null {
    if (Math.random() >= eventsData.eventChance) {
      return null;
    }

    const events = eventsData.events as EventData[];
    const chosen = events[Math.floor(Math.random() * events.length)];
    return chosen ?? null;
  }

  /** Apply the chosen effect to game state. Returns a description string. */
  applyChoice(_event: EventData, choice: EventChoice): string {
    const effect = choice.effect;
    const messages: string[] = [];

    // Resource changes
    const resourceKeys: ResourceType[] = ['scrap', 'food', 'ammo', 'parts', 'meds'];
    for (const key of resourceKeys) {
      const amount = effect[key];
      if (typeof amount === 'number' && amount !== 0) {
        const current = this.gameState.inventory.resources[key];
        const newVal = Math.max(0, current + amount);
        this.gameState.inventory.resources[key] = newVal;
        if (amount > 0) {
          messages.push(`+${amount} ${key}`);
        } else {
          const actual = current - newVal;
          if (actual > 0) {
            messages.push(`-${actual} ${key}`);
          }
        }
      }
    }

    // Lose refugee
    if (effect['lose_refugee'] === true) {
      const removed = this.removeRandomRefugee();
      if (removed) {
        messages.push(`${removed} left the camp`);
      }
    }

    // Fog penalty (rain)
    if (typeof effect['fog_penalty'] === 'number') {
      this.fogPenalty = effect['fog_penalty'] as number;
      messages.push('Visibility reduced tonight');
    }

    // Structure damage (storm)
    if (typeof effect['structure_damage'] === 'number') {
      const dmg = effect['structure_damage'] as number;
      this.applyStormDamage(dmg);
      messages.push(`All structures took ${dmg} damage`);
      // Screen shake for storm
      this.scene.cameras.main.shake(500, 0.01);
    }

    // Supply cache
    if (typeof effect['random_resource_min'] === 'number' && typeof effect['random_resource_max'] === 'number') {
      const min = effect['random_resource_min'] as number;
      const max = effect['random_resource_max'] as number;
      const amount = Math.floor(Math.random() * (max - min + 1)) + min;
      const randomResource = resourceKeys[Math.floor(Math.random() * resourceKeys.length)];
      if (randomResource) {
        this.gameState.inventory.resources[randomResource] += amount;
        messages.push(`+${amount} ${randomResource}`);
      }
    }

    // Horde warning
    if (typeof effect['horde_multiplier'] === 'number') {
      this.hordeMultiplier = effect['horde_multiplier'] as number;
      messages.push('Next wave has 25% more enemies');
    }

    return messages.length > 0 ? messages.join(', ') : 'No effect';
  }

  getHordeMultiplier(): number {
    return this.hordeMultiplier;
  }

  getFogPenalty(): number {
    return this.fogPenalty;
  }

  private removeRandomRefugee(): string | null {
    const refugees = this.gameState.refugees;
    const healthy = refugees.filter(r => r.status === 'healthy');
    if (healthy.length === 0) return null;

    const toRemove = healthy[Math.floor(Math.random() * healthy.length)];
    if (!toRemove) return null;

    const idx = refugees.findIndex(r => r.id === toRemove.id);
    if (idx >= 0) {
      refugees.splice(idx, 1);
      return toRemove.name;
    }
    return null;
  }

  private applyStormDamage(damage: number): void {
    for (const structure of this.gameState.base.structures) {
      structure.hp = Math.max(0, structure.hp - damage);
    }
    // Remove destroyed structures
    this.gameState.base.structures = this.gameState.base.structures.filter(s => s.hp > 0);
  }
}

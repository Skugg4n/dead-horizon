// Dead Horizon -- Crafting manager
// Handles recipe-based crafting using resources and AP

import Phaser from 'phaser';
import type { GameState, RecipeData, ResourceType } from '../config/types';
import recipesJson from '../data/recipes.json';

const recipeList = recipesJson.recipes as unknown as RecipeData[];

const recipeMap = new Map<string, RecipeData>();
for (const recipe of recipeList) {
  recipeMap.set(recipe.id, recipe);
}

export class CraftingManager {
  private scene: Phaser.Scene;
  private gameState: GameState;
  private getAP: () => number;
  private spendAP: (cost: number) => void;

  constructor(
    scene: Phaser.Scene,
    gameState: GameState,
    getAP: () => number,
    spendAP: (cost: number) => void,
  ) {
    this.scene = scene;
    this.gameState = gameState;
    this.getAP = getAP;
    this.spendAP = spendAP;
  }

  getAllRecipes(): RecipeData[] {
    return [...recipeList];
  }

  canCraft(recipeId: string): boolean {
    const recipe = recipeMap.get(recipeId);
    if (!recipe) return false;

    if (this.getAP() < recipe.apCost) return false;

    for (const [resource, amount] of Object.entries(recipe.ingredients)) {
      const have = this.gameState.inventory.resources[resource as ResourceType] ?? 0;
      if (have < (amount as number)) return false;
    }
    return true;
  }

  craft(recipeId: string): boolean {
    if (!this.canCraft(recipeId)) return false;

    const recipe = recipeMap.get(recipeId);
    if (!recipe) return false;

    // Deduct ingredients
    for (const [resource, amount] of Object.entries(recipe.ingredients)) {
      this.gameState.inventory.resources[resource as ResourceType] -= (amount as number);
    }

    // Deduct AP
    if (recipe.apCost > 0) {
      this.spendAP(recipe.apCost);
    }

    // Apply result
    this.applyResult(recipe);

    // Track stats
    this.gameState.stats.itemsCrafted++;

    this.scene.events.emit('item-crafted', { recipeId, recipe });
    return true;
  }

  private applyResult(recipe: RecipeData): void {
    switch (recipe.result.type) {
      case 'food':
        this.gameState.inventory.resources.food += recipe.result.amount;
        break;
      case 'ammo':
        this.gameState.inventory.resources.ammo += recipe.result.amount;
        break;
      case 'repair_weapon': {
        // Fully repair the most damaged weapon
        const weapons = this.gameState.inventory.weapons;
        let mostDamaged = weapons[0];
        if (!mostDamaged) break;
        for (const w of weapons) {
          const damagePct = w.durability / w.maxDurability;
          const bestPct = mostDamaged.durability / mostDamaged.maxDurability;
          if (damagePct < bestPct) {
            mostDamaged = w;
          }
        }
        mostDamaged.durability = mostDamaged.maxDurability;
        break;
      }
      case 'wall_hp': {
        // Add HP to the most damaged wall
        const walls = this.gameState.base.structures.filter(s => s.structureId === 'wall');
        let target = walls[0];
        if (!target) break;
        for (const w of walls) {
          if (w.hp < target.hp) target = w;
        }
        target.hp = Math.min(target.maxHp + recipe.result.amount, target.hp + recipe.result.amount);
        target.maxHp += recipe.result.amount;
        break;
      }
      case 'heal_refugee': {
        // Heal the first injured refugee
        const injured = this.gameState.refugees.find(r => r.status === 'injured');
        if (injured) {
          injured.hp = injured.maxHp;
          injured.status = 'healthy';
          this.scene.events.emit('refugee-healed', injured);
        }
        break;
      }
    }
  }
}

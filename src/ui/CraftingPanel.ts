// Dead Horizon -- Crafting panel UI
// Shows recipes with costs and a CRAFT button in DayScene

import Phaser from 'phaser';
import { CraftingManager } from '../systems/CraftingManager';
import { UIPanel } from './UIPanel';

const PANEL_WIDTH = 400;

export class CraftingPanel {
  private scene: Phaser.Scene;
  private panel: UIPanel;
  private craftingManager: CraftingManager;
  private updateResources: () => void;

  constructor(
    scene: Phaser.Scene,
    craftingManager: CraftingManager,
    updateResources: () => void,
  ) {
    this.scene = scene;
    this.craftingManager = craftingManager;
    this.updateResources = updateResources;
    this.panel = new UIPanel(scene, 'CRAFTING', PANEL_WIDTH, 400);
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.panel.getContainer();
  }

  toggle(): void {
    this.panel.toggle();
    if (this.panel.isVisible()) {
      this.refresh();
    }
  }

  private refresh(): void {
    const content = this.panel.getContentContainer();
    content.removeAll(true);

    const contentWidth = PANEL_WIDTH - 24;
    const recipes = this.craftingManager.getAllRecipes();
    let yPos = 0;

    for (const recipe of recipes) {
      const canCraft = this.craftingManager.canCraft(recipe.id);
      const color = canCraft ? '#E8DCC8' : '#6B6B6B';

      // Recipe name
      const nameText = this.scene.add.text(0, yPos, recipe.name, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '11px',
        color: color,
      });
      content.add(nameText);

      // Ingredients
      const ingredientStr = Object.entries(recipe.ingredients)
        .map(([r, n]) => `${n} ${r}`)
        .join(', ');
      const costText = this.scene.add.text(0, yPos + 14, `Cost: ${ingredientStr}${recipe.apCost > 0 ? ` + ${recipe.apCost} AP` : ''}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#888888',
      });
      content.add(costText);

      // Result description
      const resultStr = this.getResultDescription(recipe.result);
      const resultText = this.scene.add.text(0, yPos + 26, `Result: ${resultStr}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#4CAF50',
      });
      content.add(resultText);

      // CRAFT button
      if (canCraft) {
        const craftBtn = this.scene.add.text(contentWidth, yPos + 8, '[ CRAFT ]', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '10px',
          color: '#C5A030',
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

        craftBtn.on('pointerover', () => craftBtn.setColor('#FFD700'));
        craftBtn.on('pointerout', () => craftBtn.setColor('#C5A030'));
        craftBtn.on('pointerdown', () => {
          this.craftingManager.craft(recipe.id);
          this.updateResources();
          this.refresh();
        });
        content.add(craftBtn);
      }

      yPos += 52;
    }
  }

  private getResultDescription(result: { type: string; amount: number }): string {
    switch (result.type) {
      case 'food': return `+${result.amount} food`;
      case 'ammo': return `+${result.amount} ammo`;
      case 'repair_weapon': return 'Fully repair 1 weapon';
      case 'wall_hp': return `+${result.amount} HP to 1 wall`;
      case 'heal_refugee': return 'Heal 1 refugee';
      default: return `${result.type} x${result.amount}`;
    }
  }
}

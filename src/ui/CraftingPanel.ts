// Dead Horizon -- Crafting panel UI
// Shows recipes with costs and a CRAFT button in DayScene

import Phaser from 'phaser';
import { CraftingManager } from '../systems/CraftingManager';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';


export class CraftingPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private craftingManager: CraftingManager;
  private updateResources: () => void;
  private visible: boolean = false;

  constructor(
    scene: Phaser.Scene,
    craftingManager: CraftingManager,
    updateResources: () => void,
  ) {
    this.scene = scene;
    this.craftingManager = craftingManager;
    this.updateResources = updateResources;
    this.container = this.createPanel();
    this.container.setVisible(false);
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  toggle(): void {
    this.visible = !this.visible;
    if (this.visible) {
      this.refresh();
    }
    this.container.setVisible(this.visible);
  }

  private createPanel(): Phaser.GameObjects.Container {
    const panelWidth = 280;
    const panelHeight = 320;
    const x = (GAME_WIDTH - panelWidth) / 2;
    const y = (GAME_HEIGHT - panelHeight) / 2;

    const container = this.scene.add.container(x, y);
    container.setDepth(150);
    return container;
  }

  private refresh(): void {
    this.container.removeAll(true);

    const panelWidth = 280;
    const panelHeight = 320;

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1A1A2E, 0.95);
    bg.fillRect(0, 0, panelWidth, panelHeight);
    bg.lineStyle(1, 0xC5A030);
    bg.strokeRect(0, 0, panelWidth, panelHeight);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(panelWidth / 2, 10, 'CRAFTING', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#C5A030',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Close button
    const closeBtn = this.scene.add.text(panelWidth - 10, 6, 'X', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '12px',
      color: '#F44336',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.toggle());
    this.container.add(closeBtn);

    // Recipe list
    const recipes = this.craftingManager.getAllRecipes();
    let yPos = 36;

    for (const recipe of recipes) {
      const canCraft = this.craftingManager.canCraft(recipe.id);
      const color = canCraft ? '#E8DCC8' : '#6B6B6B';

      // Recipe name
      const nameText = this.scene.add.text(10, yPos, recipe.name, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '11px',
        color: color,
      });
      this.container.add(nameText);

      // Ingredients
      const ingredientStr = Object.entries(recipe.ingredients)
        .map(([r, n]) => `${n} ${r}`)
        .join(', ');
      const costText = this.scene.add.text(10, yPos + 14, `Cost: ${ingredientStr}${recipe.apCost > 0 ? ` + ${recipe.apCost} AP` : ''}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#888888',
      });
      this.container.add(costText);

      // Result description
      const resultStr = this.getResultDescription(recipe.result);
      const resultText = this.scene.add.text(10, yPos + 26, `Result: ${resultStr}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#4CAF50',
      });
      this.container.add(resultText);

      // CRAFT button
      if (canCraft) {
        const craftBtn = this.scene.add.text(panelWidth - 16, yPos + 8, '[ CRAFT ]', {
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
        this.container.add(craftBtn);
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

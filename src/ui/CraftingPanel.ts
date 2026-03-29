// Dead Horizon -- Crafting panel UI
// Shows recipes with costs and a CRAFT button in DayScene

import Phaser from 'phaser';
import { CraftingManager } from '../systems/CraftingManager';
import { UIPanel } from './UIPanel';
import { renderResourceCosts } from './resourceIcons';

const PANEL_WIDTH = 360;

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
    this.panel = new UIPanel(scene, 'CRAFTING', 360, 400);
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

      // Hover background
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x333333, 0);
      bg.fillRect(-4, yPos - 2, contentWidth + 8, 48);
      content.add(bg);

      // Recipe name (10px title)
      const nameText = this.scene.add.text(0, yPos, recipe.name, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: color,
      });
      content.add(nameText);

      // Ingredients with resource icons (8px label)
      const apSuffix = recipe.apCost > 0 ? ` +${recipe.apCost} AP` : '';
      renderResourceCosts(this.scene, content, recipe.ingredients, 0, yPos + 14, color);
      if (apSuffix) {
        // Estimate icon row width to place AP text after
        const iconCount = Object.keys(recipe.ingredients).length;
        const apX = iconCount * 44;
        const apLabel = this.scene.add.text(apX, yPos + 16, apSuffix, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '8px',
          color: '#FFD700',
        });
        content.add(apLabel);
      }

      // Result description (9px body)
      const resultStr = this.getResultDescription(recipe.result);
      const resultText = this.scene.add.text(0, yPos + 32, `> ${resultStr}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#4CAF50',
      });
      content.add(resultText);

      // CRAFT button (9px body)
      if (canCraft) {
        const craftBtn = this.scene.add.text(contentWidth, yPos + 8, '[ CRAFT ]', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '9px',
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

      // Hover effect
      bg.setInteractive(
        new Phaser.Geom.Rectangle(-4, yPos - 2, contentWidth + 8, 48),
        Phaser.Geom.Rectangle.Contains,
      );
      bg.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(0x444444, 0.5);
        bg.fillRect(-4, yPos - 2, contentWidth + 8, 48);
      });
      bg.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(0x333333, 0);
        bg.fillRect(-4, yPos - 2, contentWidth + 8, 48);
      });

      yPos += 56;
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

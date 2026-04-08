// Dead Horizon -- Crafting panel UI
// Shows recipes with costs and a CRAFT button in DayScene

import Phaser from 'phaser';
import { CraftingManager } from '../systems/CraftingManager';
import { UIPanel } from './UIPanel';
import { renderResourceCosts } from './resourceIcons';

const PANEL_WIDTH = 360;

// Max number of recipes visible without scrolling
const MAX_VISIBLE_RECIPES = 5;

export class CraftingPanel {
  private scene: Phaser.Scene;
  private panel: UIPanel;
  private craftingManager: CraftingManager;
  private updateResources: () => void;
  // Scroll state: index of first visible recipe
  private scrollOffset: number = 0;

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
      this.scrollOffset = 0;
      this.refresh();
    }
  }

  private refresh(): void {
    const content = this.panel.getContentContainer();
    content.removeAll(true);

    const contentWidth = PANEL_WIDTH - 24;
    const recipes = this.craftingManager.getAllRecipes();
    const total = recipes.length;

    // Clamp scroll offset
    this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, Math.max(0, total - MAX_VISIBLE_RECIPES)));

    const visibleRecipes = recipes.slice(this.scrollOffset, this.scrollOffset + MAX_VISIBLE_RECIPES);
    const hasPrev = this.scrollOffset > 0;
    const hasMore = this.scrollOffset + MAX_VISIBLE_RECIPES < total;
    const moreCount = total - (this.scrollOffset + MAX_VISIBLE_RECIPES);

    let yPos = 0;

    for (const recipe of visibleRecipes) {
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
      const resultText = this.scene.add.text(0, yPos + 32, `-- ${resultStr}`, {
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

    // Scroll navigation buttons
    if (hasPrev) {
      const upBtn = this.scene.add.text(0, yPos + 4, '[ ^ UP ]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#FFD700',
      }).setInteractive({ useHandCursor: true });
      upBtn.on('pointerover', () => upBtn.setColor('#FFFFFF'));
      upBtn.on('pointerout', () => upBtn.setColor('#FFD700'));
      upBtn.on('pointerdown', () => {
        this.scrollOffset = Math.max(0, this.scrollOffset - 1);
        this.refresh();
      });
      content.add(upBtn);
    }
    if (hasMore) {
      const downBtn = this.scene.add.text(contentWidth, yPos + 4, `[ v ${moreCount} MORE ]`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#FFD700',
      }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
      downBtn.on('pointerover', () => downBtn.setColor('#FFFFFF'));
      downBtn.on('pointerout', () => downBtn.setColor('#FFD700'));
      downBtn.on('pointerdown', () => {
        this.scrollOffset = Math.min(total - MAX_VISIBLE_RECIPES, this.scrollOffset + 1);
        this.refresh();
      });
      content.add(downBtn);
    }
  }

  private getResultDescription(result: { type: string; amount: number; itemId?: string }): string {
    switch (result.type) {
      case 'food': return `+${result.amount} food`;
      case 'ammo': return `+${result.amount} ammo`;
      case 'repair_weapon': return 'Fully repair 1 weapon';
      case 'wall_hp': return `+${result.amount} HP to 1 wall`;
      case 'heal_refugee': return 'Heal 1 refugee';
      case 'craft_armor': {
        const name = (result.itemId ?? 'armor').replace(/_/g, ' ');
        return `Craft: ${name.charAt(0).toUpperCase() + name.slice(1)}`;
      }
      case 'craft_shield': {
        const name = (result.itemId ?? 'shield').replace(/_/g, ' ');
        return `Craft: ${name.charAt(0).toUpperCase() + name.slice(1)}`;
      }
      default: return `${result.type} x${result.amount}`;
    }
  }

  /** Handle keyboard input. Returns true if handled. */
  handleKey(key: string): boolean {
    if (!this.panel.isVisible()) return false;

    if (key === 'Escape') {
      this.panel.hide();
      return true;
    }

    // Number keys craft visible recipes (1 = first visible, etc.)
    const num = parseInt(key, 10);
    if (num >= 1 && num <= 9) {
      const recipes = this.craftingManager.getAllRecipes();
      const absoluteIndex = this.scrollOffset + (num - 1);
      const recipe = recipes[absoluteIndex];
      if (recipe && this.craftingManager.canCraft(recipe.id)) {
        this.craftingManager.craft(recipe.id);
        this.updateResources();
        this.refresh();
        return true;
      }
    }

    return false;
  }

  isVisible(): boolean {
    return this.panel.isVisible();
  }

  getPanel(): UIPanel {
    return this.panel;
  }
}

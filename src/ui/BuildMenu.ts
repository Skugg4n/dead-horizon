import Phaser from 'phaser';
import { BuildingManager } from '../systems/BuildingManager';
import { UIPanel } from './UIPanel';
import { renderResourceCosts } from './resourceIcons';

const ENTRY_HEIGHT = 44;
const ENTRY_GAP = 8;
const FONT_COLOR = '#E8DCC8';
const DISABLED_COLOR = '#6B6B6B';
const HOVER_BG = 0x444444;
const NORMAL_BG = 0x333333;
const CONTENT_WIDTH = 360 - 24;

export class BuildMenu {
  private scene: Phaser.Scene;
  private panel: UIPanel;
  private buildingManager: BuildingManager;
  private getCurrentAP: () => number;
  private onSelect: (structureId: string) => void;

  constructor(
    scene: Phaser.Scene,
    buildingManager: BuildingManager,
    getCurrentAP: () => number,
    onSelect: (structureId: string) => void
  ) {
    this.scene = scene;
    this.buildingManager = buildingManager;
    this.getCurrentAP = getCurrentAP;
    this.onSelect = onSelect;

    const structures = this.buildingManager.getAllStructureData();
    const panelHeight = structures.length * (ENTRY_HEIGHT + ENTRY_GAP) + 48;
    this.panel = new UIPanel(scene, 'BUILD', 360, panelHeight);

    this.rebuild();
  }

  /** Rebuild the menu entries to reflect current resource/AP state */
  rebuild(): void {
    const content = this.panel.getContentContainer();
    content.removeAll(true);

    const structures = this.buildingManager.getAllStructureData();
    const currentAP = this.getCurrentAP();

    structures.forEach((s, i) => {
      const y = i * (ENTRY_HEIGHT + ENTRY_GAP);
      const canAfford = this.buildingManager.canAfford(s.id);
      const hasAP = currentAP >= s.apCost;
      const available = canAfford && hasAP;
      const color = available ? FONT_COLOR : DISABLED_COLOR;

      // Hover background
      const bg = this.scene.add.graphics();
      bg.fillStyle(NORMAL_BG, 0);
      bg.fillRect(-4, y - 2, CONTENT_WIDTH + 8, ENTRY_HEIGHT);
      content.add(bg);

      // Structure name (10px title)
      const nameText = this.scene.add.text(0, y, s.name, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color,
      });
      content.add(nameText);

      // AP cost (8px label, right-aligned)
      const apText = this.scene.add.text(CONTENT_WIDTH, y + 2, `${s.apCost} AP`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: available ? '#FFD700' : DISABLED_COLOR,
      }).setOrigin(1, 0);
      content.add(apText);

      // Resource cost with icons (8px)
      renderResourceCosts(this.scene, content, s.cost, 0, y + 16, color);

      if (available) {
        bg.setInteractive(
          new Phaser.Geom.Rectangle(-4, y - 2, CONTENT_WIDTH + 8, ENTRY_HEIGHT),
          Phaser.Geom.Rectangle.Contains,
        );
        bg.input!.cursor = 'pointer';
        bg.on('pointerover', () => {
          bg.clear();
          bg.fillStyle(HOVER_BG, 0.5);
          bg.fillRect(-4, y - 2, CONTENT_WIDTH + 8, ENTRY_HEIGHT);
          nameText.setColor('#FFD700');
        });
        bg.on('pointerout', () => {
          bg.clear();
          bg.fillStyle(NORMAL_BG, 0);
          bg.fillRect(-4, y - 2, CONTENT_WIDTH + 8, ENTRY_HEIGHT);
          nameText.setColor(FONT_COLOR);
        });
        bg.on('pointerdown', () => {
          this.onSelect(s.id);
        });
      }

      content.add(nameText);
    });
  }

  toggle(): void {
    this.panel.toggle();
    if (this.panel.isVisible()) {
      this.rebuild();
    }
  }

  hide(): void {
    this.panel.hide();
  }

  show(): void {
    this.panel.show();
    this.rebuild();
  }

  isVisible(): boolean {
    return this.panel.isVisible();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.panel.getContainer();
  }

  destroy(): void {
    this.panel.getContainer().destroy();
  }
}

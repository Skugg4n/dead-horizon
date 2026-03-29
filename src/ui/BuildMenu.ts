import Phaser from 'phaser';
import { BuildingManager } from '../systems/BuildingManager';

const PANEL_WIDTH = 220;
const ENTRY_HEIGHT = 40;
const FONT_COLOR = '#E8DCC8';
const DISABLED_COLOR = '#6B6B6B';

export class BuildMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private buildingManager: BuildingManager;
  private visible: boolean = false;
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

    this.container = scene.add.container(16, 80);
    this.container.setDepth(110);
    this.container.setScrollFactor(0);
    this.container.setVisible(false);

    this.rebuild();
  }

  /** Rebuild the menu entries to reflect current resource/AP state */
  rebuild(): void {
    this.container.removeAll(true);

    const structures = this.buildingManager.getAllStructureData();
    const currentAP = this.getCurrentAP();

    // Background panel
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1A1A2E, 0.9);
    bg.fillRect(0, 0, PANEL_WIDTH, structures.length * ENTRY_HEIGHT + 16);
    bg.lineStyle(1, 0x6B6B6B);
    bg.strokeRect(0, 0, PANEL_WIDTH, structures.length * ENTRY_HEIGHT + 16);
    this.container.add(bg);

    structures.forEach((s, i) => {
      const y = 8 + i * ENTRY_HEIGHT;
      const canAfford = this.buildingManager.canAfford(s.id);
      const hasAP = currentAP >= s.apCost;
      const available = canAfford && hasAP;

      const costStr = Object.entries(s.cost).map(([r, n]) => `${n} ${r}`).join(', ');
      const color = available ? FONT_COLOR : DISABLED_COLOR;

      const entry = this.scene.add.text(8, y, `${s.name} (${s.apCost} AP)\n  ${costStr}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '11px',
        color,
      });

      if (available) {
        entry.setInteractive({ useHandCursor: true });
        entry.on('pointerover', () => entry.setColor('#FFD700'));
        entry.on('pointerout', () => entry.setColor(FONT_COLOR));
        entry.on('pointerdown', () => {
          this.onSelect(s.id);
        });
      }

      this.container.add(entry);
    });
  }

  toggle(): void {
    this.visible = !this.visible;
    if (this.visible) {
      this.rebuild();
    }
    this.container.setVisible(this.visible);
  }

  hide(): void {
    this.visible = false;
    this.container.setVisible(false);
  }

  show(): void {
    this.visible = true;
    this.rebuild();
    this.container.setVisible(true);
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.container.destroy();
  }
}

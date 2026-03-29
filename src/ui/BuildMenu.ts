import Phaser from 'phaser';
import { BuildingManager } from '../systems/BuildingManager';
import { UIPanel } from './UIPanel';

const ENTRY_HEIGHT = 40;
const FONT_COLOR = '#E8DCC8';
const DISABLED_COLOR = '#6B6B6B';

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
    const panelHeight = structures.length * ENTRY_HEIGHT + 48;
    this.panel = new UIPanel(scene, 'BUILD', 400, panelHeight);

    this.rebuild();
  }

  /** Rebuild the menu entries to reflect current resource/AP state */
  rebuild(): void {
    const content = this.panel.getContentContainer();
    content.removeAll(true);

    const structures = this.buildingManager.getAllStructureData();
    const currentAP = this.getCurrentAP();

    structures.forEach((s, i) => {
      const y = i * ENTRY_HEIGHT;
      const canAfford = this.buildingManager.canAfford(s.id);
      const hasAP = currentAP >= s.apCost;
      const available = canAfford && hasAP;

      const costStr = Object.entries(s.cost).map(([r, n]) => `${n} ${r}`).join(', ');
      const color = available ? FONT_COLOR : DISABLED_COLOR;

      const entry = this.scene.add.text(0, y, `${s.name} (${s.apCost} AP)\n  ${costStr}`, {
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

      content.add(entry);
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

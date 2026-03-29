import Phaser from 'phaser';
import { AP_PER_DAY } from '../config/constants';

const BAR_X = 16;
const BAR_Y = 8;
const PIP_W = 12;
const PIP_H = 8;
const PIP_GAP = 3;
const PIP_COLOR_FULL = 0xC5A030;
const PIP_COLOR_EMPTY = 0x333333;
const TEXT_COLOR = '#E8DCC8';

export class ActionPointBar {
  private container: Phaser.GameObjects.Container;
  private pips: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private currentAP: number;
  private maxAP: number;

  constructor(scene: Phaser.Scene, startAP: number = AP_PER_DAY) {
    this.currentAP = startAP;
    this.maxAP = AP_PER_DAY;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(100);
    this.container.setScrollFactor(0);

    this.label = scene.add.text(BAR_X, BAR_Y, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: TEXT_COLOR,
    });
    this.container.add(this.label);

    this.pips = scene.add.graphics();
    this.container.add(this.pips);

    this.redraw();
  }

  update(currentAP: number): void {
    this.currentAP = currentAP;
    this.redraw();
  }

  private redraw(): void {
    this.label.setText(`AP ${this.currentAP}/${this.maxAP}`);

    this.pips.clear();
    const pipY = BAR_Y + 14;

    for (let i = 0; i < this.maxAP; i++) {
      const x = BAR_X + i * (PIP_W + PIP_GAP);
      const color = i < this.currentAP ? PIP_COLOR_FULL : PIP_COLOR_EMPTY;
      this.pips.fillStyle(color);
      this.pips.fillRect(x, pipY, PIP_W, PIP_H);
    }
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  destroy(): void {
    this.container.destroy();
  }
}

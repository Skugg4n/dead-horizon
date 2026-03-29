// Dead Horizon -- Event dialog for random day events
// Modal dialog showing event description and choices with consequences

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';

const DIALOG_WIDTH = 380;
const DIALOG_HEIGHT = 220;
const DIALOG_X = (GAME_WIDTH - DIALOG_WIDTH) / 2;
const DIALOG_Y = (GAME_HEIGHT - DIALOG_HEIGHT) / 2;

export interface EventChoice {
  text: string;
  effect: Record<string, number | boolean>;
}

export interface EventData {
  id: string;
  name: string;
  description: string;
  type: string;
  choices: EventChoice[];
}

export class EventDialog {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private onChoice: ((choice: EventChoice) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(DIALOG_X, DIALOG_Y);
    this.container.setDepth(200);
    this.container.setVisible(false);
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  show(event: EventData, onChoice: (choice: EventChoice) => void): void {
    this.onChoice = onChoice;
    this.container.removeAll(true);

    // Dimmed overlay
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.6);
    overlay.fillRect(-DIALOG_X, -DIALOG_Y, GAME_WIDTH, GAME_HEIGHT);
    this.container.add(overlay);

    // Dialog background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1A1A2E, 0.95);
    bg.fillRect(0, 0, DIALOG_WIDTH, DIALOG_HEIGHT);
    bg.lineStyle(2, 0xD4920B);
    bg.strokeRect(0, 0, DIALOG_WIDTH, DIALOG_HEIGHT);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(DIALOG_WIDTH / 2, 14, event.name.toUpperCase(), {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#D4920B',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Description
    const desc = this.scene.add.text(DIALOG_WIDTH / 2, 40, event.description, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#E8DCC8',
      align: 'center',
      wordWrap: { width: DIALOG_WIDTH - 32 },
    }).setOrigin(0.5, 0);
    this.container.add(desc);

    // Choice buttons
    const startY = 100;
    const spacing = 32;
    event.choices.forEach((choice, index) => {
      const y = startY + index * spacing;
      const btn = this.scene.add.text(DIALOG_WIDTH / 2, y, `[ ${choice.text} ]`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '12px',
        color: '#D4920B',
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

      btn.on('pointerover', () => btn.setColor('#FFD700'));
      btn.on('pointerout', () => btn.setColor('#D4920B'));
      btn.on('pointerdown', () => this.resolve(choice));
      this.container.add(btn);
    });

    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
    this.container.removeAll(true);
  }

  private resolve(choice: EventChoice): void {
    if (this.onChoice) {
      const cb = this.onChoice;
      this.onChoice = null;
      this.hide();
      cb(choice);
    }
  }
}

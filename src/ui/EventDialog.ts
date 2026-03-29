// Dead Horizon -- Event dialog for random day events
// Modal dialog showing event description and choices with consequences
// Uses UIPanel styling but with modal behavior (backdrop, must choose an option)

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';

const DIALOG_WIDTH = 360;
const DIALOG_HEIGHT = 260;
const DIALOG_X = Math.floor((GAME_WIDTH - DIALOG_WIDTH) / 2);
const DIALOG_Y = Math.floor((GAME_HEIGHT - DIALOG_HEIGHT) / 2);

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
  private backdrop: Phaser.GameObjects.Graphics;
  private onChoice: ((choice: EventChoice) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Semi-transparent backdrop covering full screen
    this.backdrop = scene.add.graphics();
    this.backdrop.fillStyle(0x000000, 0.6);
    this.backdrop.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.backdrop.setDepth(190);
    this.backdrop.setVisible(false);
    // Backdrop is interactive to block clicks but does NOT close the dialog
    this.backdrop.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT),
      Phaser.Geom.Rectangle.Contains,
    );

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

    // Dialog background with UIPanel styling
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1A1A1A, 0.95);
    bg.fillRect(0, 0, DIALOG_WIDTH, DIALOG_HEIGHT);
    bg.lineStyle(1, 0x333333, 1);
    bg.strokeRect(0, 0, DIALOG_WIDTH, DIALOG_HEIGHT);
    this.container.add(bg);

    // Header bar
    const headerBg = this.scene.add.graphics();
    headerBg.fillStyle(0x333333, 1);
    headerBg.fillRect(0, 0, DIALOG_WIDTH, 24);
    this.container.add(headerBg);

    // Title
    const title = this.scene.add.text(12, 6, event.name.toUpperCase(), {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#D4920B',
    });
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
    const startY = 110;
    const spacing = 32;
    event.choices.forEach((choice, index) => {
      const y = startY + index * spacing;
      const btn = this.scene.add.text(DIALOG_WIDTH / 2, y, `[ ${choice.text} ]`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#D4920B',
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

      btn.on('pointerover', () => btn.setColor('#FFD700'));
      btn.on('pointerout', () => btn.setColor('#D4920B'));
      btn.on('pointerdown', () => this.resolve(choice));
      this.container.add(btn);
    });

    this.backdrop.setVisible(true);
    this.container.setVisible(true);
  }

  hide(): void {
    this.backdrop.setVisible(false);
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

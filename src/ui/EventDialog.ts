// Dead Horizon -- Event dialog for random day events
// Modal dialog showing event description and choices with consequences
// Uses dynamic height to prevent content overflow

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';

const DIALOG_WIDTH = 400;
// Minimum heights and padding -- actual height is computed from content
const HEADER_HEIGHT = 30;
const PADDING = 16;
const DESC_Y = HEADER_HEIGHT + PADDING;
// Approximate pixels per wrapped line of description text (10px Press Start 2P)
const DESC_LINE_H = 18;
const BOTTOM_PAD = 14;

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
    this.backdrop.fillStyle(0x000000, 0.65);
    this.backdrop.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.backdrop.setDepth(190);
    this.backdrop.setVisible(false);
    // Backdrop blocks clicks but does NOT close dialog (player must choose)
    this.backdrop.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT),
      Phaser.Geom.Rectangle.Contains,
    );

    this.container = scene.add.container(0, 0);
    this.container.setDepth(200);
    this.container.setVisible(false);
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  show(event: EventData, onChoice: (choice: EventChoice) => void): void {
    this.onChoice = onChoice;
    this.container.removeAll(true);

    // --- Measure content to calculate required dialog height ---
    // Estimate wrapped lines for description (chars per line at ~7px/char with 10px font)
    const descWrapWidth = DIALOG_WIDTH - PADDING * 2;
    const descWrappedLines = this.estimateWrappedLines(event.description, descWrapWidth, 10);
    const descH = Math.max(2, descWrappedLines) * DESC_LINE_H;

    // Estimate height needed for each choice (long choice text may wrap to 2 lines)
    const choiceTotalH = event.choices.reduce((sum, choice) => {
      const choiceLines = this.estimateWrappedLines(choice.text, descWrapWidth - 16, 9);
      return sum + Math.max(1, choiceLines) * 16 + 20; // line height + button padding
    }, 0);

    const dialogH = DESC_Y + descH + PADDING + choiceTotalH + BOTTOM_PAD;
    const dialogX = Math.floor((GAME_WIDTH - DIALOG_WIDTH) / 2);
    const dialogY = Math.floor((GAME_HEIGHT - dialogH) / 2);

    this.container.setPosition(dialogX, dialogY);

    // --- Background ---
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1A1A1A, 0.97);
    bg.fillRoundedRect(0, 0, DIALOG_WIDTH, dialogH, 8);
    bg.lineStyle(2, 0xD4920B, 0.9);
    bg.strokeRoundedRect(0, 0, DIALOG_WIDTH, dialogH, 8);
    this.container.add(bg);

    // Header bar
    const headerBg = this.scene.add.graphics();
    headerBg.fillStyle(0x2A2020, 1);
    headerBg.fillRoundedRect(0, 0, DIALOG_WIDTH, HEADER_HEIGHT, { tl: 8, tr: 8, bl: 0, br: 0 });
    this.container.add(headerBg);

    // Event name in header (truncate if needed)
    const title = this.scene.add.text(PADDING, 8, event.name.toUpperCase(), {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#D4920B',
      wordWrap: { width: DIALOG_WIDTH - PADDING * 3 },
    });
    this.container.add(title);

    // Description -- full word wrap, contained within panel width
    const desc = this.scene.add.text(PADDING, DESC_Y, event.description, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#E8DCC8',
      wordWrap: { width: descWrapWidth },
      lineSpacing: 4,
    });
    this.container.add(desc);

    // Separator line
    const sepY = DESC_Y + descH + 8;
    const sep = this.scene.add.graphics();
    sep.lineStyle(1, 0x3A2A1A, 0.8);
    sep.lineBetween(PADDING, sepY, DIALOG_WIDTH - PADDING, sepY);
    this.container.add(sep);

    // --- Choice buttons ---
    let choiceY = sepY + 10;

    event.choices.forEach((choice) => {
      const btnY = choiceY;
      // Estimate this choice's text height
      const choiceLines = this.estimateWrappedLines(choice.text, descWrapWidth - 16, 9);
      const btnH = Math.max(1, choiceLines) * 16 + 20;

      // Button background
      const btnBg = this.scene.add.graphics();
      btnBg.fillStyle(0x1E1208, 0.9);
      btnBg.fillRect(PADDING - 4, btnY, DIALOG_WIDTH - PADDING * 2 + 8, btnH);
      btnBg.lineStyle(1, 0x4A2A0A, 0.6);
      btnBg.strokeRect(PADDING - 4, btnY, DIALOG_WIDTH - PADDING * 2 + 8, btnH);
      this.container.add(btnBg);

      const btn = this.scene.add.text(PADDING, btnY + 6, choice.text, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#D4920B',
        wordWrap: { width: descWrapWidth - 8 },
        lineSpacing: 3,
      }).setOrigin(0, 0).setInteractive({ useHandCursor: true });

      btn.on('pointerover', () => {
        btn.setColor('#FFD700');
        btnBg.clear();
        btnBg.fillStyle(0x2E1A0A, 0.95);
        btnBg.fillRect(PADDING - 4, btnY, DIALOG_WIDTH - PADDING * 2 + 8, btnH);
        btnBg.lineStyle(1, 0x8A4A18, 0.8);
        btnBg.strokeRect(PADDING - 4, btnY, DIALOG_WIDTH - PADDING * 2 + 8, btnH);
      });

      btn.on('pointerout', () => {
        btn.setColor('#D4920B');
        btnBg.clear();
        btnBg.fillStyle(0x1E1208, 0.9);
        btnBg.fillRect(PADDING - 4, btnY, DIALOG_WIDTH - PADDING * 2 + 8, btnH);
        btnBg.lineStyle(1, 0x4A2A0A, 0.6);
        btnBg.strokeRect(PADDING - 4, btnY, DIALOG_WIDTH - PADDING * 2 + 8, btnH);
      });

      btn.on('pointerdown', () => this.resolve(choice));
      this.container.add(btn);

      choiceY += btnH + 6;
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

  /**
   * Estimates number of lines after word-wrap.
   * Uses approximate character width for given font size.
   * Press Start 2P is roughly 0.7 * fontSize wide per character.
   */
  private estimateWrappedLines(text: string, wrapWidth: number, fontSize: number): number {
    const charWidth = fontSize * 0.72;
    const charsPerLine = Math.floor(wrapWidth / charWidth);
    if (charsPerLine <= 0) return 1;
    // Split on explicit newlines too
    const lines = text.split('\n');
    let total = 0;
    for (const line of lines) {
      total += Math.max(1, Math.ceil(line.length / charsPerLine));
    }
    return total;
  }
}

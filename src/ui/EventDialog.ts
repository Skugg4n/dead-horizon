// Dead Horizon -- Event dialog for random day events
// U4: Fixed grey-box overflow. Dialog now calculates its own height dynamically
//     based on content, and everything is clipped to the panel boundary.
//     Rounded corners, proper text wrapping, auto-reducing font for long choices.

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';

const DIALOG_WIDTH = 420;
// Vertical padding constants
const HEADER_H = 36;
const PADDING = 16;
const CHOICE_SPACING = 8;    // gap between choice buttons
const BOTTOM_PAD = 16;       // space below last button

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

    // Full-screen semi-transparent backdrop
    this.backdrop = scene.add.graphics();
    this.backdrop.fillStyle(0x000000, 0.6);
    this.backdrop.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.backdrop.setDepth(190);
    this.backdrop.setVisible(false);
    // Block all clicks behind the dialog
    this.backdrop.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT),
      Phaser.Geom.Rectangle.Contains,
    );

    // Container is repositioned dynamically in show() once we know dialog height
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

    // -- Measure text heights before drawing so we can size the panel correctly --
    // We use a temporary off-screen text object to get wrapped height.

    const textAreaW = DIALOG_WIDTH - PADDING * 2;

    // Description text (measured)
    const descTemp = this.scene.add.text(-2000, -2000, event.description, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      wordWrap: { width: textAreaW },
      align: 'center',
    });
    const descHeight = descTemp.height;
    descTemp.destroy();

    // Choose font size for choices: start at 9px, shrink if any choice is long
    const longestChoiceLen = Math.max(...event.choices.map(c => c.text.length));
    const choiceFontSize = longestChoiceLen > 40 ? '8px' : '9px';

    // Measure each choice button height
    const choiceHeights: number[] = event.choices.map(choice => {
      const tmp = this.scene.add.text(-2000, -2000, `[ ${choice.text} ]`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: choiceFontSize,
        wordWrap: { width: textAreaW - 16 },
        align: 'center',
      });
      const h = tmp.height;
      tmp.destroy();
      return h;
    });

    const totalChoiceH = choiceHeights.reduce((a, b) => a + b, 0)
      + CHOICE_SPACING * (event.choices.length - 1);

    // Total dialog height: header + padding + desc + gap + choices + bottom padding
    const GAP_AFTER_DESC = 14;
    const dialogHeight = HEADER_H + PADDING + descHeight + GAP_AFTER_DESC + totalChoiceH + BOTTOM_PAD;

    // Clamp to screen height with a margin
    const MAX_H = GAME_HEIGHT - 60;
    const finalH = Math.min(dialogHeight, MAX_H);

    // Center the dialog
    const dialogX = Math.floor((GAME_WIDTH - DIALOG_WIDTH) / 2);
    const dialogY = Math.floor((GAME_HEIGHT - finalH) / 2);
    this.container.setPosition(dialogX, dialogY);

    // -- Background with rounded corners --
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1A1A1A, 0.97);
    bg.fillRoundedRect(0, 0, DIALOG_WIDTH, finalH, 10);
    bg.lineStyle(2, 0xD4920B, 0.9);
    bg.strokeRoundedRect(0, 0, DIALOG_WIDTH, finalH, 10);
    this.container.add(bg);

    // Header bar (rounded only at top)
    const headerBg = this.scene.add.graphics();
    headerBg.fillStyle(0x2A2A2A, 1);
    headerBg.fillRoundedRect(0, 0, DIALOG_WIDTH, HEADER_H, { tl: 10, tr: 10, bl: 0, br: 0 });
    this.container.add(headerBg);

    // Title text
    const title = this.scene.add.text(PADDING, Math.floor(HEADER_H / 2), event.name.toUpperCase(), {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#D4920B',
    }).setOrigin(0, 0.5);
    this.container.add(title);

    // Event type badge (right side of header)
    const badge = this.scene.add.text(DIALOG_WIDTH - PADDING, Math.floor(HEADER_H / 2), event.type.toUpperCase(), {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#6B6B6B',
    }).setOrigin(1, 0.5);
    this.container.add(badge);

    // Description text -- centered, with word wrap
    const desc = this.scene.add.text(
      DIALOG_WIDTH / 2,
      HEADER_H + PADDING,
      event.description,
      {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#E8DCC8',
        align: 'center',
        wordWrap: { width: textAreaW },
      },
    ).setOrigin(0.5, 0);
    this.container.add(desc);

    // Choice buttons -- stacked, each one contained within panel width
    let choiceY = HEADER_H + PADDING + descHeight + GAP_AFTER_DESC;

    event.choices.forEach((choice, index) => {
      const btnY = choiceY;

      // Button background highlight box -- height comes from measured choiceHeights array
      const choiceH = choiceHeights[index] ?? 0;
      const btnBg = this.scene.add.graphics();
      btnBg.fillStyle(0x2A2A2A, 0);
      btnBg.fillRoundedRect(PADDING - 4, btnY - 4, DIALOG_WIDTH - PADDING * 2 + 8, choiceH + 8, 4);
      this.container.add(btnBg);

      const btn = this.scene.add.text(
        DIALOG_WIDTH / 2,
        btnY,
        `[ ${choice.text} ]`,
        {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: choiceFontSize,
          color: '#D4920B',
          wordWrap: { width: textAreaW - 16 },
          align: 'center',
        },
      ).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

      btn.on('pointerover', () => {
        btn.setColor('#FFD700');
        btnBg.clear();
        btnBg.fillStyle(0x3A2A0A, 0.8);
        btnBg.fillRoundedRect(PADDING - 4, btnY - 4, DIALOG_WIDTH - PADDING * 2 + 8, choiceH + 8, 4);
      });
      btn.on('pointerout', () => {
        btn.setColor('#D4920B');
        btnBg.clear();
        btnBg.fillStyle(0x2A2A2A, 0);
        btnBg.fillRoundedRect(PADDING - 4, btnY - 4, DIALOG_WIDTH - PADDING * 2 + 8, choiceH + 8, 4);
      });
      btn.on('pointerdown', () => this.resolve(choice));

      this.container.add(btn);

      choiceY += choiceH + CHOICE_SPACING;
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

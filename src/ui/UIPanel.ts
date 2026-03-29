// Dead Horizon -- Shared UI panel component

import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';

/** Event name emitted to close all open panels. */
export const CLOSE_ALL_PANELS = 'close-all-panels';

const HEADER_HEIGHT = 24;
const PADDING = 12;
const PANEL_Y = 56;
const BORDER_COLOR = 0x333333;
const BG_COLOR = 0x1A1A1A;
const BG_ALPHA = 0.95;
const TITLE_COLOR = '#E8DCC8';
const MAX_PANEL_HEIGHT = GAME_HEIGHT - 120;

export class UIPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private contentContainer: Phaser.GameObjects.Container;
  private visible: boolean = false;
  private panelWidth: number;
  private panelHeight: number;

  constructor(
    scene: Phaser.Scene,
    title: string,
    width: number,
    height: number,
  ) {
    this.scene = scene;
    this.panelWidth = Math.min(width, 400);
    this.panelHeight = Math.min(height, MAX_PANEL_HEIGHT);

    const panelX = Math.floor((GAME_WIDTH - this.panelWidth) / 2);

    this.container = scene.add.container(panelX, PANEL_Y);
    this.container.setDepth(100);
    this.container.setVisible(false);

    // Background with border
    const bg = scene.add.graphics();
    bg.fillStyle(BG_COLOR, BG_ALPHA);
    bg.fillRect(0, 0, this.panelWidth, this.panelHeight);
    bg.lineStyle(1, BORDER_COLOR, 1);
    bg.strokeRect(0, 0, this.panelWidth, this.panelHeight);
    this.container.add(bg);

    // Header background
    const headerBg = scene.add.graphics();
    headerBg.fillStyle(BORDER_COLOR, 1);
    headerBg.fillRect(0, 0, this.panelWidth, HEADER_HEIGHT);
    this.container.add(headerBg);

    // Title text
    const titleText = scene.add.text(PADDING, 6, title, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: TITLE_COLOR,
    });
    this.container.add(titleText);

    // Close button [X]
    const closeBtn = scene.add.text(
      this.panelWidth - PADDING - 20,
      6,
      '[X]',
      {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: TITLE_COLOR,
      },
    );
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    closeBtn.on('pointerover', () => closeBtn.setColor('#FFD700'));
    closeBtn.on('pointerout', () => closeBtn.setColor(TITLE_COLOR));
    this.container.add(closeBtn);

    // Content container (offset by header + padding)
    this.contentContainer = scene.add.container(
      PADDING,
      HEADER_HEIGHT + PADDING,
    );
    this.container.add(this.contentContainer);

    // Listen for close-all event
    scene.events.on(CLOSE_ALL_PANELS, this.handleCloseAll, this);

    // Clean up on scene shutdown
    scene.events.once('shutdown', () => {
      scene.events.off(CLOSE_ALL_PANELS, this.handleCloseAll, this);
      this.container.destroy();
    });
  }

  private handleCloseAll = (): void => {
    if (this.visible) {
      this.container.setVisible(false);
      this.visible = false;
    }
  };

  show(): void {
    // Close any other open panels first
    this.scene.events.emit(CLOSE_ALL_PANELS);
    this.container.setVisible(true);
    this.visible = true;
  }

  hide(): void {
    this.container.setVisible(false);
    this.visible = false;
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  getContentContainer(): Phaser.GameObjects.Container {
    return this.contentContainer;
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
}

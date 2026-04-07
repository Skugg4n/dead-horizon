// Dead Horizon -- Shared UI panel component

import Phaser from 'phaser';
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
const MAX_PANEL_HEIGHT = GAME_HEIGHT - 160; // Leave room for toolbar + resource bar
const SCROLL_STEP = 30; // pixels per scroll tick

export class UIPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private contentContainer: Phaser.GameObjects.Container;
  private visible: boolean = false;
  private panelWidth: number;
  private panelHeight: number;
  private backdrop: Phaser.GameObjects.Graphics;
  private contentMask!: Phaser.Display.Masks.GeometryMask;
  private scrollY: number = 0;
  private contentAreaHeight: number = 0;

  constructor(
    scene: Phaser.Scene,
    title: string,
    width: number,
    height: number,
  ) {
    this.scene = scene;
    this.panelWidth = Math.min(width, 360);
    this.panelHeight = Math.min(height, MAX_PANEL_HEIGHT);

    const panelX = Math.floor((GAME_WIDTH - this.panelWidth) / 2);

    // Full-screen invisible backdrop -- clicking outside the panel closes it
    this.backdrop = scene.add.graphics();
    this.backdrop.fillStyle(0x000000, 0.01);
    this.backdrop.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.backdrop.setDepth(249);
    this.backdrop.setVisible(false);
    this.backdrop.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT),
      Phaser.Geom.Rectangle.Contains,
    );
    this.backdrop.on('pointerdown', () => this.hide());

    this.container = scene.add.container(panelX, PANEL_Y);
    this.container.setDepth(250);
    this.container.setVisible(false);

    // Background with border -- blocks clicks from reaching the backdrop
    const bg = scene.add.graphics();
    bg.fillStyle(BG_COLOR, BG_ALPHA);
    bg.fillRect(0, 0, this.panelWidth, this.panelHeight);
    bg.lineStyle(1, BORDER_COLOR, 1);
    bg.strokeRect(0, 0, this.panelWidth, this.panelHeight);
    bg.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, this.panelWidth, this.panelHeight),
      Phaser.Geom.Rectangle.Contains,
    );
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

    // Content area height (visible portion)
    this.contentAreaHeight = this.panelHeight - HEADER_HEIGHT - PADDING * 2;

    // Mask: clip content to panel bounds so it never overflows
    const maskShape = scene.make.graphics({ x: 0, y: 0 });
    // Mask position is in world space -- we compute it relative to container position
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(
      panelX,
      PANEL_Y + HEADER_HEIGHT,
      this.panelWidth,
      this.panelHeight - HEADER_HEIGHT,
    );
    this.contentMask = maskShape.createGeometryMask();
    this.contentContainer.setMask(this.contentMask);

    // Mouse wheel scrolling on the panel background
    bg.on('wheel', (_pointer: Phaser.Input.Pointer, _dx: number, _dy: number, dz: number) => {
      this.scroll(dz > 0 ? SCROLL_STEP : -SCROLL_STEP);
    });

    // Listen for close-all event
    scene.events.on(CLOSE_ALL_PANELS, this.handleCloseAll, this);

    // Clean up on scene shutdown
    scene.events.once('shutdown', () => {
      scene.events.off(CLOSE_ALL_PANELS, this.handleCloseAll, this);
      this.backdrop.destroy();
      this.container.destroy();
    });
  }

  private handleCloseAll = (): void => {
    if (this.visible) {
      this.container.setVisible(false);
      this.backdrop.setVisible(false);
      this.visible = false;
    }
  };

  show(): void {
    // Close any other open panels first
    this.scene.events.emit(CLOSE_ALL_PANELS);
    this.backdrop.setVisible(true);
    this.container.setVisible(true);
    this.visible = true;
  }

  hide(): void {
    this.backdrop.setVisible(false);
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

  /** Scroll content by delta pixels (positive = down, negative = up). */
  scroll(delta: number): void {
    // Measure total content height by checking children bounds
    let maxY = 0;
    for (const child of this.contentContainer.list) {
      const obj = child as unknown as { y?: number; height?: number; displayHeight?: number };
      if (typeof obj.y === 'number') {
        const h = obj.displayHeight ?? obj.height ?? 12;
        const bottom = obj.y + h;
        if (bottom > maxY) maxY = bottom;
      }
    }

    const maxScroll = Math.max(0, maxY - this.contentAreaHeight);
    this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, maxScroll);
    this.contentContainer.y = HEADER_HEIGHT + PADDING - this.scrollY;
  }

  /** Reset scroll to top (call after rebuilding content). */
  resetScroll(): void {
    this.scrollY = 0;
    this.contentContainer.y = HEADER_HEIGHT + PADDING;
  }

  getContentContainer(): Phaser.GameObjects.Container {
    return this.contentContainer;
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  getBackdrop(): Phaser.GameObjects.Graphics {
    return this.backdrop;
  }
}

import Phaser from 'phaser';

// Maximum number of visible message lines in the log box
const MAX_MESSAGES = 8;

// Visual constants
const LOG_X = 4;
const LOG_Y = 418;          // above resource bar (GAME_HEIGHT - 72 = 528) with padding
const LOG_W = 252;
const LOG_H = 104;
const PADDING = 5;
const FONT_SIZE = '7px';
const LINE_HEIGHT = 12;

// Color for each message entry -- older entries fade towards dark grey
const COLORS_BY_AGE = [
  '#cccccc', // newest (index 0 from end)
  '#b8b8b8',
  '#a0a0a0',
  '#888888',
  '#757575',
  '#636363',
  '#525252',
  '#404040', // oldest visible
];

interface LogEntry {
  text: string;
  color: string;
}

/**
 * GameLog -- scrolling chat-box style message log in the lower-left corner.
 * Shows the last MAX_MESSAGES lines; newest is always at the bottom.
 * All game events (waves, loot, warnings) are funnelled here in addition to
 * the existing HUD fade-out messages.
 *
 * Uses a dual-camera-aware design:
 * - In NightScene (single camera) the container uses setScrollFactor(0).
 * - In DayScene (dual camera) the caller must call getContainer() and pass it
 *   to addToUI() so it lives on the fixed UI camera.
 */
export class GameLog {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private lineTexts: Phaser.GameObjects.Text[] = [];
  private messages: LogEntry[] = [];

  // Throttle: track last time "Base took damage!" was added (ms)
  private lastBaseDamageTime: number = 0;
  private readonly BASE_DAMAGE_THROTTLE_MS = 5000;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Container is positioned at LOG_X, LOG_Y in screen space.
    this.container = scene.add.container(LOG_X, LOG_Y);
    this.container.setDepth(200);
    // setScrollFactor(0) keeps it fixed for NightScene (single camera).
    // DayScene uses dual cameras -- the caller must call addToUI(getContainer()).
    this.container.setScrollFactor(0);

    // Semi-transparent background panel
    this.bg = scene.add.graphics();
    this.drawBackground();
    this.container.add(this.bg);

    // Pre-create text objects for each visible line (bottom = newest)
    for (let i = 0; i < MAX_MESSAGES; i++) {
      const lineY = PADDING + i * LINE_HEIGHT;
      const txt = scene.add.text(PADDING, lineY, '', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: FONT_SIZE,
        color: '#cccccc',
        wordWrap: { width: LOG_W - PADDING * 2 },
      });
      this.lineTexts.push(txt);
      this.container.add(txt);
    }
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  /**
   * Append a new message to the log.
   * @param text    Message to display.
   * @param color   Optional hex color string (default: '#cccccc').
   */
  addMessage(text: string, color: string = '#cccccc'): void {
    this.messages.push({ text, color });
    // Trim history to 2x max so we don't accumulate forever
    if (this.messages.length > MAX_MESSAGES * 2) {
      this.messages.splice(0, this.messages.length - MAX_MESSAGES * 2);
    }
    this.refresh();
  }

  /**
   * Add a "Base took damage!" entry, throttled to once per 5 seconds
   * to avoid spamming the log during heavy zombie attacks.
   */
  addBaseDamageMessage(): void {
    const now = this.scene.time.now;
    if (now - this.lastBaseDamageTime < this.BASE_DAMAGE_THROTTLE_MS) return;
    this.lastBaseDamageTime = now;
    this.addMessage('Base took damage!', '#FF6B6B');
  }

  show(): void {
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }

  clear(): void {
    this.messages = [];
    this.refresh();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  private drawBackground(): void {
    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.55);
    this.bg.fillRoundedRect(0, 0, LOG_W, LOG_H, 4);
    this.bg.lineStyle(1, 0x333333, 0.6);
    this.bg.strokeRoundedRect(0, 0, LOG_W, LOG_H, 4);
  }

  /**
   * Rebuild the visible text lines from the current messages array.
   * The last MAX_MESSAGES entries are rendered, newest at the bottom.
   * Older lines receive progressively darker alpha to fade into the background.
   */
  private refresh(): void {
    // Slice the last MAX_MESSAGES entries
    const visible = this.messages.slice(-MAX_MESSAGES);

    for (let i = 0; i < MAX_MESSAGES; i++) {
      const entry = visible[i];
      const txt = this.lineTexts[i];

      // Guard: txt should always exist as the array is populated in constructor,
      // but strict mode requires the check since array access returns T | undefined.
      if (!txt) continue;

      if (!entry) {
        txt.setText('');
        continue;
      }

      txt.setText(entry.text);

      // Age-based dimming: the entry at position i within `visible` has an
      // age of (visible.length - 1 - i) from the bottom (0 = newest).
      const ageFromBottom = (visible.length - 1) - i;
      const rawColor: string | undefined = COLORS_BY_AGE[ageFromBottom] ?? COLORS_BY_AGE[COLORS_BY_AGE.length - 1];
      // Fallback to light grey if somehow the age lookup returns undefined
      const dimmedColor: string = rawColor ?? '#cccccc';
      txt.setColor(dimmedColor);
    }
  }
}

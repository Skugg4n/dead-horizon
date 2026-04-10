import Phaser from 'phaser';

// Maximum number of visible message lines in the log box (collapsed view).
const MAX_MESSAGES = 8;
// Maximum number of visible lines when the log is expanded (T key).
const MAX_MESSAGES_EXPANDED = 22;
// How many messages we retain in memory for the scrollable history.
const HISTORY_LIMIT = 60;

// Visual constants
const LOG_X = 4;
const LOG_Y = 418;          // above resource bar
const LOG_W = 252;
const LOG_H_COLLAPSED = 104;
const LOG_H_EXPANDED = 272; // grows upward so the bottom anchor stays the same
const PADDING = 5;
const FONT_SIZE = '7px';
const LINE_HEIGHT = 12;

// Color for each message entry -- older entries fade towards dark grey
const COLORS_BY_AGE = [
  '#cccccc', // newest
  '#b8b8b8',
  '#a0a0a0',
  '#888888',
  '#757575',
  '#636363',
  '#525252',
  '#404040',
];

export type LogPriority = 'critical' | 'normal' | 'spam';

interface LogEntry {
  text: string;
  color: string;
  priority: LogPriority;
  timestamp: number;
}

/**
 * GameLog -- scrolling chat-box style message log in the lower-left corner.
 *
 * Priority levels:
 *   - 'critical' : keeps original bright color regardless of age, prefixed with '!'
 *   - 'normal'   : standard age-based dimming
 *   - 'spam'     : allowed to be pushed out quickly, dimmed faster
 *
 * Press T (wired from the scene) to toggle expanded history view showing
 * the last MAX_MESSAGES_EXPANDED messages from the persistent history.
 */
export class GameLog {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private lineTexts: Phaser.GameObjects.Text[] = [];
  private hintText: Phaser.GameObjects.Text;
  private messages: LogEntry[] = [];
  private expanded = false;

  private lastBaseDamageTime: number = 0;
  private readonly BASE_DAMAGE_THROTTLE_MS = 5000;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.container = scene.add.container(LOG_X, LOG_Y);
    this.container.setDepth(200);
    this.container.setScrollFactor(0);

    this.bg = scene.add.graphics();
    this.drawBackground();
    this.container.add(this.bg);

    // Pre-create text objects for the maximum possible number of lines so
    // expand/collapse is a simple visibility toggle.
    for (let i = 0; i < MAX_MESSAGES_EXPANDED; i++) {
      const txt = scene.add.text(PADDING, 0, '', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: FONT_SIZE,
        color: '#cccccc',
        wordWrap: { width: LOG_W - PADDING * 2 },
      });
      this.lineTexts.push(txt);
      this.container.add(txt);
    }

    this.hintText = scene.add.text(LOG_W - PADDING, PADDING, '[T] log', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#666666',
    }).setOrigin(1, 0);
    this.container.add(this.hintText);

    this.layout();
    this.refresh();
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  addMessage(text: string, color: string = '#cccccc', priority: LogPriority = 'normal'): void {
    const prefix = priority === 'critical' ? '! ' : '';
    this.messages.push({
      text: prefix + text,
      color,
      priority,
      timestamp: this.scene.time.now,
    });
    if (this.messages.length > HISTORY_LIMIT) {
      this.messages.splice(0, this.messages.length - HISTORY_LIMIT);
    }
    this.refresh();
  }

  addBaseDamageMessage(): void {
    const now = this.scene.time.now;
    if (now - this.lastBaseDamageTime < this.BASE_DAMAGE_THROTTLE_MS) return;
    this.lastBaseDamageTime = now;
    this.addMessage('Base took damage!', '#FF6B6B', 'critical');
  }

  toggleExpanded(): void {
    this.expanded = !this.expanded;
    this.layout();
    this.refresh();
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
    const h = this.expanded ? LOG_H_EXPANDED : LOG_H_COLLAPSED;
    // Anchor to the bottom by offsetting Y upward when expanded
    const yOffset = this.expanded ? -(LOG_H_EXPANDED - LOG_H_COLLAPSED) : 0;
    this.bg.clear();
    this.bg.fillStyle(0x000000, this.expanded ? 0.75 : 0.55);
    this.bg.fillRoundedRect(0, yOffset, LOG_W, h, 4);
    this.bg.lineStyle(1, this.expanded ? 0x777733 : 0x333333, this.expanded ? 0.8 : 0.6);
    this.bg.strokeRoundedRect(0, yOffset, LOG_W, h, 4);
  }

  private layout(): void {
    this.drawBackground();
    const visibleCount = this.expanded ? MAX_MESSAGES_EXPANDED : MAX_MESSAGES;
    const h = this.expanded ? LOG_H_EXPANDED : LOG_H_COLLAPSED;
    const yOffset = this.expanded ? -(LOG_H_EXPANDED - LOG_H_COLLAPSED) : 0;

    for (let i = 0; i < this.lineTexts.length; i++) {
      const txt = this.lineTexts[i];
      if (!txt) continue;
      if (i < visibleCount) {
        txt.setVisible(true);
        txt.setY(yOffset + PADDING + i * LINE_HEIGHT);
      } else {
        txt.setVisible(false);
      }
    }

    // Hint anchored to top-right corner of whichever panel is shown
    this.hintText.setY(yOffset + PADDING);
    this.hintText.setText(this.expanded ? '[T] close' : '[T] log');
    this.hintText.setColor(this.expanded ? '#ffcc66' : '#666666');
    // Suppress the unused-var warning about h
    void h;
  }

  private refresh(): void {
    const maxVisible = this.expanded ? MAX_MESSAGES_EXPANDED : MAX_MESSAGES;
    const visible = this.messages.slice(-maxVisible);

    for (let i = 0; i < this.lineTexts.length; i++) {
      const txt = this.lineTexts[i];
      if (!txt) continue;
      if (i >= maxVisible) {
        txt.setText('');
        continue;
      }

      const entry = visible[i];
      if (!entry) {
        txt.setText('');
        continue;
      }

      txt.setText(entry.text);

      if (entry.priority === 'critical') {
        // Keep critical messages at full brightness regardless of age
        txt.setColor(entry.color);
        continue;
      }

      const ageFromBottom = (visible.length - 1) - i;
      // Spam messages dim twice as fast (index jumps by 2)
      const dimIndex = entry.priority === 'spam' ? ageFromBottom * 2 : ageFromBottom;
      const clamped = Math.min(dimIndex, COLORS_BY_AGE.length - 1);
      const rawColor: string | undefined = COLORS_BY_AGE[clamped];
      txt.setColor(rawColor ?? '#cccccc');
    }
  }
}

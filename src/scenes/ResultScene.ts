import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager';
import { AudioManager } from '../systems/AudioManager';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import type { NightStats } from '../config/types';

// Text style helpers -- keeps lines consistent
const FONT = '"Press Start 2P", monospace';

function makeText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  size: string,
  color: string,
  originX = 0,
  originY = 0,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, content, {
    fontFamily: FONT,
    fontSize: size,
    color,
  }).setOrigin(originX, originY);
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' });
  }

  create(data: NightStats): void {
    const state = SaveManager.load();
    this.cameras.main.setBackgroundColor('#0D0A08');

    // --- Background panel ---
    const panelW = 520;
    const panelH = 460;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = (GAME_HEIGHT - panelH) / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x141008, 0.97);
    bg.fillRect(panelX, panelY, panelW, panelH);
    bg.lineStyle(2, 0x5A3A1A, 1);
    bg.strokeRect(panelX, panelY, panelW, panelH);
    // Inner accent line
    bg.lineStyle(1, 0x3A2010, 0.5);
    bg.strokeRect(panelX + 4, panelY + 4, panelW - 8, panelH - 8);

    // --- Header ---
    const nightLabel = this.buildNightLabel(data, state);
    const headerY = panelY + 18;
    makeText(this, GAME_WIDTH / 2, headerY, nightLabel, '13px', '#D4620B', 0.5, 0);

    // Divider
    const divG = this.add.graphics();
    divG.lineStyle(1, 0x4A2A10, 0.8);
    divG.lineBetween(panelX + 16, headerY + 22, panelX + panelW - 16, headerY + 22);

    // --- Scrollable content zone ---
    // We build a tall container then mask + scroll it
    const contentX = panelX + 20;
    const contentTopY = headerY + 32;
    const contentH = panelH - 80; // leave room for footer button
    const contentW = panelW - 40;

    // Scrollable container
    const scrollContainer = this.add.container(contentX, contentTopY);

    // Build all report lines into the container
    const lineHeight = 18;
    let cursorY = 0;

    const addLine = (text: string, color: string, size = '9px', indent = 0): void => {
      const t = makeText(this, indent, cursorY, text, size, color, 0, 0);
      scrollContainer.add(t);
      cursorY += lineHeight;
    };

    const addSpacer = (px = 6): void => {
      cursorY += px;
    };

    // Kill summary
    addLine('KILLS', '#9A7A5A', '8px');
    addSpacer(4);

    const trapPct = data.kills > 0 ? Math.round((data.trapKills / data.kills) * 100) : 0;
    const weapPct = data.kills > 0 ? Math.round((data.weaponKills / data.kills) * 100) : 0;

    addLine(`  Total:       ${data.kills}`, '#E8DCC8');
    addLine(`  Traps:       ${data.trapKills}  (${trapPct}%)`, '#FFB060');
    addLine(`  Weapons:     ${data.weaponKills}  (${weapPct}%)`, '#88CCFF');

    if (data.bossKills > 0) {
      addLine(`  Boss kills:  ${data.bossKills}`, '#FF6666');
    }

    addSpacer();

    // Top traps
    if (data.topTraps.length > 0) {
      addLine('TOP TRAPS', '#9A7A5A', '8px');
      addSpacer(4);
      data.topTraps.forEach((entry, idx) => {
        const medal = idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : '#CD7F32';
        addLine(`  ${idx + 1}. ${entry.trapName}  --  ${entry.kills} kills`, medal);
      });
      addSpacer();
    }

    // Breakthroughs (zones where zombies passed all traps and hit base)
    addLine('BREAKTHROUGHS', '#9A7A5A', '8px');
    addSpacer(4);
    if (data.breakthroughs === 0) {
      addLine('  None -- perfect defense!', '#4CAF50');
    } else {
      addLine(`  ${data.breakthroughs} zone${data.breakthroughs !== 1 ? 's' : ''} breached`, '#FF6644');
    }
    addSpacer();

    // Structures lost
    addLine('STRUCTURES LOST', '#9A7A5A', '8px');
    addSpacer(4);
    if (data.structuresDestroyed.length === 0) {
      addLine('  None -- everything held!', '#4CAF50');
    } else {
      addLine(`  ${data.structuresDestroyed.length} structure${data.structuresDestroyed.length !== 1 ? 's' : ''} destroyed`, '#FF6644');
      // Show up to 3 destroyed structures
      const shown = data.structuresDestroyed.slice(0, 3);
      shown.forEach(s => {
        addLine(`  - ${s.structureId} at (${Math.round(s.x)}, ${Math.round(s.y)})`, '#AA7766', '8px', 8);
      });
      if (data.structuresDestroyed.length > 3) {
        addLine(`  + ${data.structuresDestroyed.length - 3} more...`, '#6A5A5A', '8px', 8);
      }
    }
    addSpacer();

    // Ammo used
    const ammoUsed = Math.max(0, data.ammoUsedStart - data.ammoUsedEnd);
    addLine('AMMO USED', '#9A7A5A', '8px');
    addSpacer(4);
    addLine(`  ${ammoUsed} / ${data.ammoUsedStart} rounds fired`, '#E8DCC8');
    addSpacer();

    // Base HP
    addLine('BASE HP', '#9A7A5A', '8px');
    addSpacer(4);
    const hpColor = data.baseHpEnd > data.baseHpMax * 0.66
      ? '#4CAF50'
      : data.baseHpEnd > data.baseHpMax * 0.33
        ? '#FFD700'
        : '#FF4444';
    addLine(`  ${data.baseHpEnd} / ${data.baseHpMax}`, hpColor);
    addSpacer();

    // Legacy Points earned this night
    const lpEarned = this.calcLpEarned(data, state.zone);
    if (lpEarned > 0) {
      addLine('LEGACY POINTS EARNED', '#9A7A5A', '8px');
      addSpacer(4);
      addLine(`  +${lpEarned} LP  (Total: ${state.meta.legacyPoints})`, '#FFD700');
      addSpacer();
    }

    // Endless mode: high score reminder
    if (data.endlessNight !== undefined && data.endlessNight > 0) {
      addLine('ENDLESS RECORD', '#9A7A5A', '8px');
      addSpacer(4);
      const hs = state.endlessHighScore;
      addLine(`  Night ${data.endlessNight} survived  (Best: ${hs})`, '#FFB060');
      addSpacer();
    }

    const totalContentH = cursorY;

    // Apply a mask so content clips inside the content area
    const maskShape = this.add.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(contentX, contentTopY, contentW, contentH);
    const mask = maskShape.createGeometryMask();
    scrollContainer.setMask(mask);

    // Scroll logic: drag or mouse wheel
    if (totalContentH > contentH) {
      let isDragging = false;
      let dragStartY = 0;
      let containerStartY = 0;

      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.x >= contentX && p.x <= contentX + contentW &&
            p.y >= contentTopY && p.y <= contentTopY + contentH) {
          isDragging = true;
          dragStartY = p.y;
          containerStartY = scrollContainer.y;
        }
      });
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!isDragging) return;
        const dy = p.y - dragStartY;
        const minY = contentTopY - (totalContentH - contentH);
        const newY = Phaser.Math.Clamp(containerStartY + dy, minY, contentTopY);
        scrollContainer.y = newY;
      });
      this.input.on('pointerup', () => { isDragging = false; });

      this.input.on('wheel', (_p: Phaser.Input.Pointer, _go: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
        const minY = contentTopY - (totalContentH - contentH);
        scrollContainer.y = Phaser.Math.Clamp(scrollContainer.y - dy * 0.5, minY, contentTopY);
      });

      // Scroll indicator
      const scrollHint = makeText(this, panelX + panelW - 18, contentTopY + contentH - 16, 'v', '8px', '#3A2A1A', 0.5, 0);
      this.tweens.add({ targets: scrollHint, y: '+=4', yoyo: true, repeat: -1, duration: 600 });
    }

    // --- Footer: CONTINUE button ---
    const footerY = panelY + panelH - 36;
    const divG2 = this.add.graphics();
    divG2.lineStyle(1, 0x4A2A10, 0.8);
    divG2.lineBetween(panelX + 16, footerY - 8, panelX + panelW - 16, footerY - 8);

    const advance = () => {
      AudioManager.play('ui_click');
      if (data.endlessNight !== undefined) {
        // In Endless mode we loop back to NightScene (DayScene is skipped)
        this.scene.start('NightScene');
      } else {
        this.scene.start('DayScene');
      }
    };

    const continueText = makeText(this, GAME_WIDTH / 2, footerY + 10, '', '11px', '#D4620B', 0.5, 0.5);

    // Delay so player can read before accidentally advancing
    this.time.delayedCall(1200, () => {
      const label = data.endlessNight !== undefined
        ? '[ NEXT ENDLESS NIGHT ]'
        : '[ CONTINUE TO DAY ]';
      continueText.setText(label);
      continueText.setInteractive({ useHandCursor: true });
      continueText.on('pointerover', () => continueText.setColor('#FFD700'));
      continueText.on('pointerout', () => continueText.setColor('#D4620B'));
      continueText.on('pointerdown', advance);

      this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          advance();
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private buildNightLabel(data: NightStats, state: ReturnType<typeof SaveManager.load>): string {
    if (data.endlessNight !== undefined && data.endlessNight > 0) {
      return `ENDLESS -- NIGHT ${data.endlessNight} SURVIVED`;
    }
    const nightNum = state.progress.currentWave; // already incremented before ResultScene
    const zoneName = state.zone.toUpperCase();
    return `${zoneName} -- NIGHT ${nightNum} SURVIVED`;
  }

  /** Calculate LP earned for this night (applied to state before ResultScene is called). */
  private calcLpEarned(data: NightStats, zone: string): number {
    let lp = 10; // base: survived a night
    if (data.bossKills > 0) lp += 25 * data.bossKills;
    if (zone === 'endless') lp += 90; // 100 total for endless night
    return lp;
  }
}

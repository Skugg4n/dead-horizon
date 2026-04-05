import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import type { ZoneId } from '../config/types';
import zonesData from '../data/zones.json';
import { AudioManager } from '../systems/AudioManager';

interface ZoneCompleteData {
  zone: ZoneId;
  kills: number;
}

// Zone names for display, loaded from zones.json
const ZONE_NAMES: Partial<Record<ZoneId, string>> = Object.fromEntries(
  (zonesData.zones as Array<{ id: string; name: string }>).map(z => [z.id, z.name])
) as Partial<Record<ZoneId, string>>;

// Which zone comes after which, based on zones.json unlock conditions
const NEXT_ZONE: Partial<Record<ZoneId, ZoneId>> = {
  forest: 'city',
  city: 'military',
};

export class ZoneCompleteScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ZoneCompleteScene' });
  }

  create(data: ZoneCompleteData): void {
    this.cameras.main.setBackgroundColor('#05080A');

    // Triumphant fanfare on zone completion
    AudioManager.play('zone_complete');

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const zoneName = ZONE_NAMES[data.zone] ?? data.zone.toUpperCase();
    const nextZone = NEXT_ZONE[data.zone] ?? null;
    const nextZoneName = nextZone ? (ZONE_NAMES[nextZone] ?? nextZone.toUpperCase()) : null;

    // Load save for stats display
    const state = SaveManager.load();
    const nightsSurvived = state.progress.currentWave ?? 5;
    const trapsBuilt = state.base.structures.length;

    // --- Particle background: scattered green sparks drifting upward ---
    // We simulate particles with small Graphics dots using tweens
    this.createBackgroundParticles();

    // Four dark edge bands for a vignette effect, focusing attention on center
    const vigBands = this.add.graphics();
    vigBands.fillStyle(0x000000, 0.55);
    vigBands.fillRect(0, 0, 120, GAME_HEIGHT); // left
    vigBands.fillRect(GAME_WIDTH - 120, 0, 120, GAME_HEIGHT); // right
    vigBands.fillRect(0, 0, GAME_WIDTH, 80); // top
    vigBands.fillRect(0, GAME_HEIGHT - 80, GAME_WIDTH, 80); // bottom

    // Horizontal accent lines for atmosphere -- fade in
    const lines = this.add.graphics().setAlpha(0);
    lines.lineStyle(1, 0x22FF44, 0.25);
    lines.lineBetween(0, cy - 110, GAME_WIDTH, cy - 110);
    lines.lineBetween(0, cy + 130, GAME_WIDTH, cy + 130);
    this.tweens.add({ targets: lines, alpha: 1, duration: 1200, ease: 'Power2' });

    // === "ZONE COMPLETE" header with glow/pulse ===
    // Glow layer behind main text (slightly larger, blurred via alpha pulse)
    const glowText = this.add.text(cx, cy - 94, 'ZONE COMPLETE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '24px',
      color: '#00FF66',
    }).setOrigin(0.5).setAlpha(0).setScale(0.5);

    const headerShadow = this.add.text(cx + 3, cy - 92, 'ZONE COMPLETE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '24px',
      color: '#062010',
    }).setOrigin(0.5).setAlpha(0).setScale(0.5);

    const header = this.add.text(cx, cy - 94, 'ZONE COMPLETE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '24px',
      color: '#4EFF80',
    }).setOrigin(0.5).setAlpha(0).setScale(0.5);

    // Scale-in with dramatic pop
    this.tweens.add({
      targets: [header, headerShadow, glowText],
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 450,
      ease: 'Back.easeOut',
    });

    // Pulsing glow effect on the behind-text layer
    this.time.delayedCall(500, () => {
      this.tweens.add({
        targets: glowText,
        alpha: { from: 0.4, to: 0.0 },
        scaleX: { from: 1.04, to: 1.0 },
        scaleY: { from: 1.04, to: 1.0 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    // === Zone name: fade-in beneath header ===
    const zoneLabel = this.add.text(cx, cy - 52, zoneName.toUpperCase(), {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#88D8AA',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: zoneLabel,
      alpha: 1,
      duration: 600,
      delay: 350,
      ease: 'Power2',
    });

    // Separator bar -- grows outward from center
    const sepBar = this.add.graphics().setAlpha(0);
    sepBar.fillStyle(0x2ECC71, 0.6);
    sepBar.fillRect(cx - 100, cy - 24, 200, 2);
    this.tweens.add({
      targets: sepBar,
      alpha: 1,
      duration: 400,
      delay: 550,
      ease: 'Power2',
    });

    // === Stats summary ===
    const statsContainer = this.add.container(0, 0).setAlpha(0);

    const statsLines: Array<{ label: string; value: string; color: string }> = [
      { label: 'Kills this zone:', value: `${data.kills}`, color: '#E87878' },
      { label: 'Nights survived:', value: `${nightsSurvived}`, color: '#78C8E8' },
      { label: 'Traps built:', value: `${trapsBuilt}`, color: '#C8E878' },
    ];

    statsLines.forEach((stat, i) => {
      const statY = cy - 6 + i * 20;
      const labelTxt = this.add.text(cx - 10, statY, stat.label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#7AAA8A',
      }).setOrigin(1, 0);

      const valueTxt = this.add.text(cx + 4, statY, stat.value, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: stat.color,
      }).setOrigin(0, 0);

      statsContainer.add([labelTxt, valueTxt]);
    });

    this.add.existing(statsContainer);

    this.tweens.add({
      targets: statsContainer,
      alpha: 1,
      duration: 500,
      delay: 700,
      ease: 'Power2',
    });

    // === Next zone unlock section ===
    const unlockY = cy + 58;

    if (nextZoneName) {
      // "NEXT ZONE UNLOCKED" with animated lock-open feel
      const unlockBg = this.add.graphics().setAlpha(0);
      unlockBg.fillStyle(0x1A1200, 0.8);
      unlockBg.strokeRoundedRect(cx - 150, unlockY - 8, 300, 40, 4);
      unlockBg.lineStyle(1, 0xC5A030, 0.7);
      unlockBg.strokeRoundedRect(cx - 150, unlockY - 8, 300, 40, 4);
      unlockBg.fillRoundedRect(cx - 150, unlockY - 8, 300, 40, 4);

      const unlockLabel = this.add.text(cx, unlockY + 2, `NEXT ZONE UNLOCKED:`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#A08020',
      }).setOrigin(0.5, 0).setAlpha(0);

      const unlockName = this.add.text(cx, unlockY + 18, nextZoneName.toUpperCase(), {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '11px',
        color: '#FFD700',
      }).setOrigin(0.5, 0).setAlpha(0).setScale(0.6);

      // Delayed dramatic reveal with scale bounce for the zone name
      this.tweens.add({
        targets: [unlockBg, unlockLabel],
        alpha: 1,
        duration: 400,
        delay: 1100,
        ease: 'Power2',
      });

      this.tweens.add({
        targets: unlockName,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 350,
        delay: 1300,
        ease: 'Back.easeOut',
      });

      // Subtle shimmer on the unlock name after it appears
      this.time.delayedCall(1700, () => {
        this.tweens.add({
          targets: unlockName,
          alpha: { from: 1.0, to: 0.55 },
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      });
    } else {
      // Military = last zone -- all zones cleared celebration
      const clearBg = this.add.graphics().setAlpha(0);
      clearBg.fillStyle(0x1A1200, 0.8);
      clearBg.lineStyle(1, 0xFFD700, 0.8);
      clearBg.strokeRoundedRect(cx - 130, unlockY - 8, 260, 36, 4);
      clearBg.fillRoundedRect(cx - 130, unlockY - 8, 260, 36, 4);

      const allClear = this.add.text(cx, unlockY + 10, 'ALL ZONES CLEARED', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '11px',
        color: '#FFD700',
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: [clearBg, allClear],
        alpha: 1,
        duration: 500,
        delay: 1100,
        ease: 'Power2',
      });

      this.tweens.add({
        targets: allClear,
        alpha: { from: 1.0, to: 0.4 },
        duration: 800,
        delay: 1700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Flavour line
    const flavour = this.add.text(cx, cy + 106, 'Pack your bags.', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#2A4A2A',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: flavour,
      alpha: 1,
      duration: 600,
      delay: 900,
      ease: 'Power2',
    });

    // === BACK TO MENU button (appears after 3s) ===
    const backBtn = this.add.text(cx, cy + 138, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#D4620B',
    }).setOrigin(0.5).setAlpha(0);

    let blinkTween: Phaser.Tweens.Tween | null = null;

    const advance = (): void => {
      this.scene.start('MenuScene');
    };

    this.time.delayedCall(3000, () => {
      backBtn.setText('[ BACK TO MENU ]');

      this.tweens.add({
        targets: backBtn,
        alpha: 1,
        duration: 300,
        ease: 'Power2',
      });

      backBtn.setInteractive({ useHandCursor: true });
      backBtn.on('pointerover', () => {
        backBtn.setColor('#FFD700');
        blinkTween?.stop();
        backBtn.setAlpha(1);
      });
      backBtn.on('pointerout', () => {
        backBtn.setColor('#D4620B');
        // Resume blink
        blinkTween = this.tweens.add({
          targets: backBtn,
          alpha: 0.35,
          duration: 600,
          yoyo: true,
          repeat: -1,
        });
      });
      backBtn.on('pointerdown', advance);

      // Start blink after fade-in completes
      this.time.delayedCall(350, () => {
        blinkTween = this.tweens.add({
          targets: backBtn,
          alpha: 0.35,
          duration: 600,
          yoyo: true,
          repeat: -1,
        });
      });

      const keyHandler = (_evt: KeyboardEvent): void => { advance(); };
      this.input.keyboard?.on('keydown', keyHandler);

      this.events.once('shutdown', () => {
        this.input.keyboard?.off('keydown', keyHandler);
        blinkTween?.stop();
      });
    });

    console.log(`[ZoneCompleteScene] zone=${data.zone} zoneProgress=`, state.zoneProgress);
  }

  /**
   * Create drifting particle dots in the background for atmosphere.
   * Each particle is a small Graphics dot that floats upward and fades out.
   */
  private createBackgroundParticles(): void {
    const PARTICLE_COUNT = 28;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Spread creation over time so they don't all start at once
      const delay = Math.random() * 3000;

      this.time.delayedCall(delay, () => {
        this.spawnParticle();
      });
    }

    // Continue spawning new particles periodically
    this.time.addEvent({
      delay: 400,
      repeat: -1,
      callback: () => {
        this.spawnParticle();
      },
    });
  }

  /** Spawn a single drifting background particle. */
  private spawnParticle(): void {
    const x = Math.random() * GAME_WIDTH;
    const y = GAME_HEIGHT + 10;
    const size = 1 + Math.random() * 2;

    // Alternate between green sparks and pale blue dust
    const colorIndex = Math.random();
    let color: number;
    if (colorIndex < 0.6) {
      color = 0x22AA44; // green spark
    } else if (colorIndex < 0.85) {
      color = 0x4488AA; // blue-grey dust
    } else {
      color = 0xFFD700; // rare gold glint
    }

    const dot = this.add.graphics().setDepth(1);
    dot.fillStyle(color, 0.7);
    dot.fillRect(0, 0, size, size);
    dot.setPosition(x, y);

    const duration = 4000 + Math.random() * 5000;
    const driftX = (Math.random() - 0.5) * 80;

    this.tweens.add({
      targets: dot,
      y: -20,
      x: x + driftX,
      alpha: { from: 0.7, to: 0 },
      duration,
      ease: 'Linear',
      onComplete: () => {
        dot.destroy();
      },
    });
  }
}

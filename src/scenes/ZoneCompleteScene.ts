import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import type { ZoneId } from '../config/types';
import zonesData from '../data/zones.json';

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
    this.cameras.main.setBackgroundColor('#0A0D0A');

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const zoneName = ZONE_NAMES[data.zone] ?? data.zone.toUpperCase();
    const nextZone = NEXT_ZONE[data.zone] ?? null;
    const nextZoneName = nextZone ? (ZONE_NAMES[nextZone] ?? nextZone.toUpperCase()) : null;

    // Horizontal accent lines for atmosphere
    const lines = this.add.graphics();
    lines.lineStyle(1, 0x2A4A2A, 0.6);
    lines.lineBetween(0, cy - 90, GAME_WIDTH, cy - 90);
    lines.lineBetween(0, cy + 110, GAME_WIDTH, cy + 110);

    // "ZONE COMPLETE" header
    const headerShadow = this.add.text(cx + 2, cy - 78, 'ZONE COMPLETE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '22px',
      color: '#0A2008',
    }).setOrigin(0.5);

    const header = this.add.text(cx, cy - 80, 'ZONE COMPLETE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '22px',
      color: '#4CAF50',
    }).setOrigin(0.5);

    // Scale-in animation
    header.setScale(0.5);
    headerShadow.setScale(0.5);
    this.tweens.add({
      targets: [header, headerShadow],
      scaleX: 1,
      scaleY: 1,
      duration: 400,
      ease: 'Back.easeOut',
    });

    // Zone name
    this.add.text(cx, cy - 38, zoneName.toUpperCase(), {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#A8D8A8',
    }).setOrigin(0.5);

    // Separator dot
    const dot = this.add.graphics();
    dot.fillStyle(0x4CAF50);
    dot.fillRect(cx - 40, cy - 14, 80, 2);

    // Stats
    this.add.text(cx, cy + 5, `Kills this zone: ${data.kills}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#7AAA7A',
    }).setOrigin(0.5);

    // Next zone hint or end message
    if (nextZoneName) {
      this.add.text(cx, cy + 34, `UNLOCKED: ${nextZoneName.toUpperCase()}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#C5A030',
      }).setOrigin(0.5);
    } else {
      // Military = last zone; all zones cleared
      this.add.text(cx, cy + 34, 'ALL ZONES CLEARED', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#FFD700',
      }).setOrigin(0.5);
    }

    // Flavour line
    this.add.text(cx, cy + 62, 'Pack your bags.', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#3A5A3A',
    }).setOrigin(0.5);

    // Continue prompt (appears after 3s to prevent accidental skip)
    const continueText = this.add.text(cx, cy + 92, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#D4620B',
    }).setOrigin(0.5);

    // Blinking animation starts when text is shown
    let blinkTween: Phaser.Tweens.Tween | null = null;

    const advance = (): void => {
      // Return to menu -- player chooses next zone there
      this.scene.start('MenuScene');
    };

    this.time.delayedCall(3000, () => {
      continueText.setText('[ BACK TO MENU ]');
      continueText.setInteractive({ useHandCursor: true });
      continueText.on('pointerover', () => continueText.setColor('#FFD700'));
      continueText.on('pointerout', () => continueText.setColor('#D4620B'));
      continueText.on('pointerdown', advance);

      blinkTween = this.tweens.add({
        targets: continueText,
        alpha: 0.3,
        duration: 600,
        yoyo: true,
        repeat: -1,
      });

      const keyHandler = (_evt: KeyboardEvent): void => { advance(); };
      this.input.keyboard?.on('keydown', keyHandler);
      // Remove keyboard handler if scene is shut down before player clicks
      this.events.once('shutdown', () => {
        this.input.keyboard?.off('keydown', keyHandler);
        blinkTween?.stop();
      });
    });

    // Load latest save to confirm progress was recorded
    const state = SaveManager.load();
    console.log(`[ZoneCompleteScene] zone=${data.zone} zoneProgress=`, state.zoneProgress);
  }
}

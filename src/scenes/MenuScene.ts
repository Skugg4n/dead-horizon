import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager';
import { AchievementManager } from '../systems/AchievementManager';
import { GAME_VERSION, GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { AudioManager } from '../systems/AudioManager';
import type { CharacterType, CharacterData, SkillType } from '../config/types';
import { SkillManager } from '../systems/SkillManager';
import charactersJson from '../data/characters.json';

const characters = charactersJson.characters as unknown as CharacterData[];

// Layout constants for left-aligned design
const LEFT_MARGIN = 48;
const TITLE_X = LEFT_MARGIN;
const BUTTON_X = LEFT_MARGIN;
const BUTTON_W = 260;

export class MenuScene extends Phaser.Scene {
  private selectedCharacter: CharacterType = 'soldier';
  private characterSelectContainer!: Phaser.GameObjects.Container;
  private mainMenuContainer!: Phaser.GameObjects.Container;
  private achievementContainer: Phaser.GameObjects.Container | null = null;
  private settingsContainer: Phaser.GameObjects.Container | null = null;
  private charSelectLeftHandler: (() => void) | null = null;
  private charSelectRightHandler: (() => void) | null = null;
  private charSelectEnterHandler: (() => void) | null = null;

  // Animated elements
  private campfireGlow: Phaser.GameObjects.Graphics | null = null;
  private campfireFlicker: Phaser.GameObjects.Graphics | null = null;
  private titleContainer: Phaser.GameObjects.Container | null = null;
  private emberParticles: Phaser.GameObjects.Graphics[] = [];

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0A0A12');
    this.selectedCharacter = 'soldier';

    this.createBackground();
    this.createMainMenu();
    this.createCharacterSelect();
    this.characterSelectContainer.setVisible(false);
    this.startAmbientAnimations();
  }

  // ---------------------------------------------------------------------------
  // Background: sky gradient, ruined buildings, ground, campfire
  // ---------------------------------------------------------------------------

  private createBackground(): void {
    const g = this.add.graphics();
    g.setDepth(0);

    // Dark sky -- horizontal bands to simulate gradient from cold blue-black to reddish orange horizon
    const skyColors = [0x0A0A12, 0x0C0A10, 0x100808, 0x180A08, 0x200D08];
    const bandH = Math.ceil(GAME_HEIGHT * 0.62 / skyColors.length);
    skyColors.forEach((color, i) => {
      g.fillStyle(color);
      g.fillRect(0, i * bandH, GAME_WIDTH, bandH + 2);
    });

    // Ground -- dark scorched earth in lower 40%
    const groundY = Math.floor(GAME_HEIGHT * 0.60);
    const groundColors = [0x1A1208, 0x141008, 0x0F0A04, 0x0A0702];
    const groundBandH = Math.ceil(GAME_HEIGHT * 0.4 / groundColors.length);
    groundColors.forEach((color, i) => {
      g.fillStyle(color);
      g.fillRect(0, groundY + i * groundBandH, GAME_WIDTH, groundBandH + 2);
    });

    // Ember-orange horizon glow band
    g.fillStyle(0x3A1005, 0.5);
    g.fillRect(0, groundY - 24, GAME_WIDTH, 48);

    // Ruined building silhouettes along horizon
    this.drawBuildings(groundY);

    // Dense dark forest silhouettes flanking the scene (pixel art feel)
    this.drawForest(groundY);

    // Zombie silhouettes lurking in the shadows on the right
    this.drawZombieSilhouettes(groundY);

    // Ground cracks/debris details
    const gDetail = this.add.graphics();
    gDetail.setDepth(1);
    gDetail.lineStyle(1, 0x2A1E0A, 0.3);
    for (let i = 0; i < 10; i++) {
      const lineY = groundY + 12 + i * 22 + (i % 3) * 6;
      const lineX = 60 + (i * 73) % (GAME_WIDTH - 160);
      gDetail.lineBetween(lineX, lineY, lineX + 18 + (i * 17) % 60, lineY + ((i % 3) - 1) * 3);
    }

    // Glowing windows in buildings
    this.drawGlowingWindows(groundY);

    // EVAC sign -- atmospheric detail top-right
    this.drawEvacSign();

    // Campfire -- positioned right-center so it glows behind the info panel area
    const fireX = GAME_WIDTH * 0.62;
    const fireY = groundY + 55;

    // Campfire base (ash/ember mound)
    const ashG = this.add.graphics();
    ashG.setDepth(3);
    ashG.fillStyle(0x2A1A08);
    ashG.fillEllipse(fireX, fireY + 8, 48, 16);
    // Logs
    ashG.fillStyle(0x3A2010);
    ashG.fillRect(fireX - 18, fireY + 2, 36, 6);
    ashG.fillStyle(0x2E1A0C);
    for (let t = 0; t < 22; t++) {
      const px = fireX - 11 + t;
      const py = fireY + (t < 11 ? t * 0.35 : (22 - t) * 0.35) + 2;
      ashG.fillRect(px, py, 2, 6);
    }

    // Animated campfire glow (outer halo)
    this.campfireGlow = this.add.graphics();
    this.campfireGlow.setDepth(2);
    this.drawCampfireGlow(this.campfireGlow, fireX, fireY, 1.0);

    // Animated campfire flicker (inner bright flame)
    this.campfireFlicker = this.add.graphics();
    this.campfireFlicker.setDepth(4);
    this.drawCampfireFlicker(this.campfireFlicker, fireX, fireY, 1.0);
  }

  /**
   * Dense forest silhouette flanking left and right edges.
   * Dark pine/dead tree shapes to give a gritty wilderness feel.
   */
  private drawForest(groundY: number): void {
    const fg = this.add.graphics();
    fg.setDepth(3);

    // Left forest cluster
    const leftTrees = [
      { x: 0,   w: 22, h: 120 },
      { x: 14,  w: 18, h: 95  },
      { x: 28,  w: 24, h: 140 },
      { x: 44,  w: 16, h: 80  },
      { x: 56,  w: 20, h: 110 },
      { x: 68,  w: 14, h: 70  },
    ];

    fg.fillStyle(0x0A0D08);
    for (const t of leftTrees) {
      // Tree trunk
      fg.fillRect(t.x + t.w / 2 - 2, groundY - t.h + t.h * 0.6, 4, t.h * 0.4);
      // Canopy (triangle approximation with stacked rects)
      for (let row = 0; row < 5; row++) {
        const rowW = t.w * (0.3 + row * 0.14);
        const rowX = t.x + t.w / 2 - rowW / 2;
        const rowY = groundY - t.h + row * (t.h * 0.14);
        fg.fillRect(rowX, rowY, rowW, t.h * 0.14 + 2);
      }
    }

    // Right forest cluster
    const rightTrees = [
      { x: GAME_WIDTH - 22,  w: 22, h: 130 },
      { x: GAME_WIDTH - 38,  w: 18, h: 100 },
      { x: GAME_WIDTH - 58,  w: 24, h: 145 },
      { x: GAME_WIDTH - 74,  w: 16, h: 85  },
      { x: GAME_WIDTH - 90,  w: 20, h: 115 },
      { x: GAME_WIDTH - 106, w: 14, h: 72  },
    ];

    fg.fillStyle(0x080C06);
    for (const t of rightTrees) {
      fg.fillRect(t.x + t.w / 2 - 2, groundY - t.h + t.h * 0.6, 4, t.h * 0.4);
      for (let row = 0; row < 5; row++) {
        const rowW = t.w * (0.3 + row * 0.14);
        const rowX = t.x + t.w / 2 - rowW / 2;
        const rowY = groundY - t.h + row * (t.h * 0.14);
        fg.fillRect(rowX, rowY, rowW, t.h * 0.14 + 2);
      }
    }
  }

  /**
   * Zombie silhouettes standing in shadow on the right side.
   * Minimal blocky pixel shapes to suggest lurking threats.
   */
  private drawZombieSilhouettes(groundY: number): void {
    const zg = this.add.graphics();
    zg.setDepth(2);

    // Each zombie: x position, distance factor (farther = darker and shorter)
    const zombies: Array<{ x: number; scale: number }> = [
      { x: GAME_WIDTH - 145, scale: 0.6 },
      { x: GAME_WIDTH - 175, scale: 0.5 },
      { x: GAME_WIDTH - 200, scale: 0.45 },
      { x: GAME_WIDTH - 115, scale: 0.55 },
    ];

    for (const z of zombies) {
      const h = Math.round(40 * z.scale);
      const w = Math.round(12 * z.scale);
      const baseY = groundY + 2;
      const alpha = 0.18 + z.scale * 0.12;

      // Body
      zg.fillStyle(0x0A0806, alpha);
      zg.fillRect(z.x - w / 2, baseY - h, w, h * 0.55);
      // Head
      const headS = Math.round(8 * z.scale);
      zg.fillRect(z.x - headS / 2, baseY - h - headS, headS, headS);
      // Raised arm (outstretched)
      zg.fillRect(z.x + w / 2, baseY - h * 0.75, Math.round(10 * z.scale), Math.round(4 * z.scale));
      // Legs (two stubs)
      zg.fillRect(z.x - w / 2, baseY - h * 0.45, Math.round(4 * z.scale), h * 0.45);
      zg.fillRect(z.x + Math.round(2 * z.scale), baseY - h * 0.45, Math.round(4 * z.scale), h * 0.45);
    }
  }

  /**
   * "EVAC 2.3 km" sign -- atmospheric post-apoc detail in top-right corner.
   */
  private drawEvacSign(): void {
    const sg = this.add.graphics();
    sg.setDepth(6);

    const sx = GAME_WIDTH - 130;
    const sy = 18;
    const sw = 120;
    const sh = 28;

    // Sign board
    sg.fillStyle(0x1A1008, 0.85);
    sg.fillRect(sx, sy, sw, sh);
    sg.lineStyle(1, 0x4A3A20, 0.7);
    sg.strokeRect(sx, sy, sw, sh);

    // Sign post (thin vertical line)
    sg.lineStyle(2, 0x2A2010, 0.6);
    sg.lineBetween(sx + sw / 2, sy + sh, sx + sw / 2, sy + sh + 30);

    // "EVAC" text
    const evacText = this.add.text(sx + 6, sy + 5, 'EVAC  2.3 km', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#5A7A3A',
    }).setOrigin(0, 0);
    evacText.setDepth(7);

    // Arrow indicator (right-pointing chevron)
    sg.lineStyle(2, 0x4A6A30, 0.8);
    sg.lineBetween(sx + sw - 14, sy + 10, sx + sw - 6, sy + 14);
    sg.lineBetween(sx + sw - 14, sy + 18, sx + sw - 6, sy + 14);
  }

  private drawBuildings(groundY: number): void {
    // Far layer -- darker, taller blobs behind everything
    const farG = this.add.graphics();
    farG.setDepth(1);
    farG.fillStyle(0x080808);
    const farBuildings = [
      { x: 0, w: 120, h: 180 },
      { x: 200, w: 160, h: 200 },
      { x: 430, w: 130, h: 220 },
      { x: 620, w: 180, h: 175 },
    ];
    for (const b of farBuildings) {
      farG.fillRect(b.x, groundY - b.h, b.w, b.h);
    }

    // Near layer -- more detailed collapsed buildings
    const g = this.add.graphics();
    g.setDepth(2);
    g.fillStyle(0x111111);
    const buildings = [
      { x: 0,   w: 58,  h: 78  },
      { x: 48,  w: 38,  h: 52  },
      { x: 78,  w: 82,  h: 108 },
      { x: 148, w: 28,  h: 38  },
      { x: 168, w: 58,  h: 88  },
      { x: 218, w: 18,  h: 28  },
      { x: 236, w: 90,  h: 135 },
      { x: 318, w: 48,  h: 68  },
      { x: 358, w: 28,  h: 48  },
      { x: 398, w: 68,  h: 98  },
      { x: 458, w: 38,  h: 58  },
      { x: 488, w: 82,  h: 118 },
      { x: 562, w: 32,  h: 42  },
      { x: 588, w: 58,  h: 82  },
      { x: 638, w: 88,  h: 128 },
      { x: 718, w: 38,  h: 68  },
      { x: 748, w: 52,  h: 52  },
    ];
    for (const b of buildings) {
      g.fillRect(b.x, groundY - b.h, b.w, b.h);
      // Jagged roofline -- small rubble protrusions
      g.fillStyle(0x0D0D0D);
      g.fillRect(b.x + b.w - 12, groundY - b.h - 8, 14, 10);
      g.fillRect(b.x + 2, groundY - b.h - 5, 9, 7);
      g.fillStyle(0x111111);
    }
  }

  private drawGlowingWindows(groundY: number): void {
    // Orange-lit windows scattered across buildings -- post-apoc fire glow
    const positions = [
      { x: 92,  y: groundY - 78,  size: 3 },
      { x: 108, y: groundY - 58,  size: 2 },
      { x: 182, y: groundY - 62,  size: 3 },
      { x: 258, y: groundY - 98,  size: 4 },
      { x: 272, y: groundY - 72,  size: 2 },
      { x: 412, y: groundY - 68,  size: 3 },
      { x: 498, y: groundY - 88,  size: 4 },
      { x: 508, y: groundY - 58,  size: 2 },
      { x: 658, y: groundY - 88,  size: 3 },
      { x: 672, y: groundY - 62,  size: 2 },
      { x: 758, y: groundY - 42,  size: 3 },
    ];

    const winG = this.add.graphics();
    winG.setDepth(2);
    for (const p of positions) {
      winG.fillStyle(0xD4620B, 0.12);
      winG.fillCircle(p.x, p.y, p.size * 3.5);
      winG.fillStyle(0xFF8C00, 0.65);
      winG.fillCircle(p.x, p.y, p.size);
    }
  }

  private drawCampfireGlow(g: Phaser.GameObjects.Graphics, x: number, y: number, intensity: number): void {
    g.clear();
    g.fillStyle(0xD4620B, 0.05 * intensity);
    g.fillCircle(x, y, 110);
    g.fillStyle(0xE8760B, 0.09 * intensity);
    g.fillCircle(x, y, 70);
    g.fillStyle(0xFF8C00, 0.14 * intensity);
    g.fillCircle(x, y, 42);
  }

  private drawCampfireFlicker(g: Phaser.GameObjects.Graphics, x: number, y: number, scale: number): void {
    g.clear();
    g.fillStyle(0xFFD700, 0.88);
    g.fillEllipse(x, y, 10 * scale, 18 * scale);
    g.fillStyle(0xFF6600, 0.82);
    g.fillEllipse(x, y + 4, 14 * scale, 13 * scale);
    g.fillStyle(0xFF3300, 0.68);
    g.fillEllipse(x, y + 7, 17 * scale, 11 * scale);
    g.fillStyle(0xFFFFCC, 0.55);
    g.fillEllipse(x, y + 2, 5 * scale, 8 * scale);
  }

  // ---------------------------------------------------------------------------
  // Ambient animations: campfire, embers, title breathing
  // ---------------------------------------------------------------------------

  private startAmbientAnimations(): void {
    const groundY = Math.floor(GAME_HEIGHT * 0.60);
    const fireX = GAME_WIDTH * 0.62;
    const fireY = groundY + 55;

    // Campfire glow pulse
    if (this.campfireGlow) {
      this.tweens.add({
        targets: this.campfireGlow,
        alpha: { from: 0.7, to: 1.0 },
        duration: 1300,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    }

    // Fast campfire flicker via timed redraw
    if (this.campfireFlicker) {
      const flickerLoop = (): void => {
        if (!this.campfireFlicker || !this.scene.isActive()) return;
        const scale = 0.82 + Math.random() * 0.36;
        this.drawCampfireFlicker(this.campfireFlicker, fireX, fireY, scale);
        this.time.delayedCall(70 + Math.random() * 130, flickerLoop);
      };
      this.time.delayedCall(80, flickerLoop);
    }

    // Title breathe (on the title container)
    if (this.titleContainer) {
      this.tweens.add({
        targets: this.titleContainer,
        alpha: { from: 0.88, to: 1.0 },
        duration: 2800,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    }

    // Ember particles floating up from fire
    this.spawnEmberParticle(fireX, fireY);
  }

  private spawnEmberParticle(fireX: number, fireY: number): void {
    const dot = this.add.graphics();
    dot.setDepth(5);
    const size = 1 + Math.floor(Math.random() * 2);
    const color = Math.random() > 0.5 ? 0xFF6600 : 0xFFD700;
    dot.fillStyle(color, 0.9);
    dot.fillCircle(0, 0, size);

    const startX = fireX + (Math.random() - 0.5) * 22;
    const startY = fireY - 5;
    dot.setPosition(startX, startY);
    this.emberParticles.push(dot);

    const targetX = startX + (Math.random() - 0.5) * 90;
    const targetY = startY - 110 - Math.random() * 90;
    const duration = 1400 + Math.random() * 2200;

    this.tweens.add({
      targets: dot,
      x: targetX,
      y: targetY,
      alpha: { from: 0.9, to: 0 },
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => {
        dot.destroy();
        const idx = this.emberParticles.indexOf(dot);
        if (idx >= 0) this.emberParticles.splice(idx, 1);
      },
    });

    // Schedule next
    this.time.delayedCall(280 + Math.random() * 420, () => {
      if (this.scene.isActive('MenuScene')) {
        this.spawnEmberParticle(fireX, fireY);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Main Menu -- left-aligned layout
  // ---------------------------------------------------------------------------

  private createMainMenu(): void {
    this.mainMenuContainer = this.add.container(0, 0);
    this.mainMenuContainer.setDepth(10);

    // --- TITLE BLOCK (left-aligned, large) ---
    this.titleContainer = this.add.container(TITLE_X, 30);
    this.titleContainer.setDepth(11);
    this.mainMenuContainer.add(this.titleContainer);

    // Shadow for "DEAD"
    const deadShadow = this.add.text(2, 2, 'DEAD', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '42px',
      color: '#1A0300',
    }).setOrigin(0, 0);
    this.titleContainer.add(deadShadow);

    // Main "DEAD"
    const deadText = this.add.text(0, 0, 'DEAD', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '42px',
      color: '#D4620B',
    }).setOrigin(0, 0);
    this.titleContainer.add(deadText);

    // Shadow for "HORIZON"
    const horizonShadow = this.add.text(2, 52, 'HORIZON', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '42px',
      color: '#1A0300',
    }).setOrigin(0, 0);
    this.titleContainer.add(horizonShadow);

    // Main "HORIZON"
    const horizonText = this.add.text(0, 50, 'HORIZON', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '42px',
      color: '#C5550A',
    }).setOrigin(0, 0);
    this.titleContainer.add(horizonText);

    // Tagline
    const tagline = this.add.text(2, 106, 'POST APOCALYPTIC TOP-DOWN SURVIVAL / BASE BUILDING - SHOOTER', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#5A4A3A',
      wordWrap: { width: 300 },
    }).setOrigin(0, 0);
    this.titleContainer.add(tagline);

    // Red accent words
    const accentLine = this.add.text(2, 132, 'Refugees. Repairs. Survive.', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#C5200A',
    }).setOrigin(0, 0);
    this.titleContainer.add(accentLine);

    // Grey die line
    const dieLine = this.add.text(2, 146, 'Die many times.', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#4A3A34',
    }).setOrigin(0, 0);
    this.titleContainer.add(dieLine);

    // Decorative separator line
    const sepG = this.add.graphics();
    sepG.lineStyle(1, 0x3A2010, 0.7);
    sepG.lineBetween(0, 166, 280, 166);
    this.titleContainer.add(sepG);

    // --- VERSION (bottom-left) ---
    const versionText = this.add.text(LEFT_MARGIN, GAME_HEIGHT - 14, `v${GAME_VERSION} -- EARLY ACCESS`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#2A2520',
    }).setOrigin(0, 0.5);
    this.mainMenuContainer.add(versionText);

    // --- INFO PANEL (right side, bottom) ---
    this.buildInfoPanel();

    // --- MENU BUTTONS (left side, middle) ---
    this.buildMenuButtons();
  }

  private buildInfoPanel(): void {
    // "WHAT TO EXPECT" feature list on bottom-right
    const panelX = GAME_WIDTH - 280;
    const panelY = GAME_HEIGHT - 190;
    const panelW = 268;

    const infoContainer = this.add.container(panelX, panelY);
    infoContainer.setDepth(10);
    this.mainMenuContainer.add(infoContainer);

    // Panel background
    const bg = this.add.graphics();
    bg.fillStyle(0x0D0A08, 0.7);
    bg.fillRect(0, 0, panelW, 175);
    bg.lineStyle(1, 0x2A1E14, 0.8);
    bg.strokeRect(0, 0, panelW, 175);
    infoContainer.add(bg);

    // Header
    const header = this.add.text(12, 10, 'WHAT TO EXPECT:', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#7A5A3A',
    }).setOrigin(0, 0);
    infoContainer.add(header);

    // Divider
    const div = this.add.graphics();
    div.lineStyle(1, 0x2A1E14, 0.6);
    div.lineBetween(12, 26, panelW - 12, 26);
    infoContainer.add(div);

    // Feature entries: [bold label] + [dim description]
    const features: Array<{ label: string; desc: string }> = [
      { label: 'BUILD and FORTIFY',    desc: 'Create shelter and defenses' },
      { label: 'SCAVENGE and REPAIR',  desc: 'Find parts, fix gear, keep going' },
      { label: 'ZOMBIE SWARMS',        desc: 'They come from all sides. Survive.' },
    ];

    features.forEach((f, i) => {
      const baseY = 36 + i * 44;

      // Bullet point
      const bullet = this.add.graphics();
      bullet.fillStyle(0xD4620B, 0.8);
      bullet.fillRect(12, baseY + 5, 4, 4);
      infoContainer.add(bullet);

      // Feature label (highlighted)
      const labelText = this.add.text(22, baseY, f.label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#C5A030',
        wordWrap: { width: panelW - 34 },
      }).setOrigin(0, 0);
      infoContainer.add(labelText);

      // Feature description (dim)
      const descText = this.add.text(22, baseY + 16, f.desc, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#5A4A3A',
        wordWrap: { width: panelW - 34 },
      }).setOrigin(0, 0);
      infoContainer.add(descText);
    });
  }

  private buildMenuButtons(): void {
    const hasSave = SaveManager.hasSave();

    // Save info displayed if save exists (small, under the title area)
    let continueSubtext = '';
    if (hasSave) {
      const state = SaveManager.load();
      continueSubtext = `Day ${(state.progress.totalRuns ?? 0) + 1} -- ${state.zone ?? 'forest'}`;
    }

    // Button Y starts after title block (~220px from top)
    let btnY = 230;
    const BTN_SPACING = 52;

    // Primary button: START GAME or CONTINUE
    if (hasSave) {
      this.createMenuButton(BUTTON_X, btnY, 'CONTINUE', true, continueSubtext, () => {
        AudioManager.play('ui_click');
        this.scene.start('DayScene');
      });
      btnY += BTN_SPACING + 4;

      this.createMenuButton(BUTTON_X, btnY, 'NEW GAME', false, '', () => {
        AudioManager.play('ui_click');
        SaveManager.clearSave();
        this.showCharacterSelect();
      });
      btnY += BTN_SPACING;
    } else {
      this.createMenuButton(BUTTON_X, btnY, 'START GAME', true, '', () => {
        AudioManager.play('ui_click');
        this.showCharacterSelect();
      });
      btnY += BTN_SPACING + 4;
    }

    // Settings
    this.createMenuButton(BUTTON_X, btnY, 'SETTINGS', false, '', () => {
      AudioManager.play('ui_click');
      this.toggleSettingsPanel();
    });
    btnY += BTN_SPACING;

    // Achievements
    this.createMenuButton(BUTTON_X, btnY, 'ACHIEVEMENTS', false, '', () => {
      AudioManager.play('ui_click');
      this.toggleAchievementPanel();
    });
  }

  /**
   * Creates a styled left-aligned button with Graphics background.
   * Primary buttons have an orange border and red-tinted fill.
   * Optional subtext renders below the main label in dim color.
   */
  private createMenuButton(
    x: number,
    y: number,
    label: string,
    primary: boolean,
    subtext: string,
    action: () => void,
  ): void {
    const btnH = subtext ? 42 : 34;
    const borderColor = primary ? 0xC5300A : 0x3A2820;
    const bgNormal   = primary ? 0x2A0A04 : 0x141010;
    const bgHover    = primary ? 0x3E1208 : 0x201818;
    const textColor  = primary ? '#D4620B' : '#7A6560';
    const textHover  = primary ? '#FFD700' : '#C5A030';
    const fontSize   = primary ? '12px' : '10px';

    const container = this.add.container(x, y);
    container.setDepth(12);
    this.mainMenuContainer.add(container);

    // Staggered fade-in based on Y position
    container.setAlpha(0);
    this.tweens.add({
      targets: container,
      alpha: 1,
      duration: 350,
      delay: 300 + (y - 230) * 0.8,
      ease: 'Quad.easeOut',
    });

    const bg = this.add.graphics();
    bg.fillStyle(bgNormal);
    bg.fillRect(0, 0, BUTTON_W, btnH);
    bg.lineStyle(primary ? 2 : 1, borderColor);
    bg.strokeRect(0, 0, BUTTON_W, btnH);
    container.add(bg);

    // Inner left accent bar for primary button
    if (primary) {
      const accentBar = this.add.graphics();
      accentBar.fillStyle(0xC5300A);
      accentBar.fillRect(0, 0, 4, btnH);
      container.add(accentBar);
    }

    const labelText = this.add.text(primary ? 12 : 10, btnH / 2 - (subtext ? 8 : 0), label, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize,
      color: textColor,
    }).setOrigin(0, 0.5);
    container.add(labelText);

    if (subtext) {
      const subText = this.add.text(primary ? 12 : 10, btnH / 2 + 10, subtext, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#4A3A34',
      }).setOrigin(0, 0.5);
      container.add(subText);
    }

    // Arrow indicator on the right edge for primary
    if (primary) {
      const arrow = this.add.text(BUTTON_W - 10, btnH / 2, '>', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#5A2A10',
      }).setOrigin(1, 0.5);
      container.add(arrow);
    }

    // Interactivity via the bg graphics shape
    bg.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, BUTTON_W, btnH),
      Phaser.Geom.Rectangle.Contains,
    );

    bg.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(bgHover);
      bg.fillRect(0, 0, BUTTON_W, btnH);
      bg.lineStyle(primary ? 2 : 1, primary ? 0xFF5020 : 0x5A3A30);
      bg.strokeRect(0, 0, BUTTON_W, btnH);
      labelText.setColor(textHover);
    });

    bg.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(bgNormal);
      bg.fillRect(0, 0, BUTTON_W, btnH);
      bg.lineStyle(primary ? 2 : 1, borderColor);
      bg.strokeRect(0, 0, BUTTON_W, btnH);
      labelText.setColor(textColor);
    });

    bg.on('pointerdown', action);
  }

  // ---------------------------------------------------------------------------
  // Settings panel (unchanged functionality)
  // ---------------------------------------------------------------------------

  private toggleSettingsPanel(): void {
    if (this.settingsContainer) {
      this.settingsContainer.destroy();
      this.settingsContainer = null;
      return;
    }

    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    const panelW = 300;
    const panelH = 220;

    this.settingsContainer = this.add.container(centerX - panelW / 2, centerY - panelH / 2);
    this.settingsContainer.setDepth(150);

    const bg = this.add.graphics();
    bg.fillStyle(0x1A1A2E, 0.95);
    bg.fillRoundedRect(0, 0, panelW, panelH, 8);
    bg.lineStyle(2, 0xD4620B);
    bg.strokeRoundedRect(0, 0, panelW, panelH, 8);
    this.settingsContainer.add(bg);

    const title = this.add.text(panelW / 2, 16, 'SETTINGS', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '12px',
      color: '#D4620B',
    }).setOrigin(0.5, 0);
    this.settingsContainer.add(title);

    const closeBtn = this.add.text(panelW - 14, 10, 'X', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '12px',
      color: '#F44336',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.toggleSettingsPanel());
    this.settingsContainer.add(closeBtn);

    // Toggle helper
    const createToggle = (label: string, y: number, isOn: () => boolean, toggle: () => void): void => {
      const text = this.add.text(20, y, label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#E8DCC8',
      });
      this.settingsContainer?.add(text);

      const stateText = this.add.text(panelW - 20, y, isOn() ? 'ON' : 'OFF', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: isOn() ? '#4CAF50' : '#F44336',
      }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

      stateText.on('pointerover', () => stateText.setColor('#FFD700'));
      stateText.on('pointerout', () => stateText.setColor(isOn() ? '#4CAF50' : '#F44336'));
      stateText.on('pointerdown', () => {
        toggle();
        stateText.setText(isOn() ? 'ON' : 'OFF');
        stateText.setColor(isOn() ? '#4CAF50' : '#F44336');
      });
      this.settingsContainer?.add(stateText);
    };

    createToggle('Sound Effects', 55,
      () => !AudioManager.isSfxMuted(),
      () => AudioManager.setSfxMuted(!AudioManager.isSfxMuted()),
    );

    createToggle('Ambient / Music', 85,
      () => !AudioManager.isAmbientMuted(),
      () => AudioManager.setAmbientMuted(!AudioManager.isAmbientMuted()),
    );

    createToggle('All Audio', 115,
      () => !AudioManager.isMuted(),
      () => AudioManager.setMuted(!AudioManager.isMuted()),
    );

    const div = this.add.graphics();
    div.lineStyle(1, 0x3A3A3A);
    div.lineBetween(20, 148, panelW - 20, 148);
    this.settingsContainer.add(div);

    const volText = this.add.text(panelW / 2, 165, `Volume: ${Math.round(AudioManager.getVolume() * 100)}%`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#6B6B6B',
    }).setOrigin(0.5);
    this.settingsContainer.add(volText);

    const volDown = this.add.text(panelW / 2 - 80, 190, '[ - ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#6B6B6B',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    volDown.on('pointerdown', () => {
      AudioManager.setVolume(AudioManager.getVolume() - 0.1);
      volText.setText(`Volume: ${Math.round(AudioManager.getVolume() * 100)}%`);
      AudioManager.play('ui_click');
    });
    this.settingsContainer.add(volDown);

    const volUp = this.add.text(panelW / 2 + 80, 190, '[ + ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#6B6B6B',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    volUp.on('pointerdown', () => {
      AudioManager.setVolume(AudioManager.getVolume() + 0.1);
      volText.setText(`Volume: ${Math.round(AudioManager.getVolume() * 100)}%`);
      AudioManager.play('ui_click');
    });
    this.settingsContainer.add(volUp);
  }

  // ---------------------------------------------------------------------------
  // Achievements panel (unchanged functionality)
  // ---------------------------------------------------------------------------

  private toggleAchievementPanel(): void {
    if (this.achievementContainer) {
      this.achievementContainer.destroy();
      this.achievementContainer = null;
      return;
    }

    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    const panelWidth = 350;
    const panelHeight = 400;

    this.achievementContainer = this.add.container(centerX - panelWidth / 2, centerY - panelHeight / 2);
    this.achievementContainer.setDepth(150);

    const bg = this.add.graphics();
    bg.fillStyle(0x1A1A2E, 0.95);
    bg.fillRect(0, 0, panelWidth, panelHeight);
    bg.lineStyle(1, 0xC5A030);
    bg.strokeRect(0, 0, panelWidth, panelHeight);
    this.achievementContainer.add(bg);

    const title = this.add.text(panelWidth / 2, 12, 'ACHIEVEMENTS', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '12px',
      color: '#C5A030',
    }).setOrigin(0.5, 0);
    this.achievementContainer.add(title);

    const closeBtn = this.add.text(panelWidth - 10, 8, 'X', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '12px',
      color: '#F44336',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.toggleAchievementPanel());
    this.achievementContainer.add(closeBtn);

    if (SaveManager.hasSave()) {
      const state = SaveManager.load();
      const mgr = new AchievementManager(this, state);
      const all = mgr.getAllWithStatus();
      let yPos = 38;

      for (const entry of all) {
        const icon = entry.unlocked ? '[*]' : '[ ]';
        const color = entry.unlocked ? '#4CAF50' : '#6B6B6B';

        const text = this.add.text(14, yPos, `${icon} ${entry.data.name}`, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '10px',
          color,
          wordWrap: { width: panelWidth - 28 },
        });
        this.achievementContainer.add(text);

        const desc = this.add.text(40, yPos + 14, entry.data.description, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '8px',
          color: '#888888',
          wordWrap: { width: panelWidth - 54 },
        });
        this.achievementContainer.add(desc);

        yPos += 34;
      }
    } else {
      const noSave = this.add.text(panelWidth / 2, 60, 'Start a game to track achievements', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#6B6B6B',
        wordWrap: { width: panelWidth - 28 },
        align: 'center',
      }).setOrigin(0.5, 0);
      this.achievementContainer.add(noSave);
    }
  }

  // ---------------------------------------------------------------------------
  // Character select (preserve existing buildCharacterView)
  // ---------------------------------------------------------------------------

  private selectedCharIndex: number = 2; // default to soldier

  private createCharacterSelect(): void {
    this.characterSelectContainer = this.add.container(0, 0);
    this.characterSelectContainer.setDepth(10);
    this.selectedCharIndex = characters.findIndex(c => c.id === this.selectedCharacter);
    if (this.selectedCharIndex < 0) this.selectedCharIndex = 0;
    this.buildCharacterView();
  }

  private buildCharacterView(): void {
    this.characterSelectContainer.removeAll(true);

    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;
    const char = characters[this.selectedCharIndex];
    if (!char) return;

    this.selectedCharacter = char.id;

    // Title
    const title = this.add.text(centerX, 30, 'CHOOSE YOUR SURVIVOR', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#E8DCC8',
    }).setOrigin(0.5);
    this.characterSelectContainer.add(title);

    // Page indicator (dots)
    const dotY = 58;
    for (let i = 0; i < characters.length; i++) {
      const dotChar = i === this.selectedCharIndex ? 'O' : '.';
      const dot = this.add.text(
        centerX + (i - (characters.length - 1) / 2) * 20,
        dotY, dotChar, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: i === this.selectedCharIndex ? '#C5A030' : '#3A3A3A',
      }).setOrigin(0.5);
      this.characterSelectContainer.add(dot);
    }

    // Central card
    const cardW = 400;
    const cardH = 380;
    const cardX = centerX - cardW / 2;
    const cardY = 78;

    const bg = this.add.graphics();
    bg.fillStyle(0x1E1E3A, 0.95);
    bg.fillRoundedRect(cardX, cardY, cardW, cardH, 8);
    bg.lineStyle(2, 0xC5A030);
    bg.strokeRoundedRect(cardX, cardY, cardW, cardH, 8);
    this.characterSelectContainer.add(bg);

    // Character name
    const name = this.add.text(centerX, cardY + 24, char.name, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#C5A030',
    }).setOrigin(0.5);
    this.characterSelectContainer.add(name);

    // Character portrait (use pixel art portrait if available, fallback to letter icon)
    const iconCenterY = cardY + 90;
    const portraitKey = `portrait_${char.id}`;
    if (this.textures.exists(portraitKey)) {
      const portrait = this.add.image(centerX, iconCenterY, portraitKey);
      portrait.setDisplaySize(64, 64);
      this.characterSelectContainer.add(portrait);
      // Gold border around portrait
      const borderGfx = this.add.graphics();
      borderGfx.lineStyle(2, 0xC5A030);
      borderGfx.strokeRect(centerX - 32, iconCenterY - 32, 64, 64);
      this.characterSelectContainer.add(borderGfx);
    } else {
      // Fallback: letter icon in circle
      const iconMap: Record<string, string> = {
        scavenger: 'S', engineer: 'E', soldier: 'W', medic: 'M',
      };
      const iconLetter = iconMap[char.id] ?? '?';
      const iconBg = this.add.graphics();
      iconBg.fillStyle(0x2A2A4E);
      iconBg.fillCircle(centerX, iconCenterY, 32);
      iconBg.lineStyle(2, 0xC5A030);
      iconBg.strokeCircle(centerX, iconCenterY, 32);
      this.characterSelectContainer.add(iconBg);
      const icon = this.add.text(centerX, iconCenterY, iconLetter, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '24px',
        color: '#E8DCC8',
      }).setOrigin(0.5);
      this.characterSelectContainer.add(icon);
    }

    // Description
    const desc = this.add.text(centerX, cardY + 145, char.description, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#9A9A9A',
      wordWrap: { width: cardW - 60 },
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5, 0);
    this.characterSelectContainer.add(desc);

    // Skill bonuses section
    const skillY = cardY + 230;
    const skillTitle = this.add.text(centerX, skillY, 'Starting Skills', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#888888',
    }).setOrigin(0.5);
    this.characterSelectContainer.add(skillTitle);

    const divider = this.add.graphics();
    divider.lineStyle(1, 0x3A3A3A);
    divider.lineBetween(centerX - 100, skillY + 16, centerX + 100, skillY + 16);
    this.characterSelectContainer.add(divider);

    const SKILL_NAMES: Record<string, string> = {
      combat_melee: 'Melee', combat_pistol: 'Pistol', combat_rifle: 'Rifle',
      combat_shotgun: 'Shotgun', looting: 'Looting', building: 'Building',
      speed_agility: 'Agility', leadership: 'Leadership',
      survival: 'Survival', stealth: 'Stealth',
    };

    let skillListY = skillY + 28;
    const entries = Object.entries(char.skillBonuses).filter(([, v]) => v > 0);
    if (entries.length === 0) {
      const none = this.add.text(centerX, skillListY, 'No starting bonuses', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#6B6B6B',
      }).setOrigin(0.5);
      this.characterSelectContainer.add(none);
    } else {
      for (const [skillId, level] of entries) {
        const readable = SKILL_NAMES[skillId] ?? skillId;
        const barX = centerX - 80;
        const label = this.add.text(barX, skillListY, readable, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '9px',
          color: '#E8DCC8',
        }).setOrigin(0, 0.5);
        this.characterSelectContainer.add(label);

        for (let i = 0; i < 5; i++) {
          const pip = this.add.graphics();
          const px = centerX + 40 + i * 14;
          if (i < level) {
            pip.fillStyle(0x4CAF50);
            pip.fillRect(px, skillListY - 4, 10, 8);
          } else {
            pip.fillStyle(0x2A2A2A);
            pip.fillRect(px, skillListY - 4, 10, 8);
          }
          this.characterSelectContainer.add(pip);
        }
        skillListY += 22;
      }
    }

    // Left arrow
    const leftArrow = this.add.text(cardX - 30, centerY + 10, '<', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '24px',
      color: '#6B6B6B',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    leftArrow.on('pointerover', () => leftArrow.setColor('#E8DCC8'));
    leftArrow.on('pointerout', () => leftArrow.setColor('#6B6B6B'));
    leftArrow.on('pointerdown', () => {
      AudioManager.play('ui_click');
      this.selectedCharIndex = (this.selectedCharIndex - 1 + characters.length) % characters.length;
      this.buildCharacterView();
    });
    this.characterSelectContainer.add(leftArrow);

    // Right arrow
    const rightArrow = this.add.text(cardX + cardW + 30, centerY + 10, '>', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '24px',
      color: '#6B6B6B',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    rightArrow.on('pointerover', () => rightArrow.setColor('#E8DCC8'));
    rightArrow.on('pointerout', () => rightArrow.setColor('#6B6B6B'));
    rightArrow.on('pointerdown', () => {
      AudioManager.play('ui_click');
      this.selectedCharIndex = (this.selectedCharIndex + 1) % characters.length;
      this.buildCharacterView();
    });
    this.characterSelectContainer.add(rightArrow);

    // Keyboard navigation -- remove only previously registered char-select handlers
    if (this.charSelectLeftHandler) this.input.keyboard?.off('keydown-LEFT', this.charSelectLeftHandler);
    if (this.charSelectRightHandler) this.input.keyboard?.off('keydown-RIGHT', this.charSelectRightHandler);
    if (this.charSelectEnterHandler) this.input.keyboard?.off('keydown-ENTER', this.charSelectEnterHandler);

    this.charSelectLeftHandler = () => {
      this.selectedCharIndex = (this.selectedCharIndex - 1 + characters.length) % characters.length;
      this.buildCharacterView();
    };
    this.charSelectRightHandler = () => {
      this.selectedCharIndex = (this.selectedCharIndex + 1) % characters.length;
      this.buildCharacterView();
    };
    this.charSelectEnterHandler = () => this.startWithCharacter();

    this.input.keyboard?.on('keydown-LEFT', this.charSelectLeftHandler);
    this.input.keyboard?.on('keydown-RIGHT', this.charSelectRightHandler);
    this.input.keyboard?.on('keydown-ENTER', this.charSelectEnterHandler);

    // Begin button
    const beginBtn = this.add.text(centerX, cardY + cardH + 28, '[ BEGIN ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#D4620B',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    beginBtn.on('pointerover', () => beginBtn.setColor('#FFD700'));
    beginBtn.on('pointerout', () => beginBtn.setColor('#D4620B'));
    beginBtn.on('pointerdown', () => { AudioManager.play('ui_click'); this.startWithCharacter(); });
    this.characterSelectContainer.add(beginBtn);

    // Back button
    const backBtn = this.add.text(centerX, cardY + cardH + 58, '[ BACK ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '11px',
      color: '#6B6B6B',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#E8DCC8'));
    backBtn.on('pointerout', () => backBtn.setColor('#6B6B6B'));
    backBtn.on('pointerdown', () => this.hideCharacterSelect());
    this.characterSelectContainer.add(backBtn);
  }

  private showCharacterSelect(): void {
    this.mainMenuContainer.setVisible(false);
    this.characterSelectContainer.setVisible(true);
  }

  private hideCharacterSelect(): void {
    this.characterSelectContainer.setVisible(false);
    this.mainMenuContainer.setVisible(true);
  }

  private startWithCharacter(): void {
    const state = SaveManager.createDefaultState();
    state.player.character = this.selectedCharacter;

    // Apply character skill bonuses as starting XP (convert levels to cumulative XP)
    const charData = characters.find(c => c.id === this.selectedCharacter);
    if (charData) {
      for (const [skillId, startLevel] of Object.entries(charData.skillBonuses)) {
        if (startLevel > 0) {
          const skillType = skillId as SkillType;
          const skillData = SkillManager.getSkillData(skillType);
          if (skillData) {
            let xp = 0;
            for (let i = 0; i < startLevel && i < skillData.xpPerLevel.length; i++) {
              xp += skillData.xpPerLevel[i] ?? 0;
            }
            state.player.skills[skillType] = xp;
          }
        }
      }
    }

    SaveManager.save(state);
    this.scene.start('DayScene');
  }
}

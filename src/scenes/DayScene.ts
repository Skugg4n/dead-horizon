import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager';
import { BuildingManager, type StructureData } from '../systems/BuildingManager';
import { WeaponManager } from '../systems/WeaponManager';
import { RefugeeManager } from '../systems/RefugeeManager';
import { ActionPointBar } from '../ui/ActionPointBar';
import { EquipmentPanel } from '../ui/EquipmentPanel';
import { RefugeePanel } from '../ui/RefugeePanel';
import { LootRunPanel } from '../ui/LootRunPanel';
import { LootManager } from '../systems/LootManager';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, GAME_WIDTH, GAME_HEIGHT, AP_PER_DAY, XP_PER_BUILD, DEFAULT_RESOURCE_CAP, STORAGE_CAP_BONUS } from '../config/constants';
import visualConfig from '../data/visual-config.json';
import { SkillManager } from '../systems/SkillManager';
import { SkillPanel } from '../ui/SkillPanel';
import { ZoneManager } from '../systems/ZoneManager';
import { CraftingManager } from '../systems/CraftingManager';
import { CraftingPanel } from '../ui/CraftingPanel';
import { AchievementManager } from '../systems/AchievementManager';
import type { GameState, StructureInstance, ResourceType, TerrainResult, PerkData } from '../config/types';
import perksJson from '../data/perks.json';
import weaponsJson from '../data/weapons.json';
import { REFUGEE_NAMES, REFUGEE_SKILL_BONUSES } from '../config/constants';
import { generateTerrain, drawZoneBackground } from '../systems/TerrainGenerator';
import { EventManager } from '../systems/EventManager';
import { EventDialog } from '../ui/EventDialog';
import type { EventChoice } from '../ui/EventDialog';
import structuresJson from '../data/structures.json';
import baseLevelsJson from '../data/base-levels.json';
import { getStructureSpriteKey, getBaseSpriteKey } from '../utils/spriteFactory';
import { CLOSE_ALL_PANELS } from '../ui/UIPanel';
import { BuildMenu } from '../ui/BuildMenu';
import { AudioManager } from '../systems/AudioManager';
import { GameLog } from '../ui/GameLog';

// Parse structure colors from JSON (string hex to number)
const STRUCTURE_COLORS: Record<string, number> = Object.fromEntries(
  Object.entries(visualConfig.structureColors).map(([k, v]) => [k, parseInt(v.replace('0x', ''), 16)])
);

export class DayScene extends Phaser.Scene {
  private gameState!: GameState;
  private buildingManager!: BuildingManager;
  private weaponManager!: WeaponManager;
  private equipmentPanel!: EquipmentPanel;
  private skillManager!: SkillManager;
  private skillPanel!: SkillPanel;
  private refugeeManager!: RefugeeManager;
  private refugeePanel!: RefugeePanel;
  private lootManager!: LootManager;
  private lootRunPanel!: LootRunPanel;
  private zoneManager!: ZoneManager;
  private craftingManager!: CraftingManager;
  private craftingPanel!: CraftingPanel;
  private achievementManager!: AchievementManager;
  private eventManager!: EventManager;
  private eventDialog!: EventDialog;
  private apBar!: ActionPointBar;
  private currentAP!: number;
  private mapContainer!: Phaser.GameObjects.Container;
  private structureSprites: Phaser.GameObjects.GameObject[] = [];

  // Placement mode state
  private placementMode: boolean = false;
  private placementStructureId: string | null = null;
  private placementRotation: 0 | 1 = 0; // 0 = horizontal (default), 1 = vertical
  private rotateButton: Phaser.GameObjects.Container | null = null;
  private scrapMode: boolean = false;
  private maxApForDay: number = AP_PER_DAY;
  private ghostGraphics: Phaser.GameObjects.Graphics | null = null;
  private placementJustStarted: boolean = false;

  // Tutorial state -- when true, random events are deferred until tutorial closes
  private tutorialShowing: boolean = false;

  // UI camera -- fixed at (0,0), never scrolls.
  // All UI elements are assigned here so their interactive zones
  // always match their visual positions regardless of main camera scroll.
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;

  // Day-cycle lighting overlay -- redrawn whenever AP changes
  private dayLightOverlay!: Phaser.GameObjects.Graphics;

  // Tracks last AP value for lighting change detection in update()
  private _lastLightingAP: number = -1;

  // "Night is approaching" warning text in HUD (shown at 1h left)
  private nightWarningText: Phaser.GameObjects.Text | null = null;

  // UI elements
  private gameLog!: GameLog;
  private buildMenu!: BuildMenu;
  private buildMenuVisible: boolean = false;
  private buildMenuOpening: boolean = false;
  private structurePopup: Phaser.GameObjects.Container | null = null;
  private infoText!: Phaser.GameObjects.Text;
  private resourceTexts: Map<ResourceType, Phaser.GameObjects.Text> = new Map();
  private baseUpgradeBtn!: Phaser.GameObjects.Container;
  private baseTentGraphics!: Phaser.GameObjects.Graphics;
  private baseSpriteImage: Phaser.GameObjects.Image | null = null;

  constructor() {
    super({ key: 'DayScene' });
  }

  create(): void {
    try {
    this.gameState = SaveManager.load();
    // Workhours per day: base is AP_PER_DAY + 1 per healthy refugee in camp.
    // More people = more labour gets done, up to a reasonable cap so late
    // runs don't trivially steamroll. Speed Run cuts the base to 8.
    const baseAp = this.gameState.activeChallenge === 'speed_run' ? 8 : AP_PER_DAY;
    const healthyRefugees = (this.gameState.refugees ?? []).filter(r => r.status === 'healthy').length;
    const refugeeBonus = Math.min(healthyRefugees, 8); // cap at +8
    this.maxApForDay = baseAp + refugeeBonus;
    this.currentAP = this.maxApForDay;

    // Apply legacy perks on the very first day of a fresh run (totalRuns == 0, wave == 1)
    if (this.gameState.progress.totalRuns === 0 && this.gameState.progress.currentWave === 1) {
      this.applyLegacyPerks();
    }

    // Load structure data and create BuildingManager
    interface StructuresFile { structures: StructureData[]; }
    const typedStructures = structuresJson as unknown as StructuresFile;
    const structureList = typedStructures.structures;
    this.buildingManager = new BuildingManager(this, this.gameState, structureList);

    this.placementMode = false;
    this.placementStructureId = null;
    this.structureSprites = [];

    // Fade in from black (night-to-day transition)
    // Match grass tile average color to eliminate visible gaps between tiles
    this.cameras.main.setBackgroundColor('#2A491F');
    this.cameras.main.fadeIn(800, 0, 0, 0);

    // Start day ambient sound -- use zone-specific variant when available
    if (this.gameState.zone === 'forest') {
      AudioManager.startAmbient('forest_day');
    } else if (this.gameState.zone === 'city') {
      AudioManager.startAmbient('city_day');
    } else if (this.gameState.zone === 'military') {
      AudioManager.startAmbient('military_day');
    } else {
      AudioManager.startAmbient('day');
    }

    this.createMap();
    this.setupCameras();
    this.renderPlacedStructures();

    // UI layer (created after cameras so addToUI works)
    this.createTopBar();
    this.createActionBar();
    this.createResourceBar();
    this.createBuildMenu();
    // Close build menu + exit scrap mode when any other panel opens
    this.events.on(CLOSE_ALL_PANELS, () => {
      if (this.buildMenuVisible && !this.buildMenuOpening) {
        this.buildMenuVisible = false;
        this.buildMenu.hide();
        this.cancelPlacement();
      }
      this.exitScrapMode();
    });
    this.createInfoText();

    // Game log -- scrolling message history in lower-left corner.
    // Must be registered on the UI camera (dual-camera setup in DayScene).
    this.gameLog = new GameLog(this);
    this.addToUI(this.gameLog.getContainer());

    // Weapon system
    this.weaponManager = new WeaponManager(this, this.gameState);

    // Equipment panel (Q) -- equip slots + repair + upgrade for all weapons
    this.equipmentPanel = new EquipmentPanel(
      this,
      this.weaponManager,
      this.gameState,
      () => this.currentAP,
      (cost: number) => {
        this.currentAP -= cost;
        this.apBar.update(this.currentAP);
      },
      () => this.updateResourceDisplay(),
    );
    this.addToUI(this.equipmentPanel.getContainer());
    this.addToUI(this.equipmentPanel.getPanel().getBackdrop());

    // Skill system
    this.skillManager = new SkillManager(this, this.gameState);
    this.skillPanel = new SkillPanel(this, this.skillManager);
    this.addToUI(this.skillPanel.getContainer());
    this.addToUI(this.skillPanel.getPanel().getBackdrop());

    // Refugee system (Camp Crew)
    this.refugeeManager = new RefugeeManager(this, this.gameState);
    // Backward compat: assign bonusType to refugees loaded from old saves
    this.refugeeManager.ensureBonusTypes();
    this.refugeePanel = new RefugeePanel(this, this.refugeeManager);
    this.addToUI(this.refugeePanel.getContainer());
    this.addToUI(this.refugeePanel.getPanel().getBackdrop());

    // Loot run system
    this.lootManager = new LootManager(this, this.gameState);
    this.lootRunPanel = new LootRunPanel(
      this,
      this.lootManager,
      this.gameState,
      () => this.currentAP,
      (cost: number) => {
        this.currentAP -= cost;
        this.apBar.update(this.currentAP);
      },
      () => this.updateResourceDisplay(),
    );
    this.addToUI(this.lootRunPanel.getContainer());
    this.addToUI(this.lootRunPanel.getPanel().getBackdrop());
    this.addToUI(this.lootRunPanel.getEncounterContainer());
    this.addToUI(this.lootRunPanel.getEncounterDialog().getBackdrop());

    // Zone system
    this.zoneManager = new ZoneManager(this, this.gameState);

    // Crafting system
    this.craftingManager = new CraftingManager(
      this,
      this.gameState,
      () => this.currentAP,
      (cost: number) => {
        this.currentAP -= cost;
        this.apBar.update(this.currentAP);
      },
    );
    this.craftingPanel = new CraftingPanel(this, this.craftingManager, () => this.updateResourceDisplay());
    this.addToUI(this.craftingPanel.getContainer());
    this.addToUI(this.craftingPanel.getPanel().getBackdrop());

    // Achievement system
    this.achievementManager = new AchievementManager(this, this.gameState);

    // Zone selector (kept top-right)
    this.createZoneSelector();

    // Listen for looting XP awards
    this.events.on('award-looting-xp', (xp: number) => {
      this.skillManager.addXP('looting', xp);
    });

    // Listen for rescued refugees from loot runs
    this.events.on('refugee-rescued', () => {
      const newRefugee = this.refugeeManager.addRefugee();
      if (newRefugee) {
        this.showInfo(`Rescued ${newRefugee.name} during loot run!`);
        this.gameLog.addMessage(`Rescued ${newRefugee.name}!`, '#88FF88');
      } else {
        // Fix 7: No room at camp -- tell player to build more shelters
        this.gameLog.addMessage('No room! Build more shelters.', '#F44336');
      }
    });

    // Track loot run completions for achievements
    this.events.on('loot-run-complete', () => {
      this.gameState.stats.lootRunsCompleted++;
    });

    // Log loot run results to GameLog when available
    this.events.on('loot-run-finished', (result: { loot: Partial<Record<string, number>>; foundBlueprintId: string | null; weaponDropId: string | null }) => {
      // Summarise gathered resources as "+N scrap +M food" etc.
      const gains = Object.entries(result.loot)
        .filter(([, v]) => (v ?? 0) > 0)
        .map(([k, v]) => `+${v} ${k}`)
        .join(' ');
      if (gains) {
        this.gameLog.addMessage(`Loot run: ${gains}`, '#88DDFF');
      } else {
        this.gameLog.addMessage('Loot run complete', '#88DDFF');
      }
      if (result.foundBlueprintId) {
        this.gameLog.addMessage('Blueprint found!', '#FFD700');
      }
      if (result.weaponDropId) {
        this.gameLog.addMessage('Weapon found!', '#FFD700');
      }
    });

    // Event system
    this.eventManager = new EventManager(this, this.gameState);
    this.eventDialog = new EventDialog(this);
    this.addToUI(this.eventDialog.getContainer());
    this.addToUI(this.eventDialog.getBackdrop());

    // Day-start processing: food consumption, healing, random arrival, leadership XP
    this.processDayStart();

    // DO NOT save here -- if load() returned defaults due to a merge error,
    // saving now would overwrite the real save with blank data.
    // Save only happens at END DAY (endDay method) or explicit user actions.

    this.setupInput();

    // Show day-phase tutorial on first ever game.
    // Tutorial sets tutorialShowing=true so random events are deferred until it closes.
    if (this.gameState.progress.totalRuns === 0 && this.gameState.progress.currentWave <= 1) {
      this.showDayTutorial();
    }

    // Roll for random event at day start -- deferred if tutorial is currently showing
    if (!this.tutorialShowing) {
      this.checkRandomEvent();
    }

    // Day-cycle lighting overlay: sits above world, below all UI panels (depth 90)
    // Drawn on the main camera (world-space) but uses setScrollFactor(0) so it covers the screen
    this.dayLightOverlay = this.add.graphics();
    this.dayLightOverlay.setDepth(90).setScrollFactor(0);
    this.updateDayLighting();

    // Post-apocalyptic color grade: permanent warm sepia tint overlay (alpha 0.03)
    // Gives the day phase a muted, desaturated post-apocalyptic feel
    const dayColorGrade = this.add.graphics();
    dayColorGrade.setDepth(89); // just below dayLightOverlay
    dayColorGrade.setScrollFactor(0);
    dayColorGrade.fillStyle(0x3A2800, 1); // dark amber/sepia tint
    dayColorGrade.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    dayColorGrade.setAlpha(0.03);

    // Dawn fade-in animation -- skip if tutorial is showing (first game)
    if (!this.tutorialShowing) {
      this.showDawnAnimation();
    }

    this.events.emit('day-started', this.gameState.progress.currentWave);

    // Clean up all event listeners on scene shutdown to prevent memory leaks
    this.events.once('shutdown', () => {
      this.events.off('award-looting-xp');
      this.events.off('refugee-rescued');
      this.events.off('loot-run-complete');
      this.events.off('loot-run-finished');
      this.events.off('update');

      this.tweens.killAll();
      this.input.keyboard?.removeAllListeners();
      this.input.off('pointerdown');
    });
    } catch (e) {
      console.error('DayScene create() failed:', e);
      // NEVER clear save -- preserve player progress even if scene fails
      this.scene.start('MenuScene');
    }
  }

  update(_time: number, delta: number): void {
    // Update ghost position during placement mode
    if (this.placementMode && this.ghostGraphics) {
      const pointer = this.input.activePointer;
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      // Snap to grid
      const snappedX = Math.floor(worldPoint.x / TILE_SIZE) * TILE_SIZE;
      const snappedY = Math.floor(worldPoint.y / TILE_SIZE) * TILE_SIZE;
      this.ghostGraphics.setPosition(snappedX, snappedY);
    }

    // Speed Run: accumulate day-phase time into the persistent timer
    if (this.gameState.activeChallenge === 'speed_run') {
      this.gameState.speedRunTimer += delta;
    }

    // Refresh day-lighting overlay when AP changes (AP only changes on player actions, not every frame)
    if (this.dayLightOverlay && this.currentAP !== this._lastLightingAP) {
      this.updateDayLighting();
      this._lastLightingAP = this.currentAP;
    }
  }

  /**
   * Dawn fade-in animation shown at the start of each day.
   * Creates a fullscreen dark overlay that fades to transparent over 2 seconds,
   * while "A new dawn rises." and "Day N" text fade in underneath.
   * All objects are registered on the UI camera (addToUI) so they sit above everything.
   */
  private showDawnAnimation(): void {
    const dayNumber = this.gameState.progress.currentWave;

    // Quick dawn flash -- depth 600 to be above ALL dialogs/events
    const overlay = this.add.graphics();
    overlay.fillStyle(0x0A0505, 0.85);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.setDepth(600).setScrollFactor(0);
    this.addToUI(overlay);

    const dayText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `Day ${dayNumber}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '18px',
      color: '#D4920B',
    }).setOrigin(0.5).setDepth(601).setScrollFactor(0);
    this.addToUI(dayText);

    // Fast fade: visible for 0.8s then gone in 0.5s
    this.tweens.add({
      targets: [overlay, dayText],
      alpha: 0,
      duration: 500,
      delay: 800,
      onComplete: () => {
        overlay.destroy();
        dayText.destroy();
      },
    });
  }

  /**
   * Redraws the day-cycle lighting overlay based on remaining AP (hours left in the day).
   * 12h = warm orange glow at dawn, 6h = clear midday, 0h = dark reddish dusk.
   * Called from update() whenever currentAP changes.
   */
  private updateDayLighting(): void {
    if (!this.dayLightOverlay) return;

    const hoursLeft = this.currentAP;

    let color: number;
    let alpha: number;

    if (hoursLeft >= 9) {
      // Morning: warm orange fading to clear as day progresses toward midday
      color = 0xFF8800;
      alpha = ((hoursLeft - 9) / 3) * 0.1; // 0.1 at 12h, 0 at 9h
    } else if (hoursLeft >= 3) {
      // Midday to afternoon: clear, no tint
      color = 0xFFDD00;
      alpha = 0;
    } else {
      // Evening: darkening red-orange as night approaches
      color = 0xFF4400;
      alpha = ((3 - hoursLeft) / 3) * 0.15; // 0 at 3h, 0.15 at 0h
    }

    this.dayLightOverlay.clear();
    if (alpha > 0) {
      this.dayLightOverlay.fillStyle(color, alpha);
      this.dayLightOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    // Show or hide the "Night is approaching" warning at 1h left
    this.updateNightWarning(hoursLeft);
  }

  /**
   * Shows a "Night is approaching..." warning text when 1 AP or fewer remain.
   * Creates the text on first call, hides it again if AP somehow goes back up (debug).
   */
  private updateNightWarning(hoursLeft: number): void {
    if (hoursLeft <= 1 && hoursLeft > 0) {
      if (!this.nightWarningText) {
        // Create warning text -- positioned in the top center area below the top bar
        this.nightWarningText = this.add.text(GAME_WIDTH / 2, 46, 'Night is approaching...', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '8px',
          color: '#FF4400',
          backgroundColor: '#1A0800',
          padding: { left: 6, right: 6, top: 3, bottom: 3 },
        }).setOrigin(0.5, 0).setDepth(110).setScrollFactor(0).setAlpha(0);
        this.addToUI(this.nightWarningText);

        // Fade in the warning
        this.tweens.add({ targets: this.nightWarningText, alpha: 1, duration: 600 });
      }
      // Pulse the warning text to draw attention
      if (!this.tweens.isTweening(this.nightWarningText)) {
        this.tweens.add({
          targets: this.nightWarningText,
          alpha: 0.4,
          duration: 600,
          yoyo: true,
          repeat: -1,
        });
      }
    } else if (this.nightWarningText && hoursLeft > 1) {
      // AP was increased (e.g., debug) -- hide warning
      this.nightWarningText.destroy();
      this.nightWarningText = null;
    }
  }

  private createMap(): void {
    const mapPixelWidth  = MAP_WIDTH  * TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT * TILE_SIZE;
    const centerX = mapPixelWidth  / 2;
    const centerY = mapPixelHeight / 2;

    this.mapContainer = this.add.container(0, 0);

    // Determine road row (horizontal path through map centre)
    const roadRow = Math.floor(MAP_HEIGHT / 2);

    // Draw zone-specific background (ground + road/streets + detail patches).
    // drawZoneBackground returns an array of Graphics objects that are added to mapContainer.
    // isDaytime=true uses brighter colour palette.
    const bgGraphics = drawZoneBackground(this, this.gameState.zone, mapPixelWidth, mapPixelHeight, centerX, centerY, roadRow, true);
    for (const g of bgGraphics) {
      this.mapContainer.add(g);
    }

    // Grid overlay removed -- caused visible square pattern over terrain tiles

    // IMPORTANT: setBounds MUST come before generateTerrain() because
    // TerrainGenerator reads scene.physics.world.bounds to know map dimensions.
    // Without this, DayScene uses default 800x600 while NightScene uses 1280x960,
    // causing completely different decoration positions.
    this.physics.world.setBounds(0, 0, mapPixelWidth, mapPixelHeight);

    // ------------------------------------------------------------------
    // TERRAIN FEATURES (trees, rocks, bushes etc.) -- visual only, no colliders
    // Uses the same seed as NightScene so obstacles match.
    // ------------------------------------------------------------------
    const seed = this.gameState.mapSeed;
    console.log(`[DayScene] terrain seed = ${seed}`);
    const basePos = { x: centerX, y: centerY };
    const terrainResult: TerrainResult = generateTerrain(this, this.gameState.zone, basePos, seed, true);
    this.mapContainer.add(terrainResult.decorContainer);

    // ------------------------------------------------------------------
    // BASE TENT (centre)
    // ------------------------------------------------------------------
    this.baseTentGraphics = this.add.graphics();
    this.drawBaseTent(this.baseTentGraphics, centerX, centerY);
    this.mapContainer.add(this.baseTentGraphics);

    // Base label removed -- player already knows where the base is.
  }

  private renderPlacedStructures(): void {
    // Clear old sprites
    this.structureSprites.forEach(s => s.destroy());
    this.structureSprites = [];

    for (const structure of this.gameState.base.structures) {
      this.drawStructure(structure);
    }
  }

  private drawStructure(structure: StructureInstance): void {
    const spriteKey = getStructureSpriteKey(this, structure.structureId);
    const data = this.buildingManager.getStructureData(structure.structureId);
    const tiles = data?.widthTiles ?? 1;
    const isVertical = structure.rotation === 1;
    // Footprint in pixels, respecting rotation
    const footW = isVertical ? TILE_SIZE : tiles * TILE_SIZE;
    const footH = isVertical ? tiles * TILE_SIZE : TILE_SIZE;

    if (spriteKey) {
      const img = this.add.image(
        structure.x + footW / 2,
        structure.y + footH / 2,
        spriteKey,
      );
      img.setDisplaySize(footW, footH);
      if (isVertical) img.setRotation(Math.PI / 2);
      this.addToWorld(img);
      this.structureSprites.push(img);
    } else {
      // Programmatic fallback with colored tile + short label
      const color = STRUCTURE_COLORS[structure.structureId] ?? 0x888888;
      const g = this.add.graphics();
      g.fillStyle(color);
      g.fillRect(structure.x, structure.y, footW, footH);
      g.lineStyle(1, 0xE8DCC8, 0.6);
      g.strokeRect(structure.x, structure.y, footW, footH);
      this.addToWorld(g);
      this.structureSprites.push(g);

      // Short name label so player can identify structures
      const shortName = (data?.name ?? structure.structureId).split(' ').map(s => s[0]).join('');
      const label = this.add.text(
        structure.x + footW / 2,
        structure.y + footH / 2,
        shortName,
        { fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: '#FFFFFF', stroke: '#000000', strokeThickness: 2 }
      ).setOrigin(0.5).setDepth(5);
      this.addToWorld(label);
      this.structureSprites.push(label);
    }

    // Level indicator
    if (structure.level > 1) {
      const lvlText = this.add.text(
        structure.x + TILE_SIZE / 2,
        structure.y + TILE_SIZE / 2,
        `${structure.level}`,
        { fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#FFFFFF' }
      ).setOrigin(0.5);
      lvlText.setDepth(5);
      this.addToWorld(lvlText);
      this.structureSprites.push(lvlText);
    }

    // Damage visualization: any structure below full HP gets a visible HP bar
    // above it and a crack overlay that scales with damage. Lets the player
    // see at-a-glance which walls need repair without having to click each one.
    const hpRatio = structure.hp / Math.max(1, structure.maxHp);
    if (hpRatio < 1 && structure.hp > 0) {
      const dmgGfx = this.add.graphics();
      dmgGfx.setDepth(6);

      // Crack overlay: more cracks at lower HP
      const crackCount = hpRatio < 0.33 ? 5 : hpRatio < 0.66 ? 3 : 1;
      dmgGfx.lineStyle(1, 0x1A0A04, 0.85);
      for (let i = 0; i < crackCount; i++) {
        const x1 = structure.x + 4 + (i * 7) % (TILE_SIZE - 8);
        const y1 = structure.y + 4;
        const x2 = x1 + ((i % 2 === 0) ? 6 : -4);
        const y2 = structure.y + TILE_SIZE - 4;
        dmgGfx.lineBetween(x1, y1, x2, y2);
      }

      // HP bar ON the structure tile (bottom edge, inside the tile footprint)
      const BAR_W = TILE_SIZE - 6;
      const BAR_H = 3;
      const BAR_X = structure.x + 3;
      const BAR_Y = structure.y + TILE_SIZE - BAR_H - 2;
      dmgGfx.fillStyle(0x000000, 0.7);
      dmgGfx.fillRect(BAR_X - 1, BAR_Y - 1, BAR_W + 2, BAR_H + 2);
      let fillColor = 0x4CAF50;
      if (hpRatio < 0.66) fillColor = 0xFFC107;
      if (hpRatio < 0.33) fillColor = 0xF44336;
      dmgGfx.fillStyle(fillColor, 1);
      dmgGfx.fillRect(BAR_X, BAR_Y, Math.floor(BAR_W * hpRatio), BAR_H);

      this.addToWorld(dmgGfx);
      this.structureSprites.push(dmgGfx);
    }
  }

  private setupCameras(): void {
    const mapPixelWidth = MAP_WIDTH * TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT * TILE_SIZE;

    // Main camera scrolls over the map
    this.cameras.main.setBounds(0, 0, mapPixelWidth, mapPixelHeight);
    this.cameras.main.centerOn(mapPixelWidth / 2, mapPixelHeight / 2);

    // Fixed UI camera at (0,0) -- never scrolls.
    // UI elements are ignored by the main camera and only rendered here,
    // so their interactive hit areas stay aligned with their screen positions.
    this.uiCamera = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.setName('ui');
    // Prevent uiCamera from rendering world objects already on the display list
    const existingObjects = [...this.children.list];
    this.uiCamera.ignore(existingObjects);

  }

  // Register game objects as UI-only: visible on uiCamera, hidden from main camera.
  private addToUI(...objects: Phaser.GameObjects.GameObject[]): void {
    for (const obj of objects) {
      this.cameras.main.ignore(obj);
    }
  }

  // Register game objects as world-only: hidden from uiCamera.
  private addToWorld(...objects: Phaser.GameObjects.GameObject[]): void {
    for (const obj of objects) {
      this.uiCamera.ignore(obj);
    }
  }

  // -- Top Bar (h=36): AP pips left, DAY centered, base info + upgrade right --
  private createTopBar(): void {
    const topBg = this.add.graphics();
    topBg.fillStyle(0x1A1A1A, 0.85);
    topBg.fillRect(0, 0, GAME_WIDTH, 36);
    topBg.setDepth(100).setScrollFactor(0);
    this.addToUI(topBg);

    // AP bar (left side) -- click on "AP X/Y" text to open debug menu (hidden shortcut)
    this.apBar = new ActionPointBar(this, this.currentAP, () => this.toggleDebugMenu(), this.maxApForDay);
    this.addToUI(this.apBar.getContainer());

    // DAY counter (centered) -- triple-click to open debug menu
    const dayText = this.add.text(GAME_WIDTH / 2, 18, `DAY ${this.gameState.progress.currentWave}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#E8DCC8',
    }).setOrigin(0.5).setDepth(100).setInteractive();
    let debugClickCount = 0;
    let debugClickTimer: ReturnType<typeof setTimeout> | null = null;
    dayText.on('pointerdown', () => {
      debugClickCount++;
      if (debugClickTimer) clearTimeout(debugClickTimer);
      if (debugClickCount >= 3) {
        debugClickCount = 0;
        this.toggleDebugMenu();
      } else {
        debugClickTimer = setTimeout(() => { debugClickCount = 0; }, 600);
      }
    });
    this.addToUI(dayText);

    // Challenge badge: shown when a challenge run is active
    if (this.gameState.activeChallenge) {
      const challengeLabels: Record<string, string> = {
        no_build: 'NO BUILD',
        pacifist: 'PACIFIST',
        speed_run: 'SPEED RUN',
      };
      const label = challengeLabels[this.gameState.activeChallenge] ?? 'CHALLENGE';
      const challengeBadge = this.add.text(GAME_WIDTH / 2, 30, label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#C5A030',
        backgroundColor: '#1A0800',
        padding: { left: 4, right: 4, top: 2, bottom: 2 },
      }).setOrigin(0.5, 0).setDepth(101);
      this.addToUI(challengeBadge);
    }

    // Base info + upgrade button (right side)
    this.createBaseUpgradeUI();
  }

  // -- Icon toolbar at bottom (y=GAME_HEIGHT-48, h=48) --
  private createActionBar(): void {
    const TOOLBAR_Y = GAME_HEIGHT - 48;
    const TOOLBAR_H = 48;

    // Dark background strip
    const barBg = this.add.graphics();
    barBg.fillStyle(0x1A1A1A, 0.70);
    barBg.fillRect(0, TOOLBAR_Y, GAME_WIDTH, TOOLBAR_H);
    barBg.setDepth(100).setScrollFactor(0);
    this.addToUI(barBg);

    // Button definitions: label, icon key, theme color, callback, shortcut key
    // Order: BUILD | EQUIP | CRAFT | LOOT | REFUGEES | END DAY
    // AMMO and WEAPONS removed (ammo auto-loads at night, EQUIP covers weapon management)
    // SKILLS removed from toolbar -- accessible via keyboard S shortcut
    interface ToolbarButton {
      label: string;
      iconKey: string;
      color: number;
      onClick: () => void;
      shortcut?: string;
    }

    const buttons: ToolbarButton[] = [
      { label: 'BUILD', iconKey: 'icon_build', color: 0x4CAF50, onClick: () => this.toggleBuildMenu(), shortcut: 'B' },
      { label: 'SCRAP', iconKey: 'icon_scrap', color: 0xC5620B, onClick: () => this.toggleScrapMode(), shortcut: 'X' },
      { label: 'EQUIP', iconKey: 'icon_weapons', color: 0xE07030, onClick: () => this.equipmentPanel.toggle(), shortcut: 'Q' },
      { label: 'CRAFT', iconKey: 'icon_craft', color: 0xD4A030, onClick: () => this.craftingPanel.toggle(), shortcut: 'C' },
      { label: 'LOOT', iconKey: 'icon_lootrun', color: 0xD4A030, onClick: () => this.lootRunPanel.toggle(), shortcut: 'L' },
      { label: 'REFUGEES', iconKey: 'icon_refugees', color: 0x8B6FC0, onClick: () => this.refugeePanel.toggle(), shortcut: 'R' },
      { label: 'END DAY', iconKey: 'icon_endday', color: 0xD4620B, onClick: () => this.showEndDayConfirmation(), shortcut: 'E' },
    ];

    // Calculate positions: 6 evenly spaced buttons, no gaps
    const BUTTON_SIZE = 36;
    const totalButtons = buttons.length; // 6
    const totalWidth = totalButtons * BUTTON_SIZE + (totalButtons - 1) * 16;
    const startX = Math.floor((GAME_WIDTH - totalWidth) / 2);

    // Shared tooltip text (reused, only one visible at a time)
    const tooltip = this.add.text(0, 0, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#E8DCC8',
      backgroundColor: '#1A1A1A',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5, 1).setDepth(120).setVisible(false);
    this.addToUI(tooltip);

    let curX = startX;
    for (const entry of buttons) {
      const shortcutHint = entry.shortcut ? ` [${entry.shortcut}]` : '';
      this.createIconButton(entry.iconKey, entry.label + shortcutHint, entry.color, curX, TOOLBAR_Y + 6, BUTTON_SIZE, entry.onClick, tooltip);

      // Fix 5: Small text label under each icon (6px, muted color)
      const btnLabel = this.add.text(curX + BUTTON_SIZE / 2, TOOLBAR_Y + 6 + BUTTON_SIZE + 2, entry.label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '5px',
        color: '#555555',
      }).setOrigin(0.5, 0).setDepth(100).setScrollFactor(0);
      this.addToUI(btnLabel);

      curX += BUTTON_SIZE + 16;
    }
  }

  /** Create a single icon toolbar button with hover tooltip and fallback to text label */
  private createIconButton(
    iconKey: string,
    label: string,
    themeColor: number,
    x: number,
    y: number,
    size: number,
    onClick: () => void,
    tooltip: Phaser.GameObjects.Text,
  ): void {
    const ICON_SIZE = 32;
    const container = this.add.container(x, y);
    container.setSize(size, size);
    container.setDepth(100);

    // Background square
    const bg = this.add.graphics();
    bg.fillStyle(0x1A1A1A, 0.70);
    bg.fillRoundedRect(0, 0, size, size, 2);
    bg.lineStyle(2, themeColor, 0.6);
    bg.strokeRoundedRect(0, 0, size, size, 2);
    container.add(bg);

    const hasIcon = this.textures.exists(iconKey) && this.textures.get(iconKey).key !== '__MISSING';

    if (hasIcon) {
      const icon = this.add.image(size / 2, size / 2, iconKey);
      icon.setDisplaySize(ICON_SIZE, ICON_SIZE);
      container.add(icon);
    } else {
      // Text fallback: abbreviation (first 3 chars) in theme color
      const abbr = label.substring(0, 3);
      const colorStr = '#' + themeColor.toString(16).padStart(6, '0');
      const fallbackText = this.add.text(size / 2, size / 2, abbr, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: colorStr,
      }).setOrigin(0.5);
      container.add(fallbackText);
    }

    // Hit zone for interaction
    const hitZone = this.add.zone(size / 2, size / 2, size, size);
    hitZone.setInteractive({ useHandCursor: true });
    container.add(hitZone);

    hitZone.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x333333, 0.80);
      bg.fillRoundedRect(0, 0, size, size, 2);
      bg.lineStyle(2, 0xFFD700, 0.8);
      bg.strokeRoundedRect(0, 0, size, size, 2);
      container.setScale(1.05);

      // Show tooltip above icon
      tooltip.setText(label);
      tooltip.setPosition(x + size / 2, y - 6);
      tooltip.setVisible(true);
    });

    hitZone.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x1A1A1A, 0.70);
      bg.fillRoundedRect(0, 0, size, size, 2);
      bg.lineStyle(2, themeColor, 0.6);
      bg.strokeRoundedRect(0, 0, size, size, 2);
      container.setScale(1.0);
      tooltip.setVisible(false);
    });

    hitZone.on('pointerdown', onClick);

    this.addToUI(container);
  }

  // -- Resource bar with icons (y=GAME_HEIGHT-72, h=24) --
  private createResourceBar(): void {
    const RES_BAR_Y = GAME_HEIGHT - 72;
    const RES_BAR_H = 24;

    const resBg = this.add.graphics();
    resBg.fillStyle(0x1A1A1A, 0.85);
    resBg.fillRect(0, RES_BAR_Y, GAME_WIDTH, RES_BAR_H);
    resBg.setDepth(100).setScrollFactor(0);
    this.addToUI(resBg);

    const RESOURCE_COLORS: Record<ResourceType, string> = {
      scrap: '#C5A030',
      food: '#4CAF50',
      ammo: '#4A90D9',
      parts: '#E8DCC8',
      meds: '#F44336',
    };
    const RESOURCE_ICONS: Record<ResourceType, string> = {
      scrap: 'icon_scrap',
      food: 'icon_food',
      ammo: 'icon_ammo',
      parts: 'icon_parts',
      meds: 'icon_meds',
    };
    const RESOURCE_ORDER: ResourceType[] = ['scrap', 'food', 'ammo', 'parts', 'meds'];
    const sectionWidth = GAME_WIDTH / RESOURCE_ORDER.length;
    const cap = this.getResourceCap();
    const res = this.gameState.inventory.resources;

    // Tooltip texts for each resource type (shown on hover)
    const RESOURCE_TOOLTIPS: Record<ResourceType, string> = {
      scrap: 'SCRAP: Build structures and barricades',
      food: 'FOOD: Refugees eat 1 per day each',
      ammo: 'AMMO: Used when shooting (click/space)',
      parts: 'PARTS: Upgrade and repair weapons',
      meds: 'MEDS: Heal injured refugees (REST job)',
    };

    // Shared tooltip label (only one shown at a time)
    const resTooltip = this.add.text(0, RES_BAR_Y - 6, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#E8DCC8',
      backgroundColor: '#111111',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5, 1).setDepth(120).setVisible(false);
    this.addToUI(resTooltip);

    // Separators
    const sep = this.add.graphics();
    sep.lineStyle(1, 0x333333, 1);
    for (let i = 1; i < RESOURCE_ORDER.length; i++) {
      const sx = sectionWidth * i;
      sep.lineBetween(sx, RES_BAR_Y, sx, RES_BAR_Y + RES_BAR_H);
    }
    sep.setDepth(100).setScrollFactor(0);
    this.addToUI(sep);

    for (let i = 0; i < RESOURCE_ORDER.length; i++) {
      const type = RESOURCE_ORDER[i] as ResourceType;
      const color = RESOURCE_COLORS[type];
      const iconKey = RESOURCE_ICONS[type];
      const value = res[type];
      const centerX = sectionWidth * i + sectionWidth / 2;
      const centerY = RES_BAR_Y + RES_BAR_H / 2;
      const tooltipText = RESOURCE_TOOLTIPS[type];

      // Invisible hover zone for the whole section
      const hoverZone = this.add.zone(
        sectionWidth * i,
        RES_BAR_Y,
        sectionWidth,
        RES_BAR_H,
      ).setOrigin(0, 0).setDepth(101).setInteractive();
      hoverZone.on('pointerover', () => {
        resTooltip.setText(tooltipText);
        resTooltip.setPosition(centerX, RES_BAR_Y - 2);
        resTooltip.setVisible(true);
      });
      hoverZone.on('pointerout', () => {
        resTooltip.setVisible(false);
      });
      this.addToUI(hoverZone);

      // Try to show 16x16 icon left of number
      const hasIcon = this.textures.exists(iconKey) && this.textures.get(iconKey).key !== '__MISSING';
      if (hasIcon) {
        const icon = this.add.image(centerX - 28, centerY, iconKey);
        icon.setDisplaySize(16, 16);
        icon.setDepth(100);
        this.addToUI(icon);
      }

      const textX = hasIcon ? centerX - 8 : centerX;
      const text = this.add.text(
        textX,
        centerY,
        `${value}/${cap}`,
        {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '9px',
          color: color,
        },
      ).setOrigin(hasIcon ? 0 : 0.5, 0.5).setDepth(100);
      this.addToUI(text);
      this.resourceTexts.set(type, text);
    }
  }

  private updateResourceDisplay(): void {
    this.enforceResourceCaps();
    const res = this.gameState.inventory.resources;
    const cap = this.getResourceCap();
    const RESOURCE_ORDER: ResourceType[] = ['scrap', 'food', 'ammo', 'parts', 'meds'];
    for (const type of RESOURCE_ORDER) {
      const text = this.resourceTexts.get(type);
      if (!text || !text.active) continue;
      text.setText(`${res[type]}/${cap}`);
    }
  }

  private createZoneSelector(): void {
    const zones = this.zoneManager.getAllZones();
    const current = this.zoneManager.getCurrentZone();

    // Bug 8: ZONE label placed at y=22 (below base name at y=6, no UPGRADE button overlap).
    // Zone list starts at y=36 so items don't overlap with the top bar area.
    const ZONE_LABEL_Y = 22;
    const ZONE_LIST_START_Y = 36;

    const label = this.add.text(GAME_WIDTH - 16, ZONE_LABEL_Y, 'ZONE:', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#6B6B6B',
    }).setOrigin(1, 0).setDepth(100);
    this.addToUI(label);

    let yPos = ZONE_LIST_START_Y;

    for (const zone of zones) {
      const unlocked = this.zoneManager.isUnlocked(zone.id);
      const isCurrent = zone.id === current.id;
      const color = isCurrent ? '#C5A030' : (unlocked ? '#E8DCC8' : '#4A4A4A');
      const prefix = isCurrent ? '> ' : '  ';

      const text = this.add.text(GAME_WIDTH - 16, yPos, `${prefix}${zone.name}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: color,
      }).setOrigin(1, 0).setDepth(100);

      if (unlocked && !isCurrent) {
        text.setInteractive({ useHandCursor: true });
        text.on('pointerover', () => text.setColor('#FFD700'));
        text.on('pointerout', () => text.setColor('#E8DCC8'));
        text.on('pointerdown', () => {
          this.zoneManager.setZone(zone.id);
          SaveManager.save(this.gameState);
          this.showInfo(`Zone changed to ${zone.name}`);
          this.scene.restart();
        });
      }

      this.addToUI(text);
      yPos += 14;
    }
  }

  private createBuildMenu(): void {
    this.buildMenu = new BuildMenu(
      this,
      this.buildingManager,
      () => this.currentAP,
      () => this.maxApForDay,
      () => this.gameState.inventory.resources,
      () => (this.getBaseLevelData().unlockedStructures as string[]),
      () => this.gameState.unlockedBlueprints,
      (structureId: string) => this.startPlacement(structureId),
    );
    // When build menu is closed (via [X] or backdrop), cancel placement
    this.buildMenu.setOnClose(() => {
      this.buildMenuVisible = false;
      this.cancelPlacement();
    });
    // Register containers with the UI camera so click zones always align
    this.addToUI(this.buildMenu.getContainer());
    this.addToUI(this.buildMenu.getBackdrop());
  }

  /** Full rebuild -- needed when base level changes (new structures unlocked). */
  private rebuildBuildMenu(): void {
    this.buildMenu.destroy();
    this.createBuildMenu();
    if (this.buildMenuVisible) {
      this.buildMenuVisible = false; // reset so show() works
      this.buildMenu.show();
      this.buildMenuVisible = true;
    }
  }

  private createInfoText(): void {
    this.infoText = this.add.text(GAME_WIDTH / 2, 42, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '12px',
      color: '#C5A030',
    }).setOrigin(0.5).setDepth(100);
    this.addToUI(this.infoText);
  }

  private showInfo(msg: string): void {
    this.infoText.setText(msg);
    this.infoText.setAlpha(1);
    this.tweens.killTweensOf(this.infoText);
    this.tweens.add({
      targets: this.infoText,
      alpha: 0,
      delay: 3000,
      duration: 1000,
      ease: 'Power2',
    });
  }

  private toggleBuildMenu(): void {
    // No Build challenge: building is completely disabled
    if (this.gameState.activeChallenge === 'no_build') {
      this.showInfo('Building disabled! (No Build challenge)');
      return;
    }
    this.exitScrapMode();
    this.buildMenuVisible = !this.buildMenuVisible;
    if (this.buildMenuVisible) {
      // Close other panels before opening build menu (guard against re-entry)
      this.buildMenuOpening = true;
      this.events.emit(CLOSE_ALL_PANELS);
      this.buildMenuOpening = false;
      this.buildMenu.show();
    } else {
      this.buildMenu.hide();
      this.cancelPlacement();
    }
  }

  private startPlacement(structureId: string): void {
    this.placementMode = true;
    this.placementStructureId = structureId;
    this.placementRotation = 0;
    // Prevent the same click that selected the menu item from placing the structure.
    // Reset on next tick so only the originating pointer event is skipped, not the
    // first real map click.
    this.placementJustStarted = true;
    this.time.delayedCall(0, () => {
      this.placementJustStarted = false;
    });

    // Create ghost preview (world-space element, only on main camera).
    // For multi-tile structures (widthTiles > 1 or zoneRadius > TILE_SIZE/2)
    // we draw a ghost that covers the actual footprint so the player can see
    this.redrawGhost();

    // Show a floating ROTATE button for multi-tile structures so the player
    // has a reliable way to rotate without depending on the R key.
    const data = this.buildingManager.getStructureData(structureId);
    if ((data?.widthTiles ?? 1) > 1) {
      this.showRotateButton();
    } else {
      this.hideRotateButton();
    }

    // Keep build menu visible so player can switch structures or close to exit
    const rotHint = (data?.widthTiles ?? 1) > 1 ? ' Click ROTATE to turn.' : '';
    this.showInfo(`Click to place ${data?.name ?? structureId}.${rotHint} ESC/right-click to cancel.`);
  }

  /** Show a floating [ROTATE] button near the top of the screen during placement. */
  private showRotateButton(): void {
    if (this.rotateButton) {
      this.rotateButton.setVisible(true);
      return;
    }
    const BTN_W = 88;
    const BTN_H = 24;
    const x = Math.floor(GAME_WIDTH / 2 - BTN_W / 2);
    const y = 64;

    const container = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x1A1A1A, 0.92);
    bg.fillRoundedRect(0, 0, BTN_W, BTN_H, 4);
    bg.lineStyle(2, 0xC5A030, 0.9);
    bg.strokeRoundedRect(0, 0, BTN_W, BTN_H, 4);
    container.add(bg);

    const label = this.add.text(BTN_W / 2, BTN_H / 2, 'ROTATE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#FFD700',
    }).setOrigin(0.5, 0.5);
    container.add(label);

    // Interactive hit zone covering the whole button
    const hit = this.add.rectangle(0, 0, BTN_W, BTN_H, 0xffffff, 0.001).setOrigin(0, 0);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => label.setColor('#FFFFFF'));
    hit.on('pointerout', () => label.setColor('#FFD700'));
    hit.on('pointerdown', (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.rotatePlacement();
    });
    container.add(hit);

    container.setDepth(300);
    this.addToUI(container);
    this.rotateButton = container;
  }

  private hideRotateButton(): void {
    if (this.rotateButton) {
      this.rotateButton.destroy();
      this.rotateButton = null;
    }
  }

  /**
   * Compute ghost footprint dimensions in PIXEL space, applying the current
   * placementRotation for multi-tile structures. widthTiles is stored as the
   * horizontal length in structures.json; rotation=1 swaps width and height.
   */
  private getGhostDimensions(structureId: string): { w: number; h: number } {
    const structData = this.buildingManager.getStructureData(structureId);
    const tiles = structData?.widthTiles ?? 1;
    if (tiles <= 1) return { w: TILE_SIZE, h: TILE_SIZE };
    if (this.placementRotation === 1) {
      return { w: TILE_SIZE, h: tiles * TILE_SIZE };
    }
    return { w: tiles * TILE_SIZE, h: TILE_SIZE };
  }

  private redrawGhost(): void {
    if (!this.placementStructureId) return;
    if (this.ghostGraphics) {
      this.ghostGraphics.destroy();
      this.ghostGraphics = null;
    }
    const color = STRUCTURE_COLORS[this.placementStructureId] ?? 0x888888;
    const { w: ghostW, h: ghostH } = this.getGhostDimensions(this.placementStructureId);

    this.ghostGraphics = this.add.graphics();
    this.ghostGraphics.fillStyle(color, 0.5);
    this.ghostGraphics.fillRect(0, 0, ghostW, ghostH);
    this.ghostGraphics.lineStyle(2, 0xFFD700, 0.9);
    this.ghostGraphics.strokeRect(0, 0, ghostW, ghostH);
    // Draw tile grid inside the footprint so the player sees how many tiles it takes
    this.ghostGraphics.lineStyle(1, 0xFFD700, 0.5);
    for (let x = TILE_SIZE; x < ghostW; x += TILE_SIZE) {
      this.ghostGraphics.lineBetween(x, 0, x, ghostH);
    }
    for (let y = TILE_SIZE; y < ghostH; y += TILE_SIZE) {
      this.ghostGraphics.lineBetween(0, y, ghostW, y);
    }
    this.ghostGraphics.setDepth(50);
    this.addToWorld(this.ghostGraphics);
  }

  /** Rotate the current placement ghost 90 degrees. Called by the R key. */
  private rotatePlacement(): void {
    console.log(`[DayScene] rotatePlacement called. placementMode=${this.placementMode} id=${this.placementStructureId}`);
    if (!this.placementMode || !this.placementStructureId) return;
    const data = this.buildingManager.getStructureData(this.placementStructureId);
    console.log(`[DayScene] widthTiles=${data?.widthTiles}`);
    if (!data?.widthTiles || data.widthTiles <= 1) {
      this.showInfo('This structure is one tile -- nothing to rotate');
      return;
    }
    this.placementRotation = this.placementRotation === 0 ? 1 : 0;
    this.redrawGhost();
    this.showInfo(`Rotated to ${this.placementRotation === 0 ? 'horizontal' : 'vertical'}`);
  }

  private cancelPlacement(): void {
    this.placementMode = false;
    this.placementStructureId = null;
    if (this.ghostGraphics) {
      this.ghostGraphics.destroy();
      this.ghostGraphics = null;
    }
    this.hideRotateButton();
  }

  /**
   * Toggle "scrap mode". When active, left-clicking any placed structure
   * sells it (75% refund) without showing a popup. Lets the player bulldoze
   * many structures quickly. Exits on right-click, ESC, toggling again, or
   * any other major action (opening build menu, equipment panel, etc).
   */
  private toggleScrapMode(): void {
    // Leaving any placement mode first
    if (this.placementMode) this.cancelPlacement();
    this.closeStructurePopup();

    this.scrapMode = !this.scrapMode;
    if (this.scrapMode) {
      this.showInfo('SCRAP MODE -- click structures to scrap. ESC/right-click to exit.');
    } else {
      this.showInfo('Scrap mode off');
    }
  }

  /** Exit scrap mode if active. Called by any action that should override it. */
  private exitScrapMode(): void {
    if (this.scrapMode) {
      this.scrapMode = false;
      this.showInfo('Scrap mode off');
    }
  }

  private setupInput(): void {
    // DEFENSIVE: remove any stale pointerdown handler registered by a previous
    // create() that didn't get cleaned up. This is the nuclear option and
    // prevents the "same click creates multiple placements" bug where scene
    // restarts leaked listeners. input.off with no function removes ALL
    // pointerdown listeners on the scene input.
    this.input.off('pointerdown');
    // Also clear any `on('pointerdown')` listeners set by Phaser internal
    // gameobjects that might have survived a shutdown race.
    const handlerCount = this.input.listenerCount('pointerdown');
    if (handlerCount > 0) {
      console.warn(`[DayScene] setupInput: ${handlerCount} stale pointerdown listeners remained after off()`);
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, hitObjects: Phaser.GameObjects.GameObject[]) => {
      // BG8 ROOT CAUSE FIX: if the pointerdown hit any interactive GameObject
      // (e.g. a build menu item, a toolbar button, a popup button) then
      // IGNORE it at the scene level. Otherwise the click-through places a
      // structure at the world position UNDER the UI panel, which the
      // player sees as phantom buildings appearing on the left side of the
      // map whenever they switch structure mid-placement.
      if (hitObjects && hitObjects.length > 0) {
        return;
      }

      if (pointer.rightButtonDown()) {
        // Right-click exits scrap mode if active
        if (this.scrapMode) {
          this.scrapMode = false;
          this.showInfo('Scrap mode off');
          return;
        }
        // Right-click on a damaged structure = repair it (1 parts per 50 HP).
        // Cancel any in-progress placement or popup as a side effect.
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const clickedStructure = this.buildingManager.getStructureAt(worldPoint.x, worldPoint.y);
        if (clickedStructure && clickedStructure.hp > 0 && clickedStructure.hp < clickedStructure.maxHp) {
          this.repairStructure(clickedStructure);
          return;
        }
        this.cancelPlacement();
        this.closeStructurePopup();
        return;
      }

      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const gridX = Math.floor(worldPoint.x / TILE_SIZE) * TILE_SIZE;
      const gridY = Math.floor(worldPoint.y / TILE_SIZE) * TILE_SIZE;

      // Scrap mode: any click on a structure scraps it (sell via BuildingManager).
      // Player stays in scrap mode so they can bulldoze many in a row.
      if (this.scrapMode) {
        const target = this.buildingManager.getStructureAt(worldPoint.x, worldPoint.y);
        if (target) {
          const data = this.buildingManager.getStructureData(target.structureId);
          if (this.buildingManager.sell(target.id)) {
            this.renderPlacedStructures();
            this.updateResourceDisplay();
            this.showInfo(`Scrapped ${data?.name ?? 'structure'}`);
            AudioManager.play('ui_click');
          }
        }
        return;
      }

      if (this.placementMode && this.placementStructureId) {
        // Skip the click that opened placement mode (same pointer event)
        if (this.placementJustStarted) {
          return;
        }
        this.placeStructure(this.placementStructureId, gridX, gridY);
        return;
      }

      // Check if clicking the base center (Bug 9: base click shows upgrade popup)
      const mapPixW = MAP_WIDTH * TILE_SIZE;
      const mapPixH = MAP_HEIGHT * TILE_SIZE;
      const baseLd = this.getBaseLevelData();
      const baseHalfSize = baseLd.visual.size / 2;
      const baseCx = mapPixW / 2;
      const baseCy = mapPixH / 2;
      const distToBase = Math.abs(worldPoint.x - baseCx) <= baseHalfSize + 8
        && Math.abs(worldPoint.y - baseCy) <= baseHalfSize + 8;
      if (distToBase) {
        this.showBaseUpgradePopup();
        return;
      }

      // Check if clicking an existing structure (when not in placement mode)
      const existing = this.buildingManager.getStructureAt(worldPoint.x, worldPoint.y);
      if (existing) {
        this.showStructurePopup(existing);
      } else {
        this.closeStructurePopup();
      }
    });

    // Allow camera panning with arrow keys
    if (this.input.keyboard) {
      const cursors = this.input.keyboard.createCursorKeys();
      const panSpeed = 4;
      this.events.on('update', () => {
        if (cursors.left.isDown) this.cameras.main.scrollX -= panSpeed;
        if (cursors.right.isDown) this.cameras.main.scrollX += panSpeed;
        if (cursors.up.isDown) this.cameras.main.scrollY -= panSpeed;
        if (cursors.down.isDown) this.cameras.main.scrollY += panSpeed;
      });

      // Central keyboard router -- dispatches to the topmost open dialog/panel
      this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
        const key = event.key;

        // 0. Block ALL shortcuts while tutorial is showing
        if (this.tutorialShowing) return;

        // 0a. Placement mode R = rotate (highest priority so build menu
        // being open doesn't swallow the rotate key). Only fires if a
        // multi-tile structure is being placed.
        if (this.placementMode && key.toUpperCase() === 'R') {
          this.rotatePlacement();
          return;
        }

        // 1. Dialogs take priority (EventDialog, EncounterDialog)
        if (this.eventDialog.isShowing()) {
          if (this.eventDialog.handleKey(key)) return;
        }

        // EncounterDialog is inside lootRunPanel but rendered on top
        if (this.lootRunPanel.getEncounterDialog().isShowing()) {
          if (this.lootRunPanel.getEncounterDialog().handleKey(key)) return;
        }

        // 2. Open panels get next shot
        if (this.equipmentPanel.isVisible()) {
          if (this.equipmentPanel.handleKey(key)) return;
        }
        if (this.craftingPanel.isVisible()) {
          if (this.craftingPanel.handleKey(key)) return;
        }
        if (this.skillPanel.isVisible()) {
          if (this.skillPanel.handleKey(key)) return;
        }
        if (this.refugeePanel.isVisible()) {
          if (this.refugeePanel.handleKey(key)) return;
        }
        if (this.lootRunPanel.isVisible()) {
          if (this.lootRunPanel.handleKey(key)) return;
        }

        // 3. Build menu keyboard handling
        if (this.buildMenuVisible) {
          if (key === 'Escape') {
            this.toggleBuildMenu();
            return;
          }
          // Delegate to BuildMenu's key handler (1-9, arrows, Enter, Tab)
          if (this.buildMenu.handleKey(key, event)) return;
          return; // Consume all other keys when build menu is open
        }

        // 4a. Scrap mode: ESC exits immediately (checked BEFORE placement mode
        // so a single press always works, regardless of leftover state)
        if (this.scrapMode && key === 'Escape') {
          this.exitScrapMode();
          return;
        }

        // 4b. Placement mode
        if (this.placementMode) {
          if (key === 'Escape') {
            this.cancelPlacement();
            return;
          }
          if (key.toUpperCase() === 'R') {
            this.rotatePlacement();
            return;
          }
          return;
        }

        // 5. Structure popup
        if (this.structurePopup) {
          if (key === 'Escape') {
            this.closeStructurePopup();
            return;
          }
        }

        // 6. Global toolbar shortcuts (only when no panel is open)
        const upper = key.toUpperCase();
        switch (upper) {
          case 'B': this.toggleBuildMenu(); break;
          case 'Q': this.equipmentPanel.toggle(); break;
          case 'C': this.craftingPanel.toggle(); break;
          case 'R': this.refugeePanel.toggle(); break;
          case 'L': this.lootRunPanel.toggle(); break;
          case 'S': this.skillPanel.toggle(); break;
          case 'E': this.showEndDayConfirmation(); break;
          case 'X': this.toggleScrapMode(); break;
          default: break;
        }

        // DEBUG: backtick (`) opens debug console
        if (key === '`' || key === '§') {
          this.toggleDebugMenu();
        }
      });
    }

    // Right click to cancel placement
    if (this.input.mouse) {
      this.input.mouse.disableContextMenu();
    }
  }

  // Show a simple confirmation before ending the day via keyboard shortcut.
  // Prevents accidental E key presses from immediately starting the night.
  private showEndDayConfirmation(): void {
    const panelW = 300;
    const panelH = 110;
    const px = Math.floor((GAME_WIDTH - panelW) / 2);
    const py = Math.floor((GAME_HEIGHT - panelH) / 2);

    // Build a small confirmation overlay -- all objects are world-space
    // but added to the UI camera so they stay fixed.
    // No full-screen backdrop: the panel itself blocks clicks via setInteractive.
    const panel = this.add.graphics().setDepth(251);
    panel.fillStyle(0x1A1A1A, 0.97);
    panel.fillRoundedRect(px, py, panelW, panelH, 8);
    panel.lineStyle(2, 0xD4620B, 0.9);
    panel.strokeRoundedRect(px, py, panelW, panelH, 8);
    panel.setInteractive(
      new Phaser.Geom.Rectangle(px, py, panelW, panelH),
      Phaser.Geom.Rectangle.Contains,
    );
    this.addToUI(panel);

    const prompt = this.add.text(GAME_WIDTH / 2, py + 20, 'The sun is setting.\nAre you ready for the horde?', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#E8DCC8',
      align: 'center',
      wordWrap: { width: panelW - 24 },
    }).setOrigin(0.5, 0).setDepth(252);
    this.addToUI(prompt);

    // Use an object wrapper so both dismiss and keyHandler can cross-reference
    // each other while satisfying const constraints.
    const handlers: { key?: (event: KeyboardEvent) => void } = {};

    const dismiss = (): void => {
      panel.destroy();
      prompt.destroy();
      yesBtn.destroy();
      noBtn.destroy();
      if (handlers.key) this.input.keyboard?.off('keydown', handlers.key);
    };

    const yesBtn = this.add.text(GAME_WIDTH / 2 - 50, py + 82, '[ BRING IT ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#4CAF50',
    }).setOrigin(1, 0).setDepth(252).setInteractive({ useHandCursor: true });
    yesBtn.on('pointerover', () => yesBtn.setColor('#FFD700'));
    yesBtn.on('pointerout', () => yesBtn.setColor('#4CAF50'));
    yesBtn.on('pointerdown', () => { dismiss(); this.endDay(); });
    this.addToUI(yesBtn);

    const noBtn = this.add.text(GAME_WIDTH / 2 + 50, py + 82, '[ NOT YET ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#F44336',
    }).setOrigin(0, 0).setDepth(252).setInteractive({ useHandCursor: true });
    noBtn.on('pointerover', () => noBtn.setColor('#FFD700'));
    noBtn.on('pointerout', () => noBtn.setColor('#F44336'));
    noBtn.on('pointerdown', () => dismiss());
    this.addToUI(noBtn);

    // Keyboard dismiss: Escape = cancel, Enter/Y = confirm
    handlers.key = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        dismiss();
      } else if (event.key === 'Enter' || event.key === 'y' || event.key === 'Y') {
        dismiss();
        this.endDay();
      }
    };
    this.input.keyboard?.on('keydown', handlers.key);
  }

  /**
   * Repair a damaged structure during the day. Costs 1 parts per 50 HP.
   * Called on right-click on any damaged-but-alive structure.
   */
  private repairStructure(instance: StructureInstance): void {
    const REPAIR_COST = 1;
    const REPAIR_HP   = 50;

    if (this.gameState.inventory.resources.parts < REPAIR_COST) {
      this.showInfo('Need 1 PARTS to repair!');
      AudioManager.play('ui_error');
      return;
    }

    this.gameState.inventory.resources.parts -= REPAIR_COST;
    instance.hp = Math.min(instance.maxHp, instance.hp + REPAIR_HP);
    this.updateResourceDisplay();

    // Redraw structures to refresh the damage overlay
    this.renderPlacedStructures();

    const data = this.buildingManager.getStructureData(instance.structureId);
    this.showInfo(`Repaired ${data?.name ?? 'structure'} (+${REPAIR_HP} HP)`);
    this.gameLog.addMessage(`Repaired ${data?.name ?? 'structure'}`, '#44AAFF');
    AudioManager.play('ui_build');
  }

  private placeStructure(structureId: string, x: number, y: number): void {
    // Block placement on the base tent footprint so player can't build on the
    // base itself. Base is a square centered on the map middle.
    const mapPixW = MAP_WIDTH * TILE_SIZE;
    const mapPixH = MAP_HEIGHT * TILE_SIZE;
    const baseLd = this.getBaseLevelData();
    const baseHalf = baseLd.visual.size / 2;
    const baseCx = mapPixW / 2;
    const baseCy = mapPixH / 2;
    if (x + TILE_SIZE > baseCx - baseHalf && x < baseCx + baseHalf &&
        y + TILE_SIZE > baseCy - baseHalf && y < baseCy + baseHalf) {
      this.showInfo('Cannot build on the base!');
      AudioManager.play('ui_error');
      return;
    }

    const result = this.buildingManager.place(structureId, x, y, this.currentAP, this.placementRotation);

    if (result) {
      this.currentAP = result.apRemaining;
      this.apBar.update(this.currentAP);
      this.updateResourceDisplay();
      this.drawStructure(result.instance);

      // Award building XP
      this.skillManager.addXP('building', XP_PER_BUILD);

      // Track for achievements
      this.gameState.stats.structuresPlaced++;

      const data = this.buildingManager.getStructureData(structureId);
      this.showInfo(`${data?.name ?? 'Structure'} placed!`);
      this.gameLog.addMessage(`Built ${data?.name ?? 'structure'}`, '#88DDFF');
      AudioManager.play('ui_build');
      // Keep placement mode active so player can place more of the same structure
      this.updateResourceDisplay();
    } else {
      // Determine reason for failure
      const data = this.buildingManager.getStructureData(structureId);
      if (!data) return;

      if (!this.buildingManager.hasEnoughAP(structureId, this.currentAP)) {
        this.showInfo('Not enough time!');
        AudioManager.play('ui_error');
      } else if (!this.buildingManager.canAfford(structureId)) {
        this.showInfo('Not enough resources!');
      } else if (!this.buildingManager.isPositionFree(x, y)) {
        this.showInfo('Something is already here!');
      }
    }
  }

  private showStructurePopup(instance: StructureInstance): void {
    this.closeStructurePopup();

    const data = this.buildingManager.getStructureData(instance.structureId);
    if (!data) return;

    // Determine whether there is an upgrade available and what it costs
    const nextUpgrade = this.buildingManager.getNextUpgrade(instance);
    const hasUpgradeSlot = instance.level < data.maxLevel;
    const canUpgrade = hasUpgradeSlot
      && this.buildingManager.canAffordUpgrade(instance)
      && this.buildingManager.hasEnoughAPForUpgrade(instance, this.currentAP);

    // Build a compact cost string for the upgrade button label (e.g. "3 parts, 1 AP")
    const upgradeCostLabel = (nextUpgrade != null)
      ? Object.entries(nextUpgrade.cost)
          .map(([r, n]) => `${n} ${r}`)
          .join(', ') + `, 1 AP`
      : '';

    // Popup height: taller when there is an upgrade row
    const popupH = hasUpgradeSlot ? 110 : 90;

    // Convert structure world position to screen position for the popup
    const cam = this.cameras.main;
    const popupX = instance.x - cam.scrollX + TILE_SIZE + 8;
    const popupY = instance.y - cam.scrollY;

    this.structurePopup = this.add.container(popupX, popupY);
    this.structurePopup.setDepth(120);

    const bg = this.add.graphics();
    bg.fillStyle(0x1A1A2E, 0.95);
    bg.fillRect(0, 0, 168, popupH);
    bg.lineStyle(1, 0x6B6B6B);
    bg.strokeRect(0, 0, 168, popupH);
    this.structurePopup.add(bg);

    // Structure name, level, and HP
    const info = this.add.text(8, 6, `${data.name} Lv${instance.level}\nHP: ${instance.hp}/${instance.maxHp}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#E8DCC8',
    });
    this.structurePopup.add(info);

    // Upgrade section (when at least one more level exists)
    if (hasUpgradeSlot) {
      const upgradeColor = canUpgrade ? '#4CAF50' : '#6B6B6B';

      // Cost label row (shows what the upgrade costs)
      const costText = this.add.text(8, 48, `Lv${instance.level + 1}: ${upgradeCostLabel}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#AAAAAA',
        wordWrap: { width: 152 },
      });
      this.structurePopup.add(costText);

      const upgradeBtn = this.add.text(8, 68, '[ UPGRADE ]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '11px',
        color: upgradeColor,
      });

      if (canUpgrade) {
        upgradeBtn.setInteractive({ useHandCursor: true });
        upgradeBtn.on('pointerover', () => upgradeBtn.setColor('#FFD700'));
        upgradeBtn.on('pointerout', () => upgradeBtn.setColor('#4CAF50'));
        upgradeBtn.on('pointerdown', () => {
          const result = this.buildingManager.upgrade(instance.id, this.currentAP);
          if (result) {
            this.currentAP = result.apRemaining;
            this.apBar.update(this.currentAP);
            this.updateResourceDisplay();
            this.renderPlacedStructures();
            this.closeStructurePopup();
            // instance.level was mutated by upgrade() -- show new level
            this.showInfo(`${data.name} upgraded to Lv${instance.level}!`);
          }
        });
      }
      this.structurePopup.add(upgradeBtn);
    }

    // Sell button -- placed below upgrade row when present, otherwise at same y as before
    const sellY = hasUpgradeSlot ? 90 : 68;
    // Calculate sell yield (75% of build cost)
    const sellYield = Object.entries(data.cost)
      .map(([res, amt]) => `+${Math.ceil((amt as number) * 0.75)}${res[0]?.toUpperCase() ?? ''}`)
      .join(' ');
    const sellBtn = this.add.text(8, sellY, `[ SCRAP ${sellYield} ]`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '11px',
      color: '#F44336',
    }).setInteractive({ useHandCursor: true });

    sellBtn.on('pointerover', () => sellBtn.setColor('#FFD700'));
    sellBtn.on('pointerout', () => sellBtn.setColor('#F44336'));
    sellBtn.on('pointerdown', () => {
      this.buildingManager.sell(instance.id);
      this.updateResourceDisplay();
      this.renderPlacedStructures();
      this.closeStructurePopup();
      this.showInfo(`${data.name} sold!`);
    });
    this.structurePopup.add(sellBtn);

    this.addToUI(this.structurePopup);
  }

  private closeStructurePopup(): void {
    if (this.structurePopup) {
      this.structurePopup.destroy();
      this.structurePopup = null;
    }
  }

  /**
   * Bug 9: Show a base upgrade popup when the player clicks the base structure.
   * Same pattern as showStructurePopup() but shows upgrade cost + confirm button.
   * Uses structurePopup container so it is automatically cleaned up by closeStructurePopup().
   */
  private showBaseUpgradePopup(): void {
    this.closeStructurePopup();

    const levelData = this.getBaseLevelData();
    const next = this.getNextBaseLevelData();

    this.structurePopup = this.add.container(GAME_WIDTH - 192, 46);
    const popupW = 180;
    const bg = this.add.graphics();
    bg.fillStyle(0x1A1A1A, 0.95);
    bg.fillRect(0, 0, popupW, 110);
    bg.lineStyle(1, 0x333333);
    bg.strokeRect(0, 0, popupW, 110);
    this.structurePopup.add(bg);

    // Current base level name
    this.structurePopup.add(this.add.text(8, 8, levelData.name, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#C5A030',
    }));

    if (!next || !next.cost) {
      // Already at max level
      this.structurePopup.add(this.add.text(8, 26, 'MAX LEVEL', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#6B6B6B',
      }));
    } else {
      const costStr = Object.entries(next.cost).map(([r, n]) => `${n} ${r}`).join(', ');
      const apCost = (next.apCost ?? 0);

      this.structurePopup.add(this.add.text(8, 26, `Upgrade to: ${next.name}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#E8DCC8',
        wordWrap: { width: popupW - 16 },
      }));
      this.structurePopup.add(this.add.text(8, 44, `Cost: ${costStr}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#AAAAAA',
        wordWrap: { width: popupW - 16 },
      }));
      if (apCost > 0) {
        this.structurePopup.add(this.add.text(8, 60, `Time: ${apCost}h`, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '7px',
          color: '#AAAAAA',
        }));
      }

      // Check affordability
      let canAfford = this.currentAP >= apCost;
      for (const [resource, amount] of Object.entries(next.cost)) {
        if ((this.gameState.inventory.resources[resource as ResourceType] ?? 0) < (amount as number)) {
          canAfford = false;
        }
      }

      const upgradeBtn = this.add.text(8, apCost > 0 ? 78 : 62, '[ UPGRADE ]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '11px',
        color: canAfford ? '#4CAF50' : '#6B6B6B',
      });
      if (canAfford) {
        upgradeBtn.setInteractive({ useHandCursor: true });
        upgradeBtn.on('pointerover', () => upgradeBtn.setColor('#FFD700'));
        upgradeBtn.on('pointerout', () => upgradeBtn.setColor('#4CAF50'));
        upgradeBtn.on('pointerdown', () => {
          this.upgradeBase();
          this.closeStructurePopup();
        });
      }
      this.structurePopup.add(upgradeBtn);
    }

    // Close button
    const closeBtn = this.add.text(popupW - 8, 8, '[X]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#666666',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeStructurePopup());
    closeBtn.on('pointerover', () => closeBtn.setColor('#FFD700'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#666666'));
    this.structurePopup.add(closeBtn);

    this.structurePopup.setDepth(101);
    this.addToUI(this.structurePopup);
  }

  /** Draw the base tent/building visual based on current level */
  private drawBaseTent(graphics: Phaser.GameObjects.Graphics, centerX: number, centerY: number): void {
    const levelData = this.getBaseLevelData();
    const size = levelData.visual.size;

    // Try sprite-based rendering
    const baseSpriteKey = getBaseSpriteKey(this, this.gameState.base.level);
    if (baseSpriteKey) {
      graphics.clear();
      if (this.baseSpriteImage) {
        this.baseSpriteImage.destroy();
      }
      this.baseSpriteImage = this.add.image(centerX, centerY, baseSpriteKey);
      this.baseSpriteImage.setDisplaySize(size, size);
      this.mapContainer.add(this.baseSpriteImage);
      return;
    }

    // Programmatic fallback
    const halfSize = size / 2;
    const fillColor = parseInt(levelData.visual.color.replace('0x', ''), 16);
    const strokeColor = parseInt(levelData.visual.strokeColor.replace('0x', ''), 16);
    const strokeWidth = levelData.visual.strokeWidth;

    graphics.clear();
    graphics.fillStyle(fillColor);
    graphics.fillRect(centerX - halfSize, centerY - halfSize, size, size);
    graphics.lineStyle(strokeWidth, strokeColor);
    graphics.strokeRect(centerX - halfSize, centerY - halfSize, size, size);

    // For Camp and above, draw inner wall detail
    if (this.gameState.base.level >= 1) {
      const inset = 4;
      graphics.lineStyle(1, strokeColor, 0.4);
      graphics.strokeRect(
        centerX - halfSize + inset,
        centerY - halfSize + inset,
        size - inset * 2,
        size - inset * 2
      );
    }
  }

  /** Create the base level UI in the top bar (right side).
   * Bug 9: UPGRADE button removed -- clicking the base on the map opens an upgrade popup instead.
   */
  private createBaseUpgradeUI(): void {
    const levelData = this.getBaseLevelData();

    // Base name label only -- no upgrade button here to avoid top-bar overlap (Bug 7/9)
    const baseLabel = this.add.text(GAME_WIDTH - 16, 6, levelData.name, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#E8DCC8',
    }).setOrigin(1, 0).setDepth(100);
    this.addToUI(baseLabel);

    // Assign a dummy container so updateBaseUpgradeUI can destroy it without crashing
    this.baseUpgradeBtn = this.add.container(0, 0);
    this.addToUI(this.baseUpgradeBtn);
  }

  /** Refresh the base upgrade UI after an upgrade */
  private updateBaseUpgradeUI(): void {
    this.baseUpgradeBtn.destroy();
    this.createBaseUpgradeUI();

    // Redraw base tent visual
    const mapPixelWidth = MAP_WIDTH * TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT * TILE_SIZE;
    this.drawBaseTent(this.baseTentGraphics, mapPixelWidth / 2, mapPixelHeight / 2);

    // Refresh build menu to show newly unlocked structures
    this.rebuildBuildMenu();
  }

  private processDayStart(): void {
    // Farm production: each farm produces foodPerDay
    const farmFood = this.getFarmProduction();
    if (farmFood > 0) {
      this.gameState.inventory.resources.food += farmFood;
      this.enforceResourceCaps();
      this.showInfo(`Farms produced +${farmFood} food`);
    }

    // Leadership XP: 10 XP per refugee per day
    const refugeeCount = this.refugeeManager.getAll().length;
    if (refugeeCount > 0) {
      this.skillManager.addXP('leadership', refugeeCount * 10);
    }

    // Camp Crew passive bonuses (food/scrap per healthy refugee, repair = trap lifetime bonus)
    const bonuses = this.refugeeManager.applyDailyBonuses();
    if (bonuses.food > 0 || bonuses.scrap > 0 || bonuses.repairBonus > 0) {
      const parts: string[] = [];
      if (bonuses.food > 0) parts.push(`+${bonuses.food} food`);
      if (bonuses.scrap > 0) parts.push(`+${bonuses.scrap} scrap`);
      if (bonuses.repairBonus > 0) parts.push(`+${bonuses.repairBonus} trap life`);
      this.showInfo(`Camp Crew: ${parts.join(', ')}`);
    }

    // Food consumption (survival skill reduces consumption)
    const foodResult = this.refugeeManager.consumeFood();
    if (foodResult.missing > 0) {
      // Show prominent starvation warning in both the info banner and the game log
      this.showInfo('Refugees starving! Need more food!');
      this.gameLog.addMessage(`Refugees starving! ${foodResult.missing} went without food.`, '#FF4444');
    }

    // Auto-heal injured refugees (uses 1 med per refugee, no job assignment needed)
    const healed = this.refugeeManager.processHealing();
    if (healed.length > 0) {
      this.showInfo(healed.join(', '));
    }

    // Random refugee arrival
    const newRefugee = this.refugeeManager.tryRandomArrival();
    if (newRefugee) {
      this.showInfo(`${newRefugee.name} arrived at camp!`);
    }

    // Check achievements
    this.achievementManager.checkAll();

    this.updateResourceDisplay();
  }

  /** Roll for a random event and show dialog if one triggers */
  private checkRandomEvent(): void {
    const event = this.eventManager.rollEvent();
    if (!event) return;

    // Log the event name; horde warnings get a distinct color
    const isHorde = event.type === 'HORDE_WARNING';
    const logColor = isHorde ? '#FF4444' : '#FFD700';
    const prefix = isHorde ? 'HORDE WARNING: ' : 'Event: ';
    this.gameLog.addMessage(`${prefix}${event.name}`, logColor);

    this.eventDialog.show(event, (choice: EventChoice) => {
      const result = this.eventManager.applyChoice(event, choice);
      this.showInfo(result);
      // Log the event outcome as well
      if (result && result !== 'No effect') {
        this.gameLog.addMessage(result, '#cccccc');
      }
      this.updateResourceDisplay();
    });
  }

  /** Get horde multiplier from today's event (if any) */
  getHordeMultiplier(): number {
    return this.eventManager.getHordeMultiplier();
  }

  /** Get fog penalty from today's event (if any) */
  getFogPenalty(): number {
    return this.eventManager.getFogPenalty();
  }

  /** Calculate total food production from farms */
  private getFarmProduction(): number {
    let total = 0;
    for (const structure of this.gameState.base.structures) {
      if (structure.structureId === 'farm') {
        const data = this.buildingManager.getStructureData('farm');
        if (data?.foodPerDay) {
          total += data.foodPerDay;
        }
      }
    }
    return total;
  }

  /** Get current resource cap based on storage structures */
  private getResourceCap(): number {
    const storageCount = this.gameState.base.structures.filter(
      s => s.structureId === 'storage'
    ).length;
    return DEFAULT_RESOURCE_CAP + storageCount * STORAGE_CAP_BONUS;
  }

  /** Enforce resource caps */
  private enforceResourceCaps(): void {
    const cap = this.getResourceCap();
    const res = this.gameState.inventory.resources;
    const keys: ResourceType[] = ['scrap', 'food', 'ammo', 'parts', 'meds'];
    for (const key of keys) {
      if (res[key] > cap) {
        res[key] = cap;
      }
    }
  }

  /** Get current base level data from base-levels.json */
  private getBaseLevelData(): typeof baseLevelsJson.baseLevels[number] {
    const idx = Math.min(this.gameState.base.level, baseLevelsJson.baseLevels.length - 1);
    const data = baseLevelsJson.baseLevels[idx];
    if (!data) throw new Error('No base levels defined');
    return data;
  }

  /** Get next base level data, or null if at max */
  private getNextBaseLevelData(): typeof baseLevelsJson.baseLevels[number] | null {
    const nextLevel = this.gameState.base.level + 1;
    return baseLevelsJson.baseLevels[nextLevel] ?? null;
  }

  /** Attempt to upgrade the base */
  private upgradeBase(): void {
    const next = this.getNextBaseLevelData();
    if (!next || !next.cost) return;

    // Check AP
    const apCost = next.apCost ?? 0;
    if (this.currentAP < apCost) {
      this.showInfo('Not enough time!');
      return;
    }

    // Check resources
    for (const [resource, amount] of Object.entries(next.cost)) {
      const have = this.gameState.inventory.resources[resource as ResourceType] ?? 0;
      if (have < (amount as number)) {
        this.showInfo('Not enough resources!');
        return;
      }
    }

    // Deduct resources
    for (const [resource, amount] of Object.entries(next.cost)) {
      this.gameState.inventory.resources[resource as ResourceType] -= (amount as number);
    }
    this.currentAP -= apCost;

    // Level up
    this.gameState.base.level = next.level;

    this.apBar.update(this.currentAP);
    this.updateResourceDisplay();
    this.updateBaseUpgradeUI();
    this.showInfo(`Base upgraded to ${next.name}!`);
  }

  private endDay(): void {
    AudioManager.stopAmbient();
    // Note: Camp Crew bonuses are applied at day START (processDayStart).
    // No gathering step needed here anymore.

    // Check achievements before saving
    this.achievementManager.checkAll();

    // Sync all systems back to game state before saving
    this.refugeeManager.syncToState();
    this.skillManager.syncToState(this.gameState);
    SaveManager.save(this.gameState);

    // Fade out to night
    this.cameras.main.fadeOut(800, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('NightScene', {
        hordeMultiplier: this.eventManager.getHordeMultiplier(),
        fogPenalty: this.eventManager.getFogPenalty(),
      });
    });
  }

  private showDayTutorial(): void {
    // Block random events until all tutorial steps are dismissed
    this.tutorialShowing = true;

    const steps = [
      { title: 'DAY PHASE', text: 'You have 12 hours to\nprepare before nightfall.' },
      { title: 'BUILD', text: 'Place traps and walls\naround your base to\ndefend against zombies.' },
      { title: 'LOOT', text: 'Send loot runs to find\nscrap, ammo, parts.\nMay find weapons and blueprints!' },
      { title: 'END DAY', text: 'Press END DAY when ready.\nNight begins immediately.\nGood luck, survivor.' },
    ];
    let currentStep = 0;

    const container = this.add.container(0, 0).setDepth(300).setScrollFactor(0);

    // No full-screen backdrop -- panel blocks clicks via setInteractive.
    const panelW = 320;
    const panelH = 180;
    const px = (GAME_WIDTH - panelW) / 2;
    const py = (GAME_HEIGHT - panelH) / 2 - 20;

    const panel = this.add.graphics();
    panel.fillStyle(0x1A1A2E, 0.95);
    panel.fillRoundedRect(px, py, panelW, panelH, 8);
    panel.lineStyle(2, 0x4CAF50);
    panel.strokeRoundedRect(px, py, panelW, panelH, 8);
    panel.setInteractive(
      new Phaser.Geom.Rectangle(px, py, panelW, panelH),
      Phaser.Geom.Rectangle.Contains,
    );
    container.add(panel);

    const stepCounter = this.add.text(GAME_WIDTH / 2, py + 16, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#6B6B6B',
    }).setOrigin(0.5);
    container.add(stepCounter);

    const titleText = this.add.text(GAME_WIDTH / 2, py + 40, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#4CAF50',
    }).setOrigin(0.5);
    container.add(titleText);

    const bodyText = this.add.text(GAME_WIDTH / 2, py + 72, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#E8DCC8',
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5, 0);
    container.add(bodyText);

    const continueText = this.add.text(GAME_WIDTH / 2, py + panelH - 18, 'Click or press any key', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#6B6B6B',
    }).setOrigin(0.5);
    container.add(continueText);

    this.tweens.add({
      targets: continueText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    const showStep = () => {
      const step = steps[currentStep];
      if (!step) return;
      stepCounter.setText(`${currentStep + 1} / ${steps.length}`);
      titleText.setText(step.title);
      bodyText.setText(step.text);
    };

    const advance = () => {
      currentStep++;
      if (currentStep >= steps.length) {
        // Tutorial finished -- clear flag and check for deferred random events
        this.tutorialShowing = false;
        container.destroy();
        this.checkRandomEvent();
        return;
      }
      AudioManager.play('ui_click');
      showStep();
    };

    showStep();

    // Panel already has setInteractive -- click anywhere on the panel to advance.
    panel.on('pointerdown', advance);
    const keyHandler = this.input.keyboard?.on('keydown', advance);
    container.once('destroy', () => {
      if (keyHandler) this.input.keyboard?.off('keydown', advance);
    });
  }

  // =========================================================================
  // DEBUG MENU -- press ` or § to toggle
  // =========================================================================
  private debugContainer: Phaser.GameObjects.Container | null = null;

  private toggleDebugMenu(): void {
    if (this.debugContainer) {
      this.debugContainer.destroy();
      this.debugContainer = null;
      return;
    }

    const gs = this.gameState;
    const panelW = 300;
    const panelH = 400;
    const px = 10;
    const py = 60;

    this.debugContainer = this.add.container(px, py).setDepth(500).setScrollFactor(0);

    const bg = this.add.graphics();
    bg.fillStyle(0x0A0A0A, 0.95);
    bg.fillRoundedRect(0, 0, panelW, panelH, 6);
    bg.lineStyle(2, 0xFF0000);
    bg.strokeRoundedRect(0, 0, panelW, panelH, 6);
    this.debugContainer.add(bg);

    const title = this.add.text(10, 8, 'DEBUG MENU', {
      fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#FF0000',
    });
    this.debugContainer.add(title);

    let y = 30;
    const addButton = (label: string, action: () => void) => {
      const btn = this.add.text(10, y, `> ${label}`, {
        fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#4CAF50',
      }).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setColor('#FFD700'));
      btn.on('pointerout', () => btn.setColor('#4CAF50'));
      btn.on('pointerdown', () => {
        action();
        console.log(`[DEBUG] ${label}`);
        // Refresh UI
        this.events.emit('resources-changed');
        this.updateResourceDisplay();
      });
      this.debugContainer?.add(btn);
      y += 18;
    };

    addButton('+50 ALL RESOURCES', () => {
      gs.inventory.resources.scrap += 50;
      gs.inventory.resources.food += 50;
      gs.inventory.resources.ammo += 50;
      gs.inventory.resources.parts += 50;
      gs.inventory.resources.meds += 50;
    });

    addButton('+100 SCRAP', () => { gs.inventory.resources.scrap += 100; });
    addButton('+50 PARTS', () => { gs.inventory.resources.parts += 50; });
    addButton('+50 AMMO', () => { gs.inventory.resources.ammo += 50; });
    addButton('+50 FOOD', () => { gs.inventory.resources.food += 50; });
    addButton('+20 MEDS', () => { gs.inventory.resources.meds += 20; });
    addButton('+12 AP', () => { this.currentAP = 12; });

    addButton('SET WAVE 1', () => { gs.progress.currentWave = 1; });
    addButton('SET WAVE 3', () => { gs.progress.currentWave = 3; });
    addButton('SET WAVE 5', () => { gs.progress.currentWave = 5; });

    addButton('UPGRADE BASE', () => {
      gs.base.level = Math.min(gs.base.level + 1, 3);
      console.log(`[DEBUG] Base level: ${gs.base.level}`);
    });

    addButton('ADD ALL WEAPONS', () => {
      // WeaponManager already imported at top of file
      const allWeapons = ['hunting_knife', 'baseball_bat', 'crowbar', 'machete',
        'fire_axe', 'katana', '9mm_compact', 'revolver', 'silenced_pistol',
        'assault_rifle', 'scoped_rifle', 'marksman_rifle', 'pump_shotgun',
        'combat_shotgun', 'pipe_bomb', 'molotov', 'grenade_launcher'];
      for (const wid of allWeapons) {
        const inst = WeaponManager.createWeaponInstance(wid);
        if (inst) gs.inventory.weapons.push(inst);
      }
      console.log(`[DEBUG] Added ${allWeapons.length} weapons`);
    });

    addButton('ADD REFUGEE', () => {
      const id = `debug_${Date.now()}`;
      gs.refugees.push({
        id, name: 'Debug Dave', hp: 100, maxHp: 100,
        status: 'healthy', job: null, skillBonus: 'none', bonusType: 'food',
      });
    });

    addButton('GIVE ALL (EVERYTHING)', () => {
      gs.inventory.resources.scrap += 200;
      gs.inventory.resources.food += 200;
      gs.inventory.resources.ammo += 200;
      gs.inventory.resources.parts += 200;
      gs.inventory.resources.meds += 200;
      gs.base.level = 3;
      this.currentAP = 12;
      // WeaponManager already imported at top of file
      const allWeapons = ['fire_axe', 'katana', 'silenced_pistol', 'marksman_rifle',
        'combat_shotgun', 'grenade_launcher'];
      for (const wid of allWeapons) {
        const inst = WeaponManager.createWeaponInstance(wid);
        if (inst) gs.inventory.weapons.push(inst);
      }
      console.log('[DEBUG] GAVE EVERYTHING');
    });

    addButton('SAVE GAME', () => {
      SaveManager.save(gs);
      console.log('[DEBUG] Game saved');
    });

    addButton('CLEANUP FAR STRUCTURES', () => {
      // Removes any structure more than 250px from the map center.
      // The base is always at the map center -- structures far from it
      // are leftovers from old save bugs (BG7) and should be scrapped.
      const mapCenterX = (MAP_WIDTH * TILE_SIZE) / 2;
      const mapCenterY = (MAP_HEIGHT * TILE_SIZE) / 2;
      const MAX_DIST = 250;
      const before = gs.base.structures.length;
      const removed: Array<{ id: string; x: number; y: number }> = [];
      gs.base.structures = gs.base.structures.filter(s => {
        const dx = s.x + TILE_SIZE / 2 - mapCenterX;
        const dy = s.y + TILE_SIZE / 2 - mapCenterY;
        const tooFar = Math.sqrt(dx * dx + dy * dy) > MAX_DIST;
        if (tooFar) removed.push({ id: s.structureId, x: s.x, y: s.y });
        return !tooFar;
      });
      const after = gs.base.structures.length;
      console.log(`[DEBUG] CLEANUP removed ${before - after} structures (>${MAX_DIST}px from center):`);
      console.table(removed);
      SaveManager.save(gs);
      // Re-render the day view to reflect the change
      this.scene.restart();
    });

    addButton('[CLOSE]', () => { this.toggleDebugMenu(); });
  }

  /**
   * Apply legacy perks to the game state at the start of a fresh run.
   * Perks are one-time bonuses that modify the starting state.
   * Called only when totalRuns == 0 and currentWave == 1 (brand new run).
   */
  private applyLegacyPerks(): void {
    const unlockedPerks: string[] = this.gameState.meta?.unlockedPerks ?? [];
    if (unlockedPerks.length === 0) return;

    const perks = (perksJson as unknown as { perks: PerkData[] }).perks;

    for (const perkDef of perks) {
      if (!unlockedPerks.includes(perkDef.id)) continue;

      // scrap_stash: +10 scrap at start
      if (perkDef.id === 'scrap_stash') {
        const bonus = typeof perkDef.effect['startScrap'] === 'number' ? perkDef.effect['startScrap'] as number : 10;
        this.gameState.inventory.resources.scrap += bonus;
      }

      // armed_and_ready: add one Uncommon weapon at start
      if (perkDef.id === 'armed_and_ready') {
        // Find an uncommon-rarity weapon from weapons.json
        const weapons = (weaponsJson as { weapons: Array<{ id: string; rarity: string }> }).weapons;
        const uncommons = weapons.filter(w => w.rarity === 'uncommon');
        if (uncommons.length > 0) {
          const pick = uncommons[Math.floor(Math.random() * uncommons.length)];
          if (pick) {
            const inst = WeaponManager.createWeaponInstance(pick.id);
            if (inst) {
              this.gameState.inventory.weapons.push(inst);
            }
          }
        }
      }

      // camp_fire: add one starting refugee
      if (perkDef.id === 'camp_fire') {
        const name = REFUGEE_NAMES[Math.floor(Math.random() * REFUGEE_NAMES.length)] ?? 'Alex';
        const bonus = REFUGEE_SKILL_BONUSES[Math.floor(Math.random() * REFUGEE_SKILL_BONUSES.length)] ?? 'none';
        this.gameState.refugees.push({
          id: `legacy_refugee_${Date.now()}`,
          name,
          hp: 50,
          maxHp: 50,
          status: 'healthy',
          job: null,
          skillBonus: bonus,
          bonusType: 'food',
        });
      }

      // scholar: keep blueprints -- handled at death by NOT clearing unlockedBlueprints
      // (NightScene checks for this perk before resetting on death -- not needed here at day start)

      // tough_base: +50 max HP -- we store a flag; NightScene reads it via meta perks
      // The actual HP bonus is applied in NightScene.create() by checking this perk
      // (No action needed here at day start)

      // lucky_looter: bonus applies in LootManager.ts dynamically -- no day-start change needed
    }

    SaveManager.save(this.gameState);
  }
}

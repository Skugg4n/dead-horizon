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
import type { GameState, StructureInstance, ResourceType, TerrainResult } from '../config/types';
import { generateTerrain } from '../systems/TerrainGenerator';
import { EventManager } from '../systems/EventManager';
import { EventDialog } from '../ui/EventDialog';
import type { EventChoice } from '../ui/EventDialog';
import structuresJson from '../data/structures.json';
import baseLevelsJson from '../data/base-levels.json';
import { getStructureSpriteKey, getBaseSpriteKey } from '../utils/spriteFactory';
import { createUIButton } from '../ui/UIButton';
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
  private ghostGraphics: Phaser.GameObjects.Graphics | null = null;
  private placementJustStarted: boolean = false;

  // Tutorial state -- when true, random events are deferred until tutorial closes
  private tutorialShowing: boolean = false;

  // UI camera -- fixed at (0,0), never scrolls.
  // All UI elements are assigned here so their interactive zones
  // always match their visual positions regardless of main camera scroll.
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;

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
    this.currentAP = AP_PER_DAY;

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
    // Close build menu when other panels open
    this.events.on(CLOSE_ALL_PANELS, () => {
      if (this.buildMenuVisible && !this.buildMenuOpening) {
        this.buildMenuVisible = false;
        this.buildMenu.hide();
        this.cancelPlacement();
      }
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
      // Save is likely corrupted -- clear it and restart fresh
      SaveManager.clearSave();
      this.scene.start('MenuScene');
    }
  }

  update(): void {
    // Update ghost position during placement mode
    if (this.placementMode && this.ghostGraphics) {
      const pointer = this.input.activePointer;
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      // Snap to grid
      const snappedX = Math.floor(worldPoint.x / TILE_SIZE) * TILE_SIZE;
      const snappedY = Math.floor(worldPoint.y / TILE_SIZE) * TILE_SIZE;
      this.ghostGraphics.setPosition(snappedX, snappedY);
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
    const roadY   = roadRow * TILE_SIZE;

    // ------------------------------------------------------------------
    // GROUND LAYER
    // Use terrain tile sprites when available, otherwise rich Graphics.
    // ------------------------------------------------------------------
    // Sprite tiles disabled: WebGL sub-pixel rendering causes visible seams
    // between adjacent tile sprites. Graphics path is seam-free.
    const hasGrassTiles = false; // this.textures.exists('terrain_grass_1');

    // Solid green base layer to fill any gaps between tiles
    const groundFill = this.add.graphics();
    groundFill.fillStyle(0x3A6B2A);
    groundFill.fillRect(0, 0, mapPixelWidth, mapPixelHeight);
    this.mapContainer.add(groundFill);

    if (hasGrassTiles) {
      for (let ty = 0; ty < MAP_HEIGHT; ty++) {
        for (let tx = 0; tx < MAP_WIDTH; tx++) {
          // Integer positions + origin(0,0) to prevent subpixel gaps
          const tileX = tx * TILE_SIZE;
          const tileY = ty * TILE_SIZE;
          const hash = (tx * 1619 + ty * 3571) | 0;

          const tileKey = ((hash >>> 0) % 10 === 0) ? 'terrain_grass_2' : 'terrain_grass_1';
          const tile = this.add.image(tileX, tileY, tileKey).setOrigin(0, 0);
          this.mapContainer.add(tile);
        }
      }
    } else {
      // -----------------------------------------------------------------
      // Single solid fill -- per-tile variation caused checkerboard pattern
      // -----------------------------------------------------------------
      const ground = this.add.graphics();
      ground.setDepth(0);
      ground.fillStyle(0x4A7A2A);
      ground.fillRect(0, 0, mapPixelWidth, mapPixelHeight);
      this.mapContainer.add(ground);

      // -----------------------------------------------------------------
      // ROAD -- single continuous horizontal band across the full map.
      // Three stacked fillRects give a soft natural look without seams.
      // -----------------------------------------------------------------
      const road = this.add.graphics();
      road.setDepth(1);

      // Road centre Y in pixels
      const roadCentreY = roadRow * TILE_SIZE + TILE_SIZE / 2;
      const roadHalfH   = TILE_SIZE; // half-height of the main road band

      // Soft outer shoulders
      road.fillStyle(0x6A5230, 0.55);
      road.fillRect(0, roadCentreY - roadHalfH - 4, mapPixelWidth, 8);
      road.fillRect(0, roadCentreY + roadHalfH - 4, mapPixelWidth, 8);

      // Main road body -- one solid fill spanning full map width
      road.fillStyle(0x7A6248);
      road.fillRect(0, roadCentreY - roadHalfH, mapPixelWidth, roadHalfH * 2);

      // Subtle inner highlight strip
      road.fillStyle(0x8A7258, 0.45);
      road.fillRect(0, roadCentreY - 3, mapPixelWidth, 6);

      this.mapContainer.add(road);

      // -----------------------------------------------------------------
      // CLEARED BASE AREA -- lighter, sandy dirt around the base.
      // Single circular shape so there are no per-tile seam artefacts.
      // -----------------------------------------------------------------
      const baseArea = this.add.graphics();
      baseArea.setDepth(1);

      const baseClearRadius = 110; // pixels
      const baDiameter = baseClearRadius * 2;

      // Outer soft halo
      baseArea.fillStyle(0x6A5030, 0.55);
      baseArea.fillEllipse(centerX, centerY, baDiameter + 56, baDiameter + 56);

      // Main cleared dirt circle (lighter sandy earth)
      baseArea.fillStyle(0x7A6040);
      baseArea.fillEllipse(centerX, centerY, baDiameter, baDiameter);

      this.mapContainer.add(baseArea);

      // -----------------------------------------------------------------
      // ROAD EDGE MARKINGS
      // -----------------------------------------------------------------
      const markings = this.add.graphics();
      markings.setDepth(2);
      markings.fillStyle(0x8B7B5B, 0.5);
      for (let x = 0; x < mapPixelWidth; x += TILE_SIZE * 3) {
        markings.fillRect(x + 6, roadY - 2, TILE_SIZE - 10, 3);
      }
      this.mapContainer.add(markings);

      // -----------------------------------------------------------------
      // GROUND DETAIL PATCHES (grass tufts, leaves, pebbles) -- depth 2
      // -----------------------------------------------------------------
      const patches = this.add.graphics();
      patches.setDepth(2);

      for (let ty = 0; ty < MAP_HEIGHT; ty++) {
        for (let tx = 0; tx < MAP_WIDTH; tx++) {
          const hash4 = ((tx * 3571 + ty * 6173) * 2654435769) >>> 0;
          if ((hash4 % 100) < 18) {
            const tileX  = tx * TILE_SIZE;
            const tileY  = ty * TILE_SIZE;
            const patchX = tileX + (hash4 % TILE_SIZE);
            const patchY = tileY + ((hash4 >> 5) % TILE_SIZE);
            const pType  = (hash4 >> 10) % 3;
            if (pType === 0) {
              // Bright grass tuft
              patches.fillStyle(0x6AAF3A, 0.55);
              patches.fillEllipse(patchX, patchY, 6, 4);
            } else if (pType === 1) {
              // Dead/dry leaf
              patches.fillStyle(0x8B6A1A, 0.40);
              patches.fillEllipse(patchX, patchY, 5, 3);
            } else {
              // Small pebble
              patches.fillStyle(0x9A9080, 0.45);
              patches.fillCircle(patchX, patchY, 1.5);
            }
          }
        }
      }
      this.mapContainer.add(patches);

      // MAP EDGE DECORATIONS removed -- TerrainGenerator handles all decorations
      // so that DayScene and NightScene show identical layouts.
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

    const baseLevelData = this.getBaseLevelData();
    // Base label -- rendered on the game world; 9px + stroke for readability over terrain
    this.add.text(centerX, centerY - (baseLevelData.visual.size / 2) - 8, 'BASE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#E8DCC8',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);
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

    if (spriteKey) {
      // Use loaded sprite
      const img = this.add.image(
        structure.x + TILE_SIZE / 2,
        structure.y + TILE_SIZE / 2,
        spriteKey,
      );
      img.setDisplaySize(TILE_SIZE, TILE_SIZE);
      this.addToWorld(img);
      this.structureSprites.push(img);
    } else {
      // Programmatic fallback with colored tile + short label
      const color = STRUCTURE_COLORS[structure.structureId] ?? 0x888888;
      const data = this.buildingManager.getStructureData(structure.structureId);
      const w = (data?.widthTiles ?? 1) * TILE_SIZE;
      const g = this.add.graphics();
      g.fillStyle(color);
      g.fillRect(structure.x, structure.y, w, TILE_SIZE);
      g.lineStyle(1, 0xE8DCC8, 0.6);
      g.strokeRect(structure.x, structure.y, w, TILE_SIZE);
      this.addToWorld(g);
      this.structureSprites.push(g);

      // Short name label so player can identify structures
      const shortName = (data?.name ?? structure.structureId).split(' ').map(s => s[0]).join('');
      const label = this.add.text(
        structure.x + w / 2,
        structure.y + TILE_SIZE / 2,
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
    this.apBar = new ActionPointBar(this, this.currentAP, () => this.toggleDebugMenu());
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
    let yPos = 54;

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

    const label = this.add.text(GAME_WIDTH - 16, 42, 'ZONE:', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#6B6B6B',
    }).setOrigin(1, 0).setDepth(100);
    this.addToUI(label);
  }

  private createBuildMenu(): void {
    this.buildMenu = new BuildMenu(
      this,
      this.buildingManager,
      () => this.currentAP,
      () => AP_PER_DAY,
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
    // what area will be affected.
    if (this.ghostGraphics) {
      this.ghostGraphics.destroy();
    }
    const color = STRUCTURE_COLORS[structureId] ?? 0x888888;
    const structData = this.buildingManager.getStructureData(structureId);

    // Determine ghost pixel dimensions from structure data.
    // Priority: widthTiles field -> zoneRadius field -> default 1 tile.
    let ghostW = TILE_SIZE;
    const ghostH = TILE_SIZE;
    if (structData) {
      if (structData.widthTiles && structData.widthTiles > 1) {
        ghostW = structData.widthTiles * TILE_SIZE;
        // Height stays 1 tile -- these are wide structures, not squares
      }
    }

    this.ghostGraphics = this.add.graphics();
    this.ghostGraphics.fillStyle(color, 0.5);
    this.ghostGraphics.fillRect(0, 0, ghostW, ghostH);
    this.ghostGraphics.lineStyle(2, 0xFFD700, 0.9);
    this.ghostGraphics.strokeRect(0, 0, ghostW, ghostH);
    this.ghostGraphics.setDepth(50);
    this.addToWorld(this.ghostGraphics);

    // Keep build menu visible so player can switch structures or close to exit
    const data = this.buildingManager.getStructureData(structureId);
    this.showInfo(`Click to place ${data?.name ?? structureId}. ESC/right-click to cancel.`);
  }

  private cancelPlacement(): void {
    this.placementMode = false;
    this.placementStructureId = null;
    if (this.ghostGraphics) {
      this.ghostGraphics.destroy();
      this.ghostGraphics = null;
    }
  }

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.cancelPlacement();
        this.closeStructurePopup();
        return;
      }

      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const gridX = Math.floor(worldPoint.x / TILE_SIZE) * TILE_SIZE;
      const gridY = Math.floor(worldPoint.y / TILE_SIZE) * TILE_SIZE;

      if (this.placementMode && this.placementStructureId) {
        // Skip the click that opened placement mode (same pointer event)
        if (this.placementJustStarted) {
          return;
        }
        this.placeStructure(this.placementStructureId, gridX, gridY);
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

        // 4. Placement mode
        if (this.placementMode) {
          if (key === 'Escape') {
            this.cancelPlacement();
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

    const prompt = this.add.text(GAME_WIDTH / 2, py + 20, 'End day and start night?', {
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

    const yesBtn = this.add.text(GAME_WIDTH / 2 - 50, py + 72, '[ YES ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#4CAF50',
    }).setOrigin(1, 0).setDepth(252).setInteractive({ useHandCursor: true });
    yesBtn.on('pointerover', () => yesBtn.setColor('#FFD700'));
    yesBtn.on('pointerout', () => yesBtn.setColor('#4CAF50'));
    yesBtn.on('pointerdown', () => { dismiss(); this.endDay(); });
    this.addToUI(yesBtn);

    const noBtn = this.add.text(GAME_WIDTH / 2 + 50, py + 72, '[ NO ]', {
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

  private placeStructure(structureId: string, x: number, y: number): void {
    const result = this.buildingManager.place(structureId, x, y, this.currentAP);

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
        this.showInfo('Not enough AP!');
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
    const sellBtn = this.add.text(8, sellY, '[ SELL ]', {
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

  /** Create the base level and upgrade UI in the top bar (right side) */
  private createBaseUpgradeUI(): void {
    const levelData = this.getBaseLevelData();
    const next = this.getNextBaseLevelData();

    // Base name label
    const baseLabel = this.add.text(GAME_WIDTH - 16, 6, levelData.name, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#E8DCC8',
    }).setOrigin(1, 0).setDepth(100);
    this.addToUI(baseLabel);

    // Upgrade button below the label (or MAX indicator)
    if (next && next.cost) {
      const costStr = Object.entries(next.cost).map(([r, n]) => `${n} ${r}`).join(', ');
      this.baseUpgradeBtn = createUIButton(
        this,
        GAME_WIDTH - 16,
        20,
        `UPGRADE (${costStr})`,
        '#4CAF50',
        () => this.upgradeBase(),
        1,
      );
      this.baseUpgradeBtn.setDepth(100);
      this.addToUI(this.baseUpgradeBtn);
    } else {
      const maxText = this.add.text(GAME_WIDTH - 16, 20, 'MAX', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#6B6B6B',
      }).setOrigin(1, 0).setDepth(100);
      this.addToUI(maxText);
      // Assign a dummy container so updateBaseUpgradeUI can destroy it
      this.baseUpgradeBtn = this.add.container(0, 0);
      this.addToUI(this.baseUpgradeBtn);
    }
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
      this.showInfo(`Not enough food! ${foodResult.missing} refugees starving.`);
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
      this.showInfo('Not enough AP!');
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
      { title: 'DAY PHASE', text: 'You have 12 Action Points\nto prepare for the night.' },
      { title: 'BUILD', text: 'Use the BUILD menu to place\nbarricades, walls and traps\naround your base.' },
      { title: 'AMMO', text: 'Ammo is loaded AUTOMATICALLY\nat the start of each night.\nCollect more ammo via LOOT runs.' },
      { title: 'LOOT RUNS', text: 'Send expeditions to find\nscrap, food, ammo and meds.\nCosts 3-5 AP.' },
      { title: 'END DAY', text: 'When ready, press END DAY.\nNight begins immediately.\nGood luck.' },
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

    addButton('[CLOSE]', () => { this.toggleDebugMenu(); });
  }
}

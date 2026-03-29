import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager';
import { BuildingManager, type StructureData } from '../systems/BuildingManager';
import { WeaponManager } from '../systems/WeaponManager';
import { RefugeeManager } from '../systems/RefugeeManager';
import { loadAmmo } from '../systems/AmmoLoader';
import { ActionPointBar } from '../ui/ActionPointBar';
import { WeaponPanel } from '../ui/WeaponPanel';
import { RefugeePanel } from '../ui/RefugeePanel';
import { LootRunPanel } from '../ui/LootRunPanel';
import { LootManager } from '../systems/LootManager';
import { TILE_SIZE, GAME_WIDTH, GAME_HEIGHT, AP_PER_DAY, XP_PER_BUILD, DEFAULT_RESOURCE_CAP, STORAGE_CAP_BONUS } from '../config/constants';
import { SkillManager } from '../systems/SkillManager';
import { SkillPanel } from '../ui/SkillPanel';
import type { GameState, StructureInstance, ResourceType } from '../config/types';
import structuresJson from '../data/structures.json';
import baseLevelsJson from '../data/base-levels.json';

const MAP_WIDTH = 40;  // tiles
const MAP_HEIGHT = 30; // tiles

// Structure colors for rendering placed structures
const STRUCTURE_COLORS: Record<string, number> = {
  barricade: 0x8B6914,
  wall: 0x6B6B6B,
  trap: 0xCC3333,
  pillbox: 0x4A6741,
  storage: 0x7B6B3A,
  shelter: 0x5A4A3A,
  farm: 0x3A6B3A,
};

export class DayScene extends Phaser.Scene {
  private gameState!: GameState;
  private buildingManager!: BuildingManager;
  private weaponManager!: WeaponManager;
  private weaponPanel!: WeaponPanel;
  private skillManager!: SkillManager;
  private skillPanel!: SkillPanel;
  private refugeeManager!: RefugeeManager;
  private refugeePanel!: RefugeePanel;
  private lootManager!: LootManager;
  private lootRunPanel!: LootRunPanel;
  private apBar!: ActionPointBar;
  private currentAP!: number;
  private mapContainer!: Phaser.GameObjects.Container;
  private structureSprites: Phaser.GameObjects.Graphics[] = [];

  // Placement mode state
  private placementMode: boolean = false;
  private placementStructureId: string | null = null;
  private ghostGraphics: Phaser.GameObjects.Graphics | null = null;
  private placementJustStarted: boolean = false;

  // UI camera -- fixed at (0,0), never scrolls.
  // All UI elements are assigned here so their interactive zones
  // always match their visual positions regardless of main camera scroll.
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;

  // UI elements
  private buildMenuContainer!: Phaser.GameObjects.Container;
  private buildMenuVisible: boolean = false;
  private structurePopup: Phaser.GameObjects.Container | null = null;
  private infoText!: Phaser.GameObjects.Text;
  private resourceText!: Phaser.GameObjects.Text;
  private baseUpgradeText!: Phaser.GameObjects.Text;
  private baseTentGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'DayScene' });
  }

  create(): void {
    this.gameState = SaveManager.load();
    this.currentAP = AP_PER_DAY;

    // Load structure data and create BuildingManager
    const structureList = structuresJson.structures as unknown as StructureData[];
    this.buildingManager = new BuildingManager(this, this.gameState, structureList);

    this.placementMode = false;
    this.placementStructureId = null;
    this.structureSprites = [];

    // Fade in from black (night-to-day transition)
    this.cameras.main.setBackgroundColor('#3A5A2A');
    this.cameras.main.fadeIn(800, 0, 0, 0);

    this.createMap();
    this.renderPlacedStructures();
    this.setupCameras();

    // UI layer (created after cameras so addToUI works)
    this.apBar = new ActionPointBar(this, this.currentAP);
    this.addToUI(this.apBar.getContainer());
    this.createResourceDisplay();
    this.createEndDayButton();
    this.createBuildButton();
    this.createLoadAmmoButton();
    this.createBuildMenu();
    this.createWeaponsButton();
    this.createSkillButton();
    this.createRefugeesButton();
    this.createLootRunButton();
    this.createBaseUpgradeUI();
    this.createInfoText();

    // Weapon system
    this.weaponManager = new WeaponManager(this, this.gameState);
    this.weaponPanel = new WeaponPanel(
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
    this.addToUI(this.weaponPanel.getContainer());

    // Skill system
    this.skillManager = new SkillManager(this, this.gameState);
    this.skillPanel = new SkillPanel(this, this.skillManager);
    this.addToUI(this.skillPanel.getContainer());

    // Refugee system
    this.refugeeManager = new RefugeeManager(this, this.gameState);
    this.refugeePanel = new RefugeePanel(this, this.refugeeManager);
    this.addToUI(this.refugeePanel.getContainer());

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
    this.addToUI(this.lootRunPanel.getEncounterContainer());

    // Listen for looting XP awards
    this.events.on('award-looting-xp', (xp: number) => {
      this.skillManager.addXP('looting', xp);
    });

    // Listen for rescued refugees from loot runs
    this.events.on('refugee-rescued', () => {
      const newRefugee = this.refugeeManager.addRefugee();
      if (newRefugee) {
        this.showInfo(`Rescued ${newRefugee.name} during loot run!`);
      }
    });

    // Day-start processing: food consumption, healing, random arrival
    this.processDayStart();

    this.setupInput();

    this.events.emit('day-started', this.gameState.progress.currentWave);
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
    const mapPixelWidth = MAP_WIDTH * TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT * TILE_SIZE;

    this.mapContainer = this.add.container(0, 0);

    // Ground (lighter green for daytime)
    const ground = this.add.graphics();
    ground.fillStyle(0x3A6B2A);
    ground.fillRect(0, 0, mapPixelWidth, mapPixelHeight);
    this.mapContainer.add(ground);

    // Grid overlay to help with placement
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x2D5A22, 0.3);
    for (let x = 0; x <= mapPixelWidth; x += TILE_SIZE) {
      grid.lineBetween(x, 0, x, mapPixelHeight);
    }
    for (let y = 0; y <= mapPixelHeight; y += TILE_SIZE) {
      grid.lineBetween(0, y, mapPixelWidth, y);
    }
    this.mapContainer.add(grid);

    // Horizontal road through the middle
    const roadY = Math.floor(MAP_HEIGHT / 2) * TILE_SIZE;
    const road = this.add.graphics();
    road.fillStyle(0x6B5A43);
    road.fillRect(0, roadY - TILE_SIZE, mapPixelWidth, TILE_SIZE * 2);
    this.mapContainer.add(road);

    // Road markings
    const markings = this.add.graphics();
    markings.fillStyle(0x8B7B5B);
    for (let x = 0; x < mapPixelWidth; x += TILE_SIZE * 2) {
      markings.fillRect(x + 8, roadY - 2, TILE_SIZE - 8, 4);
    }
    this.mapContainer.add(markings);

    // Base in center -- visual depends on base level
    const centerX = mapPixelWidth / 2;
    const centerY = mapPixelHeight / 2;
    this.baseTentGraphics = this.add.graphics();
    this.drawBaseTent(this.baseTentGraphics, centerX, centerY);
    this.mapContainer.add(this.baseTentGraphics);

    const baseLevelData = this.getBaseLevelData();
    this.add.text(centerX, centerY - (baseLevelData.visual.size / 2) - 8, 'BASE', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#E8DCC8',
    }).setOrigin(0.5);

    this.physics.world.setBounds(0, 0, mapPixelWidth, mapPixelHeight);
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
    const color = STRUCTURE_COLORS[structure.structureId] ?? 0x888888;
    const g = this.add.graphics();
    g.fillStyle(color);
    g.fillRect(structure.x, structure.y, TILE_SIZE, TILE_SIZE);
    g.lineStyle(1, 0xE8DCC8, 0.6);
    g.strokeRect(structure.x, structure.y, TILE_SIZE, TILE_SIZE);
    this.addToWorld(g);

    // Level indicator
    if (structure.level > 1) {
      const lvlText = this.add.text(
        structure.x + TILE_SIZE / 2,
        structure.y + TILE_SIZE / 2,
        `${structure.level}`,
        { fontFamily: 'monospace', fontSize: '10px', color: '#FFFFFF' }
      ).setOrigin(0.5);
      lvlText.setDepth(5);
      this.addToWorld(lvlText);
    }

    this.structureSprites.push(g);
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

    // Day indicator (UI element)
    const dayText = this.add.text(GAME_WIDTH / 2, 16, `DAY ${this.gameState.progress.currentWave}`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#E8DCC8',
    }).setOrigin(0.5).setDepth(100);
    this.addToUI(dayText);
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

  private createResourceDisplay(): void {
    const res = this.gameState.inventory.resources;
    const cap = this.getResourceCap();
    const text = `Scrap: ${res.scrap}/${cap}  Food: ${res.food}/${cap}  Ammo: ${res.ammo}/${cap}  Parts: ${res.parts}/${cap}  Meds: ${res.meds}/${cap}`;
    this.resourceText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 16, text, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#E8DCC8',
    }).setOrigin(0.5).setDepth(100);
    this.addToUI(this.resourceText);
  }

  private updateResourceDisplay(): void {
    this.enforceResourceCaps();
    const res = this.gameState.inventory.resources;
    const cap = this.getResourceCap();
    const text = `Scrap: ${res.scrap}/${cap}  Food: ${res.food}/${cap}  Ammo: ${res.ammo}/${cap}  Parts: ${res.parts}/${cap}  Meds: ${res.meds}/${cap}`;
    this.resourceText.setText(text);
  }

  private createEndDayButton(): void {
    const btn = this.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 40, '[ END DAY ]', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#D4620B',
    }).setOrigin(1, 1).setDepth(100).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#FFD700'));
    btn.on('pointerout', () => btn.setColor('#D4620B'));
    btn.on('pointerdown', () => this.endDay());
    this.addToUI(btn);
  }

  private createBuildButton(): void {
    const btn = this.add.text(16, GAME_HEIGHT - 40, '[ BUILD ]', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#4CAF50',
    }).setOrigin(0, 1).setDepth(100).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#FFD700'));
    btn.on('pointerout', () => btn.setColor('#4CAF50'));
    btn.on('pointerdown', () => this.toggleBuildMenu());
    this.addToUI(btn);
  }

  private createLoadAmmoButton(): void {
    const btn = this.add.text(130, GAME_HEIGHT - 40, '[ LOAD AMMO ]', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#4A90D9',
    }).setOrigin(0, 1).setDepth(100).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#FFD700'));
    btn.on('pointerout', () => btn.setColor('#4A90D9'));
    btn.on('pointerdown', () => {
      if (this.currentAP < 1) {
        this.showInfo('Not enough AP!');
        return;
      }
      const result = loadAmmo(this.gameState, 1);
      if (result.success) {
        this.currentAP -= 1;
        this.apBar.update(this.currentAP);
        this.updateResourceDisplay();
        this.showInfo(result.message);
      } else {
        this.showInfo(result.message);
      }
    });
    this.addToUI(btn);
  }

  private createWeaponsButton(): void {
    const btn = this.add.text(290, GAME_HEIGHT - 40, '[ WEAPONS ]', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#C5A030',
    }).setOrigin(0, 1).setDepth(100).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#FFD700'));
    btn.on('pointerout', () => btn.setColor('#C5A030'));
    btn.on('pointerdown', () => this.weaponPanel.toggle());
    this.addToUI(btn);
  }

  private createSkillButton(): void {
    const btn = this.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 40, '[ SKILLS ]', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#C5A030',
    }).setOrigin(1, 0).setDepth(100).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#FFD700'));
    btn.on('pointerout', () => btn.setColor('#C5A030'));
    btn.on('pointerdown', () => this.skillPanel.toggle());
    this.addToUI(btn);
  }

  private createRefugeesButton(): void {
    const btn = this.add.text(430, GAME_HEIGHT - 40, '[ REFUGEES ]', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#8B6FC0',
    }).setOrigin(0, 1).setDepth(100).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#FFD700'));
    btn.on('pointerout', () => btn.setColor('#8B6FC0'));
    btn.on('pointerdown', () => this.refugeePanel.toggle());
    this.addToUI(btn);
  }

  private createLootRunButton(): void {
    const btn = this.add.text(570, GAME_HEIGHT - 40, '[ LOOT RUN ]', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#D4A030',
    }).setOrigin(0, 1).setDepth(100).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#FFD700'));
    btn.on('pointerout', () => btn.setColor('#D4A030'));
    btn.on('pointerdown', () => this.lootRunPanel.toggle());
    this.addToUI(btn);
  }

  private createBuildMenu(): void {
    this.buildMenuContainer = this.add.container(16, 80);
    this.buildMenuContainer.setDepth(110);
    this.buildMenuContainer.setVisible(false);

    const baseLevelData = this.getBaseLevelData();
    const unlockedIds = baseLevelData.unlockedStructures as string[];
    const availableStructures = this.buildingManager.getAvailableStructures(unlockedIds);
    const lockedStructures = this.buildingManager.getLockedStructures(unlockedIds);
    const totalEntries = availableStructures.length + lockedStructures.length;

    // Background panel
    const bg = this.add.graphics();
    bg.fillStyle(0x1A1A2E, 0.9);
    bg.fillRect(0, 0, 220, totalEntries * 40 + 16);
    bg.lineStyle(1, 0x6B6B6B);
    bg.strokeRect(0, 0, 220, totalEntries * 40 + 16);
    this.buildMenuContainer.add(bg);

    // Available structure entries
    let entryIndex = 0;
    availableStructures.forEach((s) => {
      const y = 8 + entryIndex * 40;
      const canAfford = this.buildingManager.canAfford(s.id);
      const hasAP = this.buildingManager.hasEnoughAP(s.id, this.currentAP);
      const available = canAfford && hasAP;

      const costStr = Object.entries(s.cost).map(([r, n]) => `${n} ${r}`).join(', ');
      const color = available ? '#E8DCC8' : '#6B6B6B';

      const entry = this.add.text(8, y, `${s.name} (${s.apCost} AP)\n  ${costStr}`, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: color,
      });

      if (available) {
        entry.setInteractive({ useHandCursor: true });
        entry.on('pointerover', () => entry.setColor('#FFD700'));
        entry.on('pointerout', () => entry.setColor('#E8DCC8'));
        entry.on('pointerdown', () => this.startPlacement(s.id));
      }

      this.buildMenuContainer.add(entry);
      entryIndex++;
    });

    // Locked structure entries (greyed out with required level)
    lockedStructures.forEach((s) => {
      const y = 8 + entryIndex * 40;
      // Find which level unlocks this structure
      const requiredLevel = baseLevelsJson.baseLevels.find(
        bl => (bl.unlockedStructures as string[]).includes(s.id)
      );
      const requiredName = requiredLevel?.name ?? '???';

      const entry = this.add.text(8, y, `${s.name} [Requires ${requiredName}]`, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#4A4A4A',
      });

      this.buildMenuContainer.add(entry);
      entryIndex++;
    });

    this.addToUI(this.buildMenuContainer);
  }

  private refreshBuildMenu(): void {
    // Destroy and recreate to update affordability
    this.buildMenuContainer.destroy();
    this.createBuildMenu();
    if (this.buildMenuVisible) {
      this.buildMenuContainer.setVisible(true);
    }
  }

  private createInfoText(): void {
    this.infoText = this.add.text(GAME_WIDTH / 2, 50, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#C5A030',
    }).setOrigin(0.5).setDepth(100);
    this.addToUI(this.infoText);
  }

  private showInfo(msg: string): void {
    this.infoText.setText(msg);
    this.infoText.setAlpha(1);
    this.tweens.add({
      targets: this.infoText,
      alpha: 0,
      delay: 1500,
      duration: 1000,
      ease: 'Power2',
    });
  }

  private toggleBuildMenu(): void {
    this.buildMenuVisible = !this.buildMenuVisible;
    if (this.buildMenuVisible) {
      this.refreshBuildMenu();
    }
    this.buildMenuContainer.setVisible(this.buildMenuVisible);

    if (!this.buildMenuVisible) {
      this.cancelPlacement();
    }
  }

  private startPlacement(structureId: string): void {
    this.placementMode = true;
    this.placementStructureId = structureId;
    // Prevent the same click that selected the menu item from placing the structure
    this.placementJustStarted = true;

    // Create ghost preview (world-space element, only on main camera)
    if (this.ghostGraphics) {
      this.ghostGraphics.destroy();
    }
    const color = STRUCTURE_COLORS[structureId] ?? 0x888888;
    this.ghostGraphics = this.add.graphics();
    this.ghostGraphics.fillStyle(color, 0.5);
    this.ghostGraphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    this.ghostGraphics.lineStyle(1, 0xFFD700, 0.8);
    this.ghostGraphics.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
    this.ghostGraphics.setDepth(50);
    this.addToWorld(this.ghostGraphics);

    this.buildMenuContainer.setVisible(false);
    this.buildMenuVisible = false;
    const data = this.buildingManager.getStructureData(structureId);
    this.showInfo(`Click to place ${data?.name ?? structureId}. Right-click to cancel.`);
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
          this.placementJustStarted = false;
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
    }

    // Right click to cancel placement
    if (this.input.mouse) {
      this.input.mouse.disableContextMenu();
    }
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

      const data = this.buildingManager.getStructureData(structureId);
      this.showInfo(`${data?.name ?? 'Structure'} placed!`);
      this.cancelPlacement();
    } else {
      // Determine reason for failure
      const data = this.buildingManager.getStructureData(structureId);
      if (!data) return;

      if (!this.buildingManager.hasEnoughAP(structureId, this.currentAP)) {
        this.showInfo('Not enough AP!');
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

    // Convert structure world position to screen position for the popup
    const cam = this.cameras.main;
    const popupX = instance.x - cam.scrollX + TILE_SIZE + 8;
    const popupY = instance.y - cam.scrollY;

    this.structurePopup = this.add.container(popupX, popupY);
    this.structurePopup.setDepth(120);

    const bg = this.add.graphics();
    bg.fillStyle(0x1A1A2E, 0.95);
    bg.fillRect(0, 0, 160, 90);
    bg.lineStyle(1, 0x6B6B6B);
    bg.strokeRect(0, 0, 160, 90);
    this.structurePopup.add(bg);

    // Structure info
    const info = this.add.text(8, 6, `${data.name} Lv${instance.level}\nHP: ${instance.hp}/${instance.maxHp}`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#E8DCC8',
    });
    this.structurePopup.add(info);

    // Upgrade button (if not max level)
    if (instance.level < data.maxLevel) {
      const canUpgrade = this.buildingManager.canAfford(instance.structureId)
        && this.buildingManager.hasEnoughAP(instance.structureId, this.currentAP);
      const upgradeColor = canUpgrade ? '#4CAF50' : '#6B6B6B';

      const upgradeBtn = this.add.text(8, 48, '[ UPGRADE ]', {
        fontFamily: 'monospace',
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
            this.showInfo(`${data.name} upgraded to Lv${instance.level}!`);
          }
        });
      }
      this.structurePopup.add(upgradeBtn);
    }

    // Sell button
    const sellBtn = this.add.text(8, 68, '[ SELL ]', {
      fontFamily: 'monospace',
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

  /** Create the base level and upgrade UI */
  private createBaseUpgradeUI(): void {
    const levelData = this.getBaseLevelData();
    const next = this.getNextBaseLevelData();

    let text = `BASE: ${levelData.name}`;
    if (next && next.cost) {
      const costStr = Object.entries(next.cost).map(([r, n]) => `${n} ${r}`).join(', ');
      text += ` [UPGRADE to ${next.name} -- ${costStr}, ${next.apCost ?? 0} AP]`;
    } else {
      text += ' [MAX]';
    }

    this.baseUpgradeText = this.add.text(GAME_WIDTH / 2, 30, text, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: next ? '#4CAF50' : '#6B6B6B',
    }).setOrigin(0.5).setDepth(100);

    if (next) {
      this.baseUpgradeText.setInteractive({ useHandCursor: true });
      this.baseUpgradeText.on('pointerover', () => this.baseUpgradeText.setColor('#FFD700'));
      this.baseUpgradeText.on('pointerout', () => this.baseUpgradeText.setColor('#4CAF50'));
      this.baseUpgradeText.on('pointerdown', () => this.upgradeBase());
    }

    this.addToUI(this.baseUpgradeText);
  }

  /** Refresh the base upgrade UI text after an upgrade */
  private updateBaseUpgradeUI(): void {
    this.baseUpgradeText.destroy();
    this.createBaseUpgradeUI();

    // Redraw base tent visual
    const mapPixelWidth = MAP_WIDTH * TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT * TILE_SIZE;
    this.drawBaseTent(this.baseTentGraphics, mapPixelWidth / 2, mapPixelHeight / 2);

    // Refresh build menu to show newly unlocked structures
    this.refreshBuildMenu();
  }

  private processDayStart(): void {
    // Farm production: each farm produces foodPerDay
    const farmFood = this.getFarmProduction();
    if (farmFood > 0) {
      this.gameState.inventory.resources.food += farmFood;
      this.enforceResourceCaps();
      this.showInfo(`Farms produced +${farmFood} food`);
    }

    // Food consumption
    const foodResult = this.refugeeManager.consumeFood();
    if (foodResult.missing > 0) {
      this.showInfo(`Not enough food! ${foodResult.missing} refugees starving.`);
    }

    // Heal injured refugees on rest
    const healed = this.refugeeManager.processHealing();
    if (healed.length > 0) {
      this.showInfo(healed.join(', '));
    }

    // Random refugee arrival
    const newRefugee = this.refugeeManager.tryRandomArrival();
    if (newRefugee) {
      this.showInfo(`${newRefugee.name} arrived at camp!`);
    }

    this.updateResourceDisplay();
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
    // Process refugee gathering before saving
    const gathering = this.refugeeManager.processGathering();
    if (gathering.food > 0 || gathering.scrap > 0 || gathering.repaired > 0) {
      const parts: string[] = [];
      if (gathering.food > 0) parts.push(`+${gathering.food} food`);
      if (gathering.scrap > 0) parts.push(`+${gathering.scrap} scrap`);
      if (gathering.repaired > 0) parts.push(`${gathering.repaired} HP repaired`);
      console.log(`Refugee gathering: ${parts.join(', ')}`);
    }

    // Sync all systems back to game state before saving
    this.refugeeManager.syncToState();
    this.skillManager.syncToState(this.gameState);
    SaveManager.save(this.gameState);

    // Fade out to night
    this.cameras.main.fadeOut(800, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('NightScene');
    });
  }
}

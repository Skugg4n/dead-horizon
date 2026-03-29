// Dead Horizon -- Loot run panel UI for DayScene
// Shows destinations, weapon/companion selection, and loot results

import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants';
import { LootManager, type LootDestination, type LootResult } from '../systems/LootManager';
import { EncounterDialog } from './EncounterDialog';
import type { GameState, WeaponInstance, RefugeeInstance, ResourceType } from '../config/types';

const PANEL_WIDTH = 360;
const PANEL_X = (GAME_WIDTH - PANEL_WIDTH) / 2;
const PANEL_Y = 40;

type PanelState = 'destinations' | 'configure' | 'results';

export class LootRunPanel {
  private scene: Phaser.Scene;
  private lootManager: LootManager;
  private gameState: GameState;
  private container: Phaser.GameObjects.Container;
  private encounterDialog: EncounterDialog;
  private visible: boolean = false;

  // Current AP accessors
  private currentAP: () => number;
  private spendAP: (cost: number) => void;
  private onResourceChange: () => void;

  // Selection state
  private selectedDestination: LootDestination | null = null;
  private selectedWeapons: WeaponInstance[] = [];
  private selectedCompanions: RefugeeInstance[] = [];
  private panelState: PanelState = 'destinations';

  constructor(
    scene: Phaser.Scene,
    lootManager: LootManager,
    gameState: GameState,
    currentAP: () => number,
    spendAP: (cost: number) => void,
    onResourceChange: () => void,
  ) {
    this.scene = scene;
    this.lootManager = lootManager;
    this.gameState = gameState;
    this.currentAP = currentAP;
    this.spendAP = spendAP;
    this.onResourceChange = onResourceChange;

    this.container = scene.add.container(PANEL_X, PANEL_Y);
    this.container.setDepth(130);
    this.container.setVisible(false);

    this.encounterDialog = new EncounterDialog(scene);
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  getEncounterContainer(): Phaser.GameObjects.Container {
    return this.encounterDialog.getContainer();
  }

  toggle(): void {
    this.visible = !this.visible;
    if (this.visible) {
      this.panelState = 'destinations';
      this.selectedDestination = null;
      this.selectedWeapons = [];
      this.selectedCompanions = [];
      this.rebuild();
    }
    this.container.setVisible(this.visible);
  }

  isVisible(): boolean {
    return this.visible;
  }

  private rebuild(): void {
    this.container.removeAll(true);

    switch (this.panelState) {
      case 'destinations':
        this.buildDestinationList();
        break;
      case 'configure':
        this.buildConfigureScreen();
        break;
      case 'results':
        // Results are shown via encounter dialog or inline
        break;
    }
  }

  private buildDestinationList(): void {
    const destinations = this.lootManager.getDestinations();
    const panelHeight = destinations.length * 60 + 50;

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1A1A2E, 0.92);
    bg.fillRect(0, 0, PANEL_WIDTH, panelHeight);
    bg.lineStyle(1, 0x6B6B6B);
    bg.strokeRect(0, 0, PANEL_WIDTH, panelHeight);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(PANEL_WIDTH / 2, 8, 'LOOT RUNS', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '13px',
      color: '#FFD700',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Close button
    const closeBtn = this.scene.add.text(PANEL_WIDTH - 12, 8, 'X', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '12px',
      color: '#F44336',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.toggle());
    this.container.add(closeBtn);

    // Destination entries
    destinations.forEach((dest, i) => {
      const y = 32 + i * 60;
      const hasAP = this.currentAP() >= dest.apCost;
      const color = hasAP ? '#E8DCC8' : '#6B6B6B';

      // Destination name and cost
      const nameText = this.scene.add.text(12, y, `${dest.name}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '11px',
        color,
      });
      this.container.add(nameText);

      const apText = this.scene.add.text(PANEL_WIDTH - 12, y, `${dest.apCost} AP`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '11px',
        color: hasAP ? '#4CAF50' : '#F44336',
      }).setOrigin(1, 0);
      this.container.add(apText);

      // Details
      const encounterPct = Math.round(dest.encounterChance * 100);
      const lootNames = dest.loot.map(l => l.resource).join(', ');
      const detailText = this.scene.add.text(12, y + 16, `Encounter: ${encounterPct}%  |  Loot: ${lootNames}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#6B6B6B',
      });
      this.container.add(detailText);

      // Select button
      if (hasAP) {
        const selectBtn = this.scene.add.text(12, y + 32, '[ SELECT ]', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '10px',
          color: '#4A90D9',
        }).setInteractive({ useHandCursor: true });
        selectBtn.on('pointerover', () => selectBtn.setColor('#FFD700'));
        selectBtn.on('pointerout', () => selectBtn.setColor('#4A90D9'));
        selectBtn.on('pointerdown', () => {
          this.selectedDestination = dest;
          this.selectedWeapons = [];
          this.selectedCompanions = [];
          this.panelState = 'configure';
          this.rebuild();
        });
        this.container.add(selectBtn);
      }
    });
  }

  private buildConfigureScreen(): void {
    if (!this.selectedDestination) return;

    const weapons = this.gameState.inventory.weapons;
    const healthyRefugees = this.gameState.refugees.filter(
      r => r.status === 'healthy' && r.job !== 'loot_run'
    );

    const weaponRows = weapons.length;
    const refugeeRows = healthyRefugees.length;
    const panelHeight = 90 + weaponRows * 20 + refugeeRows * 20 + 60;

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1A1A2E, 0.92);
    bg.fillRect(0, 0, PANEL_WIDTH, panelHeight);
    bg.lineStyle(1, 0x6B6B6B);
    bg.strokeRect(0, 0, PANEL_WIDTH, panelHeight);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(PANEL_WIDTH / 2, 8, `PREPARE: ${this.selectedDestination.name}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '11px',
      color: '#FFD700',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Back button
    const backBtn = this.scene.add.text(12, 8, '< BACK', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#D4620B',
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => {
      this.panelState = 'destinations';
      this.rebuild();
    });
    this.container.add(backBtn);

    let yOffset = 30;

    // Weapons section
    const weaponLabel = this.scene.add.text(12, yOffset, 'Weapons to bring:', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#C5A030',
    });
    this.container.add(weaponLabel);
    yOffset += 16;

    if (weapons.length === 0) {
      const noWeapons = this.scene.add.text(20, yOffset, '(no weapons)', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#6B6B6B',
      });
      this.container.add(noWeapons);
      yOffset += 20;
    } else {
      for (const weapon of weapons) {
        const isSelected = this.selectedWeapons.some(w => w.id === weapon.id);
        const marker = isSelected ? '[x]' : '[ ]';
        const color = isSelected ? '#4CAF50' : '#E8DCC8';

        const entry = this.scene.add.text(20, yOffset, `${marker} ${weapon.weaponId} (DMG: ${this.getWeaponDisplayDamage(weapon)})`, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '9px',
          color,
        }).setInteractive({ useHandCursor: true });

        entry.on('pointerdown', () => {
          if (isSelected) {
            this.selectedWeapons = this.selectedWeapons.filter(w => w.id !== weapon.id);
          } else {
            this.selectedWeapons.push(weapon);
          }
          this.rebuild();
        });

        this.container.add(entry);
        yOffset += 20;
      }
    }

    // Companions section
    yOffset += 6;
    const companionLabel = this.scene.add.text(12, yOffset, 'Companions:', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#C5A030',
    });
    this.container.add(companionLabel);
    yOffset += 16;

    if (healthyRefugees.length === 0) {
      const noRefugees = this.scene.add.text(20, yOffset, '(no healthy refugees available)', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#6B6B6B',
      });
      this.container.add(noRefugees);
      yOffset += 20;
    } else {
      for (const refugee of healthyRefugees) {
        const isSelected = this.selectedCompanions.some(c => c.id === refugee.id);
        const marker = isSelected ? '[x]' : '[ ]';
        const color = isSelected ? '#4CAF50' : '#E8DCC8';

        const entry = this.scene.add.text(20, yOffset, `${marker} ${refugee.name} (${refugee.skillBonus})`, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '9px',
          color,
        }).setInteractive({ useHandCursor: true });

        entry.on('pointerdown', () => {
          if (isSelected) {
            this.selectedCompanions = this.selectedCompanions.filter(c => c.id !== refugee.id);
          } else {
            this.selectedCompanions.push(refugee);
          }
          this.rebuild();
        });

        this.container.add(entry);
        yOffset += 20;
      }
    }

    // Strength preview
    yOffset += 8;
    const strength = this.lootManager.calculateStrength(this.selectedWeapons, this.selectedCompanions.length);
    const strengthText = this.scene.add.text(12, yOffset, `Combat strength: ${strength}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#E8DCC8',
    });
    this.container.add(strengthText);
    yOffset += 20;

    // GO button
    const goBtn = this.scene.add.text(PANEL_WIDTH / 2, yOffset, '[ GO ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#4CAF50',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    goBtn.on('pointerover', () => goBtn.setColor('#FFD700'));
    goBtn.on('pointerout', () => goBtn.setColor('#4CAF50'));
    goBtn.on('pointerdown', () => this.startRun());
    this.container.add(goBtn);
  }

  private getWeaponDisplayDamage(weapon: WeaponInstance): number {
    return this.lootManager.calculateStrength([weapon], 0);
  }

  private startRun(): void {
    if (!this.selectedDestination) return;

    // Check AP
    if (this.currentAP() < this.selectedDestination.apCost) {
      return;
    }

    // Spend AP
    this.spendAP(this.selectedDestination.apCost);

    // Mark companions as 'away'
    for (const companion of this.selectedCompanions) {
      const refugee = this.gameState.refugees.find(r => r.id === companion.id);
      if (refugee) {
        refugee.status = 'away';
        refugee.job = 'loot_run';
      }
    }

    // Execute the loot run
    const result = this.lootManager.executeLootRun(this.selectedDestination.id);

    if (result.encounter) {
      // Show encounter dialog
      this.container.setVisible(false);
      const strength = this.lootManager.calculateStrength(this.selectedWeapons, this.selectedCompanions.length);
      const thresholds: Record<string, number> = {
        nearby_houses: 50,
        abandoned_store: 70,
        military_outpost: 100,
      };
      const threshold = thresholds[this.selectedDestination.id] ?? 50;

      this.encounterDialog.show(strength, threshold, (choice) => {
        if (choice === 'fight') {
          this.lootManager.resolveFight(result, this.selectedWeapons, this.selectedCompanions);
        } else {
          this.lootManager.resolveFlee(result);
        }
        this.showEncounterResult(result);
      });
    } else {
      // No encounter, show results directly
      this.showLootResults(result);
    }
  }

  private showEncounterResult(result: LootResult): void {
    let details = '';

    if (result.encounterOutcome === 'win') {
      details = 'You fought and won! Loot multiplied by 1.5x.';
      if (result.rescuedRefugee) {
        details += '\nYou rescued a survivor who joins your camp!';
      }
    } else if (result.encounterOutcome === 'lose') {
      details = 'You were overwhelmed. All loot lost.';
      if (result.injuredCompanions.length > 0) {
        details += `\n${result.injuredCompanions.length} companion(s) were injured.`;
      }
    } else if (result.encounterOutcome === 'flee') {
      details = 'You fled safely, but dropped some loot.';
    }

    this.encounterDialog.showResult(
      result.encounterOutcome as 'win' | 'lose' | 'flee',
      details,
      () => {
        this.applyResults(result);
        this.showLootResults(result);
      },
    );
  }

  private showLootResults(result: LootResult): void {
    if (!result.encounter) {
      this.applyResults(result);
    }

    // Build a results display in the panel
    this.container.removeAll(true);
    this.panelState = 'results';

    const lootEntries = Object.entries(result.loot) as Array<[ResourceType, number]>;
    const panelHeight = 80 + lootEntries.length * 18 + 40;

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1A1A2E, 0.92);
    bg.fillRect(0, 0, PANEL_WIDTH, panelHeight);
    bg.lineStyle(1, 0x4CAF50);
    bg.strokeRect(0, 0, PANEL_WIDTH, panelHeight);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(PANEL_WIDTH / 2, 8, 'LOOT RUN COMPLETE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '13px',
      color: '#4CAF50',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Destination
    const destText = this.scene.add.text(12, 30, `Location: ${result.destination.name}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#E8DCC8',
    });
    this.container.add(destText);

    // Loot gained
    let yOffset = 48;
    if (lootEntries.length === 0) {
      const noLoot = this.scene.add.text(12, yOffset, 'No loot gained.', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#F44336',
      });
      this.container.add(noLoot);
      yOffset += 18;
    } else {
      const lootLabel = this.scene.add.text(12, yOffset, 'Loot gained:', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#C5A030',
      });
      this.container.add(lootLabel);
      yOffset += 16;

      for (const [resource, amount] of lootEntries) {
        if (amount > 0) {
          const lootLine = this.scene.add.text(20, yOffset, `+${amount} ${resource}`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: '#4CAF50',
          });
          this.container.add(lootLine);
          yOffset += 18;
        }
      }
    }

    // Close button
    yOffset += 8;
    const closeBtn = this.scene.add.text(PANEL_WIDTH / 2, yOffset, '[ CLOSE ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#E8DCC8',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#FFD700'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#E8DCC8'));
    closeBtn.on('pointerdown', () => {
      this.visible = false;
      this.container.setVisible(false);
    });
    this.container.add(closeBtn);

    this.container.setVisible(true);
  }

  private applyResults(result: LootResult): void {
    // Add loot to resources
    for (const [resource, amount] of Object.entries(result.loot) as Array<[ResourceType, number]>) {
      if (amount > 0) {
        this.gameState.inventory.resources[resource] += amount;
      }
    }

    // Handle injured companions
    for (const companionId of result.injuredCompanions) {
      const refugee = this.gameState.refugees.find(r => r.id === companionId);
      if (refugee) {
        refugee.status = 'injured';
        refugee.job = null;
      }
    }

    // Return companions from 'away' (except injured ones already handled)
    for (const companion of this.selectedCompanions) {
      const refugee = this.gameState.refugees.find(r => r.id === companion.id);
      if (refugee && refugee.status === 'away') {
        refugee.status = 'healthy';
        refugee.job = null;
      }
    }

    // Handle rescued refugee
    if (result.rescuedRefugee) {
      this.scene.events.emit('refugee-rescued');
    }

    // Award looting XP
    this.lootManager.awardLootingXP();

    // Notify resource change
    this.onResourceChange();

    // Emit completion event
    this.scene.events.emit('loot-run-finished', result);
  }
}

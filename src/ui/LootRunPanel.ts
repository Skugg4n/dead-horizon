// Dead Horizon -- Loot run panel UI for DayScene
// Shows destinations, weapon/companion selection, and loot results

import Phaser from 'phaser';
import { LootManager, type LootDestination, type LootResult } from '../systems/LootManager';
import { EncounterDialog } from './EncounterDialog';
import { UIPanel } from './UIPanel';
import type { GameState, WeaponInstance, RefugeeInstance, ResourceType } from '../config/types';

const PANEL_WIDTH = 360;

type PanelState = 'destinations' | 'configure' | 'results';

export class LootRunPanel {
  private scene: Phaser.Scene;
  private lootManager: LootManager;
  private gameState: GameState;
  private panel: UIPanel;
  private encounterDialog: EncounterDialog;

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

    this.panel = new UIPanel(scene, 'LOOT RUNS', 360, 460);

    this.encounterDialog = new EncounterDialog(scene);
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.panel.getContainer();
  }

  getEncounterContainer(): Phaser.GameObjects.Container {
    return this.encounterDialog.getContainer();
  }

  toggle(): void {
    if (this.panel.isVisible()) {
      this.panel.hide();
    } else {
      this.panelState = 'destinations';
      this.selectedDestination = null;
      this.selectedWeapons = [];
      this.selectedCompanions = [];
      this.panel.show();
      this.rebuild();
    }
  }

  isVisible(): boolean {
    return this.panel.isVisible();
  }

  private rebuild(): void {
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
    const content = this.panel.getContentContainer();
    content.removeAll(true);

    const destinations = this.lootManager.getDestinations();
    const contentWidth = PANEL_WIDTH - 24;

    // Destination entries
    destinations.forEach((dest, i) => {
      const y = i * 60;
      const hasAP = this.currentAP() >= dest.apCost;
      const color = hasAP ? '#E8DCC8' : '#6B6B6B';

      // Hover background
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x333333, 0);
      bg.fillRect(-4, y - 2, contentWidth + 8, 54);
      content.add(bg);

      // Destination name and cost (10px title)
      // Name is constrained so AP badge on the right doesn't overlap
      const nameText = this.scene.add.text(0, y, `${dest.name}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color,
        wordWrap: { width: contentWidth - 60 },
      });
      content.add(nameText);

      const apText = this.scene.add.text(contentWidth, y + 2, `${dest.apCost} AP`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: hasAP ? '#FFD700' : '#F44336',
      }).setOrigin(1, 0);
      content.add(apText);

      // Details (8px label) -- word-wrapped to fit within content area
      const encounterPct = Math.round(dest.encounterChance * 100);
      const lootNames = dest.loot.map(l => l.resource).join(', ');
      const detailText = this.scene.add.text(0, y + 16, `Encounter: ${encounterPct}%  |  ${lootNames}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#6B6B6B',
        wordWrap: { width: contentWidth },
      });
      content.add(detailText);

      // Select button (9px body)
      if (hasAP) {
        const selectBtn = this.scene.add.text(0, y + 32, '[ SELECT ]', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '9px',
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
        content.add(selectBtn);

        // Hover effect on entire entry
        bg.setInteractive(
          new Phaser.Geom.Rectangle(-4, y - 2, contentWidth + 8, 54),
          Phaser.Geom.Rectangle.Contains,
        );
        bg.on('pointerover', () => {
          bg.clear();
          bg.fillStyle(0x444444, 0.5);
          bg.fillRect(-4, y - 2, contentWidth + 8, 54);
        });
        bg.on('pointerout', () => {
          bg.clear();
          bg.fillStyle(0x333333, 0);
          bg.fillRect(-4, y - 2, contentWidth + 8, 54);
        });
      }
    });
  }

  private buildConfigureScreen(): void {
    if (!this.selectedDestination) return;

    const content = this.panel.getContentContainer();
    content.removeAll(true);

    const contentWidth = PANEL_WIDTH - 24;
    const weapons = this.gameState.inventory.weapons;
    const healthyRefugees = this.gameState.refugees.filter(
      r => r.status === 'healthy' && r.job !== 'loot_run'
    );

    // Back button (9px body)
    const backBtn = this.scene.add.text(0, 0, '< BACK', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#D4620B',
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => {
      this.panelState = 'destinations';
      this.rebuild();
    });
    content.add(backBtn);

    // Destination title (10px)
    const destTitle = this.scene.add.text(contentWidth / 2, 0, this.selectedDestination.name, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#FFD700',
    }).setOrigin(0.5, 0);
    content.add(destTitle);

    let yOffset = 22;

    // Weapons section (10px title)
    const weaponLabel = this.scene.add.text(0, yOffset, 'Weapons to bring:', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#C5A030',
    });
    content.add(weaponLabel);
    yOffset += 16;

    if (weapons.length === 0) {
      const noWeapons = this.scene.add.text(8, yOffset, '(no weapons)', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#6B6B6B',
      });
      content.add(noWeapons);
      yOffset += 20;
    } else {
      for (const weapon of weapons) {
        const isSelected = this.selectedWeapons.some(w => w.id === weapon.id);
        const marker = isSelected ? '[x]' : '[ ]';
        const color = isSelected ? '#4CAF50' : '#E8DCC8';

        const entry = this.scene.add.text(8, yOffset, `${marker} ${weapon.weaponId} (DMG: ${this.getWeaponDisplayDamage(weapon)})`, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '9px',
          color,
          wordWrap: { width: contentWidth - 8 },
        }).setInteractive({ useHandCursor: true });

        entry.on('pointerdown', () => {
          if (isSelected) {
            this.selectedWeapons = this.selectedWeapons.filter(w => w.id !== weapon.id);
          } else {
            this.selectedWeapons.push(weapon);
          }
          this.rebuild();
        });

        content.add(entry);
        yOffset += 20;
      }
    }

    // Companions section
    yOffset += 6;
    const companionLabel = this.scene.add.text(0, yOffset, 'Companions:', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#C5A030',
    });
    content.add(companionLabel);
    yOffset += 16;

    if (healthyRefugees.length === 0) {
      const noRefugees = this.scene.add.text(8, yOffset, '(no healthy refugees available)', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#6B6B6B',
      });
      content.add(noRefugees);
      yOffset += 20;
    } else {
      for (const refugee of healthyRefugees) {
        const isSelected = this.selectedCompanions.some(c => c.id === refugee.id);
        const marker = isSelected ? '[x]' : '[ ]';
        const color = isSelected ? '#4CAF50' : '#E8DCC8';

        const entry = this.scene.add.text(8, yOffset, `${marker} ${refugee.name} (${refugee.skillBonus})`, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '9px',
          color,
          wordWrap: { width: contentWidth - 8 },
        }).setInteractive({ useHandCursor: true });

        entry.on('pointerdown', () => {
          if (isSelected) {
            this.selectedCompanions = this.selectedCompanions.filter(c => c.id !== refugee.id);
          } else {
            this.selectedCompanions.push(refugee);
          }
          this.rebuild();
        });

        content.add(entry);
        yOffset += 20;
      }
    }

    // Strength preview (9px body)
    yOffset += 8;
    const strength = this.lootManager.calculateStrength(this.selectedWeapons, this.selectedCompanions.length);
    const strengthText = this.scene.add.text(0, yOffset, `Combat strength: ${strength}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#E8DCC8',
    });
    content.add(strengthText);
    yOffset += 20;

    // GO button (10px title)
    const goBtn = this.scene.add.text(contentWidth / 2, yOffset, '[ GO ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#4CAF50',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    goBtn.on('pointerover', () => goBtn.setColor('#FFD700'));
    goBtn.on('pointerout', () => goBtn.setColor('#4CAF50'));
    goBtn.on('pointerdown', () => this.startRun());
    content.add(goBtn);
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
      this.panel.hide();
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

    // Build a results display in the panel content
    const content = this.panel.getContentContainer();
    content.removeAll(true);
    this.panelState = 'results';

    const contentWidth = PANEL_WIDTH - 24;
    const lootEntries = Object.entries(result.loot) as Array<[ResourceType, number]>;

    // Title (10px)
    const title = this.scene.add.text(contentWidth / 2, 0, 'LOOT RUN COMPLETE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#4CAF50',
    }).setOrigin(0.5, 0);
    content.add(title);

    // Destination (9px body)
    const destText = this.scene.add.text(0, 18, `Location: ${result.destination.name}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#E8DCC8',
      wordWrap: { width: contentWidth },
    });
    content.add(destText);

    // Loot gained
    let yOffset = 34;
    if (lootEntries.length === 0) {
      const noLoot = this.scene.add.text(0, yOffset, 'No loot gained.', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#F44336',
      });
      content.add(noLoot);
      yOffset += 16;
    } else {
      const lootLabel = this.scene.add.text(0, yOffset, 'Loot gained:', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#C5A030',
      });
      content.add(lootLabel);
      yOffset += 16;

      for (const [resource, amount] of lootEntries) {
        if (amount > 0) {
          const lootLine = this.scene.add.text(8, yOffset, `+${amount} ${resource}`, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '9px',
            color: '#4CAF50',
          });
          content.add(lootLine);
          yOffset += 16;
        }
      }
    }

    // Close button (10px)
    yOffset += 8;
    const closeBtn = this.scene.add.text(contentWidth / 2, yOffset, '[ CLOSE ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#E8DCC8',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#FFD700'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#E8DCC8'));
    closeBtn.on('pointerdown', () => {
      this.panel.hide();
    });
    content.add(closeBtn);

    this.panel.show();
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

// Dead Horizon -- Loot run panel UI for DayScene
// U1: Simplified one-click flow -- clicking a destination row starts the run immediately.
// U3: Companion selection is retained but now shown as an optional pre-run popup.

import Phaser from 'phaser';
import { LootManager, type LootDestination, type LootResult } from '../systems/LootManager';
import { EncounterDialog } from './EncounterDialog';
import { UIPanel } from './UIPanel';
import { WeaponManager } from '../systems/WeaponManager';
import type { GameState, RefugeeInstance, ResourceType, WeaponInstance } from '../config/types';
import blueprintsJson from '../data/blueprints.json';

// Minimal type for blueprint lookup (only fields we need here)
interface BlueprintEntry {
  id: string;
  name: string;
  unlocks: string[];
}

const blueprintList = blueprintsJson.blueprints as BlueprintEntry[];
const blueprintMap = new Map<string, BlueprintEntry>(blueprintList.map(b => [b.id, b]));

const PANEL_WIDTH = 360;

type PanelState = 'destinations' | 'companions' | 'results';

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
  private selectedCompanions: RefugeeInstance[] = [];
  private panelState: PanelState = 'destinations';

  // Timer handle for auto-close of results
  private resultsTimer: Phaser.Time.TimerEvent | null = null;

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

  getEncounterDialog(): EncounterDialog {
    return this.encounterDialog;
  }

  toggle(): void {
    if (this.panel.isVisible()) {
      this.cancelResultsTimer();
      this.panel.hide();
    } else {
      this.panelState = 'destinations';
      this.selectedDestination = null;
      // Default: keep last selection, or ALL healthy if none selected
      const healthy = this.gameState.refugees.filter(r => r.status === 'healthy');
      const validIds = new Set(healthy.map(r => r.id));
      this.selectedCompanions = this.selectedCompanions.filter(c => validIds.has(c.id));
      if (this.selectedCompanions.length === 0 && healthy.length > 0) {
        this.selectedCompanions = [...healthy];
      }
      this.panel.show();
      this.rebuild();
    }
  }

  isVisible(): boolean {
    return this.panel.isVisible();
  }

  /** Handle keyboard input when panel is visible. Returns true if handled. */
  handleKey(key: string): boolean {
    if (!this.panel.isVisible()) return false;

    // ESC closes the panel
    if (key === 'Escape') {
      this.cancelResultsTimer();
      this.panel.hide();
      return true;
    }

    // In results mode, Enter also closes
    if (this.panelState === 'results' && key === 'Enter') {
      this.cancelResultsTimer();
      this.panel.hide();
      return true;
    }

    // In destinations mode, number keys select destinations
    if (this.panelState === 'destinations') {
      const num = parseInt(key, 10);
      if (num >= 1 && num <= 9) {
        const destinations = this.lootManager.getDestinations();
        const dest = destinations[num - 1];
        if (dest && this.currentAP() >= dest.apCost) {
          this.selectedDestination = dest;
          const availableCompanions = this.gameState.refugees.filter(
            r => r.status === 'healthy' && r.job !== 'loot_run',
          );
          if (availableCompanions.length > 0) {
            this.panelState = 'companions';
            // Pre-select all healthy companions by default
            if (this.selectedCompanions.length === 0) {
              this.selectedCompanions = [...availableCompanions];
            }
            this.rebuild();
          } else {
            this.startRun();
          }
          return true;
        }
      }
    }

    // In companions mode: 1-9 toggle companions, Enter = GO, Backspace = back
    if (this.panelState === 'companions') {
      if (key === 'Enter') {
        this.startRun();
        return true;
      }
      if (key === 'Backspace') {
        this.panelState = 'destinations';
        this.rebuild();
        return true;
      }
      const num = parseInt(key, 10);
      if (num >= 1 && num <= 9) {
        const healthyRefugees = this.gameState.refugees.filter(
          r => r.status === 'healthy' && r.hp > 0 && r.job !== 'loot_run',
        );
        const refugee = healthyRefugees[num - 1];
        if (refugee) {
          const isSelected = this.selectedCompanions.some(c => c.id === refugee.id);
          if (isSelected) {
            this.selectedCompanions = this.selectedCompanions.filter(c => c.id !== refugee.id);
          } else {
            this.selectedCompanions.push(refugee);
          }
          this.buildCompanionScreen();
        }
        return true;
      }
    }

    return false;
  }

  getPanel(): UIPanel {
    return this.panel;
  }

  private rebuild(): void {
    switch (this.panelState) {
      case 'destinations':
        this.buildDestinationList();
        break;
      case 'companions':
        this.buildCompanionScreen();
        break;
      case 'results':
        // Results screen is built by showLootResults -- nothing to do here
        break;
    }
  }

  // -- Destination list: each row is fully clickable to start the run --
  private buildDestinationList(): void {
    const content = this.panel.getContentContainer();
    content.removeAll(true);

    const destinations = this.lootManager.getDestinations();
    const contentWidth = PANEL_WIDTH - 24;

    destinations.forEach((dest, i) => {
      const y = i * 68;
      const hasAP = this.currentAP() >= dest.apCost;
      const color = hasAP ? '#E8DCC8' : '#6B6B6B';

      // Clickable row background
      const rowBg = this.scene.add.graphics();
      rowBg.fillStyle(0x333333, 0);
      rowBg.fillRect(0, y, contentWidth, 62);
      content.add(rowBg);

      // Keyboard shortcut hint [1]-[9] shown to the left of the destination name
      const keyHint = this.scene.add.text(0, y + 4, `[${i + 1}]`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: hasAP ? '#445566' : '#333333',
      });
      content.add(keyHint);

      // Destination name
      const nameText = this.scene.add.text(28, y + 4, dest.name, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color,
      });
      content.add(nameText);

      // AP cost -- right-aligned
      const apText = this.scene.add.text(contentWidth, y + 6, `${dest.apCost} AP`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: hasAP ? '#FFD700' : '#F44336',
      }).setOrigin(1, 0);
      content.add(apText);

      // Encounter + loot details
      const encounterPct = Math.round(dest.encounterChance * 100);
      const lootNames = dest.loot.map(l => l.resource).join(', ');
      const detailText = this.scene.add.text(0, y + 20, `Encounter: ${encounterPct}%  |  ${lootNames}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#6B6B6B',
      });
      content.add(detailText);

      if (hasAP) {
        // "Click to go" hint
        const hintText = this.scene.add.text(0, y + 38, '> CLICK TO START', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '8px',
          color: '#4A90D9',
        });
        content.add(hintText);

        // Make the full row interactive
        rowBg.setInteractive(
          new Phaser.Geom.Rectangle(0, y, contentWidth, 62),
          Phaser.Geom.Rectangle.Contains,
        );
        rowBg.on('pointerover', () => {
          rowBg.clear();
          rowBg.fillStyle(0x4A90D9, 0.12);
          rowBg.fillRect(0, y, contentWidth, 62);
          hintText.setColor('#FFD700');
        });
        rowBg.on('pointerout', () => {
          rowBg.clear();
          rowBg.fillStyle(0x333333, 0);
          rowBg.fillRect(0, y, contentWidth, 62);
          hintText.setColor('#4A90D9');
        });
        rowBg.on('pointerdown', () => {
          this.selectedDestination = dest;
          // If there are available companions, show optional companion screen.
          // Otherwise go straight to running.
          const availableCompanions = this.gameState.refugees.filter(
            r => r.status === 'healthy' && r.job !== 'loot_run',
          );
          if (availableCompanions.length > 0) {
            this.panelState = 'companions';
            // Pre-select all healthy companions by default
            if (this.selectedCompanions.length === 0) {
              this.selectedCompanions = [...availableCompanions];
            }
            this.rebuild();
          } else {
            this.startRun();
          }
        });
      }

      // Row separator
      if (i < destinations.length - 1) {
        const sep = this.scene.add.graphics();
        sep.lineStyle(1, 0x333333, 0.5);
        sep.lineBetween(0, y + 64, contentWidth, y + 64);
        content.add(sep);
      }
    });
  }

  // -- Optional companion selection before starting the run --
  private buildCompanionScreen(): void {
    if (!this.selectedDestination) return;

    const content = this.panel.getContentContainer();
    content.removeAll(true);

    const contentWidth = PANEL_WIDTH - 24;

    // Back button
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

    // Destination title
    const destTitle = this.scene.add.text(contentWidth / 2, 0, this.selectedDestination.name, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#FFD700',
    }).setOrigin(0.5, 0);
    content.add(destTitle);

    let yOffset = 22;

    const companionLabel = this.scene.add.text(0, yOffset, 'Take companions? (optional)', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#C5A030',
    });
    content.add(companionLabel);
    yOffset += 14;

    // Risk warning
    const riskText = this.scene.add.text(0, yOffset, 'Risk: companions may be injured if you lose a fight', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#AA6633',
    });
    content.add(riskText);
    yOffset += 14;

    const healthyRefugees = this.gameState.refugees.filter(
      r => r.status === 'healthy' && r.hp > 0 && r.job !== 'loot_run',
    );

    for (const [compIndex, refugee] of healthyRefugees.entries()) {
      const isSelected = this.selectedCompanions.some(c => c.id === refugee.id);
      const marker = isSelected ? '[x]' : '[ ]';
      const entryColor = isSelected ? '#4CAF50' : '#E8DCC8';

      // Keyboard shortcut hint for companion selection
      const compKey = this.scene.add.text(0, yOffset, `[${compIndex + 1}]`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#445566',
      });
      content.add(compKey);

      const entry = this.scene.add.text(
        28,
        yOffset,
        `${marker} ${refugee.name}  (${refugee.skillBonus})  HP:${refugee.hp}/${refugee.maxHp}`,
        {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '9px',
          color: entryColor,
        },
      ).setInteractive({ useHandCursor: true });

      entry.on('pointerover', () => entry.setColor('#FFD700'));
      entry.on('pointerout', () => entry.setColor(isSelected ? '#4CAF50' : '#E8DCC8'));
      entry.on('pointerdown', () => {
        if (isSelected) {
          this.selectedCompanions = this.selectedCompanions.filter(c => c.id !== refugee.id);
        } else {
          this.selectedCompanions.push(refugee);
        }
        // Rebuild so markers update
        this.buildCompanionScreen();
      });

      content.add(entry);
      yOffset += 20;
    }

    yOffset += 8;

    // GO button -- starts run with whatever companions are selected (can be zero)
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

  private startRun(): void {
    if (!this.selectedDestination) return;

    if (this.currentAP() < this.selectedDestination.apCost) {
      return;
    }

    this.spendAP(this.selectedDestination.apCost);

    // Mark companions as away on loot run
    for (const companion of this.selectedCompanions) {
      const refugee = this.gameState.refugees.find(r => r.id === companion.id);
      if (refugee) {
        refugee.status = 'away';
        refugee.job = 'loot_run';
      }
    }

    const result = this.lootManager.executeLootRun(this.selectedDestination.id);

    if (result.encounter) {
      // Use equipped weapons for encounter strength calculation
      this.panel.hide();
      const equippedWeapons = this.gameState.inventory.weapons.filter(w =>
        w.id === this.gameState.equipped.primaryWeaponId ||
        w.id === this.gameState.equipped.secondaryWeaponId
      );
      const strength = this.lootManager.calculateStrength(equippedWeapons, this.selectedCompanions.length);
      const thresholds: Record<string, number> = {
        nearby_houses: 50,
        abandoned_store: 70,
        city_ruins: 60,
        hospital: 65,
        police_station: 80,
        military_outpost: 100,
        armory: 120,
      };
      const threshold = thresholds[this.selectedDestination.id] ?? 50;

      this.encounterDialog.show(strength, threshold, (choice) => {
        if (choice === 'fight') {
          this.lootManager.resolveFight(result, equippedWeapons, this.selectedCompanions);
        } else {
          this.lootManager.resolveFlee(result);
        }
        this.showEncounterResult(result);
      });
    } else {
      this.showLootResults(result);
    }
  }

  private showEncounterResult(result: LootResult): void {
    let details = '';

    if (result.encounterOutcome === 'win') {
      details = 'You fought and won! Loot x1.5.';
      if (result.rescuedRefugee) {
        details += ' Rescued a survivor!';
      }
    } else if (result.encounterOutcome === 'lose') {
      details = 'Overwhelmed. All loot lost.';
      if (result.injuredCompanions.length > 0) {
        details += ` ${result.injuredCompanions.length} companion(s) injured.`;
      }
    } else if (result.encounterOutcome === 'flee') {
      details = 'Fled safely, dropped some loot.';
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

    const content = this.panel.getContentContainer();
    content.removeAll(true);
    this.panelState = 'results';

    const contentWidth = PANEL_WIDTH - 24;
    const lootEntries = Object.entries(result.loot) as Array<[ResourceType, number]>;

    // Title
    const title = this.scene.add.text(contentWidth / 2, 0, 'LOOT RUN COMPLETE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#4CAF50',
    }).setOrigin(0.5, 0);
    content.add(title);

    const destText = this.scene.add.text(0, 18, `Location: ${result.destination.name}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#E8DCC8',
    });
    content.add(destText);

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

    // Show weapon drop if one was found
    if (result.weaponDropId) {
      const weaponData = WeaponManager.getWeaponData(result.weaponDropId);
      const weaponName = weaponData ? weaponData.name : result.weaponDropId;
      yOffset += 4;
      const weaponLabel = this.scene.add.text(0, yOffset, 'Weapon found:', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#C5A030',
      });
      content.add(weaponLabel);
      yOffset += 16;
      const weaponLine = this.scene.add.text(8, yOffset, `+ ${weaponName}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#FFD700',
      });
      content.add(weaponLine);
      yOffset += 16;
    }

    // Show armor drop if one was found
    if (result.foundArmorId) {
      yOffset += 4;
      const armorLabel = this.scene.add.text(0, yOffset, 'Armor found:', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#C5A030',
      });
      content.add(armorLabel);
      yOffset += 16;
      const displayName = result.foundArmorId.replace(/_/g, ' ').toUpperCase();
      const armorLine = this.scene.add.text(8, yOffset, `+ ${displayName}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#4A90D9',
      });
      content.add(armorLine);
      yOffset += 16;
    }

    // Show shield drop if one was found
    if (result.foundShieldId) {
      yOffset += 4;
      const shieldLabel = this.scene.add.text(0, yOffset, 'Shield found:', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#C5A030',
      });
      content.add(shieldLabel);
      yOffset += 16;
      const displayName = result.foundShieldId.replace(/_/g, ' ').toUpperCase();
      const shieldLine = this.scene.add.text(8, yOffset, `+ ${displayName}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#4CAF50',
      });
      content.add(shieldLine);
      yOffset += 16;
    }

    // Show blueprint find if one was found -- special highlighted block
    if (result.foundBlueprintId) {
      yOffset += 8;

      // Look up full blueprint data to show unlock list
      const bpData = blueprintMap.get(result.foundBlueprintId);
      const bpRealName = bpData?.name ?? result.foundBlueprintId.replace(/_/g, ' ');
      // Format unlocks as human-readable trap names
      const unlockNames = (bpData?.unlocks ?? [])
        .map(u => u.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
        .join(', ');
      const unlocksLabel = unlockNames.length > 0 ? `Unlocks: ${unlockNames}` : 'New trap unlocked';

      // Expand highlight box height to fit name + unlocks line
      const bpBoxH = 72;

      // Gold background highlight box behind the blueprint section
      const bpBg = this.scene.add.graphics();
      bpBg.fillStyle(0x1A1400, 0.9);
      bpBg.lineStyle(1, 0xC5A030, 0.85);
      bpBg.strokeRect(0, yOffset - 4, contentWidth, bpBoxH);
      bpBg.fillRect(0, yOffset - 4, contentWidth, bpBoxH);
      content.add(bpBg);

      // "NEW BLUEPRINT FOUND!" header in gold with glow effect
      const bpHeader = this.scene.add.text(contentWidth / 2, yOffset + 2, 'NEW BLUEPRINT FOUND!', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#FFD700',
      }).setOrigin(0.5, 0).setAlpha(0).setScale(0.5);
      content.add(bpHeader);

      // Blueprint real name (from blueprints.json)
      const bpLine = this.scene.add.text(contentWidth / 2, yOffset + 20, bpRealName, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#FFE066',
        wordWrap: { width: contentWidth - 8 },
      }).setOrigin(0.5, 0).setAlpha(0);
      content.add(bpLine);

      // Unlocks line -- shows which traps are now available
      const bpHint = this.scene.add.text(contentWidth / 2, yOffset + 48, unlocksLabel, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#A07820',
        wordWrap: { width: contentWidth - 8 },
      }).setOrigin(0.5, 0).setAlpha(0);
      content.add(bpHint);

      // Scale-in + fade-in animation for the header (dramatic pop)
      this.scene.tweens.add({
        targets: bpHeader,
        scaleX: 1,
        scaleY: 1,
        alpha: 1,
        duration: 350,
        ease: 'Back.easeOut',
      });

      this.scene.tweens.add({
        targets: [bpLine, bpHint],
        alpha: 1,
        duration: 300,
        delay: 200,
        ease: 'Power2',
      });

      // Subtle shake on the bg box after the pop
      this.scene.time.delayedCall(120, () => {
        this.scene.tweens.add({
          targets: bpBg,
          x: { from: -3, to: 3 },
          duration: 60,
          yoyo: true,
          repeat: 3,
          ease: 'Linear',
          onComplete: () => { bpBg.x = 0; },
        });
      });

      // Pulse glow on header text after entrance
      this.scene.time.delayedCall(400, () => {
        this.scene.tweens.add({
          targets: bpHeader,
          alpha: { from: 1.0, to: 0.55 },
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      });

      yOffset += bpBoxH + 8;
    }

    yOffset += 8;

    // Auto-close countdown label
    const countdownText = this.scene.add.text(contentWidth / 2, yOffset, 'Closing in 3...', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#6B6B6B',
    }).setOrigin(0.5, 0);
    content.add(countdownText);

    yOffset += 16;

    // Close button -- single click closes immediately
    const closeBtn = this.scene.add.text(contentWidth / 2, yOffset, '[ CLOSE ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#E8DCC8',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#FFD700'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#E8DCC8'));
    closeBtn.on('pointerdown', () => {
      this.cancelResultsTimer();
      this.panel.hide();
    });
    content.add(closeBtn);

    this.panel.show();

    // No auto-close -- player reads results at their own pace
    // Close hint shown via countdownText (repurposed)
    countdownText.setText('Press ESC or click to close');

    // Ensure the result panel shows (may have been hidden during encounter dialog)
    this.panel.getContainer().setVisible(true);
  }

  private cancelResultsTimer(): void {
    if (this.resultsTimer) {
      this.resultsTimer.remove();
      this.resultsTimer = null;
    }
  }

  private applyResults(result: LootResult): void {
    // lucky_looter perk: +25% to all loot amounts
    const hasLuckyLooter = (this.gameState.meta?.unlockedPerks ?? []).includes('lucky_looter');
    const lootBonus = hasLuckyLooter ? 1.25 : 1.0;

    for (const [resource, amount] of Object.entries(result.loot) as Array<[ResourceType, number]>) {
      if (amount > 0) {
        this.gameState.inventory.resources[resource] += Math.round(amount * lootBonus);
      }
    }

    // Add weapon drop to inventory if one was found
    if (result.weaponDropId) {
      const weaponData = WeaponManager.getWeaponData(result.weaponDropId);
      if (weaponData) {
        const newWeapon: WeaponInstance = {
          id: `${weaponData.id}_${Date.now()}`,
          weaponId: weaponData.id,
          rarity: weaponData.rarity,
          level: 1,
          xp: 0,
          durability: weaponData.maxDurability,
          maxDurability: weaponData.maxDurability,
          upgrades: [],
        };
        this.gameState.inventory.weapons.push(newWeapon);
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

    // Return companions who are still 'away' to healthy idle
    for (const companion of this.selectedCompanions) {
      const refugee = this.gameState.refugees.find(r => r.id === companion.id);
      if (refugee && refugee.status === 'away') {
        refugee.status = 'healthy';
        refugee.job = null;
      }
    }

    if (result.rescuedRefugee) {
      this.scene.events.emit('refugee-rescued');
    }

    this.lootManager.awardLootingXP();
    this.onResourceChange();
    // Bug 11+12: Notify EquipmentPanel (and any other listeners) that inventory changed.
    // Without this, newly found weapons only appear after closing and reopening the panel.
    this.scene.events.emit('inventory-changed');
    this.scene.events.emit('loot-run-finished', result);
  }
}

import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager';
import { AchievementManager } from '../systems/AchievementManager';
import { GAME_VERSION } from '../config/constants';
import { AudioManager } from '../systems/AudioManager';
import type { CharacterType, CharacterData, SkillType } from '../config/types';
import { SkillManager } from '../systems/SkillManager';
import charactersJson from '../data/characters.json';

const characters = charactersJson.characters as unknown as CharacterData[];

export class MenuScene extends Phaser.Scene {
  private selectedCharacter: CharacterType = 'soldier';
  private characterSelectContainer!: Phaser.GameObjects.Container;
  private mainMenuContainer!: Phaser.GameObjects.Container;
  private achievementContainer: Phaser.GameObjects.Container | null = null;
  private settingsContainer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1A1A2E');
    // Character state reset handled by buildCharacterView
    this.selectedCharacter = 'soldier';

    this.createMainMenu();
    this.createCharacterSelect();
    this.characterSelectContainer.setVisible(false);
  }

  private createMainMenu(): void {
    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    this.mainMenuContainer = this.add.container(0, 0);

    // Title
    const title = this.add.text(centerX, centerY - 80, 'DEAD HORIZON', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#E8DCC8',
    }).setOrigin(0.5);
    this.mainMenuContainer.add(title);

    // Subtitle
    const subtitle = this.add.text(centerX, centerY - 40, 'Survive. Build. Die. Repeat.', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#6B6B6B',
    }).setOrigin(0.5);
    this.mainMenuContainer.add(subtitle);

    // Show saved progress if exists
    if (SaveManager.hasSave()) {
      const state = SaveManager.load();
      const progressText = this.add.text(centerX, centerY - 5, `Runs: ${state.progress.totalRuns} -- Total kills: ${state.progress.totalKills}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '11px',
        color: '#C5A030',
      }).setOrigin(0.5);
      this.mainMenuContainer.add(progressText);

      // Continue button (loads existing save)
      const continueText = this.add.text(centerX, centerY + 30, '[ CONTINUE ]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '14px',
        color: '#D4620B',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      continueText.on('pointerover', () => continueText.setColor('#FFD700'));
      continueText.on('pointerout', () => continueText.setColor('#D4620B'));
      continueText.on('pointerdown', () => { AudioManager.play('ui_click'); this.scene.start('DayScene'); });
      this.mainMenuContainer.add(continueText);

      // New Game button (clears save, shows character select)
      const newGameText = this.add.text(centerX, centerY + 65, '[ NEW GAME ]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '14px',
        color: '#6B6B6B',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      newGameText.on('pointerover', () => newGameText.setColor('#F44336'));
      newGameText.on('pointerout', () => newGameText.setColor('#6B6B6B'));
      newGameText.on('pointerdown', () => {
        SaveManager.clearSave();
        this.showCharacterSelect();
      });
      this.mainMenuContainer.add(newGameText);
    } else {
      // No save -- show Start Game that goes to character select
      const startText = this.add.text(centerX, centerY + 30, '[ START GAME ]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '14px',
        color: '#D4620B',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      startText.on('pointerover', () => startText.setColor('#FFD700'));
      startText.on('pointerout', () => startText.setColor('#D4620B'));
      startText.on('pointerdown', () => this.showCharacterSelect());
      this.mainMenuContainer.add(startText);
    }

    // Achievements button
    const achieveBtn = this.add.text(centerX, centerY + 95, '[ ACHIEVEMENTS ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '11px',
      color: '#6B6B6B',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    achieveBtn.on('pointerover', () => achieveBtn.setColor('#C5A030'));
    achieveBtn.on('pointerout', () => achieveBtn.setColor('#6B6B6B'));
    achieveBtn.on('pointerdown', () => this.toggleAchievementPanel());
    this.mainMenuContainer.add(achieveBtn);

    // Settings button
    const settingsBtn = this.add.text(centerX, centerY + 120, '[ SETTINGS ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#6B6B6B',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    settingsBtn.on('pointerover', () => settingsBtn.setColor('#E8DCC8'));
    settingsBtn.on('pointerout', () => settingsBtn.setColor('#6B6B6B'));
    settingsBtn.on('pointerdown', () => {
      AudioManager.play('ui_click');
      this.toggleSettingsPanel();
    });
    this.mainMenuContainer.add(settingsBtn);

    // Version
    const versionText = this.add.text(centerX, centerY + 145, `v${GAME_VERSION}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#3A3A3A',
    }).setOrigin(0.5);
    this.mainMenuContainer.add(versionText);
  }

  private toggleSettingsPanel(): void {
    if (this.settingsContainer) {
      this.settingsContainer.destroy();
      this.settingsContainer = null;
      return;
    }

    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;
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
    const createToggle = (label: string, y: number, isOn: () => boolean, toggle: () => void) => {
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

    // Divider
    const div = this.add.graphics();
    div.lineStyle(1, 0x3A3A3A);
    div.lineBetween(20, 148, panelW - 20, 148);
    this.settingsContainer.add(div);

    // Volume info
    const volText = this.add.text(panelW / 2, 165, `Volume: ${Math.round(AudioManager.getVolume() * 100)}%`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#6B6B6B',
    }).setOrigin(0.5);
    this.settingsContainer.add(volText);

    // Volume buttons
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

  private toggleAchievementPanel(): void {
    if (this.achievementContainer) {
      this.achievementContainer.destroy();
      this.achievementContainer = null;
      return;
    }

    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;
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

    // Load achievement data
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
          color: color,
        });
        this.achievementContainer.add(text);

        const desc = this.add.text(40, yPos + 14, entry.data.description, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '8px',
          color: '#888888',
        });
        this.achievementContainer.add(desc);

        yPos += 34;
      }
    } else {
      const noSave = this.add.text(panelWidth / 2, 60, 'Start a game to track achievements', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#6B6B6B',
      }).setOrigin(0.5, 0);
      this.achievementContainer.add(noSave);
    }
  }

  private selectedCharIndex: number = 2; // default to soldier

  private createCharacterSelect(): void {
    this.characterSelectContainer = this.add.container(0, 0);
    this.selectedCharIndex = characters.findIndex(c => c.id === this.selectedCharacter);
    if (this.selectedCharIndex < 0) this.selectedCharIndex = 0;
    this.buildCharacterView();
  }

  private buildCharacterView(): void {
    // Clear previous content except the container itself
    this.characterSelectContainer.removeAll(true);
    // Character state reset handled by buildCharacterView

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

    // Character icon (large)
    const iconMap: Record<string, string> = {
      scavenger: 'S', engineer: 'E', soldier: 'W', medic: 'M',
    };
    const iconLetter = iconMap[char.id] ?? '?';
    // Icon circle
    const iconCenterY = cardY + 90;
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

    // Divider line
    const divider = this.add.graphics();
    divider.lineStyle(1, 0x3A3A3A);
    divider.lineBetween(centerX - 100, skillY + 16, centerX + 100, skillY + 16);
    this.characterSelectContainer.add(divider);

    // Readable skill names
    const SKILL_NAMES: Record<string, string> = {
      combat_melee: 'Melee', combat_pistol: 'Pistol', combat_rifle: 'Rifle',
      combat_shotgun: 'Shotgun', looting: 'Looting', building: 'Building',
      speed_agility: 'Agility', leadership: 'Leadership',
      survival: 'Survival', stealth: 'Stealth',
    };

    let skillListY = skillY + 28;
    const entries = Object.entries(char.skillBonuses).filter(([_, v]) => v > 0);
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
        // Skill bar visual
        const barX = centerX - 80;
        const label = this.add.text(barX, skillListY, readable, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '9px',
          color: '#E8DCC8',
        }).setOrigin(0, 0.5);
        this.characterSelectContainer.add(label);

        // Level pips
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

    // Keyboard navigation
    this.input.keyboard?.removeAllListeners();
    this.input.keyboard?.on('keydown-LEFT', () => {
      this.selectedCharIndex = (this.selectedCharIndex - 1 + characters.length) % characters.length;
      this.buildCharacterView();
    });
    this.input.keyboard?.on('keydown-RIGHT', () => {
      this.selectedCharIndex = (this.selectedCharIndex + 1) % characters.length;
      this.buildCharacterView();
    });
    this.input.keyboard?.on('keydown-ENTER', () => this.startWithCharacter());

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
    // Create a fresh game state with selected character and skill bonuses
    const state = SaveManager.createDefaultState();
    state.player.character = this.selectedCharacter;

    // Apply character skill bonuses as starting XP
    // Convert starting levels to cumulative XP
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

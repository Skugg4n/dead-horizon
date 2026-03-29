import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager';
import { AchievementManager } from '../systems/AchievementManager';
import { GAME_VERSION } from '../config/constants';
import type { CharacterType, CharacterData, SkillType } from '../config/types';
import { SkillManager } from '../systems/SkillManager';
import charactersJson from '../data/characters.json';

const characters = charactersJson.characters as unknown as CharacterData[];

export class MenuScene extends Phaser.Scene {
  private selectedCharacter: CharacterType = 'soldier';
  private characterCards: Phaser.GameObjects.Container[] = [];
  private characterSelectContainer!: Phaser.GameObjects.Container;
  private mainMenuContainer!: Phaser.GameObjects.Container;
  private achievementContainer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1A1A2E');
    this.characterCards = [];
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
      continueText.on('pointerdown', () => this.scene.start('DayScene'));
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

    // Version
    const versionText = this.add.text(centerX, centerY + 120, `v${GAME_VERSION}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#3A3A3A',
    }).setOrigin(0.5);
    this.mainMenuContainer.add(versionText);
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

  private createCharacterSelect(): void {
    const centerX = this.cameras.main.centerX;

    this.characterSelectContainer = this.add.container(0, 0);

    // Title
    const title = this.add.text(centerX, 30, 'CHOOSE YOUR SURVIVOR', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '18px',
      color: '#E8DCC8',
    }).setOrigin(0.5);
    this.characterSelectContainer.add(title);

    // Character cards
    const cardWidth = 160;
    const cardSpacing = 12;
    const totalWidth = characters.length * cardWidth + (characters.length - 1) * cardSpacing;
    const startX = centerX - totalWidth / 2;

    characters.forEach((char, i) => {
      const cardX = startX + i * (cardWidth + cardSpacing);
      const card = this.createCharacterCard(char, cardX, 70, cardWidth);
      this.characterSelectContainer.add(card);
      this.characterCards.push(card);
    });

    // Start button
    const startBtn = this.add.text(centerX, 520, '[ BEGIN ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#D4620B',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startBtn.on('pointerover', () => startBtn.setColor('#FFD700'));
    startBtn.on('pointerout', () => startBtn.setColor('#D4620B'));
    startBtn.on('pointerdown', () => this.startWithCharacter());
    this.characterSelectContainer.add(startBtn);

    // Back button
    const backBtn = this.add.text(centerX, 560, '[ BACK ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '12px',
      color: '#6B6B6B',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerover', () => backBtn.setColor('#E8DCC8'));
    backBtn.on('pointerout', () => backBtn.setColor('#6B6B6B'));
    backBtn.on('pointerdown', () => this.hideCharacterSelect());
    this.characterSelectContainer.add(backBtn);
  }

  private createCharacterCard(
    char: CharacterData,
    x: number,
    y: number,
    width: number
  ): Phaser.GameObjects.Container {
    const card = this.add.container(x, y);
    const height = 420;
    const isSelected = char.id === this.selectedCharacter;

    // Card background
    const bg = this.add.graphics();
    bg.fillStyle(isSelected ? 0x2A2A4E : 0x1A1A2E, 0.95);
    bg.fillRect(0, 0, width, height);
    bg.lineStyle(2, isSelected ? 0xC5A030 : 0x3A3A3A);
    bg.strokeRect(0, 0, width, height);
    card.add(bg);

    // Name
    const name = this.add.text(width / 2, 16, char.name, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '12px',
      color: isSelected ? '#C5A030' : '#E8DCC8',
    }).setOrigin(0.5, 0);
    card.add(name);

    // Simple character icon (text-based)
    const iconMap: Record<string, string> = {
      scavenger: '[S]',
      engineer: '[E]',
      soldier: '[W]',
      medic: '[M]',
    };
    const icon = this.add.text(width / 2, 50, iconMap[char.id] ?? '[?]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '20px',
      color: isSelected ? '#C5A030' : '#6B6B6B',
    }).setOrigin(0.5, 0);
    card.add(icon);

    // Description
    const desc = this.add.text(width / 2, 100, char.description, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#6B6B6B',
      wordWrap: { width: width - 16 },
      align: 'center',
    }).setOrigin(0.5, 0);
    card.add(desc);

    // Skill bonuses
    let bonusY = 160;
    const bonusTitle = this.add.text(width / 2, bonusY, 'Starting Skills:', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#888888',
    }).setOrigin(0.5, 0);
    card.add(bonusTitle);
    bonusY += 18;

    for (const [skillId, level] of Object.entries(char.skillBonuses)) {
      if (level > 0) {
        const skillLabel = this.add.text(width / 2, bonusY, `${skillId}: Lv ${level}`, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '9px',
          color: '#4CAF50',
        }).setOrigin(0.5, 0);
        card.add(skillLabel);
        bonusY += 14;
      }
    }

    // If no bonuses, show "None"
    if (!Object.values(char.skillBonuses).some(v => v > 0)) {
      const noneLabel = this.add.text(width / 2, bonusY, '(none)', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#6B6B6B',
      }).setOrigin(0.5, 0);
      card.add(noneLabel);
    }

    // Make interactive
    const hitArea = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    card.add(hitArea);

    hitArea.on('pointerdown', () => {
      this.selectedCharacter = char.id;
      this.refreshCharacterCards();
    });

    return card;
  }

  private refreshCharacterCards(): void {
    // Destroy old cards and recreate
    for (const card of this.characterCards) {
      card.destroy();
    }
    this.characterCards = [];

    const centerX = this.cameras.main.centerX;
    const cardWidth = 160;
    const cardSpacing = 12;
    const totalWidth = characters.length * cardWidth + (characters.length - 1) * cardSpacing;
    const startX = centerX - totalWidth / 2;

    characters.forEach((char, i) => {
      const cardX = startX + i * (cardWidth + cardSpacing);
      const card = this.createCharacterCard(char, cardX, 70, cardWidth);
      this.characterSelectContainer.add(card);
      this.characterCards.push(card);
    });
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

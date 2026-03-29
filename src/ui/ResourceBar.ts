import Phaser from 'phaser';
import type { ResourceType } from '../config/types';
import { GAME_WIDTH } from '../config/constants';

interface ResourceDisplay {
  label: string;
  icon: string;
}

const RESOURCE_CONFIG: Record<ResourceType, ResourceDisplay> = {
  scrap: { label: 'Scrap', icon: '[S]' },
  food: { label: 'Food', icon: '[F]' },
  ammo: { label: 'Ammo', icon: '[A]' },
  parts: { label: 'Parts', icon: '[P]' },
  meds: { label: 'Meds', icon: '[M]' },
};

const RESOURCE_ORDER: ResourceType[] = ['scrap', 'food', 'ammo', 'parts', 'meds'];

export class ResourceBar {
  private container: Phaser.GameObjects.Container;
  private texts: Map<ResourceType, Phaser.GameObjects.Text> = new Map();

  constructor(scene: Phaser.Scene, initialResources: Record<ResourceType, number>) {
    this.container = scene.add.container(0, 0);
    this.container.setDepth(100);
    this.container.setScrollFactor(0);

    // Background bar
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.5);
    bg.fillRect(0, 0, GAME_WIDTH, 20);
    this.container.add(bg);

    // Build resource text elements
    const spacing = GAME_WIDTH / RESOURCE_ORDER.length;
    for (let i = 0; i < RESOURCE_ORDER.length; i++) {
      const type = RESOURCE_ORDER[i];
      if (!type) continue;
      const config = RESOURCE_CONFIG[type];
      const value = initialResources[type];

      const text = scene.add.text(
        spacing * i + spacing / 2,
        10,
        `${config.icon} ${config.label}: ${value}`,
        {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '11px',
          color: '#E8DCC8',
        }
      ).setOrigin(0.5);
      this.container.add(text);
      this.texts.set(type, text);
    }

    // Listen for resource changes
    scene.events.on('resource-changed', (event: { type: ResourceType; total: number }) => {
      this.updateResource(event.type, event.total);
    });
  }

  private updateResource(type: ResourceType, total: number): void {
    const text = this.texts.get(type);
    if (!text || !text.active) return;
    const config = RESOURCE_CONFIG[type];
    text.setText(`${config.icon} ${config.label}: ${total}`);
  }
}

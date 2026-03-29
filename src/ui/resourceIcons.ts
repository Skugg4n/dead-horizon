// Dead Horizon -- Shared helper for rendering resource costs with icons
// Used by BuildMenu, WeaponPanel, CraftingPanel, LootRunPanel

import Phaser from 'phaser';

const ICON_SIZE = 16;
const ICON_GAP = 2;
const ENTRY_GAP = 6;

/**
 * Render a row of resource cost entries: icon (16x16) + amount text.
 * Returns the total width so callers can position subsequent elements.
 */
export function renderResourceCosts(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  costs: Record<string, number>,
  x: number,
  y: number,
  color: string = '#E8DCC8',
): number {
  let offsetX = x;

  for (const [resource, amount] of Object.entries(costs)) {
    if (amount <= 0) continue;

    const iconKey = `icon_${resource}`;
    if (scene.textures.exists(iconKey)) {
      const icon = scene.add.image(offsetX + ICON_SIZE / 2, y + ICON_SIZE / 2, iconKey);
      icon.setDisplaySize(ICON_SIZE, ICON_SIZE);
      container.add(icon);
      offsetX += ICON_SIZE + ICON_GAP;
    }

    const text = scene.add.text(offsetX, y + 2, `${amount}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color,
    });
    container.add(text);
    offsetX += text.width + ENTRY_GAP;
  }

  return offsetX - x;
}

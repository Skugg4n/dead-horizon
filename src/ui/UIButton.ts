// Dead Horizon -- Shared UI button component

/**
 * Creates a styled button container with hover/click effects.
 * Used across all scenes for consistent button styling.
 */
export function createUIButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  color: string,
  onClick: () => void,
  originX: number = 0,
): Phaser.GameObjects.Container {
  const colorInt = parseInt(color.replace('#', ''), 16);

  const text = scene.add.text(0, 0, label, {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: '9px',
    color: color,
    padding: { x: 6, y: 4 },
  });

  const w = text.width + 12;
  const h = text.height + 8;

  const bg = scene.add.graphics();
  drawBackground(bg, w, h, 0x1A1A1A, 0.6, colorInt, 0.4);

  const container = scene.add.container(x, y, [bg, text]);
  container.setSize(w, h);

  // Shift container origin if right-aligned
  if (originX === 1) {
    container.x = x - w;
  }

  text.setInteractive({ useHandCursor: true });

  text.on('pointerover', () => {
    text.setColor('#FFD700');
    bg.clear();
    drawBackground(bg, w, h, 0x333333, 0.8, 0xFFD700, 0.6);
  });

  text.on('pointerout', () => {
    text.setColor(color);
    bg.clear();
    drawBackground(bg, w, h, 0x1A1A1A, 0.6, colorInt, 0.4);
  });

  text.on('pointerdown', onClick);

  return container;
}

function drawBackground(
  graphics: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  fillColor: number,
  fillAlpha: number,
  strokeColor: number,
  strokeAlpha: number,
): void {
  graphics.fillStyle(fillColor, fillAlpha);
  graphics.fillRoundedRect(-6, -4, w, h, 2);
  graphics.lineStyle(1, strokeColor, strokeAlpha);
  graphics.strokeRoundedRect(-6, -4, w, h, 2);
}

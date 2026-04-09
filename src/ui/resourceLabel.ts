// Dead Horizon -- Single source of truth for resource labels in UI panels
// Used by BuildMenu, CraftingPanel, EquipmentPanel, etc so every panel shows
// resources exactly the same way: LETTER + number in a consistent color.
//
// Colors match the bottom resource bar in DayScene so the player can always
// tie the letter/color to a bar on the HUD.

/** Resource color map shared across all UI. */
export const RESOURCE_COLORS: Record<string, string> = {
  scrap: '#C5A030',
  food:  '#4CAF50',
  ammo:  '#4A90D9',
  parts: '#E8DCC8',
  meds:  '#F44336',
};

/** Single-letter code shown next to the number. */
export const RESOURCE_LETTERS: Record<string, string> = {
  scrap: 'S',
  food:  'F',
  ammo:  'A',
  parts: 'P',
  meds:  'M',
};

/** Stable order so costs always read the same direction. */
export const RESOURCE_ORDER: string[] = ['scrap', 'parts', 'food', 'ammo', 'meds'];

/**
 * Format a resource costs record as a single Phaser Text string with
 * embedded color tags. Example: "3S 2P 1F".
 * Caller is responsible for creating the Text object; this helper just
 * returns the formatted plain string.
 */
export function formatResourceCosts(costs: Record<string, number>): string {
  const parts: string[] = [];
  for (const key of RESOURCE_ORDER) {
    const amt = costs[key];
    if (amt == null || amt <= 0) continue;
    const letter = RESOURCE_LETTERS[key] ?? key[0]?.toUpperCase() ?? '?';
    parts.push(`${amt}${letter}`);
  }
  return parts.join(' ');
}

/**
 * Render a row of resource costs as color-coded letter+number tokens
 * inside a Phaser container. Returns the total pixel width used.
 *
 * This is the preferred API for any UI that needs to show a cost --
 * it guarantees consistent colors, letters, and layout across the game.
 */
export function renderResourceCostsText(
  scene: import('phaser').Scene,
  container: import('phaser').GameObjects.Container,
  costs: Record<string, number>,
  x: number,
  y: number,
  fontSize: string = '8px',
): number {
  let offsetX = x;
  const GAP = 6;

  for (const key of RESOURCE_ORDER) {
    const amt = costs[key];
    if (amt == null || amt <= 0) continue;
    const letter = RESOURCE_LETTERS[key] ?? '?';
    const color = RESOURCE_COLORS[key] ?? '#FFFFFF';

    const text = scene.add.text(offsetX, y, `${amt}${letter}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize,
      color,
    });
    container.add(text);
    offsetX += text.width + GAP;
  }

  return offsetX - x;
}

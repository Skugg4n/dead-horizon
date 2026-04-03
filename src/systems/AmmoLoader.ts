import type { GameState } from '../config/types';

// Load ammo action for DayScene: costs 1 AP, transfers all available ammo
// from resource stockpile to loadedAmmo for the night phase
export function loadAmmo(gameState: GameState, _apCost: number): { success: boolean; loaded: number; message: string } {
  const available = gameState.inventory.resources.ammo;

  if (available <= 0) {
    return { success: false, loaded: 0, message: 'No ammo in stockpile!' };
  }

  // Transfer all ammo from resources to loadedAmmo
  gameState.inventory.loadedAmmo += available;
  gameState.inventory.resources.ammo = 0;

  return {
    success: true,
    loaded: available,
    message: `${available} ammo loaded into weapons! Ready for tonight.`,
  };
}

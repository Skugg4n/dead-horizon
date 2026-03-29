// Dead Horizon -- Zone manager
// Tracks current zone, unlocked zones, and loads zone-specific wave data

import Phaser from 'phaser';
import type { GameState, ZoneId, ZoneData } from '../config/types';
import zonesJson from '../data/zones.json';
import wavesDefault from '../data/waves.json';
import wavesCity from '../data/waves-city.json';
import wavesMilitary from '../data/waves-military.json';

const zoneDataList = zonesJson.zones as unknown as ZoneData[];

const zoneDataMap = new Map<ZoneId, ZoneData>();
for (const zone of zoneDataList) {
  zoneDataMap.set(zone.id, zone);
}

export class ZoneManager {
  private scene: Phaser.Scene;
  private gameState: GameState;

  constructor(scene: Phaser.Scene, gameState: GameState) {
    this.scene = scene;
    this.gameState = gameState;
  }

  getCurrentZone(): ZoneData {
    // Default to 'forest' for old saves missing zone field
    const zoneId = this.gameState.zone ?? 'forest' as ZoneId;
    if (!this.gameState.zone) this.gameState.zone = zoneId;
    const zone = zoneDataMap.get(zoneId);
    if (!zone) throw new Error(`Unknown zone: ${zoneId}`);
    return zone;
  }

  setZone(zoneId: ZoneId): boolean {
    if (!this.isUnlocked(zoneId)) return false;
    this.gameState.zone = zoneId;
    this.scene.events.emit('zone-changed', zoneId);
    return true;
  }

  isUnlocked(zoneId: ZoneId): boolean {
    const zone = zoneDataMap.get(zoneId);
    if (!zone) return false;
    if (!zone.unlockCondition) return true;

    const cond = zone.unlockCondition;
    if (cond.type === 'wave_cleared') {
      const progress = this.gameState.zoneProgress[cond.zone];
      if (!progress) return false;
      return progress.highestWaveCleared >= cond.wave;
    }
    return false;
  }

  getUnlockedZones(): ZoneData[] {
    return zoneDataList.filter(z => this.isUnlocked(z.id));
  }

  getAllZones(): ZoneData[] {
    return [...zoneDataList];
  }

  /** Record that a wave was cleared in the current zone */
  recordWaveCleared(wave: number): void {
    const zoneId = this.gameState.zone;
    if (!this.gameState.zoneProgress[zoneId]) {
      this.gameState.zoneProgress[zoneId] = { highestWaveCleared: 0 };
    }
    const progress = this.gameState.zoneProgress[zoneId];
    if (progress && wave > progress.highestWaveCleared) {
      progress.highestWaveCleared = wave;
    }
  }

  /** Get wave data JSON for the current zone */
  getWaveData(): { waves: Array<{ wave: number; enemies: Array<{ type: string; count: number; spawnDelay: number }> }> } {
    const zone = this.getCurrentZone();
    switch (zone.waveFile) {
      case 'waves-city':
        return wavesCity as { waves: Array<{ wave: number; enemies: Array<{ type: string; count: number; spawnDelay: number }> }> };
      case 'waves-military':
        return wavesMilitary as { waves: Array<{ wave: number; enemies: Array<{ type: string; count: number; spawnDelay: number }> }> };
      default:
        return wavesDefault as { waves: Array<{ wave: number; enemies: Array<{ type: string; count: number; spawnDelay: number }> }> };
    }
  }
}

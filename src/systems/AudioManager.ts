// Procedural audio system using Web Audio API
// Generates all sound effects programmatically -- no external files needed

type SoundId =
  | 'shoot_pistol' | 'shoot_rifle' | 'shoot_shotgun' | 'shoot_melee' | 'shoot_explosives'
  | 'zombie_groan' | 'zombie_attack' | 'zombie_death'
  | 'player_hurt' | 'player_death'
  | 'wave_start' | 'wave_clear'
  | 'ui_click' | 'ui_build' | 'ui_error'
  | 'loot_pickup' | 'structure_break'
  | 'ambient_wind' | 'ambient_day';

interface SoundDef {
  generate: (ctx: AudioContext) => AudioBuffer;
  volume: number;
  cooldown: number; // ms, prevents overlapping
}

let globalCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
const bufferCache = new Map<SoundId, AudioBuffer>();
const lastPlayed = new Map<SoundId, number>();
let muted = false;
let sfxMuted = false;
let ambientMuted = false;
let masterVolume = 0.4;

// Ambient state
let ambientSource: AudioBufferSourceNode | null = null;
let ambientGain: GainNode | null = null;

function getContext(): AudioContext {
  if (!globalCtx) {
    globalCtx = new AudioContext();
    masterGain = globalCtx.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(globalCtx.destination);
  }
  if (globalCtx.state === 'suspended') {
    globalCtx.resume();
  }
  return globalCtx;
}

// --- Sound generation helpers ---

// --- Sound definitions ---

function genPistol(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.15 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 40);
    d[i] = env * (Math.random() * 2 - 1) * 0.6 + env * Math.sin(t * 800) * 0.4;
  }
  return buf;
}

function genRifle(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.2 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 30);
    d[i] = env * (Math.random() * 2 - 1) * 0.7 + env * Math.sin(t * 400) * 0.3;
  }
  return buf;
}

function genShotgun(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.3 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 15);
    // Heavy noise burst + low frequency
    d[i] = env * (Math.random() * 2 - 1) * 0.8 + env * Math.sin(t * 200) * 0.5;
  }
  return buf;
}

function genMelee(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.1 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 60);
    // Sharp whoosh
    d[i] = env * Math.sin(t * 2000 * (1 - t * 5)) * 0.5;
  }
  return buf;
}

function genExplosion(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.6 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 8);
    // Heavy rumble + noise
    d[i] = env * (Math.random() * 2 - 1) * 0.5
      + env * Math.sin(t * 60) * 0.5
      + env * Math.sin(t * 120) * 0.3;
  }
  return buf;
}

function genZombieGroan(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.5 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  const baseFreq = 80 + Math.random() * 40;
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.sin(t / 0.5 * Math.PI) * Math.exp(-t * 3);
    const freq = baseFreq + Math.sin(t * 3) * 20;
    d[i] = env * (Math.sin(t * freq * 2 * Math.PI) * 0.5
      + Math.sin(t * freq * 3 * Math.PI) * 0.2
      + (Math.random() * 2 - 1) * 0.15);
  }
  return buf;
}

function genZombieAttack(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.2 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 15);
    d[i] = env * (Math.sin(t * 300) * 0.4 + (Math.random() * 2 - 1) * 0.4);
  }
  return buf;
}

function genZombieDeath(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.4 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 6);
    // Descending tone + noise
    const freq = 200 * (1 - t * 2);
    d[i] = env * (Math.sin(t * Math.max(freq, 40) * 2 * Math.PI) * 0.4
      + (Math.random() * 2 - 1) * 0.3);
  }
  return buf;
}

function genPlayerHurt(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.15 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 25);
    d[i] = env * Math.sin(t * 600 * (1 + t * 5)) * 0.5;
  }
  return buf;
}

function genPlayerDeath(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.8 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 3);
    // Descending, ominous
    d[i] = env * (Math.sin(t * 300 * (1 - t)) * 0.4
      + Math.sin(t * 150 * (1 - t * 0.5)) * 0.3
      + (Math.random() * 2 - 1) * 0.1);
  }
  return buf;
}

function genWaveStart(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.6 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.sin(t / 0.6 * Math.PI);
    // Rising alarm tone
    d[i] = env * Math.sin(t * (400 + t * 600) * 2 * Math.PI) * 0.3;
  }
  return buf;
}

function genWaveClear(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.5 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 4);
    // Triumphant ascending chord
    d[i] = env * (
      Math.sin(t * 523 * 2 * Math.PI) * 0.25  // C5
      + Math.sin(t * 659 * 2 * Math.PI) * 0.2  // E5
      + Math.sin(t * 784 * 2 * Math.PI) * 0.2  // G5
    );
  }
  return buf;
}

function genUIClick(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.05 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    d[i] = Math.exp(-t * 200) * Math.sin(t * 3000) * 0.3;
  }
  return buf;
}

function genUIBuild(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.2 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 15);
    // Metallic clang
    d[i] = env * (Math.sin(t * 1200) * 0.3 + Math.sin(t * 2400) * 0.2 + Math.sin(t * 600) * 0.2);
  }
  return buf;
}

function genUIError(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.2 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 15);
    // Dissonant buzz
    d[i] = env * (Math.sin(t * 200) * 0.3 + Math.sin(t * 237) * 0.3);
  }
  return buf;
}

function genLootPickup(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.15 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 20);
    // Coin-like ascending ping
    d[i] = env * Math.sin(t * (1500 + t * 3000) * 2 * Math.PI) * 0.3;
  }
  return buf;
}

function genStructureBreak(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.3 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 10);
    // Crumbling noise
    d[i] = env * (Math.random() * 2 - 1) * 0.5 + env * Math.sin(t * 100) * 0.3;
  }
  return buf;
}

function genAmbientWind(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const duration = 4; // 4 seconds, will loop
  const len = Math.floor(duration * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);

  // Brown noise for wind (filtered random walk)
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    prev = (prev + (0.02 * white)) / 1.02;
    const t = i / rate;
    // Slow volume modulation for wind gusts
    const mod = 0.3 + 0.2 * Math.sin(t * 0.5) + 0.1 * Math.sin(t * 1.3);
    d[i] = prev * mod * 6;
  }

  // Crossfade loop point (last 0.2s fades into first 0.2s)
  const fadeLen = Math.floor(0.2 * rate);
  for (let i = 0; i < fadeLen; i++) {
    const fade = i / fadeLen;
    const endIdx = len - fadeLen + i;
    d[endIdx] = (d[endIdx] ?? 0) * (1 - fade) + (d[i] ?? 0) * fade;
  }
  return buf;
}

function genAmbientDay(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const duration = 6;
  const len = Math.floor(duration * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);

  // Gentle ambient: soft wind + occasional high-pitched chirps
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const white = Math.random() * 2 - 1;
    prev = (prev + (0.01 * white)) / 1.01;

    // Base wind (very soft)
    let sample = prev * 2 * 0.15;

    // Bird-like chirps at semi-random intervals
    const chirpPhase = (t * 1.7) % 1;
    if (chirpPhase < 0.02) {
      const chirpEnv = Math.sin(chirpPhase / 0.02 * Math.PI);
      sample += chirpEnv * Math.sin(t * 4000) * 0.08;
    }
    const chirpPhase2 = ((t + 0.5) * 0.9) % 1;
    if (chirpPhase2 < 0.015) {
      const chirpEnv = Math.sin(chirpPhase2 / 0.015 * Math.PI);
      sample += chirpEnv * Math.sin(t * 5200) * 0.06;
    }

    d[i] = sample;
  }

  // Crossfade loop
  const fadeLen = Math.floor(0.3 * rate);
  for (let i = 0; i < fadeLen; i++) {
    const fade = i / fadeLen;
    const endIdx = len - fadeLen + i;
    d[endIdx] = (d[endIdx] ?? 0) * (1 - fade) + (d[i] ?? 0) * fade;
  }
  return buf;
}

const SOUND_DEFS: Record<SoundId, SoundDef> = {
  shoot_pistol: { generate: genPistol, volume: 0.5, cooldown: 80 },
  shoot_rifle: { generate: genRifle, volume: 0.55, cooldown: 80 },
  shoot_shotgun: { generate: genShotgun, volume: 0.65, cooldown: 100 },
  shoot_melee: { generate: genMelee, volume: 0.4, cooldown: 60 },
  shoot_explosives: { generate: genExplosion, volume: 0.7, cooldown: 200 },
  zombie_groan: { generate: genZombieGroan, volume: 0.2, cooldown: 1500 },
  zombie_attack: { generate: genZombieAttack, volume: 0.3, cooldown: 800 },
  zombie_death: { generate: genZombieDeath, volume: 0.35, cooldown: 50 },
  player_hurt: { generate: genPlayerHurt, volume: 0.5, cooldown: 200 },
  player_death: { generate: genPlayerDeath, volume: 0.6, cooldown: 0 },
  wave_start: { generate: genWaveStart, volume: 0.4, cooldown: 0 },
  wave_clear: { generate: genWaveClear, volume: 0.5, cooldown: 0 },
  ui_click: { generate: genUIClick, volume: 0.25, cooldown: 30 },
  ui_build: { generate: genUIBuild, volume: 0.35, cooldown: 100 },
  ui_error: { generate: genUIError, volume: 0.35, cooldown: 200 },
  loot_pickup: { generate: genLootPickup, volume: 0.3, cooldown: 50 },
  structure_break: { generate: genStructureBreak, volume: 0.45, cooldown: 100 },
  ambient_wind: { generate: genAmbientWind, volume: 0.15, cooldown: 0 },
  ambient_day: { generate: genAmbientDay, volume: 0.12, cooldown: 0 },
};

// Map weapon classes to sound IDs
const WEAPON_SOUND_MAP: Record<string, SoundId> = {
  melee: 'shoot_melee',
  pistol: 'shoot_pistol',
  rifle: 'shoot_rifle',
  shotgun: 'shoot_shotgun',
  explosives: 'shoot_explosives',
};

function getBuffer(id: SoundId): AudioBuffer {
  const cached = bufferCache.get(id);
  if (cached) return cached;

  const ctx = getContext();
  const def = SOUND_DEFS[id];
  const buffer = def.generate(ctx);
  bufferCache.set(id, buffer);
  return buffer;
}

// --- Public API ---

function play(id: SoundId): void {
  if (muted || sfxMuted) return;

  const def = SOUND_DEFS[id];
  const now = performance.now();
  const last = lastPlayed.get(id) ?? 0;
  if (now - last < def.cooldown) return;
  lastPlayed.set(id, now);

  const ctx = getContext();
  if (!masterGain) return;

  const buffer = getBuffer(id);
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gainNode = ctx.createGain();
  gainNode.gain.value = def.volume;

  source.connect(gainNode);
  gainNode.connect(masterGain);
  source.start();
}

function playWeaponSound(weaponClass: string): void {
  const soundId = WEAPON_SOUND_MAP[weaponClass];
  if (soundId) play(soundId);
}

function startAmbient(type: 'night' | 'day'): void {
  stopAmbient();
  if (muted || ambientMuted) return;

  const ctx = getContext();
  if (!masterGain) return;

  const id: SoundId = type === 'night' ? 'ambient_wind' : 'ambient_day';
  const buffer = getBuffer(id);
  const def = SOUND_DEFS[id];

  ambientSource = ctx.createBufferSource();
  ambientSource.buffer = buffer;
  ambientSource.loop = true;

  ambientGain = ctx.createGain();
  ambientGain.gain.value = 0;
  // Fade in over 2 seconds
  ambientGain.gain.linearRampToValueAtTime(def.volume, ctx.currentTime + 2);

  ambientSource.connect(ambientGain);
  ambientGain.connect(masterGain);
  ambientSource.start();
}

function stopAmbient(): void {
  if (ambientSource) {
    try {
      if (ambientGain && globalCtx) {
        ambientGain.gain.linearRampToValueAtTime(0, globalCtx.currentTime + 0.5);
        const src = ambientSource;
        setTimeout(() => {
          try { src.stop(); } catch { /* already stopped */ }
        }, 600);
      } else {
        ambientSource.stop();
      }
    } catch { /* already stopped */ }
    ambientSource = null;
    ambientGain = null;
  }
}

function setMuted(value: boolean): void {
  muted = value;
  if (muted) stopAmbient();
}

function isMuted(): boolean {
  return muted;
}

function setSfxMuted(value: boolean): void {
  sfxMuted = value;
}

function isSfxMuted(): boolean {
  return sfxMuted;
}

function setAmbientMuted(value: boolean): void {
  ambientMuted = value;
  if (ambientMuted) stopAmbient();
}

function isAmbientMuted(): boolean {
  return ambientMuted;
}

function setVolume(vol: number): void {
  masterVolume = Math.max(0, Math.min(1, vol));
  if (masterGain) {
    masterGain.gain.value = masterVolume;
  }
}

function getVolume(): number {
  return masterVolume;
}

// Initialize audio context on first user interaction
function initOnInteraction(): void {
  const handler = () => {
    getContext();
    document.removeEventListener('click', handler);
    document.removeEventListener('keydown', handler);
  };
  document.addEventListener('click', handler);
  document.addEventListener('keydown', handler);
}

export const AudioManager = {
  play,
  playWeaponSound,
  startAmbient,
  stopAmbient,
  setMuted,
  isMuted,
  setSfxMuted,
  isSfxMuted,
  setAmbientMuted,
  isAmbientMuted,
  setVolume,
  getVolume,
  initOnInteraction,
};

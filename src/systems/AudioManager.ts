// Procedural audio system using Web Audio API
// Generates all sound effects programmatically -- no external files needed

type SoundId =
  | 'shoot_pistol' | 'shoot_rifle' | 'shoot_shotgun' | 'shoot_melee' | 'shoot_explosives'
  | 'zombie_groan' | 'zombie_attack' | 'zombie_death'
  | 'player_hurt' | 'player_death'
  | 'wave_start' | 'wave_clear'
  | 'ui_click' | 'ui_build' | 'ui_error'
  | 'loot_pickup' | 'structure_break'
  | 'ambient_wind' | 'ambient_day'
  // Forest zone ambient sounds
  | 'forest_ambient_day'
  | 'forest_ambient_night'
  // F4: New procedural sounds
  | 'footstep'
  | 'melee_hit'
  | 'zombie_attack_hit'
  | 'structure_damage'
  | 'day_to_night'
  // F5: Trap, boss and zone sounds
  | 'trap_nail_board'
  | 'trap_trip_wire'
  | 'trap_glass_shards'
  | 'trap_tar_pit'
  | 'trap_shock_wire'
  | 'trap_spring_launcher'
  | 'trap_chain_wall'
  | 'boss_roar'
  | 'boss_stomp'
  | 'zone_complete'
  | 'final_night_start';

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

// --- F4: New procedural sound generators ---

/** Soft footstep: very short low thump, muffled */
function genFootstep(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.06 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 80);
    // Low thump -- combination of low sine + filtered noise
    d[i] = env * (Math.sin(t * 120 * 2 * Math.PI) * 0.4 + (Math.random() * 2 - 1) * 0.15);
  }
  return buf;
}

/** Melee hit thud: dull impact, body-hitting sound */
function genMeleeHit(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.12 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 35);
    // Dull impact: low frequency + noise, no high pitch
    d[i] = env * (Math.sin(t * 80 * 2 * Math.PI) * 0.5
      + Math.sin(t * 150 * 2 * Math.PI) * 0.25
      + (Math.random() * 2 - 1) * 0.2);
  }
  return buf;
}

/** Zombie attack hit: guttural slap sound when zombie hits player */
function genZombieAttackHit(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.18 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  const baseFreq = 60 + Math.random() * 30;
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Short guttural grunt + wet slap noise
    const gutturalEnv = Math.exp(-t * 20);
    const slapEnv = Math.exp(-t * 60) * (i < Math.floor(0.01 * rate) ? 1 : 0.3);
    d[i] = gutturalEnv * (Math.sin(t * baseFreq * 2 * Math.PI) * 0.4
      + Math.sin(t * baseFreq * 1.5 * 2 * Math.PI) * 0.2)
      + slapEnv * (Math.random() * 2 - 1) * 0.5;
  }
  return buf;
}

/** Structure damage: creak/crack sound when structure takes a hit */
function genStructureDamage(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.2 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 18);
    // Woody crack: mid-freq noise burst + sharp transient
    const crack = i < Math.floor(0.005 * rate) ? (Math.random() * 2 - 1) * 0.8 : 0;
    d[i] = env * (Math.sin(t * 300 * 2 * Math.PI) * 0.15
      + (Math.random() * 2 - 1) * 0.3)
      + crack;
  }
  return buf;
}

/**
 * Forest ambient day: layered bird chirps + wind through leaves.
 * Multiple chirp voices at different rates create a convincing dawn chorus.
 * Loops seamlessly over an 8-second buffer.
 */
function genForestAmbientDay(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const duration = 8;
  const len = Math.floor(duration * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);

  // Brown-noise wind base (leaves rustling)
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    prev = (prev + 0.015 * white) / 1.015;
    d[i] = prev * 2.5 * 0.18;
  }

  // Bird voice 1 -- short ascending trill (warbler-like), every ~1.3s
  const v1Rate = 1.3;
  const v1Freq = 3800;
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const phase = (t * v1Rate) % 1;
    if (phase < 0.035) {
      const env = Math.sin(phase / 0.035 * Math.PI);
      const sweep = v1Freq + Math.sin(phase / 0.035 * Math.PI * 6) * 400;
      d[i] = (d[i] ?? 0) + env * Math.sin(t * sweep * 2 * Math.PI) * 0.09;
    }
  }

  // Bird voice 2 -- deeper, two-note call (thrush-like), every ~2.1s, offset by 0.6s
  const v2Rate = 2.1;
  const v2Freq = 2600;
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const phase = ((t + 0.6) * v2Rate) % 1;
    if (phase < 0.05) {
      const env = Math.sin(phase / 0.05 * Math.PI);
      // Two-note: first half higher, second lower
      const noteShift = phase < 0.025 ? 0 : -300;
      d[i] = (d[i] ?? 0) + env * Math.sin(t * (v2Freq + noteShift) * 2 * Math.PI) * 0.07;
    }
  }

  // Bird voice 3 -- high rapid ticking (wren-like), brief burst every ~3s offset by 1.4s
  const v3Rate = 3.0;
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const phase = ((t + 1.4) * v3Rate) % 1;
    if (phase < 0.08) {
      // Rapid ticking: 18 clicks per second inside the burst
      const env = Math.sin(phase / 0.08 * Math.PI) * 0.8;
      const tick = Math.sin(t * 18 * 2 * Math.PI * 250) > 0.7 ? 1 : 0;
      d[i] = (d[i] ?? 0) + env * tick * 0.05;
    }
  }

  // Crossfade loop point (last 0.4s fades into first 0.4s)
  const fadeLen = Math.floor(0.4 * rate);
  for (let i = 0; i < fadeLen; i++) {
    const fade = i / fadeLen;
    const endIdx = len - fadeLen + i;
    d[endIdx] = (d[endIdx] ?? 0) * (1 - fade) + (d[i] ?? 0) * fade;
  }
  return buf;
}

/**
 * Forest ambient night: crickets + distant owl + occasional twig snap.
 * Darker, denser texture with steady insect pulse and sparse accents.
 * Loops over a 10-second buffer.
 */
function genForestAmbientNight(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const duration = 10;
  const len = Math.floor(duration * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);

  // Continuous cricket chorus: two slightly detuned oscillators at ~4400 Hz
  // pulsing at ~14 Hz to simulate stridulation
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Amplitude modulated by slow pulse (~14 Hz) simulating cricket chirp rhythm
    const pulse = 0.45 + 0.55 * Math.max(0, Math.sin(t * 14 * 2 * Math.PI));
    const cricket1 = Math.sin(t * 4400 * 2 * Math.PI) * 0.5;
    const cricket2 = Math.sin(t * 4437 * 2 * Math.PI) * 0.3; // slight detune for texture
    d[i] = pulse * (cricket1 + cricket2) * 0.06;
  }

  // Distant owl -- low two-tone hoot, every ~4.5s, offset 1s
  const owlPeriod = 4.5;
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const phase = ((t + 1.0) / owlPeriod) % 1;
    if (phase < 0.12) {
      const env = Math.sin(phase / 0.12 * Math.PI);
      // Two-note hoot: descend from 440 to 370 Hz
      const freq = 440 - (phase / 0.12) * 70;
      d[i] = (d[i] ?? 0) + env * Math.sin(t * freq * 2 * Math.PI) * 0.055;
    }
  }

  // Twig snap -- short noisy transient, occurs twice per loop at beat 2s and 7s
  const snapTimes = [2.0, 6.8];
  for (const snapT of snapTimes) {
    const snapStart = Math.floor(snapT * rate);
    const snapLen = Math.floor(0.04 * rate);
    for (let j = 0; j < snapLen && snapStart + j < len; j++) {
      const env = Math.exp(-j / snapLen * 12);
      d[snapStart + j] = (d[snapStart + j] ?? 0) + env * (Math.random() * 2 - 1) * 0.18;
    }
  }

  // Very soft low-frequency wind undertone (like a distant breeze)
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    prev = (prev + 0.008 * white) / 1.008;
    d[i] = (d[i] ?? 0) + prev * 1.8 * 0.12;
  }

  // Crossfade loop point (last 0.5s fades into first 0.5s)
  const fadeLen = Math.floor(0.5 * rate);
  for (let i = 0; i < fadeLen; i++) {
    const fade = i / fadeLen;
    const endIdx = len - fadeLen + i;
    d[endIdx] = (d[endIdx] ?? 0) * (1 - fade) + (d[i] ?? 0) * fade;
  }
  return buf;
}

// --- F5: Trap, boss and zone sound generators ---

/** Nail Board: short woody crunch -- wood + metal impact */
function genTrapNailBoard(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.18 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Sharp transient at start (nail strike), then woody decay
    const crack = i < Math.floor(0.004 * rate) ? (Math.random() * 2 - 1) * 0.9 : 0;
    const woodEnv = Math.exp(-t * 28);
    const metalEnv = Math.exp(-t * 55);
    d[i] = crack
      + woodEnv * (Math.sin(t * 320 * 2 * Math.PI) * 0.25 + (Math.random() * 2 - 1) * 0.2)
      + metalEnv * Math.sin(t * 1800 * 2 * Math.PI) * 0.15;
  }
  return buf;
}

/** Trip Wire: sharp snap/twang -- taut wire breaking */
function genTrapTripWire(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.22 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // High-pitched snap at t=0, then twang descending
    const snapEnv = Math.exp(-t * 80);
    const twangEnv = Math.exp(-t * 12);
    // Twang: high frequency descending (string vibration)
    const twangFreq = 1400 * Math.exp(-t * 6);
    d[i] = snapEnv * (Math.random() * 2 - 1) * 0.6
      + twangEnv * Math.sin(t * twangFreq * 2 * Math.PI) * 0.35;
  }
  return buf;
}

/** Glass Shards: short high-frequency crash -- tinkling breaking glass */
function genTrapGlassShards(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.2 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // White noise burst (glass shatter) + high-pitched ring
    const noiseEnv = Math.exp(-t * 35);
    const ringEnv = Math.exp(-t * 18);
    // Multiple high-frequency partial tones for glass character
    d[i] = noiseEnv * (Math.random() * 2 - 1) * 0.45
      + ringEnv * (
        Math.sin(t * 3800 * 2 * Math.PI) * 0.15
        + Math.sin(t * 5200 * 2 * Math.PI) * 0.10
        + Math.sin(t * 4600 * 2 * Math.PI) * 0.08
      );
  }
  return buf;
}

/** Tar Pit: squelch/bubble -- viscous low-frequency gurgle */
function genTrapTarPit(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.35 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Low bubble: slow sine at ~60 Hz with noise texture
    const bubbleEnv = Math.exp(-t * 8);
    const squelchEnv = i < Math.floor(0.05 * rate) ? Math.exp(-t * 40) : 0;
    d[i] = bubbleEnv * (
      Math.sin(t * 58 * 2 * Math.PI) * 0.4
      + Math.sin(t * 90 * 2 * Math.PI) * 0.2
      + (Math.random() * 2 - 1) * 0.12
    ) + squelchEnv * (Math.random() * 2 - 1) * 0.5;
  }
  return buf;
}

/** Shock Wire: electric zap -- buzz + crackle discharge */
function genTrapShockWire(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.25 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Electrical buzz: 120 Hz hum + heavy noise crackle
    const env = Math.exp(-t * 18);
    const crackle = Math.random() > 0.85 ? (Math.random() * 2 - 1) * 0.6 : 0;
    d[i] = env * (
      Math.sin(t * 120 * 2 * Math.PI) * 0.3
      + Math.sin(t * 240 * 2 * Math.PI) * 0.15
      + (Math.random() * 2 - 1) * 0.2
    ) + env * crackle;
  }
  return buf;
}

/** Spring Launcher: metallic THUNK + boing -- compressed spring releasing */
function genTrapSpringLauncher(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.3 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Heavy thunk at impact: low freq impulse
    const thunkEnv = Math.exp(-t * 40);
    // Spring boing: descending metallic resonance
    const boingEnv = Math.exp(-t * 10);
    const boingFreq = 900 * Math.exp(-t * 5);
    d[i] = thunkEnv * (
      Math.sin(t * 180 * 2 * Math.PI) * 0.4
      + (Math.random() * 2 - 1) * 0.25
    ) + boingEnv * Math.sin(t * boingFreq * 2 * Math.PI) * 0.3;
  }
  return buf;
}

/** Chain Wall: metallic chain rattle -- clinking links on contact */
function genTrapChainWall(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.28 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Multiple metallic pings at different frequencies (chain links)
    const env = Math.exp(-t * 12);
    // Irregular rattle pattern via modulated noise
    const rattle = (Math.sin(t * 28 * 2 * Math.PI) > 0.3) ? (Math.random() * 2 - 1) * 0.4 : 0;
    d[i] = env * (
      Math.sin(t * 1100 * 2 * Math.PI) * 0.2
      + Math.sin(t * 1450 * 2 * Math.PI) * 0.15
      + Math.sin(t * 1700 * 2 * Math.PI) * 0.10
    ) + env * rattle;
  }
  return buf;
}

/** Boss Roar: deep, threatening growl -- longer than zombie sounds */
function genBossRoar(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(1.6 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  const baseFreq = 55 + Math.random() * 20; // very low, between 55-75 Hz
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Envelope: build up then long sustain and fade
    const env = t < 0.2
      ? t / 0.2
      : Math.exp(-(t - 0.2) * 1.5);
    // Sub-bass growl with harmonics + modulation
    const modFreq = baseFreq + Math.sin(t * 4.5) * 18 + Math.sin(t * 1.8) * 10;
    d[i] = env * (
      Math.sin(t * modFreq * 2 * Math.PI) * 0.4
      + Math.sin(t * modFreq * 2 * 2 * Math.PI) * 0.2
      + Math.sin(t * modFreq * 3 * 2 * Math.PI) * 0.1
      + (Math.random() * 2 - 1) * 0.08
    );
  }
  return buf;
}

/** Boss Stomp: heavy ground thump -- massive weight impact */
function genBossStomp(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.22 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Very low impact: sub-bass thump with fast decay + noise layer
    const env = Math.exp(-t * 22);
    const subEnv = Math.exp(-t * 8);
    d[i] = env * (Math.random() * 2 - 1) * 0.3
      + subEnv * Math.sin(t * 45 * 2 * Math.PI) * 0.55
      + subEnv * Math.sin(t * 80 * 2 * Math.PI) * 0.25;
  }
  return buf;
}

/** Zone Complete: triumphant short fanfare -- relief and victory */
function genZoneComplete(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(1.8 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  // Ascending fanfare: four notes stepping up
  // C4 -> E4 -> G4 -> C5 each held ~0.35s with a brief gap
  const notes = [
    { freq: 261.6, start: 0.0,  dur: 0.28 }, // C4
    { freq: 329.6, start: 0.3,  dur: 0.28 }, // E4
    { freq: 392.0, start: 0.6,  dur: 0.28 }, // G4
    { freq: 523.2, start: 0.9,  dur: 0.55 }, // C5 -- held longer for resolution
  ];
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    let sample = 0;
    for (const note of notes) {
      const nt = t - note.start;
      if (nt >= 0 && nt < note.dur) {
        const env = Math.sin(nt / note.dur * Math.PI);
        // Chord-like: root + fifth for fullness
        sample += env * (
          Math.sin(nt * note.freq * 2 * Math.PI) * 0.3
          + Math.sin(nt * note.freq * 1.5 * 2 * Math.PI) * 0.12
        );
      }
    }
    d[i] = sample;
  }
  return buf;
}

/** Final Night Start: deep, ominous doom chord -- dread and tension */
function genFinalNightStart(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(2.0 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Slow build-in, sustained dissonant low chord, fade out
    const env = t < 0.3
      ? t / 0.3
      : Math.exp(-(t - 0.3) * 1.2);
    // Tritone dissonance for dread (e.g. D + Ab) -- very low register
    d[i] = env * (
      Math.sin(t * 73.4 * 2 * Math.PI) * 0.35   // D2
      + Math.sin(t * 103.8 * 2 * Math.PI) * 0.25  // Ab2 (tritone above D)
      + Math.sin(t * 36.7 * 2 * Math.PI) * 0.2    // D1 sub-bass
      + (Math.random() * 2 - 1) * 0.04            // subtle noise layer
    );
  }
  return buf;
}

/** Day-to-night whoosh: dramatic sweep down, ominous */
function genDayToNight(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(1.2 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Rising then sharply descending tone (like a gate slamming)
    const env = t < 0.4
      ? (t / 0.4)                          // fade in
      : Math.exp(-(t - 0.4) * 3);          // fast fade out
    const freq = 600 * Math.exp(-t * 1.5); // pitch falls from 600hz to ~80hz
    // Noise element for whoosh
    const noiseEnv = Math.exp(-t * 4) * 0.3;
    d[i] = env * (
      Math.sin(t * freq * 2 * Math.PI) * 0.35
      + Math.sin(t * freq * 0.5 * 2 * Math.PI) * 0.2
    ) + noiseEnv * (Math.random() * 2 - 1);
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
  forest_ambient_day: { generate: genForestAmbientDay, volume: 0.13, cooldown: 0 },
  forest_ambient_night: { generate: genForestAmbientNight, volume: 0.11, cooldown: 0 },
  // F4: New sounds
  footstep: { generate: genFootstep, volume: 0.18, cooldown: 250 },
  melee_hit: { generate: genMeleeHit, volume: 0.45, cooldown: 80 },
  zombie_attack_hit: { generate: genZombieAttackHit, volume: 0.4, cooldown: 200 },
  structure_damage: { generate: genStructureDamage, volume: 0.35, cooldown: 120 },
  day_to_night: { generate: genDayToNight, volume: 0.55, cooldown: 0 },
  // F5: Trap, boss and zone sounds
  trap_nail_board:     { generate: genTrapNailBoard,     volume: 0.40, cooldown: 80  },
  trap_trip_wire:      { generate: genTrapTripWire,      volume: 0.38, cooldown: 100 },
  trap_glass_shards:   { generate: genTrapGlassShards,   volume: 0.32, cooldown: 600 },
  trap_tar_pit:        { generate: genTrapTarPit,        volume: 0.30, cooldown: 800 },
  trap_shock_wire:     { generate: genTrapShockWire,     volume: 0.45, cooldown: 200 },
  trap_spring_launcher:{ generate: genTrapSpringLauncher,volume: 0.48, cooldown: 200 },
  trap_chain_wall:     { generate: genTrapChainWall,     volume: 0.35, cooldown: 300 },
  boss_roar:           { generate: genBossRoar,          volume: 0.65, cooldown: 0   },
  boss_stomp:          { generate: genBossStomp,         volume: 0.50, cooldown: 700 },
  zone_complete:       { generate: genZoneComplete,      volume: 0.55, cooldown: 0   },
  final_night_start:   { generate: genFinalNightStart,   volume: 0.60, cooldown: 0   },
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

// F4/F5: Sounds that receive +/- 10% pitch randomization on every play
const PITCH_VARIED_SOUNDS = new Set<SoundId>([
  'shoot_pistol', 'shoot_rifle', 'shoot_shotgun', 'shoot_melee', 'shoot_explosives',
  'zombie_groan', 'zombie_attack', 'zombie_death',
  'footstep', 'melee_hit', 'zombie_attack_hit',
  // Trap and boss sounds get slight pitch variation to avoid repetition
  'trap_nail_board', 'trap_trip_wire', 'trap_glass_shards',
  'trap_tar_pit', 'trap_shock_wire', 'trap_spring_launcher', 'trap_chain_wall',
  'boss_stomp',
]);

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

  // F4: Apply random pitch variation (+/- 10%) for weapon and zombie sounds
  if (PITCH_VARIED_SOUNDS.has(id)) {
    source.playbackRate.value = 0.9 + Math.random() * 0.2;
  }

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

/**
 * Start a looping ambient sound.
 * type: general 'night'/'day', or zone-specific variants like 'forest_day'/'forest_night'.
 * Zone-specific types resolve to richer procedural sounds for that zone.
 */
function startAmbient(type: 'night' | 'day' | 'forest_day' | 'forest_night'): void {
  stopAmbient();
  if (muted || ambientMuted) return;

  const ctx = getContext();
  if (!masterGain) return;

  // Resolve the SoundId from the requested ambient type
  let id: SoundId;
  if (type === 'forest_day') {
    id = 'forest_ambient_day';
  } else if (type === 'forest_night') {
    id = 'forest_ambient_night';
  } else if (type === 'night') {
    id = 'ambient_wind';
  } else {
    id = 'ambient_day';
  }

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

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
  | 'final_night_start'
  // F6: Zone-specific ambient
  | 'city_ambient_day'
  | 'city_ambient_night'
  | 'military_ambient_day'
  | 'military_ambient_night'
  // F6: Footstep variants
  | 'footstep_grass'
  | 'footstep_concrete'
  | 'footstep_metal'
  // F6: Weather
  | 'rain_loop'
  | 'thunder'
  | 'wind_gust'
  // F6: Pickup sounds
  | 'pickup_supply'
  | 'pickup_medkit'
  | 'pickup_ammo'
  | 'pickup_adrenaline'
  | 'pickup_survivor'
  // F6: Zombie variation
  | 'zombie_scream'
  | 'zombie_spit'
  | 'zombie_charge'
  | 'zombie_tunnel'
  // F6: UI / feedback
  | 'weapon_break'
  | 'weapon_upgrade'
  | 'blueprint_found'
  | 'achievement_unlock'
  | 'night_warning'
  // F6: Boss-specific
  | 'boss_charge'
  | 'boss_acid'
  | 'boss_tank_stomp';

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

// ============================================================
// F6: Zone-specific ambient generators
// ============================================================

/**
 * City ambient day: distant sirens, wind between buildings, occasional breaking glass.
 * 10-second buffer loops seamlessly.
 */
function genCityAmbientDay(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const duration = 10;
  const len = Math.floor(duration * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);

  // Low-frequency urban hum (power lines / HVAC) -- band-limited brown noise
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    prev = (prev + 0.012 * white) / 1.012;
    d[i] = prev * 2.2 * 0.12;
  }

  // Wind between buildings: medium-speed sweep noise band
  let prevW = 0;
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const white = Math.random() * 2 - 1;
    prevW = (prevW + 0.03 * white) / 1.03;
    const gustMod = 0.4 + 0.3 * Math.sin(t * 0.7) + 0.15 * Math.sin(t * 1.8);
    d[i] = (d[i] ?? 0) + prevW * 3 * gustMod * 0.09;
  }

  // Distant sirens: two-tone wail, ~220/180 Hz, period 3s, offset 1.5s, very quiet
  const sirenPeriod = 3.0;
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const phase = (t % sirenPeriod) / sirenPeriod;
    // Wail only during the first 0.6 of each period
    if (phase < 0.6) {
      const env = Math.sin((phase / 0.6) * Math.PI) * 0.04;
      // Alternate between two tones each half-cycle
      const freq = phase < 0.3 ? 220 : 180;
      d[i] = (d[i] ?? 0) + env * Math.sin(t * freq * 2 * Math.PI);
    }
  }

  // Glass break transient at t=5.5s -- very subtle
  {
    const glassStart = Math.floor(5.5 * rate);
    const glassLen = Math.floor(0.12 * rate);
    for (let j = 0; j < glassLen && glassStart + j < len; j++) {
      const env = Math.exp(-j / glassLen * 20);
      const idx = glassStart + j;
      d[idx] = (d[idx] ?? 0) + env * (Math.random() * 2 - 1) * 0.09
        + env * Math.sin(j / glassLen * 5500) * 0.04;
    }
  }

  // Crossfade loop
  const fadeLen = Math.floor(0.5 * rate);
  for (let i = 0; i < fadeLen; i++) {
    const fade = i / fadeLen;
    const endIdx = len - fadeLen + i;
    d[endIdx] = (d[endIdx] ?? 0) * (1 - fade) + (d[i] ?? 0) * fade;
  }
  return buf;
}

/**
 * City ambient night: dark hiss, metal creak, distant scream.
 * 10-second buffer.
 */
function genCityAmbientNight(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const duration = 10;
  const len = Math.floor(duration * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);

  // Dark hiss base: very quiet white-noise pass
  for (let i = 0; i < len; i++) {
    d[i] = (Math.random() * 2 - 1) * 0.015;
  }

  // Low sub-rumble (filtered brown noise)
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    prev = (prev + 0.006 * white) / 1.006;
    d[i] = (d[i] ?? 0) + prev * 1.8 * 0.14;
  }

  // Metal creak: descending metallic tone at t=3s and t=8s
  const creakTimes = [3.0, 8.0];
  for (const ct of creakTimes) {
    const start = Math.floor(ct * rate);
    const cLen = Math.floor(0.35 * rate);
    for (let j = 0; j < cLen && start + j < len; j++) {
      const t = j / rate;
      const env = Math.exp(-t * 7);
      const freq = 900 * Math.exp(-t * 4);
      const idx = start + j;
      d[idx] = (d[idx] ?? 0) + env * Math.sin(t * freq * 2 * Math.PI) * 0.06
        + env * (Math.random() * 2 - 1) * 0.02;
    }
  }

  // Distant scream at t=6.5s -- human-vocal-like descending tone
  {
    const scStart = Math.floor(6.5 * rate);
    const scLen = Math.floor(0.5 * rate);
    for (let j = 0; j < scLen && scStart + j < len; j++) {
      const t = j / rate;
      const env = Math.sin(t / 0.5 * Math.PI) * 0.035;
      const freq = 800 - t * 600;
      const idx = scStart + j;
      d[idx] = (d[idx] ?? 0) + env * (
        Math.sin(t * Math.max(freq, 200) * 2 * Math.PI) * 0.6
        + Math.sin(t * Math.max(freq, 200) * 3 * Math.PI) * 0.2
        + (Math.random() * 2 - 1) * 0.1
      );
    }
  }

  // Crossfade loop
  const fadeLen = Math.floor(0.5 * rate);
  for (let i = 0; i < fadeLen; i++) {
    const fade = i / fadeLen;
    const endIdx = len - fadeLen + i;
    d[endIdx] = (d[endIdx] ?? 0) * (1 - fade) + (d[i] ?? 0) * fade;
  }
  return buf;
}

/**
 * Military ambient day: open wind, flag flapping, distant radio static.
 * 10-second buffer.
 */
function genMilitaryAmbientDay(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const duration = 10;
  const len = Math.floor(duration * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);

  // Open-field wind: slightly faster sweep than city
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const white = Math.random() * 2 - 1;
    prev = (prev + 0.025 * white) / 1.025;
    const mod = 0.5 + 0.25 * Math.sin(t * 0.4) + 0.1 * Math.sin(t * 1.1);
    d[i] = prev * 3 * mod * 0.13;
  }

  // Flag flapping: rhythmic noise burst at ~5 Hz
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const phase = (t * 5) % 1;
    if (phase < 0.12) {
      const env = Math.sin(phase / 0.12 * Math.PI) * 0.05;
      d[i] = (d[i] ?? 0) + env * (Math.random() * 2 - 1);
    }
  }

  // Radio static bursts at t=2s and t=7s
  const radioTimes = [2.0, 7.0];
  for (const rt of radioTimes) {
    const start = Math.floor(rt * rate);
    const rLen = Math.floor(0.4 * rate);
    for (let j = 0; j < rLen && start + j < len; j++) {
      const t = j / rate;
      const env = Math.sin(t / 0.4 * Math.PI) * 0.04;
      const idx = start + j;
      // Bandpass-like static: white noise * sine carrier at 2400 Hz
      d[idx] = (d[idx] ?? 0) + env * (Math.random() * 2 - 1) * Math.abs(Math.sin(t * 2400));
    }
  }

  // Crossfade loop
  const fadeLen = Math.floor(0.5 * rate);
  for (let i = 0; i < fadeLen; i++) {
    const fade = i / fadeLen;
    const endIdx = len - fadeLen + i;
    d[endIdx] = (d[endIdx] ?? 0) * (1 - fade) + (d[i] ?? 0) * fade;
  }
  return buf;
}

/**
 * Military ambient night: deep hiss, motor drone, metal clank.
 * 10-second buffer.
 */
function genMilitaryAmbientNight(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const duration = 10;
  const len = Math.floor(duration * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);

  // Deep hiss with low sub-tone
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    prev = (prev + 0.007 * white) / 1.007;
    d[i] = prev * 2.0 * 0.13;
  }

  // Distant motor drone at ~45 Hz (generator hum)
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    d[i] = (d[i] ?? 0) + Math.sin(t * 45 * 2 * Math.PI) * 0.022
      + Math.sin(t * 90 * 2 * Math.PI) * 0.01;
  }

  // Metal clanks at t=1.8s, t=6.2s
  const clankTimes = [1.8, 6.2];
  for (const ct of clankTimes) {
    const start = Math.floor(ct * rate);
    const cLen = Math.floor(0.18 * rate);
    for (let j = 0; j < cLen && start + j < len; j++) {
      const t = j / rate;
      const env = Math.exp(-t * 22);
      const idx = start + j;
      d[idx] = (d[idx] ?? 0) + env * (
        Math.sin(t * 1300 * 2 * Math.PI) * 0.07
        + Math.sin(t * 1800 * 2 * Math.PI) * 0.04
        + (Math.random() * 2 - 1) * 0.03
      );
    }
  }

  // Crossfade loop
  const fadeLen = Math.floor(0.5 * rate);
  for (let i = 0; i < fadeLen; i++) {
    const fade = i / fadeLen;
    const endIdx = len - fadeLen + i;
    d[endIdx] = (d[endIdx] ?? 0) * (1 - fade) + (d[i] ?? 0) * fade;
  }
  return buf;
}

// ============================================================
// F6: Footstep variants
// ============================================================

/** Footstep on grass: soft, muffled low thump + subtle leaf rustle */
function genFootstepGrass(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.07 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 70);
    // Very low thump + soft rustle noise
    d[i] = env * (Math.sin(t * 90 * 2 * Math.PI) * 0.35
      + (Math.random() * 2 - 1) * 0.12);
  }
  return buf;
}

/** Footstep on concrete: harder impact with slight echo tail */
function genFootstepConcrete(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.09 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Sharp transient + mid-freq echo
    const env = Math.exp(-t * 55);
    const echoEnv = Math.exp(-t * 18);
    d[i] = env * (Math.random() * 2 - 1) * 0.4
      + echoEnv * Math.sin(t * 350 * 2 * Math.PI) * 0.18;
  }
  return buf;
}

/** Footstep on metal: ringing clang with sustain */
function genFootstepMetal(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.1 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 40);
    const ringEnv = Math.exp(-t * 12);
    // Sharp noise transient + metallic ring partials
    d[i] = env * (Math.random() * 2 - 1) * 0.3
      + ringEnv * (
        Math.sin(t * 1100 * 2 * Math.PI) * 0.2
        + Math.sin(t * 1650 * 2 * Math.PI) * 0.1
        + Math.sin(t * 2200 * 2 * Math.PI) * 0.06
      );
  }
  return buf;
}

// ============================================================
// F6: Weather sounds
// ============================================================

/**
 * Rain loop: white noise low-pass filtered (rainfall texture).
 * 8-second buffer, seamless loop.
 */
function genRainLoop(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const duration = 8;
  const len = Math.floor(duration * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);

  // Simple one-pole LP filter applied to white noise to simulate rain
  // cutoff ~800 Hz approximated by coefficient alpha = 0.08
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    lp = lp + 0.08 * (white - lp);
    const t = i / rate;
    // Slow intensity variation for realism
    const mod = 0.7 + 0.15 * Math.sin(t * 0.3) + 0.1 * Math.sin(t * 0.7);
    d[i] = lp * mod * 1.1;
  }

  // Crossfade loop
  const fadeLen = Math.floor(0.4 * rate);
  for (let i = 0; i < fadeLen; i++) {
    const fade = i / fadeLen;
    const endIdx = len - fadeLen + i;
    d[endIdx] = (d[endIdx] ?? 0) * (1 - fade) + (d[i] ?? 0) * fade;
  }
  return buf;
}

/**
 * Thunder: noise burst with low-frequency boom and long decay tail.
 * Non-looping, ~2.5s.
 */
function genThunder(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const duration = 2.5;
  const len = Math.floor(duration * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);

  // Initial crack: short white noise burst
  const crackLen = Math.floor(0.06 * rate);
  for (let i = 0; i < crackLen; i++) {
    const env = Math.exp(-i / crackLen * 8);
    d[i] = env * (Math.random() * 2 - 1) * 0.9;
  }

  // Rolling boom: very low freq oscillation with slow decay
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 2.5);
    d[i] = (d[i] ?? 0) + env * (
      Math.sin(t * 38 * 2 * Math.PI) * 0.35
      + Math.sin(t * 55 * 2 * Math.PI) * 0.2
      + (Math.random() * 2 - 1) * 0.08
    );
  }

  return buf;
}

/**
 * Wind gust: noise with sweeping band-pass character (pitch rises then falls).
 * ~1.2s, non-looping.
 */
function genWindGust(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const duration = 1.2;
  const len = Math.floor(duration * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);

  // Brown noise modulated by an envelope + band sweep simulated via sine carrier
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const white = Math.random() * 2 - 1;
    prev = (prev + 0.05 * white) / 1.05;
    // Envelope: rise then fall
    const env = Math.sin(t / duration * Math.PI);
    // Frequency sweep: 200 Hz to 600 Hz and back
    const sweepFreq = 200 + 400 * Math.sin(t / duration * Math.PI);
    d[i] = env * (
      prev * 3 * 0.5
      + Math.sin(t * sweepFreq * 2 * Math.PI) * 0.06
    );
  }
  return buf;
}

// ============================================================
// F6: Pickup sounds
// ============================================================

/** Supply crate pickup: metallic open + coin jingle */
function genPickupSupply(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.35 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Metallic lid open: mid-freq impact then ring
    const impEnv = Math.exp(-t * 30);
    const ringEnv = Math.exp(-t * 8);
    // Coin jingle: multiple high-frequency tones
    const coinEnv = t > 0.05 ? Math.exp(-(t - 0.05) * 12) : 0;
    d[i] = impEnv * ((Math.random() * 2 - 1) * 0.4 + Math.sin(t * 900 * 2 * Math.PI) * 0.2)
      + ringEnv * Math.sin(t * 1400 * 2 * Math.PI) * 0.1
      + coinEnv * (
        Math.sin(t * 2100 * 2 * Math.PI) * 0.15
        + Math.sin(t * 2800 * 2 * Math.PI) * 0.10
        + Math.sin(t * 3400 * 2 * Math.PI) * 0.07
      );
  }
  return buf;
}

/** Medkit pickup: soft ascending healing chime (3 rising tones) */
function genPickupMedkit(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.5 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  // Three ascending tones: C5, E5, G5, each 0.13s apart
  const notes = [
    { freq: 523, start: 0.0 },
    { freq: 659, start: 0.13 },
    { freq: 784, start: 0.26 },
  ];
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    let sample = 0;
    for (const note of notes) {
      const nt = t - note.start;
      if (nt >= 0 && nt < 0.18) {
        const env = Math.sin(nt / 0.18 * Math.PI);
        sample += env * Math.sin(nt * note.freq * 2 * Math.PI) * 0.18;
      }
    }
    d[i] = sample;
  }
  return buf;
}

/** Ammo pickup: military click-clack (magazine insertion sound) */
function genPickupAmmo(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.22 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // First click at t=0, second click at t=0.1
    const click1 = Math.exp(-t * 90) * (Math.random() * 2 - 1) * 0.6;
    const t2 = t - 0.1;
    const click2 = t2 > 0 ? Math.exp(-t2 * 70) * (Math.random() * 2 - 1) * 0.45 : 0;
    d[i] = click1 + click2;
  }
  return buf;
}

/** Adrenaline pickup: heartbeat-accelerating bass pump (3 beats, tempo rising) */
function genPickupAdrenaline(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.7 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  // Beat times: accelerating rhythm
  const beatTimes = [0.0, 0.28, 0.50];
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    let sample = 0;
    for (const bt of beatTimes) {
      const nt = t - bt;
      if (nt >= 0 && nt < 0.18) {
        const env = Math.exp(-nt * 18);
        // Low bass thump
        sample += env * (
          Math.sin(nt * 50 * 2 * Math.PI) * 0.55
          + Math.sin(nt * 80 * 2 * Math.PI) * 0.25
          + (Math.random() * 2 - 1) * 0.05
        );
      }
    }
    d[i] = sample;
  }
  return buf;
}

/**
 * Survivor pickup: short upward vocal-like tone (not a real voice, but warm
 * resonant sine + harmonics to suggest a human "hey!").
 */
function genPickupSurvivor(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.3 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 10);
    // Vocal formant approximation: fundamental ~220 Hz + harmonics
    d[i] = env * (
      Math.sin(t * 220 * 2 * Math.PI) * 0.35
      + Math.sin(t * 440 * 2 * Math.PI) * 0.15
      + Math.sin(t * 880 * 2 * Math.PI) * 0.07
      + Math.sin(t * 1100 * 2 * Math.PI) * 0.04
    );
  }
  return buf;
}

// ============================================================
// F6: Zombie variation
// ============================================================

/** Zombie scream: high-pitched shriek (screamer type) */
function genZombieScream(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.6 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  const baseFreq = 700 + Math.random() * 200;
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 5);
    // Rising shriek with heavy noise mix
    const freq = baseFreq + Math.sin(t * 8) * 80 + t * 400;
    d[i] = env * (
      Math.sin(t * freq * 2 * Math.PI) * 0.35
      + Math.sin(t * freq * 2.1 * 2 * Math.PI) * 0.15
      + (Math.random() * 2 - 1) * 0.25
    );
  }
  return buf;
}

/** Zombie spit: wet gurgling spit-launch (spitter type) */
function genZombieSpit(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.25 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Wet low-freq bubble burst + mid noise
    const bubbleEnv = Math.exp(-t * 25);
    const wetEnv = i < Math.floor(0.02 * rate) ? Math.exp(-t * 80) : 0;
    d[i] = bubbleEnv * (
      Math.sin(t * 120 * 2 * Math.PI) * 0.3
      + Math.sin(t * 200 * 2 * Math.PI) * 0.15
      + (Math.random() * 2 - 1) * 0.18
    ) + wetEnv * (Math.random() * 2 - 1) * 0.5;
  }
  return buf;
}

/** Zombie charge: heavy thudding rush sound (brute charge) */
function genZombieCharge(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.45 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Rising rumble as charge builds + noise
    const env = t < 0.15 ? t / 0.15 : Math.exp(-(t - 0.15) * 6);
    const freq = 60 + t * 30;
    d[i] = env * (
      Math.sin(t * freq * 2 * Math.PI) * 0.5
      + Math.sin(t * freq * 2 * 2 * Math.PI) * 0.2
      + (Math.random() * 2 - 1) * 0.15
    );
  }
  return buf;
}

/** Zombie tunnel: earthy gravel digging then emergence thud (tunnel zombie) */
function genZombieTunnel(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.55 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Scraping/digging: low-frequency noise burst
    const scrapeEnv = Math.exp(-t * 4) * (1 - Math.exp(-t * 20));
    // Emergence thud at t=0.4s
    const thudT = t - 0.4;
    const thudEnv = thudT > 0 ? Math.exp(-thudT * 25) : 0;
    d[i] = scrapeEnv * (
      (Math.random() * 2 - 1) * 0.35
      + Math.sin(t * 80 * 2 * Math.PI) * 0.15
    ) + thudEnv * (
      Math.sin(thudT * 55 * 2 * Math.PI) * 0.55
      + (Math.random() * 2 - 1) * 0.2
    );
  }
  return buf;
}

// ============================================================
// F6: UI / Feedback sounds
// ============================================================

/** Weapon break: metallic snap/crack (durability hits zero) */
function genWeaponBreak(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.4 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Sharp initial crack
    const crackEnv = Math.exp(-t * 50);
    // Metallic ringing decay
    const ringEnv = Math.exp(-t * 10);
    d[i] = crackEnv * (Math.random() * 2 - 1) * 0.7
      + ringEnv * (
        Math.sin(t * 1600 * 2 * Math.PI) * 0.2
        + Math.sin(t * 2300 * 2 * Math.PI) * 0.12
        + Math.sin(t * 3100 * 2 * Math.PI) * 0.07
      );
  }
  return buf;
}

/** Weapon upgrade: magical shimmer + ding (weapon leveled up) */
function genWeaponUpgrade(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.6 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Shimmer: rapid ascending frequency sweep
    const shimmerEnv = Math.exp(-t * 6);
    const shimmerFreq = 800 + t * 2000;
    // Final ding at t=0.25
    const dingT = t - 0.25;
    const dingEnv = dingT > 0 ? Math.exp(-dingT * 8) : 0;
    d[i] = shimmerEnv * Math.sin(t * shimmerFreq * 2 * Math.PI) * 0.15
      + dingEnv * (
        Math.sin(dingT * 1047 * 2 * Math.PI) * 0.25  // C6
        + Math.sin(dingT * 1319 * 2 * Math.PI) * 0.15  // E6
      );
  }
  return buf;
}

/** Blueprint found: paper rustle + short 2-note fanfare */
function genBlueprintFound(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.6 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Paper rustle: brief noise burst with high-frequency emphasis
    const rustleEnv = t < 0.1 ? Math.exp(-t * 25) : 0;
    // Fanfare: two ascending notes
    const n1T = t - 0.1;
    const n1Env = n1T > 0 && n1T < 0.15 ? Math.sin(n1T / 0.15 * Math.PI) : 0;
    const n2T = t - 0.28;
    const n2Env = n2T > 0 && n2T < 0.22 ? Math.sin(n2T / 0.22 * Math.PI) : 0;
    d[i] = rustleEnv * (Math.random() * 2 - 1) * 0.35
      + n1Env * Math.sin(t * 523 * 2 * Math.PI) * 0.25
      + n2Env * Math.sin(t * 659 * 2 * Math.PI) * 0.28;
  }
  return buf;
}

/**
 * Achievement unlock: triumphant 5-note ascending fanfare.
 * C4 D4 E4 G4 C5, each ~0.12s with small gaps.
 */
function genAchievementUnlock(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(1.0 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  const notes = [
    { freq: 261.6, start: 0.00, dur: 0.10 }, // C4
    { freq: 293.7, start: 0.12, dur: 0.10 }, // D4
    { freq: 329.6, start: 0.24, dur: 0.10 }, // E4
    { freq: 392.0, start: 0.36, dur: 0.10 }, // G4
    { freq: 523.2, start: 0.48, dur: 0.38 }, // C5 -- held
  ];
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    let sample = 0;
    for (const note of notes) {
      const nt = t - note.start;
      if (nt >= 0 && nt < note.dur) {
        const env = Math.sin(nt / note.dur * Math.PI);
        sample += env * (
          Math.sin(nt * note.freq * 2 * Math.PI) * 0.28
          + Math.sin(nt * note.freq * 2 * 2 * Math.PI) * 0.10
        );
      }
    }
    d[i] = sample;
  }
  return buf;
}

/** Night warning: deep gong -- low resonant bell strike at dusk */
function genNightWarning(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(1.5 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Gong: sharp onset, very slow decay
    const env = Math.exp(-t * 1.8);
    // Inharmonic partials typical of a gong/bell
    d[i] = env * (
      Math.sin(t * 65 * 2 * Math.PI) * 0.4    // fundamental
      + Math.sin(t * 158 * 2 * Math.PI) * 0.2  // 2nd partial (inharmonic)
      + Math.sin(t * 240 * 2 * Math.PI) * 0.12 // 3rd partial
      + Math.sin(t * 340 * 2 * Math.PI) * 0.06 // 4th partial
      + (Math.random() * 2 - 1) * 0.02         // subtle noise shimmer
    );
  }
  return buf;
}

// ============================================================
// F6: Boss-specific sounds
// ============================================================

/** Boss charge: heavy rushing whoosh building in intensity */
function genBossCharge(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.8 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const white = Math.random() * 2 - 1;
    prev = (prev + 0.04 * white) / 1.04;
    // Build-up envelope: starts quiet, peaks at end
    const env = t / 0.8;
    // Pitch rising: combine low rumble with sweep
    const freq = 40 + t * 80;
    d[i] = env * (
      prev * 3 * 0.4
      + Math.sin(t * freq * 2 * Math.PI) * 0.35
      + Math.sin(t * freq * 2 * 2 * Math.PI) * 0.12
    );
  }
  return buf;
}

/** Boss acid: bubbling corrosive pool sound */
function genBossAcid(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.5 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Low gurgling bubbles
    const env = Math.exp(-t * 4);
    // Bubble modulation: fast wobble
    const bubbleMod = 0.5 + 0.5 * Math.sin(t * 18 * 2 * Math.PI);
    d[i] = env * bubbleMod * (
      Math.sin(t * 70 * 2 * Math.PI) * 0.3
      + Math.sin(t * 110 * 2 * Math.PI) * 0.15
      + (Math.random() * 2 - 1) * 0.2
    );
  }
  return buf;
}

/** Boss tank stomp: massive ground-shaking impact (heavier than boss_stomp) */
function genBossTankStomp(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(0.4 * rate);
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    // Earthquake impact: very low sub-bass + broad noise layer
    const subEnv = Math.exp(-t * 6);
    const noiseEnv = Math.exp(-t * 18);
    d[i] = subEnv * (
      Math.sin(t * 28 * 2 * Math.PI) * 0.55
      + Math.sin(t * 42 * 2 * Math.PI) * 0.30
      + Math.sin(t * 60 * 2 * Math.PI) * 0.15
    ) + noiseEnv * (Math.random() * 2 - 1) * 0.35;
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
  // F6: Zone-specific ambient
  city_ambient_day:      { generate: genCityAmbientDay,      volume: 0.10, cooldown: 0 },
  city_ambient_night:    { generate: genCityAmbientNight,    volume: 0.10, cooldown: 0 },
  military_ambient_day:  { generate: genMilitaryAmbientDay,  volume: 0.10, cooldown: 0 },
  military_ambient_night:{ generate: genMilitaryAmbientNight,volume: 0.10, cooldown: 0 },
  // F6: Footstep variants
  footstep_grass:    { generate: genFootstepGrass,    volume: 0.16, cooldown: 240 },
  footstep_concrete: { generate: genFootstepConcrete, volume: 0.22, cooldown: 240 },
  footstep_metal:    { generate: genFootstepMetal,    volume: 0.20, cooldown: 240 },
  // F6: Weather
  rain_loop:  { generate: genRainLoop,  volume: 0.18, cooldown: 0   },
  thunder:    { generate: genThunder,   volume: 0.55, cooldown: 3000 },
  wind_gust:  { generate: genWindGust,  volume: 0.22, cooldown: 800  },
  // F6: Pickup sounds
  pickup_supply:     { generate: genPickupSupply,     volume: 0.35, cooldown: 100 },
  pickup_medkit:     { generate: genPickupMedkit,     volume: 0.30, cooldown: 100 },
  pickup_ammo:       { generate: genPickupAmmo,       volume: 0.32, cooldown: 100 },
  pickup_adrenaline: { generate: genPickupAdrenaline, volume: 0.38, cooldown: 100 },
  pickup_survivor:   { generate: genPickupSurvivor,   volume: 0.28, cooldown: 100 },
  // F6: Zombie variation
  zombie_scream:  { generate: genZombieScream,  volume: 0.30, cooldown: 2000 },
  zombie_spit:    { generate: genZombieSpit,    volume: 0.28, cooldown: 600  },
  zombie_charge:  { generate: genZombieCharge,  volume: 0.35, cooldown: 1500 },
  zombie_tunnel:  { generate: genZombieTunnel,  volume: 0.40, cooldown: 0    },
  // F6: UI / Feedback
  weapon_break:       { generate: genWeaponBreak,       volume: 0.45, cooldown: 0   },
  weapon_upgrade:     { generate: genWeaponUpgrade,     volume: 0.40, cooldown: 0   },
  blueprint_found:    { generate: genBlueprintFound,    volume: 0.38, cooldown: 0   },
  achievement_unlock: { generate: genAchievementUnlock, volume: 0.50, cooldown: 0   },
  night_warning:      { generate: genNightWarning,      volume: 0.45, cooldown: 0   },
  // F6: Boss-specific
  boss_charge:     { generate: genBossCharge,     volume: 0.55, cooldown: 1500 },
  boss_acid:       { generate: genBossAcid,       volume: 0.30, cooldown: 400  },
  boss_tank_stomp: { generate: genBossTankStomp,  volume: 0.60, cooldown: 900  },
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

// F4/F5/F6: Sounds that receive +/- 10% pitch randomization on every play
const PITCH_VARIED_SOUNDS = new Set<SoundId>([
  'shoot_pistol', 'shoot_rifle', 'shoot_shotgun', 'shoot_melee', 'shoot_explosives',
  'zombie_groan', 'zombie_attack', 'zombie_death',
  'footstep', 'melee_hit', 'zombie_attack_hit',
  // Trap and boss sounds get slight pitch variation to avoid repetition
  'trap_nail_board', 'trap_trip_wire', 'trap_glass_shards',
  'trap_tar_pit', 'trap_shock_wire', 'trap_spring_launcher', 'trap_chain_wall',
  'boss_stomp',
  // F6: New footstep variants and zombie sounds
  'footstep_grass', 'footstep_concrete', 'footstep_metal',
  'zombie_scream', 'zombie_spit', 'zombie_charge', 'zombie_tunnel',
  // F6: Pickup sounds and wind
  'pickup_supply', 'pickup_medkit', 'pickup_ammo', 'pickup_adrenaline', 'pickup_survivor',
  'wind_gust', 'boss_charge', 'boss_acid', 'boss_tank_stomp',
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
 * type: general 'night'/'day', or zone-specific variants.
 * Zone-specific types resolve to richer procedural sounds for that zone.
 */
function startAmbient(
  type:
    | 'night'
    | 'day'
    | 'forest_day'
    | 'forest_night'
    | 'city_day'
    | 'city_night'
    | 'military_day'
    | 'military_night',
): void {
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
  } else if (type === 'city_day') {
    id = 'city_ambient_day';
  } else if (type === 'city_night') {
    id = 'city_ambient_night';
  } else if (type === 'military_day') {
    id = 'military_ambient_day';
  } else if (type === 'military_night') {
    id = 'military_ambient_night';
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

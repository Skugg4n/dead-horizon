# Dead Horizon -- Technical Specification

**Version:** 0.1.0
**Datum:** 2026-03-28
**Status:** Draft

---

## 1. Tech Stack

| Komponent | Val | Motivering |
|-----------|-----|-----------|
| **Game engine** | Phaser 3 (senaste stabila) | Komplett 2D-spelramverk med inbyggd fysik, scener, input, ljud |
| **Språk** | TypeScript | Typsäkerhet, bättre IDE-stöd, lättare att underhålla |
| **Bundler** | Vite | Snabb dev server, bra TS-stöd, enkel config |
| **Hosting** | GitHub Pages eller Vercel | Statisk hosting, gratis, CI/CD-vänlig |
| **Save system** | localStorage | Ingen backend behövs. JSON-serialisering av game state |
| **Pakethanterare** | npm | Standard |
| **Versionskontroll** | Git + GitHub | Standard |

---

## 2. Projektstruktur

```
dead-horizon/
├── .claude/
│   ├── CLAUDE.md              # Huvudinstruktioner för alla agenter
│   ├── agents/
│   │   ├── lead.md            # Lead agent-instruktioner
│   │   ├── builder.md         # Builder agent-instruktioner
│   │   └── tester.md          # Tester agent-instruktioner
│   └── settings.json
├── docs/
│   ├── vision.md
│   ├── game-design.md
│   ├── technical-spec.md
│   ├── art-direction.md
│   └── projectplan.md
├── src/
│   ├── main.ts                # Entry point, Phaser config
│   ├── scenes/
│   │   ├── BootScene.ts       # Ladda assets, visa splash
│   │   ├── MenuScene.ts       # Huvudmeny, karaktärsval
│   │   ├── DayScene.ts        # Dagfas management
│   │   ├── NightScene.ts      # Nattfas action
│   │   ├── ResultScene.ts     # Wave-resultat, loot summary
│   │   └── GameOverScene.ts   # Dödsskärm, stats, "Try again"
│   ├── entities/
│   │   ├── Player.ts          # Spelarkaraktär
│   │   ├── Zombie.ts          # Bas-fiendeklass
│   │   ├── ZombieWalker.ts    # Walker-variant
│   │   ├── ZombieRunner.ts    # Runner-variant
│   │   ├── ZombieBrute.ts     # Brute-variant
│   │   ├── Refugee.ts         # Refugee NPC
│   │   └── Projectile.ts      # Skott/projektiler
│   ├── systems/
│   │   ├── WaveManager.ts     # Hanterar wave-spawning och progression
│   │   ├── ResourceManager.ts # Hanterar alla resurser
│   │   ├── BuildingManager.ts # Hanterar byggande och strukturer
│   │   ├── WeaponManager.ts   # Vapen-inventory, durability, XP
│   │   ├── LootManager.ts     # Loot runs, encounters, loot tables
│   │   ├── RefugeeManager.ts  # Refugee-tilldelning och status
│   │   ├── SoundMechanic.ts   # Ljud-attrahering av zombies
│   │   ├── FogOfWar.ts        # Fog of war-rendering
│   │   ├── SkillManager.ts    # Spelarens skill-progression
│   │   └── SaveManager.ts     # localStorage save/load
│   ├── structures/
│   │   ├── Barricade.ts
│   │   ├── Wall.ts
│   │   ├── Trap.ts
│   │   ├── Pillbox.ts
│   │   ├── Storage.ts
│   │   ├── Shelter.ts
│   │   └── Farm.ts
│   ├── ui/
│   │   ├── HUD.ts             # In-game HUD (nattfas)
│   │   ├── BuildMenu.ts       # Bygg-meny (dagfas)
│   │   ├── ResourceBar.ts     # Resursvisning
│   │   ├── ActionPointBar.ts  # AP-visning (dagfas)
│   │   ├── RefugeePanel.ts    # Refugee-tilldelning
│   │   ├── WeaponPanel.ts     # Vapeninventar
│   │   ├── LootRunPanel.ts    # Loot run-konfigurering
│   │   ├── MiniMap.ts         # Minimap (nattfas)
│   │   └── EncounterDialog.ts # Fight or Flee-val
│   ├── data/
│   │   ├── weapons.json       # Vapendata (stats, rariteter)
│   │   ├── enemies.json       # Fiendedata (HP, speed, etc)
│   │   ├── structures.json    # Strukturdata (HP, kostnad)
│   │   ├── loot-tables.json   # Loot-tabeller per destination
│   │   ├── characters.json    # Karaktärsdata (startbonus)
│   │   ├── waves.json         # Wave-komposition per level
│   │   └── skills.json        # Skill-definitioner och XP-krav
│   ├── config/
│   │   ├── constants.ts       # Spelkonstanter (AP per dag, etc)
│   │   └── types.ts           # Delade TypeScript-typer
│   └── utils/
│       ├── math.ts            # Hjälpfunktioner
│       └── random.ts          # Seeded random för reproducerbarhet
├── assets/
│   ├── sprites/
│   │   ├── characters/        # Spelar- och refugee-sprites
│   │   ├── enemies/           # Zombie-sprites
│   │   ├── structures/        # Byggnader och barrikader
│   │   ├── weapons/           # Vapen-ikoner och projektiler
│   │   ├── terrain/           # Mark, väg, skog, vatten
│   │   └── ui/                # UI-element, knappar, ikoner
│   ├── tilemaps/
│   │   └── main-map.json      # Tiled-exporterad karta
│   └── audio/                 # Ljud (post-MVP)
│       ├── sfx/
│       └── music/
├── public/
│   └── index.html
├── tests/
│   ├── systems/               # Enhetstester för spelsystem
│   └── integration/           # Integrationstester
├── package.json
├── tsconfig.json
├── vite.config.ts
├── CHANGELOG.md
├── LESSONS.md
└── README.md
```

---

## 3. Arkitekturprinciper

### 3.1 Scene-baserad arkitektur

Phaser använder Scenes som huvudsaklig organisationsenhet. Varje scen hanterar en fas av spelet:

```
BootScene -> MenuScene -> DayScene <-> NightScene -> ResultScene
                                                        |
                                                  GameOverScene
```

### 3.2 Manager-mönster

Spelsystem hanteras av Manager-klasser som:
- Instansieras i scenen de tillhör
- Har tydliga ansvarsområden (Single Responsibility)
- Kommunicerar via Phasers event-system (loose coupling)
- Kan serialiseras till JSON för save/load

### 3.3 Data-driven design

All speldata (vapen, fiender, waves, loot) definieras i JSON-filer. Ingen hårdkodning av spelvärden i kod. Detta gör det lätt att balansera spelet utan kodändringar.

### 3.4 Save/Load

Game state sparas till localStorage som JSON:

```typescript
interface GameState {
  version: string;
  player: {
    character: string;
    skills: Record<string, number>;
    hp: number;
  };
  inventory: {
    weapons: WeaponInstance[];
    resources: Record<ResourceType, number>;
  };
  base: {
    structures: StructureInstance[];
    level: number;
  };
  refugees: RefugeeInstance[];
  progress: {
    currentWave: number;
    highestWave: number;
    totalRuns: number;
    totalKills: number;
  };
  map: {
    fogOfWar: boolean[][];
    explored: string[];
  };
}
```

Spelet sparar automatiskt efter varje dag och vid spelardöd.

---

## 4. Nyckeltekniska utmaningar

### 4.1 Pathfinding

Zombies behöver navigera runt barrikader och strukturer mot basen/spelaren.
- Använd Phaser Navmesh eller A*-pathfinding
- Uppdatera navmesh när strukturer byggs/förstörs
- Zombies som dras mot ljud behöver dynamisk target-switching

### 4.2 Fog of War

- Implementera som en mörk overlay med "hål" runt synliga områden
- Performance: använd en low-res grid, inte per-pixel
- Uppdatera när spelaren rör sig och när loot runs avslöjar områden

### 4.3 Performance vid många fiender

Wave 5 kan ha 50-100+ zombies på skärmen:
- Object pooling för zombies och projektiler (återanvänd objekt istf. skapa nya)
- Spatial hashing för collision detection
- Begränsa pathfinding-uppdateringar (inte varje frame)

### 4.4 Balansering

All data i JSON -> lätt att justera. Men vi behöver:
- Tester som simulerar waves för att verifiera balans
- Logging av spelarsessions (kills, deaths, resurser) för att hitta problem

---

## 5. Utvecklingsmiljö

### 5.1 Setup

```bash
# Skapa projekt
npm create vite@latest dead-horizon -- --template vanilla-ts
cd dead-horizon
npm install phaser
npm install -D typescript @types/node

# Dev server
npm run dev

# Build
npm run build
```

### 5.2 Verktyg

- **Tiled Map Editor** -- för att skapa tilemaps (gratis, open source)
- **Aseprite** -- för pixel art sprites (eller gratis alternativ som LibreSprite)
- **VS Code / Claude Code** -- editor

### 5.3 CI/CD

GitHub Actions workflow:
1. Push till main -> lint + type check + tests
2. Merge till main -> build + deploy till GitHub Pages/Vercel

---

## 6. Tredjepartsberoenden

| Paket | Version | Syfte |
|-------|---------|-------|
| phaser | ^3.80 | Game engine |
| typescript | ^5.x | Språk |
| vite | ^5.x | Bundler |
| vitest | ^1.x | Testramverk |
| eslint | ^8.x | Linting |

Minimalt antal beroenden. Allt som kan byggas med Phaser built-in funktioner ska byggas så.

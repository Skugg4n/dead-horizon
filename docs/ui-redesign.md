# Dead Horizon -- UI Redesign Spec

**Version:** 1.0.0
**Datum:** 2026-03-29
**Status:** Redo for Builder

---

## Problem

Nuvarande UI har:
- 8 knappar pa EN rad (800px bred) som overlappar varandra
- CRAFT-knappen flyter ovanfor de andra
- SKILLS och END DAY overlappar
- Resurstext overlappar knappraden
- Night HUD: resurser, wave, ammo, vapen, kills alla i samma horna
- Inga bakgrunder, ramar eller visuell struktur
- Raa text i brackets istallet for riktiga knappar

## Design-principer

1. **Bakgrundspaneler** for all UI -- halvtransparent svart (#1A1A1A, 85% opacity)
2. **Tydlig hierarki** -- viktig info (HP, wave) star, sekundar info (kills, ammo) ar mindre
3. **Ingen overlappning** -- varje element har reserverat utrymme
4. **Konsekvent spacing** -- 8px som basenhet (8, 16, 24, 32...)
5. **Fargkodning fran art-direction.md** -- gron for bygg, bla for ammo, rod for fara, guld for AP

---

## DayScene Layout (800x600)

```
+------------------------------------------------------------------+
|  TOP BAR (h=48, bakgrund #1A1A1A 85%)                            |
|  [AP: 8/12 ████████░░░░]    DAY 3    [BASE: Camp  UPGRADE ->]   |
+------------------------------------------------------------------+
|                                                                    |
|  ZONE:             (right side, y=56)                             |
|  > Forest                                                         |
|    City                                                           |
|    Military                                                       |
|                                                                    |
|                                                                    |
|                        KARTA                                       |
|                                                                    |
|                                                                    |
|                                                                    |
+------------------------------------------------------------------+
|  ACTION BAR -- tva rader (h=64, bakgrund #1A1A1A 85%)            |
|                                                                    |
|  Row 1 (y = 536):                                                 |
|  [BUILD]  [AMMO]  [WEAPONS]  [CRAFT]    [SKILLS]  [END DAY ->]  |
|                                                                    |
|  Row 2 (y = 558):                                                 |
|  [REFUGEES]  [LOOT RUN]                                           |
|                                                                    |
+------------------------------------------------------------------+
|  RESOURCE BAR (h=24, bakgrund #1A1A1A 90%)                       |
|  Scrap: 30  |  Food: 0  |  Ammo: 14  |  Parts: 1  |  Meds: 2   |
+------------------------------------------------------------------+
```

### Top Bar (y=0, h=48)

```typescript
// Background panel
const topBg = scene.add.graphics();
topBg.fillStyle(0x1A1A1A, 0.85);
topBg.fillRect(0, 0, GAME_WIDTH, 48);

// AP label + pips (left side, x=16)
// DAY counter (centered)
// Base info + upgrade button (right side, x=GAME_WIDTH-16)
```

- AP-baren: label "AP: 8/12" pa rad 1, pip-ruta pa rad 2 (varje pip = 12x8, gap=3)
- DAY-raknare: centrerad, 14px, farg #E8DCC8
- Bas-info: hogerjusterad, visar niva + upgrade-knapp om tillganglig

### Action Bar (y=520, h=64)

**TVA RADER** istallet for en:

```typescript
// Row 1: Primary actions (y=536)
const ROW1_Y = GAME_HEIGHT - 64;
const ROW1_BUTTONS = [
  { label: 'BUILD',   x: 16,              color: '#4CAF50' },
  { label: 'AMMO',    x: 120,             color: '#4A90D9' },
  { label: 'WEAPONS', x: 220,             color: '#C5A030' },
  { label: 'CRAFT',   x: 340,             color: '#D4A030' },
  { label: 'SKILLS',  x: 560,             color: '#C5A030' },
  { label: 'END DAY', x: GAME_WIDTH - 16, color: '#D4620B', origin: 1 },
];

// Row 2: Secondary actions (y=558)
const ROW2_Y = GAME_HEIGHT - 42;
const ROW2_BUTTONS = [
  { label: 'REFUGEES', x: 16,  color: '#8B6FC0' },
  { label: 'LOOT RUN', x: 150, color: '#D4A030' },
];
```

### Knapp-styling

Varje knapp far en liten bakgrund istallet for bara brackets:

```typescript
function createUIButton(
  scene: Phaser.Scene,
  x: number, y: number,
  label: string,
  color: string,
  onClick: () => void,
  originX: number = 0,
): Phaser.GameObjects.Container {
  const text = scene.add.text(0, 0, label, {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: '9px',
    color: color,
    padding: { x: 6, y: 4 },
  });

  // Background rectangle behind text
  const bg = scene.add.graphics();
  const w = text.width + 12;
  const h = text.height + 8;
  bg.fillStyle(0x1A1A1A, 0.6);
  bg.fillRoundedRect(-6, -4, w, h, 2);
  bg.lineStyle(1, parseInt(color.replace('#', ''), 16), 0.4);
  bg.strokeRoundedRect(-6, -4, w, h, 2);

  const container = scene.add.container(x, y, [bg, text]);
  container.setSize(w, h);

  text.setInteractive({ useHandCursor: true });
  text.on('pointerover', () => {
    text.setColor('#FFD700');
    bg.clear();
    bg.fillStyle(0x333333, 0.8);
    bg.fillRoundedRect(-6, -4, w, h, 2);
    bg.lineStyle(1, 0xFFD700, 0.6);
    bg.strokeRoundedRect(-6, -4, w, h, 2);
  });
  text.on('pointerout', () => {
    text.setColor(color);
    bg.clear();
    bg.fillStyle(0x1A1A1A, 0.6);
    bg.fillRoundedRect(-6, -4, w, h, 2);
    bg.lineStyle(1, parseInt(color.replace('#', ''), 16), 0.4);
    bg.strokeRoundedRect(-6, -4, w, h, 2);
  });
  text.on('pointerdown', onClick);

  return container;
}
```

### Resource Bar (y=576, h=24)

```typescript
// Fixad langst ner
const resBg = scene.add.graphics();
resBg.fillStyle(0x1A1A1A, 0.9);
resBg.fillRect(0, GAME_HEIGHT - 24, GAME_WIDTH, 24);

// 5 resurser jamnt fordelade med separatorer
// Varje resurs: ikon-farg + "Scrap: 30/100"
// Separatorer: tunn vertikal linje (1px, #333333)
```

Uppdatera ResourceBar.ts:
- Flytta fran top (y=0) till botten (y=GAME_HEIGHT-24)
- Lagg till visuella separatorer mellan resurser
- Ta bort bracket-prefix ("[S]") -- anvand fargkodning istallet:
  - Scrap: #C5A030 (guld)
  - Food: #4CAF50 (gron)
  - Ammo: #4A90D9 (bla)
  - Parts: #E8DCC8 (vit)
  - Meds: #F44336 (rod)
- Visa kapacitet: "30/100" istallet for bara "30"

---

## NightScene HUD (800x600)

```
+------------------------------------------------------------------+
|  HP ████████████░░  STAMINA ████         Wave 3/5                |
|                                                                    |
|                                                                    |
|                                                                    |
|                        SPELPLAN                                    |
|                                                                    |
|                                                                    |
|                                                                    |
|                                                                    |
+------------------------------------------------------------------+
|  Rusty Knife [47/50]              Ammo: 40       Kills: 12       |
+------------------------------------------------------------------+
```

### Top HUD (y=0, h=32)

```typescript
// Background panel
const topBg = scene.add.graphics();
topBg.fillStyle(0x000000, 0.5);
topBg.fillRect(0, 0, GAME_WIDTH, 32);

// HP bar: x=16, y=8, w=180, h=12
// Stamina bar: x=16, y=22, w=100, h=6
// Wave text: centered, y=10, 12px
```

- TA BORT resursbaren fran nattscenen (den behoves inte under strid)
- HP-bar vanster, stamina under HP
- Wave-info centrerad
- Inget mer i topbaren

### Bottom HUD (y=576, h=24)

```typescript
// Background panel
const bottomBg = scene.add.graphics();
bottomBg.fillStyle(0x000000, 0.5);
bottomBg.fillRect(0, GAME_HEIGHT - 24, GAME_WIDTH, 24);

// Weapon name + durability: left (x=16)
// Ammo counter: center-right (x=GAME_WIDTH-200)
// Kill counter: far right (x=GAME_WIDTH-16)
```

- Vapennamn till vanster
- Ammo i mitten
- Kills till hoger
- Alla pa SAMMA rad, aldrig ovanlappande

### Wave Announcement

- Centrerad, stor text (20px), farg #D4620B
- Fade ut efter 2 sekunder
- Rensar sig sjalv -- inga overlapp med HUD

---

## Paneler (Build, Weapons, Skills, Refugees, Loot Run, Crafting)

Alla paneler som oppnas vid knapptryck ska folja samma monster:

```
+-- Panel Header (bakgrund #1A1A1A 95%) --+
|  WEAPONS                          [X]   |
+------------------------------------------+
|                                          |
|  (Panel content)                         |
|                                          |
+------------------------------------------+
```

### Panel-standard:
- **Position:** centrerad horisontellt, y=56 (under topbar)
- **Max bredd:** 400px
- **Max hojd:** GAME_HEIGHT - 120 (inte tacka top/bottom bars)
- **Bakgrund:** #1A1A1A, 95% opacity
- **Ram:** 1px solid #333333
- **Header:** 24px hog, med panelnamn (10px, #E8DCC8) och stangknapp [X]
- **Padding:** 12px inuti

### Stanga panel:
- Klicka [X] eller klicka utanfor panelen
- Bara EN panel oppen at gangen (oppna ny -> stang gammal)

---

## Implementationsplan

### Steg 1: Skapa UIButton helper (ny fil: src/ui/UIButton.ts)
Implementera `createUIButton()` enligt ovan. Anvands av alla scener.

### Steg 2: Skapa UIPanel helper (ny fil: src/ui/UIPanel.ts)
Bas-klass for alla paneler med header, bakgrund, stangknapp, scrollning.

### Steg 3: Redesigna DayScene layout
1. Andhra top bar (AP, DAY, bas-info) med bakgrundspanel
2. Implementera tva-rads action bar
3. Flytta och redesigna resource bar till botten
4. Byt ut alla raw-text-knappar mot UIButton
5. Testa att inget overlappar vid 800x600

### Steg 4: Redesigna NightScene HUD
1. Ta bort resursbaren
2. Forenkla top HUD (HP, stamina, wave)
3. Lagg till bottom HUD (vapen, ammo, kills)
4. Testa att HUD inte blockerar spelplanen

### Steg 5: Uppdatera alla paneler
Konvertera BuildMenu, WeaponPanel, SkillPanel, RefugeePanel, LootRunPanel, CraftingPanel till UIPanel-standarden.

### Steg 6: Verifiera
- Alla element synliga utan overlapp
- Alla knappar klickbara
- Paneler oppnas/stangs korrekt
- Responsivt vid 800x600 (och testas vid 1024x768)

---

## Filer att andra

| Fil | Andring |
|-----|---------|
| src/ui/UIButton.ts | NY -- delad knappkomponent |
| src/ui/UIPanel.ts | NY -- delad panelkomponent |
| src/ui/HUD.ts | Redesigna: top + bottom bars, ta bort resurser |
| src/ui/ResourceBar.ts | Flytta till botten, ny styling, kapacitetsvisning |
| src/ui/ActionPointBar.ts | Integrera i top bar, kompaktare pip-layout |
| src/scenes/DayScene.ts | Ny layout: 2 rader knappar, top bar, bottom bar |
| src/scenes/NightScene.ts | Ny HUD: top (HP, stamina, wave) + bottom (weapon, ammo, kills) |
| src/ui/BuildMenu.ts | Konvertera till UIPanel |
| src/ui/WeaponPanel.ts | Konvertera till UIPanel |
| src/ui/SkillPanel.ts | Konvertera till UIPanel |
| src/ui/RefugeePanel.ts | Konvertera till UIPanel |
| src/ui/LootRunPanel.ts | Konvertera till UIPanel |
| src/ui/CraftingPanel.ts | Konvertera till UIPanel |
| src/ui/EncounterDialog.ts | Konvertera till UIPanel (modal) |
| src/ui/EventDialog.ts | Konvertera till UIPanel (modal) |

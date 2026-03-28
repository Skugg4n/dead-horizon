# Dead Horizon -- Art Direction

**Version:** 0.1.0
**Datum:** 2026-03-28
**Status:** Draft

---

## 1. Visuell stil

**Format:** Pixel art, 32x32 sprites
**Perspektiv:** Top-down (rakt ovanifrån)
**Ton:** Mörk, gritty, naturalistisk. Naturen tar tillbaka civilisationen.

### 1.1 Referensspel (för känsla, inte exakt stil)

- Atomfall -- övervuxen brittisk landsbygd, post-apokalyps med natur
- Days Gone -- gritty survival, skog och vägar, massiva zombiegrupper
- The Last of Us Part II -- övervuxna städer, natur vs civilisation
- Hyper Light Drifter -- pixel art med atmosfär och mörker (stilreferens)

### 1.2 Nyckelord

Övervuxet. Rostigt. Fuktigt. Dammigt. Tyst. Fängslande. Vackert i sin förfall.

---

## 2. Färgpalett

### 2.1 Primära färger (miljö)

| Namn | Hex | Användning |
|------|-----|-----------|
| Mörkgrön (skog) | #2D4A22 | Träd, buskar, gräs |
| Mossgrön | #4A6B3A | Övervuxna ytor |
| Jordbrunt | #5C4033 | Mark, lera, vägar |
| Rostbrunt | #8B4513 | Rostiga strukturer, fordon |
| Betonggrå | #6B6B6B | Ruiner, väggar, vägar |
| Mörkgrå | #3A3A3A | Skuggor, mörka ytor |
| Nattsvart | #1A1A2E | Nattfas bakgrund |

### 2.2 Accent-färger (objekt och karaktärer)

| Namn | Hex | Användning |
|------|-----|-----------|
| Blodrött | #8B0000 | Blod, skada, fara |
| Eldorange | #D4620B | Eld, facklor, explosioner |
| Bandagevit | #E8DCC8 | Bandage, papper, ljusa kläder |
| Flanellröd | #B22222 | Karaktärskläder |
| Munitionsguld | #C5A030 | Ammo, loot-highlight |
| Medicinblå | #4A90D9 | Meds, healing |

### 2.3 UI-färger

| Namn | Hex | Användning |
|------|-----|-----------|
| UI Bakgrund | #1A1A1A (90% opacity) | Paneler, menyer |
| UI Text | #E8DCC8 | Huvudtext |
| UI Highlight | #D4620B | Valda element, viktig info |
| HP-grön | #4CAF50 | Hälsobar (full) |
| HP-röd | #F44336 | Hälsobar (låg) |
| AP-gul | #FFD700 | Action points |

---

## 3. Sprite-guide

### 3.1 Karaktärer (32x32)

**Spelaren:**
- Synlig ovanifrån med tydlig riktning (vart karaktären tittar)
- Kläder i muted toner (militärgrönt, brunt, grått) med en accent (röd bandana, blå ryggsäck)
- Vapen synligt i handen
- Walk-animation: 4 frames per riktning (upp, ner, vänster, höger)
- Idle-animation: 2 frames (subtilt)

**Refugees:**
- Varierade kläder -- rosa kjol, flanellskjorta, sliten kavaj
- Varje refugee ska vara visuellt distinkt (hårfärg, kläder)
- Ska se "civila" ut jämfört med spelaren
- Skadade refugees: bandage-sprite overlay

### 3.2 Fiender (32x32)

**Walker:**
- Långsam, slöa rörelser
- Mörk hud, slitna kläder
- Walk-animation: 4 frames (långsam, släpig)

**Runner:**
- Mager, snabb
- Mer "vild" look -- rivna kläder, böjd hållning
- Run-animation: 6 frames (snabb, aggressiv)

**Brute:**
- Stor (48x48 för att visa storlek, undantag från 32x32-standarden)
- Muskulös, eventuellt med improviserad rustning
- Walk-animation: 4 frames (tung, hotfull)

### 3.3 Strukturer

- **Tält:** Liten, grå/grön. 32x32.
- **Barrikad:** Hopsatta plankor, rostigt plåt. 32x16 (halv höjd).
- **Vägg:** Solid, av sten eller betong. 32x32.
- **Pillbox:** Förstärkt position med öppning. 32x32.
- **Fälla:** Nästan osynlig -- taggtråd eller spikmatta. 32x32.
- **Förråd:** Trälåda eller container. 32x32.
- **Farm:** Liten odling med gröna plantor. 64x64.

### 3.4 Terrain-tiles (32x32)

- Gräs (3-4 varianter för variation)
- Jord/lera
- Väg (asfalt, sprucken)
- Vatten (eventuellt animerat)
- Betong/golv (ruiner)
- Övervuxen asfalt (gräs genom sprickor)

---

## 4. Atmosfär och ljussättning

### 4.1 Dagfas

- Ljust men dämpat. Inte solsken -- mulet, grått ljus.
- Lätt dimma i kanterna av kartan.
- Färgerna är mer synliga men aldrig "glada."

### 4.2 Nattfas

- Mörkt. Kraftigt reducerad sikt.
- Spelaren har en ljuscirkel runt sig (fackla/lampa).
- Pillboxes med refugees har egna ljuskällor.
- Eldskott lyser upp kort (muzzle flash).
- Explosioner lyser upp stort.

### 4.3 Övergångar

- Dag -> Natt: Gradvis mörkläggning (1-2 sekunder)
- Natt -> Dag: Gradvis ljusning

---

## 5. UI-design

### 5.1 Dagfas-UI

```
+--------------------------------------------------+
| [AP: 8/12] [Day 3]            [Resources bar]    |
|                                                   |
|                                                   |
|              KARTA (klickbar)                     |
|                                                   |
|                                                   |
| [Build] [Loot] [Refugees] [Weapons] [End Day ->] |
+--------------------------------------------------+
```

- Bottenmeny med ikoner för huvudaktioner
- Topbar med AP och resurser
- Klicka på kartan för att interagera med objekt
- Submenyer öppnas som paneler (inte helskärm)

### 5.2 Nattfas-HUD

```
+--------------------------------------------------+
| [HP ████████] [Wave 3/5]          [Minimap]       |
|                                                   |
|                                                   |
|              SPELPLAN                              |
|                                                   |
|                                                   |
| [Weapon: Rifle Lvl 3] [Ammo: OK]  [Kills: 47]   |
+--------------------------------------------------+
```

- Minimal HUD -- inte blockera spelplanen
- HP top-left, wave info top-center, minimap top-right
- Vapen-info bottom-left, kills bottom-right
- Skada visas som skärmflash (röd kant)

### 5.3 Font

- Pixelfont som matchar 32x32-estetiken
- Rekommendation: "Press Start 2P" eller "Silkscreen" (Google Fonts, gratis)
- Storlekar: Rubrik 16px, body 8px, small 6px

---

## 6. Placeholder-assets för MVP

Under utvecklingen anvander vi enkla placeholder-sprites:
- Färgade rektanglar med bokstäver (P = player, W = walker, etc)
- Enkla geometriska former för strukturer
- Solid färger för terrain

Detta låter oss bygga all mekanik utan att vänta på konst. Riktiga sprites kan bytas in senare tack vare Phasers sprite-system.

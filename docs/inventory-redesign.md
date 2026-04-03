# Dead Horizon -- Inventory & Resource Redesign

**Version:** 2.1.2
**Datum:** 2026-04-03
**Problem:** Inventory ar rörigt, resurser otydliga, ammo-mekanik förvirrande.

---

## Nuvarande problem

1. **Ammo:** Spelaren "har" ammo (10/100) men måste "ladda" det manuellt via knapp. Varför?
2. **Meds:** Används för att hela refugees men det förklaras aldrig.
3. **Parts:** Används för upgrades/crafting men heter "parts" utan kontext.
4. **Vapen överallt:** Weapon Panel, Equipment Panel, Crafting -- tre ställen.
5. **Paneler fylls över:** För många items ryms inte.
6. **Resurser i botten:** Små siffror utan förklaring av vad de gör.

---

## Ny design: Enkel och tydlig

### Princip: "Om spelaren inte förstår det direkt är det fel designat"

---

### 1. Resurser -- förenkla till 4 + tydliga tooltips

| Resurs | Ikon | Används till | Visas som |
|--------|------|-------------|-----------|
| **Scrap** | Kugghjul | Bygga strukturer, barrikader | "12 SCRAP" |
| **Food** | Äpple | Refugees äter varje dag (1/refugee) | "8 FOOD (3 refugees äter 3/dag)" |
| **Ammo** | Kula | Vapen förbrukar under natt. AUTO-laddas. | "15 AMMO" |
| **Parts** | Skiftnyckel | Uppgradera + reparera vapen | "4 PARTS" |
| **Meds** | Rött kors | Hela skadade refugees | "2 MEDS" |

**ÄNDRING:** Ammo laddas AUTOMATISKT i alla ranged vapen vid nattstart. 
Ingen manuell "Load Ammo"-knapp. Ammo förbrukas under natten.
Om ammo = 0 kan du bara använda melee.

### 2. Dag-toolbar -- 6 knappar (ner från 8)

```
[BUILD]  [EQUIP]  [CRAFT]  [LOOT]  [REFUGEES]  [END DAY]
  B        Q        C        L        R           E
```

Borttagna:
- ~~AMMO~~ (auto-laddat)
- ~~WEAPONS~~ (ersatt av EQUIP som visar allt)

### 3. EQUIP-panel (Q) -- en panel för allt

```
+------------------------------------------+
|          EQUIPMENT                  [X]   |
|                                           |
|     [PORTRAIT]                            |
|      Soldier                              |
|                                           |
|  PRIMARY:  Fire Axe [common]         [>]  |
|            DMG:35 RNG:50 cleave 20%       |
|                                           |
|  SECONDARY: Worn Pistol [common]     [>]  |
|             DMG:10 RNG:200               |
|                                           |
|  ───────── STORAGE (3 vapen) ──────────  |
|  Hunting Knife   DMG:20  [EQUIP] [UPG]  |
|  Baseball Bat    DMG:25  [EQUIP] [UPG]  |
|  Crowbar         DMG:22  [EQUIP] [UPG]  |
|                                           |
|  ───────── STATS ────────────────────── |
|  HP: 100  Speed: 100%                    |
|  Ammo: 15 (auto-loaded at night)         |
|  Encounter Strength: 65                   |
+------------------------------------------+
```

Upgrade-knappar DIREKT i storage-listan (inte separat panel).

### 4. Natt-HUD -- tydligare

```
TOP:
  [Hjärta] HP: 80/100    Wave 2/3    BASE [====----]

BOTTOM:
  [1] Fire Axe ████░░ 35/45    AMMO: 8    KILLS: 5
  [2] Worn Pistol               
```

Visa BÅDA equipped vapen i botten med tangent-nummer.

### 5. Resource-bar under dagen -- med tooltips

```
  ⚙ 12 SCRAP    🍎 8 FOOD(3/dag)    🔫 15 AMMO    🔧 4 PARTS    ➕ 2 MEDS
```

Hovra över en resurs = tooltip som förklarar:
- "SCRAP: Used to build structures and barricades"
- "FOOD: Feeds refugees. 3 refugees eat 3 food per day"
- "AMMO: Auto-loaded into guns at night. 0 ammo = melee only"
- "PARTS: Upgrade and repair weapons"
- "MEDS: Heal injured refugees (assign to REST job)"

### 6. Ammo-ändring (gameplay)

**Nuvarande:** Ammo är en resurs (0-100). Spelaren måste manuellt "Load Ammo" med AP.
**Nytt:** Ammo laddas AUTOMATISKT vid nattstart. Varje vapen förbrukar sitt ammoPerNight.

```
Nattstart:
  Primary: Worn Pistol (2 ammo/natt) -- laddat
  Secondary: Hunting Rifle (3 ammo/natt) -- laddat
  Total ammo förbrukat: 5
  Kvar i lager: 10
```

Om inte tillräckligt ammo: "Not enough ammo! Pistol loaded (2), Rifle EMPTY"

### 7. Meds-tydlighet

Meds VISAS bara i Refugee-panelen:
```
REFUGEE: Raven [HP: 30/100] [INJURED]
  Jobs: [FOOD] [SCRAP] [REST (1 med)] [GUARD]
                          ^^^^^^^^^ tydligt att det kostar
```

---

## Implementation-ordning

1. **Auto-load ammo** vid nattstart (ta bort manuell Load Ammo-knapp)
2. **Slå ihop EQUIP + WEAPONS** till en panel
3. **Ta bort AMMO-knapp** från toolbar
4. **Tooltips** på resurser
5. **Visa båda vapen i natt-HUD**
6. **Meds-kostnaden tydlig** i refugee-panelen

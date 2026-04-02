# Dead Horizon -- Equipment & Loadout Design

**Version:** 2.0.3
**Datum:** 2026-04-02

---

## Koncept

En EQUIP-skarm dar spelaren ser sin karaktar och kan kitta den med vapen och armor.
Utrustningen paverkar bade nattliga strider OCH encounters pa loot runs.

---

## 1. Equipment Slots

```
        [HELMET]
          |
    [WEAPON 1] -- KARAKTAR -- [WEAPON 2]
          |        SILHUETT
       [ARMOR]
          |
       [BOOTS]
```

| Slot | Typ | Max | Effekt |
|------|-----|-----|--------|
| **Primary Weapon** | Valfritt vapen | 1 | Huvudvapen under natt |
| **Secondary Weapon** | Valfritt vapen | 1 | Byt med tangent 2 |
| **Helmet** | Armor | 1 | +HP, chans att undvika headshot |
| **Body Armor** | Armor | 1 | -X% inkommande skada |
| **Boots** | Armor | 1 | +movement speed, +stamina |

Ovriga vapen ligger i STORAGE -- kan inte anvandas under natten.

---

## 2. Armor-typer

### Helmets

| Namn | Defense | Bonus | Rarity | Kalla |
|------|---------|-------|--------|-------|
| Hard Hat | +5 HP | -- | common | Loot |
| Military Helmet | +15 HP | 10% dodge headshot | uncommon | Military loot |
| Riot Helmet | +25 HP | 20% dodge headshot | rare | Police Station |

### Body Armor

| Namn | Defense | Bonus | Rarity | Kalla |
|------|---------|-------|--------|-------|
| Leather Jacket | -5% dmg | -- | common | Loot |
| Kevlar Vest | -15% dmg | -- | uncommon | Military loot |
| Tactical Vest | -20% dmg | +1 weapon slot | rare | Armory |
| Riot Gear | -30% dmg | -10% speed | rare | Police Station |

### Boots

| Namn | Speed | Bonus | Rarity | Kalla |
|------|-------|-------|--------|-------|
| Worn Sneakers | +0% | -- | common | Start |
| Combat Boots | +5% speed | +10% stamina | uncommon | Loot |
| Steel-Toe Boots | +0% speed | +5 melee dmg | uncommon | Loot |
| Sprint Shoes | +15% speed | +25% stamina | rare | City loot |

---

## 3. Equip-skarmen (UI)

Oppnas via tangent Q eller ny knapp i toolbar.

Layout:
```
+------------------------------------------+
|            EQUIPMENT                 [X]  |
|                                           |
|    [Helmet: Hard Hat]                     |
|                                           |
|  [Primary]   KARAKTAR   [Secondary]       |
|  Fire Axe    SILHUETT    Worn Pistol      |
|                                           |
|    [Armor: Kevlar Vest]                   |
|                                           |
|    [Boots: Combat Boots]                  |
|                                           |
|  STATS:                                   |
|    HP: 100 (+15)  DMG Reduce: 15%        |
|    Speed: 105%    Stamina: +10%          |
|    Encounter Strength: 85                 |
|                                           |
|  STORAGE: 5 weapons, 2 armor pieces       |
+------------------------------------------+
```

- Klicka pa en slot = oppna lista med tillgangliga items
- Items i slot visas med namn + stats
- Karaktarssilhuett i mitten (anvand portrait-sprite)
- STATS-sammanfattning i botten
- "Encounter Strength" = total combat power for loot runs

---

## 4. Encounter-koppling

Encounters pa loot runs anvander nu FAKTISK utrustning:

```
Encounter Strength = 
  Primary Weapon damage * 2
  + Secondary Weapon damage
  + Armor defense bonus * 5
  + Companion count * 20
  + Skill bonuses
```

Hogre strength = hogre chans att vinna encounters.
Visar "Your Strength: 85" i encounter-dialogen.

---

## 5. Loot: Armor drops

Armor hittas pa loot runs (ny kategori i loot-tables):
- Forest: Leather Jacket, Worn Sneakers (common)
- City: Kevlar Vest, Sprint Shoes (uncommon)
- Military: Military Helmet, Combat Boots, Tactical Vest (uncommon/rare)
- Police Station: Riot Helmet, Riot Gear (rare)

---

## 6. Implementation-prioritet

1. Equipment slots i GameState (types.ts)
2. Equip-panel UI (ny fil: src/ui/EquipmentPanel.ts)
3. Armor-data i JSON (src/data/armor.json)
4. Vapenbegransning: bara equipped vapen anvands i NightScene
5. Armor-effekter i Player.takeDamage() och movement
6. Encounter strength-berakning i LootManager
7. Armor loot drops

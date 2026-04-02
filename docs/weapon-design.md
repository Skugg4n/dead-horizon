# Dead Horizon -- Weapon & Upgrade Design

**Version:** 1.9.1
**Datum:** 2026-04-02

---

## 1. Vapenlista (komplett)

### Melee (tyst, inget ammo)

| Vapen | Dmg | Range | Rate | Dur | Rarity | Effekt | Nyckelkansla |
|-------|-----|-------|------|-----|--------|--------|-------------|
| Rusty Knife | 15 | 40 | 500 | 50 | common | -- | Snabb, svag starter |
| Hunting Knife | 20 | 45 | 450 | 60 | common | bleed 25% | Uppgraderad kniv |
| Two-by-Four | 12 | 60 | 650 | 40 | common | stun 15% | Skrapvapen, lang rackvidd |
| Baseball Bat | 25 | 55 | 700 | 80 | common | knockback 30% | Crowd control |
| Crowbar | 22 | 50 | 600 | 100 | uncommon | cripple 25% | Halbar allroundare |
| Machete | 28 | 48 | 400 | 55 | uncommon | bleed 35% | Snabb, hog dmg |
| Fire Axe | 35 | 50 | 900 | 45 | rare | cleave 20% | Langsam AOE-monster |
| Katana | 30 | 55 | 350 | 30 | rare | crit 25% (2x dmg) | Snabbast, glaskanon |

### Pistol (noise 1-2, balanserad)

| Vapen | Dmg | Range | Rate | Noise | Dur | Rarity | Effekt |
|-------|-----|-------|------|-------|-----|--------|--------|
| Worn Pistol | 10 | 200 | 400 | 2 | 40 | common | -- |
| 9mm Compact | 12 | 180 | 300 | 2 | 50 | common | -- (snabbare) |
| Revolver | 22 | 220 | 700 | 3 | 60 | uncommon | knockback 20% |
| Silenced Pistol | 14 | 190 | 450 | 0 | 35 | rare | piercing 15% |

### Rifle (noise 3-4, lang range)

| Vapen | Dmg | Range | Rate | Noise | Dur | Rarity | Effekt |
|-------|-----|-------|------|-------|-----|--------|--------|
| Hunting Rifle | 25 | 350 | 800 | 4 | 35 | uncommon | -- |
| Assault Rifle | 15 | 280 | 250 | 4 | 45 | uncommon | -- (burst fire) |
| Scoped Rifle | 30 | 450 | 1000 | 3 | 30 | rare | headshot 20% (2x) |
| Marksman Rifle | 35 | 400 | 900 | 3 | 25 | rare | piercing 30% |

### Shotgun (noise 5, kort range, hog dmg)

| Vapen | Dmg | Range | Rate | Noise | Dur | Rarity | Effekt |
|-------|-----|-------|------|-------|-----|--------|--------|
| Sawed-Off | 30 | 120 | 900 | 5 | 30 | uncommon | -- |
| Pump Shotgun | 35 | 150 | 1100 | 5 | 50 | uncommon | knockback 40% |
| Combat Shotgun | 28 | 140 | 600 | 5 | 40 | rare | incendiary 25% |

### Explosives (noise 8, AOE, sallsynt)

| Vapen | Dmg | Range | Rate | Noise | Dur | Rarity | Effekt |
|-------|-----|-------|------|-------|-----|--------|--------|
| Pipe Bomb | 60 | 200 | 3000 | 8 | 5 | rare | AOE 80px |
| Molotov | 40 | 180 | 2500 | 6 | 8 | uncommon | burn zone 5s |
| Grenade Launcher | 50 | 300 | 2000 | 8 | 15 | legendary | AOE 100px |

---

## 2. Upgrade-system

### Filosofi
- Varje vapen kan uppgraderas i 3 NIVAER per upgrade-typ
- Varje niva kostar MER an forsta (eskalerande kostnad)
- Max 3 upgrades per vapen (valj klokt!)
- Upgrades ar PERMANENTA -- foljer vapnet

### Upgrade-typer

| Upgrade | Niva 1 | Niva 2 | Niva 3 | Applicerbart |
|---------|--------|--------|--------|-------------|
| **Damage Boost** | +15% dmg (3 parts) | +30% dmg (6 parts) | +50% dmg (12 parts) | Alla |
| **Reinforcement** | +25% durability (2 parts) | +50% dur (5 parts) | +100% dur (10 parts) | Alla |
| **Sharpening** | +10% crit (2 parts) | +20% crit (4 parts) | +35% crit (8 parts) | Melee |
| **Suppressor** | -1 noise (4 parts) | -2 noise (8 parts) | -- | Ranged |
| **Extended Mag** | -20% ammo use (3 parts) | -40% ammo (7 parts) | -60% ammo (14 parts) | Ranged |
| **Scope** | +15% range (3 parts) | +30% range (6 parts) | +50% range (12 parts) | Rifle/Pistol |
| **Quick Grip** | -15% fire rate (3 parts) | -25% rate (6 parts) | -40% rate (12 parts) | Alla |
| **Serrated Edge** | +bleed effect (4 parts) | +stronger bleed (8 parts) | -- | Melee utan bleed |

### Kostnadskurva
- Niva 1: basbelopp (billigt, snabb forbattring)
- Niva 2: 2x basbelopp (markbar investering)
- Niva 3: 4x basbelopp (slutspels-sink for resurser)

### Implementationsnoter
- Upgrades sparas per weapon instance (inte per weapon type)
- WeaponInstance.upgrades: Array<{ id: string, level: number }>
- WeaponManager.getWeaponStats() applicerar alla upgrades pa basstats
- UI: WeaponPanel visar installerade upgrades + tillgangliga

---

## 3. Fallor och hinder

### Nuvarande
- Barricade (saktar ner)
- Wall (blockerar)
- Trap (skadar)
- Pillbox (refugee skjuter)

### Nya fallor/hinder

| Struktur | Kostnad | Effekt | Durability | Nyckelroll |
|----------|---------|--------|------------|-----------|
| **Spike Strip** | 3 scrap | 15 dmg + cripple 3s | 5 anvandningar | Slow lane |
| **Bear Trap** | 5 scrap, 1 parts | 25 dmg + stun 2s | 1 anvandning | Hog dmg, engangsfalla |
| **Electric Fence** | 8 scrap, 3 parts | 10 dmg/s i kontakt | 150 HP | Area denial |
| **Landmine** | 4 scrap, 2 parts | 50 dmg AOE | 1 anvandning | Boom |
| **Watchtower** | 10 scrap, 5 parts | +50% awareness range | 200 HP | Upgraderad pillbox |
| **Sandbags** | 3 scrap | Halv barricade-kostnad, lag HP | 50 HP | Billig bromsare |
| **Oil Slick** | 2 food | Saktar 80% i 3 tiles | 3 natter | Eco crowd control |
| **Noise Trap** | 3 scrap | Attraherar zombies, exploderar | 1 anvandning | Avledare |

### Fallprogressions
- Natt 1-2: Barricades, Spike Strips, Sandbags (billiga)
- Natt 3-4: Bear Traps, Walls, Oil Slick, Landmines
- Natt 5+: Electric Fence, Watchtower, Noise Trap

---

## 4. Basuppgraderingar (framtid)

| Niva | Namn | Kostnad | Ger |
|------|------|---------|-----|
| 0 | Tent | Start | 0 refugees, basic shelter |
| 1 | Camp | 30 scrap, 5 parts | +2 refugees, storage +50 |
| 2 | Outpost | 60 scrap, 15 parts | +5 refugees, storage +100, pillbox-platser |
| 3 | Settlement | 120 scrap, 30 parts | +10 refugees, alla byggnadstyper, farm |

---

## 5. Specialeffekter (alla typer)

| Effekt | Beskrivning | Trigger |
|--------|------------|---------|
| bleed | X dmg over 2s | On hit |
| knockback | Knuffar bort Npx | On hit |
| cripple | -50% speed Ns | On hit |
| stun | 0 speed Ns | On hit |
| cleave | Dmg alla inom Npx | On hit |
| piercing | Skott gar genom fiende | On hit (ranged) |
| headshot | Crit-chans (2x dmg) | On hit |
| incendiary | Brann-zon, DOT | On hit (creates zone) |
| crit | X% chans for dubbel skada | On hit (melee) |
| burn zone | Area denial, dmg over time | On impact |

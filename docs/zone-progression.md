# Dead Horizon -- Zone Progression Design

**Version:** 2.2.0
**Datum:** 2026-04-03

---

## Koncept

Tre zoner spelar som "kapitel". Spelaren måste klara en zon för att låsa upp nästa.
Mellan zoner väljer man vad man tar med sig -- som att packa en ryggsäck.

---

## 1. Zonstruktur

```
FOREST (Natt 1-5) -- "The Outskirts"
  Lättast. Mest walkers. Lär sig spelet.
  Natt 5: Forest Boss (Brute Boss)
  Klara = Låser upp City

CITY (Natt 6-10) -- "Urban Decay"  
  Mer runners, spitters. Tätare fiender.
  Natt 10: City Boss (ny boss-typ?)
  Klara = Låser upp Military

MILITARY (Natt 11-15) -- "The Last Stand"
  Allt på max. Brutes, screamers, allt.
  Natt 15: Final Boss
  Klara = Endless Mode

ENDLESS (Natt 16+) -- "How Long Can You Survive?"
  Auto-scaling: +15% fiender/styrka per natt
  Leaderboard-potential
  Kör tills du dör
```

---

## 2. Huvudmeny med zoner

```
+------------------------------------------+
|  DEAD HORIZON                             |
|                                           |
|  [FOREST]  ★★★★★  COMPLETED              |
|  [CITY]    ★★☆☆☆  Night 7/10             |
|  [MILITARY] 🔒 Requires City cleared     |
|  [ENDLESS]  🔒 Requires Military cleared  |
|                                           |
|  [CONTINUE]  [NEW GAME]  [SETTINGS]      |
+------------------------------------------+
```

Stjärnor = hur många nätter du klarat i zonen.

---

## 3. Mellan-zon-val: "Pack Your Bag"

När du klarar sista natten i en zon visas:

```
+------------------------------------------+
|     MOVING TO: CITY                       |
|     "Pack what you can carry"             |
|                                           |
|  WEAPONS: (välj max 4)                    |
|  [x] Fire Axe [common]                   |
|  [x] Hunting Rifle [uncommon]            |
|  [x] Worn Pistol [common]                |
|  [ ] Rusty Knife [common]                |
|  [ ] Two-by-Four [common]                |
|                                           |
|  RESOURCES: (välj max 50 totalt)          |
|  Scrap:  [===|----] 20/50                |
|  Ammo:   [==|-----] 15/50               |
|  Parts:  [=|------] 10/50               |
|  Food:   [|-------] 5/50                |
|  Meds:   [|-------] 0/50                |
|                                           |
|  REFUGEES: (alla följer med)              |
|  Alex [healthy], Raven [injured]          |
|                                           |
|  SKILLS: (alla behålls)                   |
|  Rifle Lv3, Melee Lv2, Looting Lv1       |
|                                           |
|  [MOVE OUT >>]                            |
+------------------------------------------+
```

### Begränsningar:
- **Vapen:** Max 4 vapen (tvingar val)
- **Resurser:** Max 50 enheter TOTALT (fördela klokt!)
- **Strukturer:** Lämnas kvar (ny bas i ny zon)
- **Refugees:** Alla följer med
- **Skills:** Alla behålls (din styrka)
- **Upgrades:** Följer vapnen du tar med

---

## 4. Vad som händer vid zonsstart

- Ny zon = ny karta (nytt mapSeed)
- Bas börjar om som Tent (måste byggas upp igen)
- Strukturer/fällor borta (ny terräng)
- Men du har dina utvalda vapen + resurser + skills

---

## 5. Progression inom en zon

```
Natt 1: 1 wave  -- introduktion
Natt 2: 2 waves -- börjar bli svårt
Natt 3: 3 waves -- kräver försvar
Natt 4: 4 waves -- kräver strategi
Natt 5: 5 waves -- BOSS (klara = nästa zon)
```

Vid DÖD inom zon:
- Behåll allt gear, skills, refugees
- Ny terräng-layout ("parallell dimension")
- Börja om från natt 1 i SAMMA zon
- Allt du samlat behålls

---

## 6. Auto-scaling (Endless Mode)

Natt 16+:
- Bas: Wave 5 Military data
- Per natt: +15% antal fiender, +10% HP, +5% speed
- Natt 20: 2x fiender vs Military Wave 5
- Natt 30: Absurt svårt
- Poäng: antal nätter överlevda

---

## 7. Skills mellan zoner

Skills levlar genom användning och BEHÅLLS mellan zoner:

| Skill | Effekt | Hur det hjälper i nästa zon |
|-------|--------|---------------------------|
| Melee Lv3 | +30% melee dmg | Spara ammo |
| Rifle Lv3 | +30% rifle dmg | Klara svårare fiender |
| Looting Lv2 | Bättre loot | Hitta bättre vapen snabbare |
| Building Lv2 | Billigare byggen | Bygg upp bas snabbare |
| Leadership Lv2 | Effektivare refugees | Mer resurser per dag |

---

## 8. Implementation-prioritet

1. **Zon-progression i GameState** -- currentZone, zonesCleared
2. **Zon-lås i huvudmeny** -- visa alla, låsa olåsta
3. **Boss-natt (natt 5)** -- tydlig "FINAL WAVE" markering
4. **"Pack Your Bag"-skärm** -- val-interface
5. **Auto-scaling** för Endless
6. **Ny zon-start** -- reset bas, behåll vapen/skills

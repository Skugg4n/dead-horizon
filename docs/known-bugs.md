# Dead Horizon -- Known Bugs & Issues

Denna fil trackar alla kända buggar. Stryks INTE förrän verifierade som fixade.

---

## KRITISKA (spelet kraschar/låser sig)

### KB1: Projectile crash på wave 3 (FIXAD v1.9.2, ej verifierad live)
- Symptom: Spelet tvärstannar vid första kulan på wave 3
- Error: `proj.deactivate is not a function` (NightScene.ts:746)
- Fix: typeof-guard på deactivate innan anrop
- Status: Fixad i kod, pushat, väntar på deploy-verifiering

### KB2: Continue-knapp fungerar inte efter crash
- Symptom: Efter att spelet låst sig kan man inte klicka Continue
- Trolig orsak: GameState sparas i korrupt tillstånd efter krasch
- Status: EJ FIXAD

---

## VISUELLA

### VB1: Dag/natt har OLIKA terräng-layout
- Symptom: Träd, stenar, blommor byter plats mellan dag och natt
- Root cause: totalRuns++ körs i slutet av natten INNAN nästa dag
- Fix pågår: mapSeed i GameState som bara ändras vid dödsfall
- Status: PÅGÅR

### VB2: ">" pil i vapenpanelen otydlig
- Symptom: Gul ">" bredvid Rusty Knife -- betyder det equipped? Vald?
- Behöver: Tydligare indikator (t.ex. "EQUIPPED" text eller annan markering)
- Status: EJ FIXAD

### VB3: BASE-text trunkerad i HUD
- Symptom: "BASE" visas som "BA_E" i vissa skalningar
- Fix: Ökat font från 7px till 8px (v1.9.1)
- Status: Fixad, behöver verifieras

---

## GAMEPLAY

### GB1: Tangenter aktiva under tutorial
- Symptom: B/L/R öppnar paneler bakom tutorial-dialogen
- Fix: tutorialShowing-check i keyboard router (v1.9.1)
- Status: Fixad

### GB2: Zombie-flanking kan se buggigt ut
- Status: Implementerad v1.9.0, behöver speltest

---

## UX

### UB1: ESC/Enter/Space på resultatskärmen
- Symptom: "ALL WAVES SURVIVED" kräver musklick
- Fix: Keyboard-handler tillagd (v1.9.2+)
- Status: FIXAD, ej pushat ännu

### UB2: Game Over-skärmen saknar keyboard-navigation
- Status: EJ FIXAD

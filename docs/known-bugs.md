# Dead Horizon -- Known Bugs & Issues

Denna fil trackar alla kända buggar. Stryks INTE förrän verifierade som fixade.

---

## FIXADE OCH VERIFIERADE

### KB1: Projectile crash på wave 3
- Fix: instanceof-check i overlap callback (v2.0.4)
- **VERIFIERAD AV ANVÄNDAREN: Kraschar inte längre!**

### VB1: Dag/natt har OLIKA terräng-layout
- Root cause: DayScene anropade generateTerrain() FÖRE physics.world.setBounds()
- Fix: Flyttade setBounds() före generateTerrain() (v2.0.5)
- **VERIFIERAD AV ANVÄNDAREN: Layouten är nu identisk!**

### VB2: ">" pil i vapenpanelen otydlig
- Fix: Bytt till [EQUIPPED] text (v2.0.3)
- **FIXAD**

### VB3: BASE-text trunkerad
- Fix: Font 9px + stroke (v2.0.6)
- **FIXAD**

### GB1: Tangenter aktiva under tutorial
- Fix: tutorialShowing-check (v1.9.1)
- **FIXAD**

### UB1: ESC/Enter/Space på resultatskärmen
- Fix: Keyboard handler tillagd (v2.0.0)
- **FIXAD**

### UB2: Game Over saknar keyboard
- Fix: ESC/Enter/Space handler (v2.0.3)
- **FIXAD**

---

## VÄNTAR PÅ VERIFIERING

### KB2: Continue-knapp fungerar inte efter crash
- Fix: try/catch i SaveManager.load(), rensar korrupt save (v2.0.3)
- Status: Väntar på test

---

## KÄNDA PROBLEM (ej fixade)

### GP1: Duplicate spike trap-typer i build-menyn
- Fix: "Spike Trap" omdöpt till "Claw Trap" (v2.0.6)
- Status: Borde vara fixat, väntar på verifiering

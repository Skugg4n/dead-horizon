"""
Dead Horizon -- Character Portraits
Skapar 64x64 pixel art-portratt for de 4 spelarkaraktarerna.
"""
from PIL import Image

BASE = '/Users/olabelin/Projects/dead-horizon/public/assets/sprites/characters'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def create_sprite(size=64):
    return Image.new('RGBA', (size, size), (0, 0, 0, 0))

def px(img, x, y, color):
    if 0 <= x < img.width and 0 <= y < img.height:
        if len(color) == 3:
            color = color + (255,)
        img.putpixel((x, y), color)

def rect(img, x, y, w, h, color):
    for dy in range(h):
        for dx in range(w):
            px(img, x + dx, y + dy, color)

def save_portrait(img, name, scale=4):
    img.save(f'{BASE}/portrait_{name}.png')
    preview = img.resize(
        (img.width * scale, img.height * scale),
        Image.NEAREST
    )
    preview.save(f'{BASE}/portrait_{name}_preview.png')
    print(f'  Saved portrait_{name}.png  ({img.width}x{img.height})')

# ---------------------------------------------------------------------------
# Shared colour constants  (from art-direction.md)
# ---------------------------------------------------------------------------

# Skin tones
SKIN_MED      = (189, 140, 100)
SKIN_DARK     = (120,  85,  55)
SKIN_LIGHT    = (210, 170, 130)
SKIN_SHADOW   = ( 90,  60,  40)
SKIN_LIGHT_SH = (160, 120,  90)

# Hair
HAIR_BLACK    = ( 28,  22,  18)
HAIR_DARK_BR  = ( 55,  35,  20)
HAIR_BROWN    = ( 80,  50,  30)
HAIR_GREY     = (110, 110, 105)
HAIR_BLONDE   = (180, 140,  60)

# Eyes
EYE_BROWN     = ( 80,  50,  20)
EYE_GREEN     = ( 50,  90,  50)
EYE_BLUE      = ( 74, 144, 217)
EYE_WHITE     = (220, 210, 195)

# Clothing / gear  (art-direction palette)
MIL_GREEN     = ( 60,  80,  45)
MIL_DARK      = ( 38,  55,  28)
KHAKI         = (140, 120,  70)
GREY_JACKET   = ( 80,  78,  75)
DARK_JACKET   = ( 45,  42,  40)
SCRAP_BROWN   = ( 92,  64,  51)
BANDAGE_VIT   = (232, 220, 200)
FLANELL_RED   = (178,  34,  34)
BLOOD_RED     = (139,   0,   0)
RUST          = (139,  69,  19)

# Background  (dark panel, near nattsvart)
BG_DARK       = ( 26,  26,  46)
BG_MID        = ( 35,  35,  58)
BG_VIGN       = ( 18,  18,  32)

# Misc
SHADOW_COL    = (  0,   0,   0, 100)
WHITE_H       = (245, 245, 240)
MED_BLUE      = ( 74, 144, 217)
AMMO_GOLD     = (197, 160,  48)
LENS_GLASS    = (150, 200, 220, 180)

# ---------------------------------------------------------------------------
# Shared helper: gradient background with vignette feel
# ---------------------------------------------------------------------------

def draw_bg(img):
    for y in range(64):
        for x in range(64):
            # radial-ish vignette: darker at corners
            cx = abs(x - 31.5) / 31.5
            cy = abs(y - 31.5) / 31.5
            d  = (cx ** 2 + cy ** 2) ** 0.5
            t  = min(d, 1.0)
            r  = int(BG_MID[0] * (1 - t) + BG_VIGN[0] * t)
            g  = int(BG_MID[1] * (1 - t) + BG_VIGN[1] * t)
            b  = int(BG_MID[2] * (1 - t) + BG_VIGN[2] * t)
            img.putpixel((x, y), (r, g, b, 255))

# ---------------------------------------------------------------------------
# Shared: draw a bust -- neck + upper torso block at bottom
# ---------------------------------------------------------------------------

def draw_torso(img, x, y, w, h, color, shadow):
    """Draw a simple torso rectangle with a slight left-shadow."""
    rect(img, x, y, w, h, color)
    # left shadow stripe
    for dy in range(h):
        px(img, x, y + dy, shadow)

def draw_neck(img, cx, y, h, skin, shadow):
    """2-px wide neck."""
    rect(img, cx - 1, y, 3, h, skin)
    px(img, cx - 1, y, shadow)

# ---------------------------------------------------------------------------
# 1. SOLDIER
# ---------------------------------------------------------------------------

def portrait_soldier():
    img = create_sprite(64)
    draw_bg(img)

    # --- Torso / body  (military jacket)
    draw_torso(img, 14, 46, 36, 20, MIL_GREEN, MIL_DARK)
    # collar fold
    rect(img, 28, 46, 8, 4, MIL_DARK)
    # shoulder patches (khaki)
    rect(img, 14, 46, 5, 5, KHAKI)
    rect(img, 45, 46, 5, 5, KHAKI)
    # ammo-strap across chest
    for i in range(18):
        px(img, 15 + i * 2, 50, AMMO_GOLD)

    # --- Neck
    draw_neck(img, 32, 40, 6, SKIN_MED, SKIN_SHADOW)

    # --- Head base  (oval-ish)
    rect(img, 19, 16, 26, 24, SKIN_MED)
    # round top corners
    for dx in range(3):
        for dy in range(3 - dx):
            px(img, 19 + dx, 16 + dy, (0, 0, 0, 0))
            px(img, 44 - dx, 16 + dy, (0, 0, 0, 0))
    # jaw shadow
    for x in range(26):
        px(img, 19 + x, 39, SKIN_SHADOW)

    # --- Facial scar (from left cheek toward mouth)
    # rough diagonal scar
    for i in range(5):
        px(img, 22 + i, 29 + i // 2, BLOOD_RED)
    for i in range(4):
        px(img, 23 + i, 30 + i // 2, (160, 80, 70))

    # --- Eyes  (deep-set, stern)
    # left eye
    rect(img, 22, 26, 5, 3, EYE_WHITE)
    rect(img, 23, 27, 3, 2, EYE_BROWN)
    px(img, 24, 27, HAIR_BLACK)   # pupil
    # right eye
    rect(img, 37, 26, 5, 3, EYE_WHITE)
    rect(img, 38, 27, 3, 2, EYE_BROWN)
    px(img, 39, 27, HAIR_BLACK)
    # brow shadow
    rect(img, 22, 25, 5, 1, SKIN_SHADOW)
    rect(img, 37, 25, 5, 1, SKIN_SHADOW)

    # --- Nose  (small bridge shadow)
    px(img, 31, 30, SKIN_SHADOW)
    px(img, 32, 31, SKIN_SHADOW)
    px(img, 30, 32, SKIN_SHADOW)
    px(img, 33, 32, SKIN_SHADOW)

    # --- Mouth  (thin, set jaw)
    rect(img, 27, 35, 10, 1, SKIN_SHADOW)
    px(img, 28, 36, SKIN_SHADOW)
    px(img, 35, 36, SKIN_SHADOW)

    # --- Stubble / 5-o-clock shadow on jaw
    for x in range(22, 42, 2):
        px(img, x, 37, SKIN_DARK)
    for x in range(21, 43, 3):
        px(img, x, 38, SKIN_DARK)

    # --- Military helmet  (combat helmet, sitting low)
    # helmet body
    rect(img, 16, 8, 32, 14, MIL_DARK)
    # round top
    rect(img, 18, 5, 28, 5, MIL_DARK)
    for dx in range(3):
        for dy in range(3 - dx):
            px(img, 18 + dx, 5 + dy, (0, 0, 0, 0))
            px(img, 45 - dx, 5 + dy, (0, 0, 0, 0))
    # helmet rim
    rect(img, 14, 21, 36, 2, MIL_GREEN)
    # helmet highlight
    rect(img, 20, 6, 12, 2, (80, 100, 60))
    # chin-strap suggestion
    px(img, 18, 22, KHAKI)
    px(img, 18, 23, KHAKI)
    px(img, 45, 22, KHAKI)
    px(img, 45, 23, KHAKI)

    # --- Night-vision mount stub on helmet
    rect(img, 29, 5, 6, 3, (50, 50, 50))
    rect(img, 30, 3, 4, 3, (40, 40, 40))

    return img


# ---------------------------------------------------------------------------
# 2. SCAVENGER
# ---------------------------------------------------------------------------

def portrait_scavenger():
    img = create_sprite(64)
    draw_bg(img)

    # --- Torso  (dark hoodie / ragged jacket)
    draw_torso(img, 12, 46, 40, 20, DARK_JACKET, (25, 23, 20))
    # hood hanging behind -- darker panel at sides
    rect(img, 12, 44, 6, 6, (35, 32, 28))
    rect(img, 46, 44, 6, 6, (35, 32, 28))
    # strap + buckle (scavenger gear)
    rect(img, 32, 47, 2, 14, SCRAP_BROWN)
    rect(img, 30, 51, 6, 3, (80, 60, 40))
    # worn patches
    for i in range(5):
        px(img, 16 + i * 4, 52, RUST)

    # --- Neck
    draw_neck(img, 32, 40, 6, SKIN_LIGHT, SKIN_LIGHT_SH)

    # --- Head base  (slimmer -- smidig typ)
    rect(img, 21, 17, 22, 23, SKIN_LIGHT)
    # rounded top
    for dx in range(2):
        px(img, 21 + dx, 17, (0, 0, 0, 0))
        px(img, 42 - dx, 17, (0, 0, 0, 0))
    px(img, 21, 18, (0, 0, 0, 0))
    px(img, 42, 18, (0, 0, 0, 0))
    # jaw
    for x in range(22):
        px(img, 21 + x, 39, SKIN_LIGHT_SH)

    # --- Bandana across lower face  (covers nose and mouth)
    rect(img, 19, 31, 26, 9, FLANELL_RED)
    # worn bandana texture
    for i in range(6):
        px(img, 20 + i * 4, 33, BLOOD_RED)
        px(img, 22 + i * 4, 35, (140, 20, 20))
    # bandana knot hint at side
    rect(img, 43, 32, 3, 5, BLOOD_RED)

    # --- Eyes  (visible above bandana -- sharp, alert)
    # left eye
    rect(img, 23, 23, 5, 3, EYE_WHITE)
    rect(img, 24, 24, 3, 2, EYE_GREEN)
    px(img, 25, 24, HAIR_BLACK)
    # right eye
    rect(img, 36, 23, 5, 3, EYE_WHITE)
    rect(img, 37, 24, 3, 2, EYE_GREEN)
    px(img, 38, 24, HAIR_BLACK)
    # tired lines under eyes
    px(img, 23, 26, SKIN_LIGHT_SH)
    px(img, 40, 26, SKIN_LIGHT_SH)

    # --- Eyebrows  (sharp, raised slightly -- alert)
    rect(img, 23, 22, 5, 1, HAIR_DARK_BR)
    rect(img, 36, 22, 5, 1, HAIR_DARK_BR)

    # --- Hood  (pulled up, framing head tightly)
    # hood sides
    rect(img, 13, 14, 8, 28, (45, 42, 38))
    rect(img, 43, 14, 8, 28, (45, 42, 38))
    # hood top arc
    rect(img, 17, 8, 30, 10, (48, 45, 40))
    for dx in range(4):
        for dy in range(4 - dx):
            px(img, 17 + dx, 8 + dy, (0, 0, 0, 0))
            px(img, 46 - dx, 8 + dy, (0, 0, 0, 0))
    # inner hood shadow
    rect(img, 19, 10, 26, 5, (35, 32, 28))
    # hair visible at front edge of hood
    rect(img, 21, 15, 22, 3, HAIR_DARK_BR)
    for x in range(22):
        if x % 2 == 0:
            px(img, 21 + x, 16, HAIR_BLACK)

    return img


# ---------------------------------------------------------------------------
# 3. ENGINEER
# ---------------------------------------------------------------------------

def portrait_engineer():
    img = create_sprite(64)
    draw_bg(img)

    # --- Torso  (work jacket, tool-vest)
    draw_torso(img, 13, 45, 38, 20, (70, 80, 60), (45, 55, 38))
    # vest pockets
    rect(img, 16, 48, 8, 6, (55, 65, 48))
    rect(img, 40, 48, 8, 6, (55, 65, 48))
    # pocket flaps
    rect(img, 16, 48, 8, 1, (40, 50, 32))
    rect(img, 40, 48, 8, 1, (40, 50, 32))
    # screwdriver in pocket
    rect(img, 20, 48, 1, 5, (180, 180, 180))
    rect(img, 20, 48, 1, 2, AMMO_GOLD)
    # collar
    rect(img, 28, 45, 8, 3, (50, 58, 42))

    # --- Neck
    draw_neck(img, 32, 39, 6, SKIN_MED, SKIN_SHADOW)

    # --- Head base
    rect(img, 20, 17, 24, 22, SKIN_MED)
    for dx in range(2):
        px(img, 20 + dx, 17, (0, 0, 0, 0))
        px(img, 43 - dx, 17, (0, 0, 0, 0))
    for x in range(24):
        px(img, 20 + x, 38, SKIN_SHADOW)

    # --- Stubble  (skaggstubb -- a few days growth)
    for x in range(20, 44, 2):
        px(img, x, 34, HAIR_DARK_BR)
    for x in range(20, 44, 3):
        px(img, x, 35, HAIR_DARK_BR)
        px(img, x, 36, HAIR_DARK_BR)
    for x in range(20, 24):
        px(img, x, 33, HAIR_DARK_BR)
    for x in range(40, 44):
        px(img, x, 33, HAIR_DARK_BR)

    # --- Eyes  (thoughtful, intelligent)
    rect(img, 22, 25, 6, 3, EYE_WHITE)
    rect(img, 23, 26, 4, 2, EYE_BROWN)
    px(img, 25, 26, HAIR_BLACK)
    rect(img, 36, 25, 6, 3, EYE_WHITE)
    rect(img, 37, 26, 4, 2, EYE_BROWN)
    px(img, 39, 26, HAIR_BLACK)

    # --- Eyebrows  (slightly furrowed -- concentrating)
    rect(img, 22, 24, 6, 1, HAIR_BROWN)
    rect(img, 36, 24, 6, 1, HAIR_BROWN)
    # furrow lines between brows
    px(img, 31, 24, SKIN_SHADOW)
    px(img, 32, 24, SKIN_SHADOW)

    # --- Nose bridge shadow
    px(img, 31, 28, SKIN_SHADOW)
    px(img, 32, 29, SKIN_SHADOW)
    px(img, 30, 30, SKIN_SHADOW)
    px(img, 33, 30, SKIN_SHADOW)

    # --- Mouth  (slight smirk -- knows something you don't)
    rect(img, 27, 33, 10, 1, SKIN_SHADOW)
    px(img, 36, 34, SKIN_SHADOW)   # smirk right side

    # --- Safety goggles  (resting on forehead)
    # goggle frame
    rect(img, 20, 19, 10, 5, (60, 55, 40))
    rect(img, 34, 19, 10, 5, (60, 55, 40))
    # lens glass
    rect(img, 21, 20, 8, 3, (120, 170, 200, 160))
    rect(img, 35, 20, 8, 3, (120, 170, 200, 160))
    # goggle strap across forehead
    rect(img, 30, 20, 4, 4, (50, 45, 32))
    # strap continues behind head (implied)

    # --- Hair  (messy, short, brown -- hastig frisyr)
    rect(img, 20, 14, 24, 6, HAIR_BROWN)
    # spiky/messy top
    for i in range(6):
        px(img, 21 + i * 3, 13, HAIR_BROWN)
        px(img, 22 + i * 3, 12, HAIR_DARK_BR)
    # sides
    rect(img, 18, 17, 3, 6, HAIR_BROWN)
    rect(img, 43, 17, 3, 6, HAIR_BROWN)
    # top round corners
    for dx in range(3):
        for dy in range(3 - dx):
            px(img, 20 + dx, 14 + dy, (0, 0, 0, 0))
            px(img, 43 - dx, 14 + dy, (0, 0, 0, 0))
    px(img, 20, 14, (0, 0, 0, 0))

    return img


# ---------------------------------------------------------------------------
# 4. MEDIC
# ---------------------------------------------------------------------------

def portrait_medic():
    img = create_sprite(64)
    draw_bg(img)

    # --- Torso  (white/light medical jacket with red cross)
    MEDIC_WHITE = (200, 195, 185)
    MEDIC_SHADOW = (155, 150, 140)
    draw_torso(img, 13, 45, 38, 20, MEDIC_WHITE, MEDIC_SHADOW)
    # jacket collar / lapels
    rect(img, 27, 45, 10, 5, (175, 170, 160))
    # red cross on left chest
    rect(img, 18, 49, 6, 2, FLANELL_RED)   # horizontal bar
    rect(img, 20, 47, 2, 6, FLANELL_RED)   # vertical bar
    # stethoscope around neck / hanging
    for i in range(8):
        px(img, 30 + i, 47 + (i % 2), (100, 100, 100))
    rect(img, 37, 48, 2, 4, (90, 90, 90))
    # small syringe in pocket
    rect(img, 44, 48, 2, 4, MED_BLUE)
    rect(img, 44, 47, 2, 2, (200, 200, 200))

    # --- Neck
    draw_neck(img, 32, 39, 6, SKIN_LIGHT, SKIN_LIGHT_SH)

    # --- Head base  (oval, calm proportions)
    rect(img, 20, 16, 24, 23, SKIN_LIGHT)
    # round top corners
    for dx in range(3):
        for dy in range(3 - dx):
            px(img, 20 + dx, 16 + dy, (0, 0, 0, 0))
            px(img, 43 - dx, 16 + dy, (0, 0, 0, 0))
    # jaw line
    for x in range(24):
        px(img, 20 + x, 38, SKIN_LIGHT_SH)
    # subtle cheek shadow
    for y in range(5):
        px(img, 21, 28 + y, SKIN_LIGHT_SH)
        px(img, 42, 28 + y, SKIN_LIGHT_SH)

    # --- Eyes  (calm, focused, kind -- slightly larger)
    rect(img, 22, 24, 7, 4, EYE_WHITE)
    rect(img, 23, 25, 5, 3, EYE_BLUE)
    rect(img, 24, 26, 3, 2, (40, 90, 160))
    px(img, 25, 26, HAIR_BLACK)   # pupil
    # right eye
    rect(img, 35, 24, 7, 4, EYE_WHITE)
    rect(img, 36, 25, 5, 3, EYE_BLUE)
    rect(img, 37, 26, 3, 2, (40, 90, 160))
    px(img, 38, 26, HAIR_BLACK)
    # lower lashes (calm, soft)
    px(img, 23, 27, SKIN_LIGHT_SH)
    px(img, 36, 27, SKIN_LIGHT_SH)

    # --- Eyebrows  (gently arched -- caring expression)
    for i in range(6):
        px(img, 22 + i, 23 - (1 if i in (2, 3) else 0), HAIR_BLACK)
    for i in range(6):
        px(img, 35 + i, 23 - (1 if i in (2, 3) else 0), HAIR_BLACK)

    # --- Nose
    px(img, 31, 29, SKIN_LIGHT_SH)
    px(img, 32, 30, SKIN_LIGHT_SH)
    px(img, 30, 31, SKIN_LIGHT_SH)
    px(img, 33, 31, SKIN_LIGHT_SH)

    # --- Mouth  (calm, slight smile)
    rect(img, 27, 34, 10, 1, SKIN_LIGHT_SH)
    px(img, 27, 35, SKIN_LIGHT_SH)   # left dimple
    px(img, 36, 35, SKIN_LIGHT_SH)   # right dimple
    # lower lip hint
    rect(img, 28, 35, 8, 1, (190, 145, 120))

    # --- Hair  (short, neat, pulled back -- practical)
    HAIR_COL = HAIR_DARK_BR
    # hair cap -- neat short cut
    rect(img, 20, 10, 24, 8, HAIR_COL)
    # round top
    for dx in range(4):
        for dy in range(4 - dx):
            px(img, 20 + dx, 10 + dy, (0, 0, 0, 0))
            px(img, 43 - dx, 10 + dy, (0, 0, 0, 0))
    # side hair
    rect(img, 18, 14, 3, 8, HAIR_COL)
    rect(img, 43, 14, 3, 8, HAIR_COL)
    # hair line  -- clean, defined
    rect(img, 20, 17, 24, 1, HAIR_COL)
    for i in range(5):
        px(img, 19 + i, 17 + i // 2, HAIR_COL)
        px(img, 44 - i, 17 + i // 2, HAIR_COL)
    # slight hair highlight
    for i in range(10):
        px(img, 26 + i, 11, HAIR_BROWN)

    # --- Small red cross on collar / hat band
    # (subtle cross badge on hair near forehead)
    rect(img, 30, 16, 4, 1, FLANELL_RED)
    rect(img, 31, 15, 2, 3, FLANELL_RED)

    return img


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    print('Creating character portraits ...')

    portraits = [
        ('soldier',    portrait_soldier),
        ('scavenger',  portrait_scavenger),
        ('engineer',   portrait_engineer),
        ('medic',      portrait_medic),
    ]

    for name, fn in portraits:
        img = fn()
        save_portrait(img, name)

    print('Done. All portraits saved to public/assets/sprites/characters/')

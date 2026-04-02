"""
Dead Horizon -- Improved sprite generation
Creates detailed 32x32 (and larger) pixel art sprites.
All sprites: top-down perspective, gritty/dark tone, transparent background.
"""

from PIL import Image

# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

def create_sprite(size=32):
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

def circle(img, cx, cy, r, color, fill=True):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if fill and dist <= r:
                px(img, x, y, color)
            elif not fill and abs(dist - r) <= 0.7:
                px(img, x, y, color)

def save_sprite(img, name, scale=8):
    base = '/Users/olabelin/Projects/dead-horizon/public/assets/sprites'
    img.save(f'{base}/{name}.png')
    preview = img.resize(
        (img.width * scale, img.height * scale),
        Image.NEAREST
    )
    preview.save(f'{base}/{name}_preview.png')
    print(f'  Saved {name}.png ({img.width}x{img.height})')

# -------------------------------------------------------------------
# Color palette (from art-direction.md)
# -------------------------------------------------------------------

# Environment
DARK_GREEN   = (45, 74, 34)
MOSS_GREEN   = (74, 107, 58)
DIRT_BROWN   = (92, 64, 51)
RUST_BROWN   = (139, 69, 19)
CONCRETE     = (107, 107, 107)
DARK_GRAY    = (58, 58, 58)
NIGHT_BLACK  = (26, 26, 46)

# Accents
BLOOD_RED    = (139, 0, 0)
FIRE_ORANGE  = (212, 98, 11)
BANDAGE_WHT  = (232, 220, 200)
FLANNEL_RED  = (178, 34, 34)
AMMO_GOLD    = (197, 160, 48)
MEDIC_BLUE   = (74, 144, 217)

# Extra palette entries for sprites
SKIN_DARK    = (160, 120, 90)
SKIN_MID     = (190, 150, 110)
SKIN_PALE    = (210, 180, 140)
ZOMBIE_GRAY  = (110, 120, 100)
ZOMBIE_GREEN = (90, 120, 80)
ZOMBIE_DARK  = (60, 80, 55)
ROTTEN_GREEN = (100, 140, 60)
TOXIC_GREEN  = (80, 160, 50)
JACKET_GRN   = (55, 90, 45)
JACKET_DARK  = (35, 60, 28)
PACK_BROWN   = (110, 75, 45)
PACK_DARK    = (80, 55, 30)
CLOTH_DARK   = (50, 45, 40)
CLOTH_TAN    = (130, 110, 85)
SHADOW       = (20, 20, 20, 80)
WOOD_LIGHT   = (160, 120, 70)
WOOD_DARK    = (100, 70, 40)
STONE_LIGHT  = (140, 135, 130)
STONE_MID    = (110, 105, 100)
STONE_DARK   = (75, 72, 68)
MORTAR       = (160, 155, 148)
METAL_LIGHT  = (150, 148, 145)
METAL_MID    = (100, 98, 95)
METAL_DARK   = (60, 58, 55)
SAND_BAG     = (165, 145, 105)
SAND_DARK    = (125, 105, 75)
WIRE_DARK    = (80, 75, 70)
WIRE_SHINE   = (180, 175, 170)
TENT_GREEN   = (70, 100, 55)
TENT_DARK    = (45, 68, 35)
TENT_LIGHT   = (95, 130, 75)
ROPE_TAN     = (175, 155, 115)
EYE_RED      = (220, 30, 30)
BLOOD_DARK   = (100, 0, 0)
TOXIC_SPOT   = (120, 200, 50, 180)
WHITE        = (255, 255, 255)
BLACK        = (0, 0, 0)


# -------------------------------------------------------------------
# PLAYER sprites
# -------------------------------------------------------------------

def make_player():
    """
    Player character, top-down. Facing 'up' (toward top of screen).
    - Dark green military jacket
    - Brown backpack (visible from above)
    - Skin-tone head at top
    - Weapon stub visible at right hand
    """
    img = create_sprite(32)

    # Drop shadow underneath
    rect(img, 10, 10, 12, 14, (0, 0, 0, 40))

    # Backpack (centered, behind body -- drawn first so body covers edges)
    rect(img, 12, 10, 8,  9, PACK_BROWN)
    rect(img, 13, 11, 6,  7, PACK_DARK)
    # Backpack straps
    rect(img, 12, 12, 2,  6, PACK_DARK)
    rect(img, 18, 12, 2,  6, PACK_DARK)
    # Backpack buckle
    rect(img, 14, 14, 4,  2, AMMO_GOLD)

    # Body / jacket (32x32 grid, head faces up = y=6..10, body=y=10..22, legs=y=22..27)
    # Jacket body
    rect(img, 11, 12, 10, 12, JACKET_GRN)
    # Jacket shading (left edge)
    rect(img, 11, 12,  2, 12, JACKET_DARK)
    # Jacket shading (right edge)
    rect(img, 19, 12,  2, 12, JACKET_DARK)
    # Jacket center seam
    rect(img, 15, 13,  2, 10, JACKET_DARK)

    # Arms (extended slightly to the sides)
    # Left arm
    rect(img,  8, 13,  3,  8, JACKET_GRN)
    rect(img,  8, 13,  1,  8, JACKET_DARK)
    # Left hand (skin)
    rect(img,  8, 20,  3,  3, SKIN_DARK)

    # Right arm
    rect(img, 21, 13,  3,  8, JACKET_GRN)
    rect(img, 23, 13,  1,  8, JACKET_DARK)
    # Right hand (skin)
    rect(img, 21, 20,  3,  3, SKIN_DARK)

    # Weapon in right hand (small pistol/gun stub pointing up-right)
    rect(img, 22, 17,  2,  5, DARK_GRAY)
    rect(img, 23, 15,  1,  3, DARK_GRAY)

    # Legs
    rect(img, 12, 24,  4,  5, CLOTH_DARK)
    rect(img, 17, 24,  4,  5, CLOTH_DARK)
    # Boot highlights
    rect(img, 12, 28,  4,  2, DARK_GRAY)
    rect(img, 17, 28,  4,  2, DARK_GRAY)

    # Neck
    rect(img, 14, 10,  4,  3, SKIN_DARK)

    # Head (oval, top-center)
    rect(img, 12,  5, 8, 7, SKIN_MID)
    # Head shading sides
    rect(img, 12,  5, 1, 7, SKIN_DARK)
    rect(img, 19,  5, 1, 7, SKIN_DARK)
    # Hair (dark, top of head)
    rect(img, 12,  5, 8, 2, DARK_GRAY)
    rect(img, 12,  5, 1, 4, DARK_GRAY)
    rect(img, 19,  5, 1, 4, DARK_GRAY)
    # Eyes (two pixels, slightly below hair)
    px(img, 14,  8, NIGHT_BLACK)
    px(img, 17,  8, NIGHT_BLACK)
    # Ear studs / shadow
    px(img, 12, 10, SKIN_DARK)
    px(img, 19, 10, SKIN_DARK)

    # Belt line
    rect(img, 11, 23,  10, 1, AMMO_GOLD)
    # Belt buckle
    rect(img, 14, 22,  4,  2, AMMO_GOLD)

    return img


def make_player_attack():
    """
    Player attack pose: right arm swung forward/up with weapon extended.
    """
    img = create_sprite(32)

    # Drop shadow
    rect(img, 10, 11, 12, 13, (0, 0, 0, 40))

    # Backpack
    rect(img, 12, 10, 8,  8, PACK_BROWN)
    rect(img, 13, 11, 6,  6, PACK_DARK)
    rect(img, 14, 13, 4,  2, AMMO_GOLD)

    # Body
    rect(img, 11, 12, 10, 12, JACKET_GRN)
    rect(img, 11, 12,  2, 12, JACKET_DARK)
    rect(img, 19, 12,  2, 12, JACKET_DARK)
    rect(img, 15, 13,  2, 10, JACKET_DARK)

    # Left arm normal
    rect(img,  8, 13,  3,  8, JACKET_GRN)
    rect(img,  8, 13,  1,  8, JACKET_DARK)
    rect(img,  8, 20,  3,  3, SKIN_DARK)

    # Right arm EXTENDED upward-right (attack swing)
    rect(img, 21,  8,  3,  9, JACKET_GRN)
    rect(img, 23,  8,  1,  9, JACKET_DARK)
    rect(img, 21,  7,  3,  3, SKIN_DARK)

    # Weapon extended -- machete/bat shape
    rect(img, 21,  3,  2,  6, METAL_MID)
    rect(img, 22,  2,  1,  2, METAL_LIGHT)
    # Grip / handle
    rect(img, 21,  7,  3,  2, WOOD_DARK)

    # Legs
    rect(img, 12, 24,  4,  5, CLOTH_DARK)
    rect(img, 17, 24,  4,  5, CLOTH_DARK)
    rect(img, 12, 28,  4,  2, DARK_GRAY)
    rect(img, 17, 28,  4,  2, DARK_GRAY)

    # Neck
    rect(img, 14, 10,  4,  3, SKIN_DARK)

    # Head
    rect(img, 12,  5, 8, 7, SKIN_MID)
    rect(img, 12,  5, 1, 7, SKIN_DARK)
    rect(img, 19,  5, 1, 7, SKIN_DARK)
    rect(img, 12,  5, 8, 2, DARK_GRAY)
    rect(img, 12,  5, 1, 4, DARK_GRAY)
    rect(img, 19,  5, 1, 4, DARK_GRAY)
    px(img, 14,  8, NIGHT_BLACK)
    px(img, 17,  8, NIGHT_BLACK)

    # Belt
    rect(img, 11, 23,  10, 1, AMMO_GOLD)
    rect(img, 14, 22,  4,  2, AMMO_GOLD)

    return img


# -------------------------------------------------------------------
# ZOMBIE WALKER
# -------------------------------------------------------------------

def make_walker():
    """
    Slow zombie. Gray-green skin, ragged clothes, hunched posture.
    Viewed from above.
    """
    img = create_sprite(32)

    # Shadow
    rect(img, 10, 12, 12, 13, (0, 0, 0, 50))

    # Body -- slightly hunched, asymmetric
    rect(img, 11, 12, 10, 12, CLOTH_DARK)
    # Tears/rips in clothes
    rect(img, 13, 14,  2,  2, ZOMBIE_GRAY)
    rect(img, 18, 16,  2,  3, ZOMBIE_GREEN)
    # Shading
    rect(img, 11, 12,  1, 12, (30, 30, 25))
    rect(img, 20, 12,  1, 12, (30, 30, 25))

    # Left arm (dragging low)
    rect(img,  7, 15,  4,  7, CLOTH_DARK)
    rect(img,  7, 21,  4,  3, ZOMBIE_GRAY)
    # Claw fingers
    px(img,  7, 24, (40, 40, 35))
    px(img,  8, 25, (40, 40, 35))
    px(img, 10, 25, (40, 40, 35))

    # Right arm (reaching forward)
    rect(img, 21, 13,  4,  8, CLOTH_DARK)
    rect(img, 21, 20,  4,  3, ZOMBIE_GRAY)
    px(img, 21, 23, (40, 40, 35))
    px(img, 23, 23, (40, 40, 35))
    px(img, 24, 23, (40, 40, 35))

    # Legs (shuffling, slightly apart)
    rect(img, 11, 24,  4,  6, (45, 42, 38))
    rect(img, 17, 24,  4,  6, (45, 42, 38))
    # Bare feet / torn shoes
    rect(img, 11, 29,  4,  2, ZOMBIE_DARK)
    rect(img, 17, 29,  4,  2, ZOMBIE_DARK)

    # Neck
    rect(img, 14, 10,  4,  3, ZOMBIE_GRAY)

    # Head
    rect(img, 12,  4, 8, 8, ZOMBIE_GRAY)
    # Head shading
    rect(img, 12,  4, 1, 8, ZOMBIE_DARK)
    rect(img, 19,  4, 1, 8, ZOMBIE_DARK)
    # Sparse hair (patchy)
    rect(img, 12,  4, 3, 1, (40, 35, 30))
    rect(img, 17,  4, 2, 1, (40, 35, 30))
    # Wounds on head
    px(img, 15,  6, BLOOD_DARK)
    px(img, 16,  6, BLOOD_DARK)
    px(img, 18,  7, BLOOD_DARK)
    # Eyes (sunken, dark)
    px(img, 14,  8, (20, 20, 15))
    px(img, 17,  8, (20, 20, 15))
    # Open mouth / grimace
    rect(img, 14, 10,  4,  1, (30, 20, 15))
    px(img, 15, 10, (200, 50, 30))

    # Blood stains on torso
    px(img, 14, 15, BLOOD_DARK)
    px(img, 15, 16, BLOOD_DARK)
    px(img, 13, 18, BLOOD_DARK)

    return img


# -------------------------------------------------------------------
# ZOMBIE RUNNER
# -------------------------------------------------------------------

def make_runner():
    """
    Fast zombie. Lean, forward-leaning, red eyes, torn clothes.
    """
    img = create_sprite(32)

    # Shadow (elongated)
    rect(img, 11, 11, 10, 14, (0, 0, 0, 50))

    # Body (slimmer, more leaned -- shifted up slightly)
    rect(img, 12, 10,  8, 13, CLOTH_DARK)
    # Ripped shirt revealing pale flesh
    rect(img, 14, 12,  3,  4, (130, 120, 100))
    rect(img, 13, 17,  2,  3, (130, 120, 100))
    rect(img, 17, 15,  2,  4, (130, 120, 100))
    # Shading
    rect(img, 12, 10,  1, 13, (25, 22, 18))
    rect(img, 19, 10,  1, 13, (25, 22, 18))

    # Arms -- both reaching forward aggressively
    # Left arm (stretched up-left)
    rect(img,  6, 10,  6,  4, CLOTH_DARK)
    rect(img,  6,  9,  5,  3, (130, 120, 100))
    # Left claws
    px(img,  6,  8, (45, 42, 38))
    px(img,  8,  7, (45, 42, 38))
    px(img, 10,  8, (45, 42, 38))

    # Right arm (stretched up-right)
    rect(img, 20, 10,  6,  4, CLOTH_DARK)
    rect(img, 21,  9,  5,  3, (130, 120, 100))
    px(img, 21,  8, (45, 42, 38))
    px(img, 23,  7, (45, 42, 38))
    px(img, 25,  8, (45, 42, 38))

    # Legs (running stride)
    rect(img, 12, 23,  3,  7, (42, 38, 34))
    rect(img, 17, 21,  3,  7, (42, 38, 34))
    # Bare torn feet
    rect(img, 11, 28,  4,  2, ZOMBIE_DARK)
    rect(img, 17, 26,  4,  2, ZOMBIE_DARK)

    # Neck (thin)
    rect(img, 14,  8,  4,  3, (130, 120, 100))

    # Head (slightly smaller, leaned forward)
    rect(img, 13,  3, 7, 7, (150, 135, 115))
    # Shading
    rect(img, 13,  3, 1, 7, (100, 88, 72))
    rect(img, 19,  3, 1, 7, (100, 88, 72))
    # Wild hair
    px(img, 13,  3, (30, 25, 20))
    px(img, 14,  2, (30, 25, 20))
    px(img, 16,  2, (30, 25, 20))
    px(img, 18,  3, (30, 25, 20))
    px(img, 19,  3, (30, 25, 20))
    rect(img, 13,  3, 7, 1, (30, 25, 20))
    # RED EYES (key feature)
    px(img, 14,  6, EYE_RED)
    px(img, 15,  6, EYE_RED)
    px(img, 17,  6, EYE_RED)
    px(img, 18,  6, EYE_RED)
    # Snarl / open mouth
    rect(img, 14,  8,  5,  1, (25, 18, 12))
    px(img, 15,  8, (180, 40, 20))
    px(img, 16,  8, (180, 40, 20))
    # Wound / scratch marks on face
    px(img, 16,  5, BLOOD_DARK)
    px(img, 17,  4, BLOOD_DARK)

    return img


# -------------------------------------------------------------------
# ZOMBIE BRUTE (48x48)
# -------------------------------------------------------------------

def make_brute():
    """
    Large, muscular zombie. 48x48. Dark, imposing silhouette.
    Improvised armor scraps, massive build.
    """
    img = create_sprite(48)

    # Drop shadow
    rect(img, 10, 14, 28, 20, (0, 0, 0, 60))

    # Body (very wide)
    rect(img,  9, 14, 30, 18, ZOMBIE_DARK)
    # Muscle definition (highlights)
    rect(img, 14, 15,  4, 16, (75, 100, 65))
    rect(img, 20, 15,  4, 16, (75, 100, 65))
    rect(img, 26, 15,  4, 16, (75, 100, 65))
    # Shading sides
    rect(img,  9, 14,  2, 18, (35, 48, 28))
    rect(img, 37, 14,  2, 18, (35, 48, 28))

    # Improvised armor -- metal plate scraps on shoulders
    rect(img,  9, 14, 10,  5, METAL_MID)
    rect(img, 29, 14, 10,  5, METAL_MID)
    # Armor rivets
    px(img, 11, 15, METAL_LIGHT)
    px(img, 14, 15, METAL_LIGHT)
    px(img, 30, 15, METAL_LIGHT)
    px(img, 33, 15, METAL_LIGHT)
    # Armor shading
    rect(img,  9, 17,  3,  2, METAL_DARK)
    rect(img, 36, 17,  3,  2, METAL_DARK)

    # Rust stains on armor
    px(img, 12, 16, RUST_BROWN)
    px(img, 31, 17, RUST_BROWN)

    # Left massive arm
    rect(img,  4, 16, 7, 16, ZOMBIE_DARK)
    rect(img,  4, 16, 1, 16, (35, 48, 28))
    rect(img,  4, 31, 7,  4, ZOMBIE_GRAY)
    # Knuckles
    for i in range(3):
        px(img, 5 + i * 2, 34, (55, 60, 50))

    # Right massive arm
    rect(img, 37, 16, 7, 16, ZOMBIE_DARK)
    rect(img, 43, 16, 1, 16, (35, 48, 28))
    rect(img, 37, 31, 7,  4, ZOMBIE_GRAY)
    for i in range(3):
        px(img, 38 + i * 2, 34, (55, 60, 50))

    # Legs (tree-trunk thick)
    rect(img, 13, 32, 9, 12, (45, 55, 38))
    rect(img, 26, 32, 9, 12, (45, 55, 38))
    # Boot/feet
    rect(img, 12, 42, 10,  4, DARK_GRAY)
    rect(img, 25, 42, 10,  4, DARK_GRAY)

    # Neck (barely visible)
    rect(img, 19, 10,  10,  5, ZOMBIE_DARK)

    # Head (large, brutish)
    rect(img, 16,  3, 16, 12, ZOMBIE_DARK)
    # Facial features
    rect(img, 16,  3, 1, 12, (35, 48, 28))
    rect(img, 31,  3, 1, 12, (35, 48, 28))
    # Forehead bump
    rect(img, 20,  3,  8,  2, (55, 72, 45))
    # EYES (deep-set, red glow)
    rect(img, 18,  8,  3,  2, EYE_RED)
    rect(img, 27,  8,  3,  2, EYE_RED)
    # Nose (flat, wide)
    rect(img, 22, 10,  4,  2, (35, 48, 28))
    # Massive jaw / mouth
    rect(img, 18, 12,  12,  2, (30, 20, 15))
    rect(img, 19, 12,   2,  1, (180, 50, 30))
    rect(img, 24, 12,   4,  1, (180, 50, 30))
    # Scar on face
    rect(img, 24,  5,  1,  4, BLOOD_DARK)
    rect(img, 23,  6,  1,  2, BLOOD_DARK)

    # Blood on hands
    rect(img,  4, 32,  3,  3, BLOOD_DARK)
    rect(img, 41, 32,  3,  3, BLOOD_DARK)

    return img


# -------------------------------------------------------------------
# ZOMBIE SPITTER
# -------------------------------------------------------------------

def make_spitter():
    """
    Ranged zombie. Sickly green/toxic color, wide open mouth, bloated.
    """
    img = create_sprite(32)

    # Shadow (slightly bloated shape)
    circle(img, 16, 17, 11, (0, 0, 0, 45))

    # Body (bloated, roundish from above)
    circle(img, 16, 17, 10, ROTTEN_GREEN)
    # Body shading
    circle(img, 14, 15,  5, ZOMBIE_GREEN)
    # Toxic patches on skin
    px(img, 12, 14, TOXIC_GREEN)
    px(img, 19, 16, TOXIC_GREEN)
    px(img, 14, 20, TOXIC_GREEN)
    px(img, 18, 18, TOXIC_GREEN)
    # Boils / bumps
    circle(img, 10, 18,  2, (80, 110, 50))
    circle(img, 21, 20,  2, (80, 110, 50))
    circle(img, 16, 22,  2, (80, 110, 50))

    # Arms (stubby, dissolving)
    rect(img,  5, 15,  5,  5, ROTTEN_GREEN)
    rect(img, 22, 15,  5,  5, ROTTEN_GREEN)
    # Finger stumps
    px(img,  5, 19, TOXIC_GREEN)
    px(img,  7, 20, TOXIC_GREEN)
    px(img, 22, 19, TOXIC_GREEN)
    px(img, 24, 20, TOXIC_GREEN)
    px(img, 26, 19, TOXIC_GREEN)

    # Legs
    rect(img, 11, 26,  4,  5, ZOMBIE_GREEN)
    rect(img, 17, 26,  4,  5, ZOMBIE_GREEN)

    # Neck
    rect(img, 14, 10,  4,  4, ROTTEN_GREEN)

    # Head
    rect(img, 11,  4, 10, 8, ROTTEN_GREEN)
    # Head shading
    rect(img, 11,  4, 1, 8, ZOMBIE_DARK)
    rect(img, 20,  4, 1, 8, ZOMBIE_DARK)
    # Sunken eyes (toxic glow)
    rect(img, 13,  6,  2,  2, TOXIC_GREEN)
    rect(img, 17,  6,  2,  2, TOXIC_GREEN)
    # WIDE OPEN MOUTH (key feature -- spitter)
    rect(img, 12,  9,  8,  3, (25, 18, 12))
    # Teeth
    for i in range(4):
        px(img, 13 + i * 2,  9, BANDAGE_WHT)
    for i in range(4):
        px(img, 13 + i * 2, 11, BANDAGE_WHT)
    # Tongue / toxic saliva
    rect(img, 14, 10,  4,  1, (180, 60, 180))
    px(img, 15, 10, TOXIC_GREEN)
    px(img, 16, 10, TOXIC_GREEN)

    # Toxic drips around mouth
    px(img, 12, 12, TOXIC_GREEN)
    px(img, 19, 11, TOXIC_GREEN)
    px(img, 16, 13, TOXIC_GREEN)

    return img


# -------------------------------------------------------------------
# ZOMBIE SCREAMER
# -------------------------------------------------------------------

def make_screamer():
    """
    Sound zombie. Wide open screaming mouth, paler skin, eyes wide.
    """
    img = create_sprite(32)

    # Shadow
    rect(img,  9, 11, 14, 15, (0, 0, 0, 45))

    # Body (thin, wiry)
    rect(img, 11, 12,  10, 13, (140, 135, 125))
    rect(img, 11, 12,   1, 13, (100, 95, 88))
    rect(img, 20, 12,   1, 13, (100, 95, 88))
    # Torn clothes
    rect(img, 13, 14,   3,  3, (165, 158, 148))
    rect(img, 17, 18,   3,  4, (165, 158, 148))

    # Arms raised upward (screaming pose)
    # Left arm raised
    rect(img,  6,  8,  5,  6, (140, 135, 125))
    rect(img,  6,  7,  4,  3, (165, 155, 140))
    px(img,  6,  6, (105, 98, 88))
    px(img,  8,  5, (105, 98, 88))
    px(img, 10,  6, (105, 98, 88))

    # Right arm raised
    rect(img, 21,  8,  5,  6, (140, 135, 125))
    rect(img, 22,  7,  4,  3, (165, 155, 140))
    px(img, 22,  6, (105, 98, 88))
    px(img, 24,  5, (105, 98, 88))
    px(img, 26,  6, (105, 98, 88))

    # Legs
    rect(img, 12, 25,  4,  6, (120, 115, 108))
    rect(img, 16, 25,  4,  6, (120, 115, 108))
    rect(img, 12, 30,  4,  1, (80, 78, 72))
    rect(img, 16, 30,  4,  1, (80, 78, 72))

    # Neck (strained)
    rect(img, 14, 10,  4,  3, (165, 155, 140))

    # Head (larger, oval -- distorted from scream)
    rect(img, 11,  3, 10, 9, (175, 168, 155))
    rect(img, 11,  3, 1, 9, (135, 128, 118))
    rect(img, 20,  3, 1, 9, (135, 128, 118))
    # Veins on forehead
    rect(img, 13,  4,  1,  3, (140, 100, 100))
    rect(img, 18,  4,  1,  3, (140, 100, 100))
    # WIDE EYES (terror)
    rect(img, 13,  6,  3,  3, (240, 235, 225))
    rect(img, 16,  6,  3,  3, (240, 235, 225))
    # Pupils
    px(img, 14,  7, (20, 15, 10))
    px(img, 17,  7, (20, 15, 10))
    # Eyebrows raised
    px(img, 13,  5, (80, 75, 68))
    px(img, 14,  5, (80, 75, 68))
    px(img, 17,  5, (80, 75, 68))
    px(img, 18,  5, (80, 75, 68))

    # SCREAMING MOUTH (key feature -- very wide open)
    rect(img, 12,  9, 8, 4, (15, 10,  8))
    # Teeth top row
    for i in range(5):
        px(img, 13 + i,  9, (230, 220, 205))
    # Teeth bottom row
    for i in range(5):
        px(img, 13 + i, 12, (210, 200, 185))
    # Throat darkness
    rect(img, 14, 10,  4,  2, (8, 5, 3))
    # Tongue
    rect(img, 14, 11,  4,  1, (200, 60, 60))

    # Sound wave lines around head (implies screaming)
    for radius in [11, 12]:
        # Just dots at cardinal points
        px(img, 16,  3 - (radius - 11), NIGHT_BLACK)
        px(img, 10 - (radius - 11), 7, NIGHT_BLACK)
        px(img, 22 + (radius - 11), 7, NIGHT_BLACK)

    return img


# -------------------------------------------------------------------
# BASE TENT (32x32)
# -------------------------------------------------------------------

def make_base_tent():
    """
    Small military tent seen from above. Green/brown canvas, guide ropes.
    """
    img = create_sprite(32)

    # Ground shadow
    rect(img, 4, 6, 24, 22, (0, 0, 0, 40))

    # Main tent canvas (rectangular with peaked ridge)
    rect(img, 5, 7, 22, 18, TENT_DARK)
    rect(img, 6, 8, 20, 16, TENT_GREEN)

    # Ridge pole (center line running lengthwise)
    rect(img, 14,  7,  4, 18, TENT_LIGHT)
    rect(img, 15,  7,  2, 18, (100, 140, 80))

    # Tent panels / folds (lines radiating from ridge)
    for y in range(8, 24, 2):
        px(img,  9, y, TENT_DARK)
        px(img, 22, y, TENT_DARK)

    # Entry flap (front of tent -- bottom)
    rect(img, 12, 22, 8,  3, TENT_DARK)
    rect(img, 13, 22, 6,  2, (55, 82, 42))

    # Stakes and guide ropes
    # Corner stakes
    for sx, sy in [(4, 6), (27, 6), (4, 25), (27, 25)]:
        px(img, sx, sy, RUST_BROWN)

    # Ropes (from stakes to tent edge)
    # Top-left
    px(img, 5, 7, ROPE_TAN)
    px(img, 4, 7, ROPE_TAN)
    # Top-right
    px(img, 26, 7, ROPE_TAN)
    px(img, 27, 7, ROPE_TAN)
    # Bottom-left
    px(img, 5, 24, ROPE_TAN)
    px(img, 4, 24, ROPE_TAN)
    # Bottom-right
    px(img, 26, 24, ROPE_TAN)
    px(img, 27, 24, ROPE_TAN)

    # Patch / camouflage pattern
    px(img,  8, 12, TENT_DARK)
    px(img, 20, 15, TENT_DARK)
    px(img, 10, 18, TENT_DARK)
    rect(img, 18, 11, 2, 2, TENT_DARK)

    return img


# -------------------------------------------------------------------
# BASE CAMP (48x48)
# -------------------------------------------------------------------

def make_base_camp():
    """
    Camp with a tent inside a rough fence perimeter.
    """
    img = create_sprite(48)

    # Ground (dirt / cleared area)
    rect(img, 2, 2, 44, 44, DIRT_BROWN)
    # Ground variation
    for x in range(4, 45, 5):
        for y in range(4, 45, 5):
            px(img, x, y, (82, 56, 44))
            px(img, x+1, y+1, (100, 70, 55))

    # Fence perimeter (rough wooden posts + wire)
    # Top fence
    rect(img, 2, 2, 44, 3, WOOD_DARK)
    for x in range(2, 46, 5):
        rect(img, x, 2, 2, 4, WOOD_LIGHT)
    # Bottom fence
    rect(img, 2, 43, 44, 3, WOOD_DARK)
    for x in range(2, 46, 5):
        rect(img, x, 43, 2, 4, WOOD_LIGHT)
    # Left fence
    rect(img, 2, 2, 3, 44, WOOD_DARK)
    for y in range(2, 46, 5):
        rect(img, 2, y, 4, 2, WOOD_LIGHT)
    # Right fence
    rect(img, 43, 2, 3, 44, WOOD_DARK)
    for y in range(2, 46, 5):
        rect(img, 43, y, 4, 2, WOOD_LIGHT)

    # Gate (bottom center -- opening)
    rect(img, 20, 43, 8, 3, DIRT_BROWN)

    # Tent (center of camp)
    rect(img, 13, 13, 22, 16, TENT_DARK)
    rect(img, 14, 14, 20, 14, TENT_GREEN)
    # Tent ridge
    rect(img, 22, 13,  4, 16, TENT_LIGHT)
    rect(img, 23, 13,  2, 16, (100, 140, 80))
    # Tent entry
    rect(img, 20, 27,  8,  2, TENT_DARK)

    # Campfire (bottom-right area)
    circle(img, 36, 36, 3, (180, 80, 20))
    circle(img, 36, 36, 2, FIRE_ORANGE)
    px(img, 36, 36, (255, 200, 50))
    # Fire logs
    rect(img, 34, 36, 2, 1, WOOD_DARK)
    rect(img, 36, 37, 2, 1, WOOD_DARK)

    # Supply crate (left of tent)
    rect(img, 6, 20,  7,  6, WOOD_LIGHT)
    rect(img, 6, 20,  7,  1, WOOD_DARK)
    rect(img, 6, 20,  1,  6, WOOD_DARK)
    rect(img, 9, 21,  1,  4, WOOD_DARK)

    # Barrel (right near fence)
    circle(img, 40, 20, 4, RUST_BROWN)
    circle(img, 40, 20, 2, (155, 80, 30))
    px(img, 40, 20, (80, 55, 25))

    return img


# -------------------------------------------------------------------
# BASE OUTPOST (64x64)
# -------------------------------------------------------------------

def make_base_outpost():
    """
    Fortified position. Concrete walls, sandbag corners, watchtower hint.
    """
    img = create_sprite(64)

    # Ground base (concrete/dirt)
    rect(img, 0, 0, 64, 64, (85, 75, 65))
    # Ground texture
    for x in range(0, 64, 8):
        for y in range(0, 64, 8):
            rect(img, x, y, 4, 4, (80, 70, 60))

    # Outer concrete wall (thick)
    wall_color = (95, 90, 85)
    wall_dark  = (65, 62, 58)
    wall_light = (120, 116, 110)

    # Top wall
    rect(img, 4,  4, 56,  8, wall_dark)
    rect(img, 4,  4, 56,  6, wall_color)
    # Bottom wall
    rect(img, 4, 52, 56,  8, wall_dark)
    rect(img, 4, 54, 56,  6, wall_color)
    # Left wall
    rect(img, 4,  4,  8, 56, wall_dark)
    rect(img, 4,  4,  6, 56, wall_color)
    # Right wall
    rect(img, 52,  4,  8, 56, wall_dark)
    rect(img, 54,  4,  8, 56, wall_color)

    # Crenellations / battlements on top wall
    for x in range(4, 60, 6):
        rect(img, x, 3, 3, 3, wall_light)
    # Crenellations on bottom wall
    for x in range(4, 60, 6):
        rect(img, x, 58, 3, 3, wall_light)
    # Crenellations left wall
    for y in range(4, 60, 6):
        rect(img, 3, y, 3, 3, wall_light)
    # Crenellations right wall
    for y in range(4, 60, 6):
        rect(img, 58, y, 3, 3, wall_light)

    # Sandbag bunkers at corners
    sb = SAND_BAG
    sd = SAND_DARK
    # Top-left corner
    circle(img,  8,  8, 5, sb)
    circle(img,  8,  8, 3, sd)
    # Top-right corner
    circle(img, 56,  8, 5, sb)
    circle(img, 56,  8, 3, sd)
    # Bottom-left corner
    circle(img,  8, 56, 5, sb)
    circle(img,  8, 56, 3, sd)
    # Bottom-right corner
    circle(img, 56, 56, 5, sb)
    circle(img, 56, 56, 3, sd)

    # Gate (bottom center)
    rect(img, 26, 54, 12, 10, (60, 55, 50))
    rect(img, 27, 55, 10,  8, DARK_GRAY)
    # Gate reinforcement bars
    for x in range(28, 36, 3):
        rect(img, x, 55, 1, 8, METAL_MID)

    # Interior ground
    rect(img, 12, 12, 40, 40, (70, 65, 58))

    # Watchtower (top-left area -- viewed from above as a small platform)
    rect(img, 14, 14, 10, 10, WOOD_DARK)
    rect(img, 15, 15,  8,  8, WOOD_LIGHT)
    # Tower floor pattern
    rect(img, 16, 16,  3,  3, WOOD_DARK)
    rect(img, 20, 16,  2,  3, WOOD_DARK)
    # Ladder access
    rect(img, 18, 23,  2,  3, WOOD_DARK)

    # Main building / bunker (center)
    rect(img, 24, 20, 16, 14, wall_color)
    rect(img, 25, 21, 14, 12, wall_dark)
    # Bunker door
    rect(img, 29, 30,  6,  4, (40, 38, 35))
    rect(img, 30, 31,  4,  2, DARK_GRAY)
    # Bunker windows (firing slits)
    rect(img, 25, 24,  3,  2, (25, 22, 18))
    rect(img, 36, 24,  3,  2, (25, 22, 18))

    # Supply area (right side)
    rect(img, 40, 20, 7, 6, WOOD_LIGHT)
    rect(img, 40, 20, 7, 1, WOOD_DARK)
    rect(img, 40, 20, 1, 6, WOOD_DARK)
    rect(img, 43, 21, 1, 4, WOOD_DARK)

    # Fuel barrels
    circle(img, 44, 34, 3, RUST_BROWN)
    circle(img, 44, 34, 1, (80, 45, 20))
    circle(img, 48, 38, 3, RUST_BROWN)
    circle(img, 48, 38, 1, (80, 45, 20))

    # Campfire area (bottom-right inside)
    circle(img, 46, 46, 3, (150, 70, 15))
    circle(img, 46, 46, 2, FIRE_ORANGE)
    px(img, 46, 46, (255, 200, 50))

    return img


# -------------------------------------------------------------------
# STRUCTURE: BARRICADE
# -------------------------------------------------------------------

def make_barricade():
    """
    Wooden barricade, top-down. Horizontal planks nailed together.
    """
    img = create_sprite(32)

    # Main plank structure (horizontal logs/boards)
    # Three main planks
    rect(img, 2,  6, 28, 5, WOOD_LIGHT)
    rect(img, 2, 13, 28, 5, WOOD_LIGHT)
    rect(img, 2, 20, 28, 5, WOOD_DARK)

    # Plank shading (grain lines)
    for plank_y in [6, 13, 20]:
        rect(img, 2, plank_y, 28, 1, WOOD_DARK)
        for x in range(4, 28, 6):
            px(img, x, plank_y + 2, (130, 95, 55))
            px(img, x + 3, plank_y + 3, (130, 95, 55))

    # Vertical support posts (dark, behind planks)
    rect(img,  4, 4, 3, 24, WOOD_DARK)
    rect(img, 14, 4, 3, 24, WOOD_DARK)
    rect(img, 25, 4, 3, 24, WOOD_DARK)

    # Nails / bolts at intersections
    for px_x in [5, 15, 26]:
        for px_y in [7, 14, 21]:
            px(img, px_x, px_y, METAL_MID)

    # Rusty wire tying it together (diagonal lines)
    for i in range(28):
        if i % 3 == 0:
            px(img, 2 + i, 11, (120, 100, 70))

    # Worn edges
    px(img, 2, 6, WOOD_DARK)
    px(img, 29, 24, WOOD_DARK)

    return img


# -------------------------------------------------------------------
# STRUCTURE: WALL
# -------------------------------------------------------------------

def make_wall():
    """
    Stone/concrete wall, top-down. Gray stones with mortar lines.
    """
    img = create_sprite(32)

    # Base stone/concrete
    rect(img, 0, 0, 32, 32, STONE_MID)

    # Stone blocks pattern (brick-like, offset rows)
    # Row 0 (y=2..9)
    rect(img,  1,  2, 12, 8, STONE_LIGHT)
    rect(img, 14,  2, 17, 8, STONE_LIGHT)
    # Row 1 (y=11..18) -- offset
    rect(img,  1, 11, 17, 8, (125, 120, 115))
    rect(img, 19, 11, 12, 8, (125, 120, 115))
    # Row 2 (y=20..27)
    rect(img,  1, 20, 12, 8, STONE_LIGHT)
    rect(img, 14, 20, 17, 8, STONE_LIGHT)

    # Mortar lines (horizontal)
    rect(img, 0,  1, 32, 1, MORTAR)
    rect(img, 0, 10, 32, 1, MORTAR)
    rect(img, 0, 19, 32, 1, MORTAR)
    rect(img, 0, 28, 32, 1, MORTAR)

    # Mortar lines (vertical -- staggered)
    rect(img, 13,  2, 1, 8, MORTAR)
    rect(img, 18, 11, 1, 8, MORTAR)
    rect(img, 13, 20, 1, 8, MORTAR)

    # Cracks and damage
    px(img,  5,  5, STONE_DARK)
    px(img,  6,  6, STONE_DARK)
    px(img, 20, 14, STONE_DARK)
    px(img, 21, 14, STONE_DARK)
    px(img,  8, 23, STONE_DARK)
    px(img,  9, 24, STONE_DARK)
    px(img, 10, 23, STONE_DARK)

    # Top surface shading (slightly lighter at top edge)
    rect(img, 0, 0, 32, 1, (150, 146, 140))
    # Bottom shadow
    rect(img, 0, 31, 32, 1, (55, 52, 48))

    return img


# -------------------------------------------------------------------
# STRUCTURE: TRAP
# -------------------------------------------------------------------

def make_trap():
    """
    Metal spike trap / caltrops / barbed wire.
    Semi-visible -- metallic glints against dark ground.
    """
    img = create_sprite(32)

    # Barely-visible base (slight dirt disturbance)
    rect(img, 4, 4, 24, 24, (75, 65, 55, 60))

    # Barbed wire coils (main feature)
    # Outer coil ring
    circle(img, 16, 16, 11, (70, 68, 65, 180), fill=False)
    circle(img, 16, 16, 10, (70, 68, 65, 120), fill=False)

    # Inner coil
    circle(img, 16, 16, 6, (85, 83, 80, 200), fill=False)

    # Barbs on wire (small protruding spikes)
    barb_positions = [
        (5, 16), (10, 7), (16, 5), (22, 8), (27, 16),
        (22, 24), (16, 27), (10, 24),
    ]
    for bx, by in barb_positions:
        px(img, bx,     by,     WIRE_SHINE)
        px(img, bx + 1, by,     WIRE_DARK)
        px(img, bx,     by + 1, WIRE_DARK)

    # Center spike cluster
    px(img, 15, 15, METAL_LIGHT)
    px(img, 17, 15, METAL_LIGHT)
    px(img, 16, 14, METAL_LIGHT)
    px(img, 16, 17, METAL_LIGHT)
    px(img, 14, 16, METAL_LIGHT)
    px(img, 18, 16, METAL_LIGHT)
    # Center shadow
    px(img, 16, 16, METAL_DARK)

    # Diagonal cross-wires
    for i in range(5, 27, 2):
        if i % 4 == 1:
            px(img, i, i, (90, 88, 85, 160))
            px(img, i, 32 - i, (90, 88, 85, 160))

    # Metal glints (catches light)
    for gx, gy in [(8, 8), (24, 8), (8, 24), (24, 24), (16, 10), (10, 20)]:
        px(img, gx, gy, WIRE_SHINE)

    return img


# -------------------------------------------------------------------
# STRUCTURE: PILLBOX
# -------------------------------------------------------------------

def make_pillbox():
    """
    Sandbag gun emplacement. Circular sandbag ring with firing opening.
    """
    img = create_sprite(32)

    # Ground shadow
    circle(img, 16, 16, 13, (0, 0, 0, 50))

    # Outer sandbag ring
    circle(img, 16, 16, 12, SAND_DARK)
    circle(img, 16, 16, 11, SAND_BAG)

    # Inner fill (protected interior)
    circle(img, 16, 16,  8, (80, 72, 62))

    # Sandbag texture (stacked bags)
    # Top arc bags
    for angle_step in range(8):
        import math
        angle = math.pi * angle_step / 8  # 0 to pi (top semicircle)
        bx = int(16 + 10 * math.cos(angle))
        by = int(16 - 10 * math.sin(angle))
        rect(img, bx - 1, by - 1, 3, 2, SAND_BAG if angle_step % 2 == 0 else SAND_DARK)

    # Sandbag individual shapes (manual placement for bottom)
    bag_positions = [
        ( 5, 16), ( 7, 21), (11, 25), (16, 27), (21, 25), (25, 21), (27, 16),
        ( 6, 11), (10,  7), (16,  5), (22,  7), (26, 11),
    ]
    for bx, by in bag_positions:
        rect(img, bx - 1, by - 1, 3, 2, SAND_BAG)
        rect(img, bx,     by,     1, 1, SAND_DARK)

    # Firing opening (facing south/bottom) -- gap in sandbags
    rect(img, 13, 26, 6, 5, (0, 0, 0, 0))  # clear the opening
    # Opening sides reinforced
    rect(img, 12, 25, 2, 6, SAND_DARK)
    rect(img, 18, 25, 2, 6, SAND_DARK)

    # Interior (defender position)
    # Gun/weapon implied by narrow slit
    rect(img, 14, 18, 4, 6, (55, 50, 45))
    # Weapon / gun barrel
    rect(img, 15, 19, 2, 8, METAL_DARK)
    px(img, 15, 26, METAL_LIGHT)
    px(img, 16, 26, METAL_LIGHT)

    # Sandbag highlighting (top surface)
    for bx, by in [(5, 15), (10, 6), (22, 6), (27, 15)]:
        px(img, bx, by, (190, 168, 125))

    return img


# -------------------------------------------------------------------
# MAIN
# -------------------------------------------------------------------

def main():
    print("Generating improved Dead Horizon sprites...")

    print("\n-- Player sprites --")
    save_sprite(make_player(),        'player')
    save_sprite(make_player_attack(), 'player_attack')

    print("\n-- Zombie sprites --")
    save_sprite(make_walker(),        'walker')
    save_sprite(make_runner(),        'runner')
    save_sprite(make_brute(),         'brute',  scale=5)
    save_sprite(make_spitter(),       'spitter')
    save_sprite(make_screamer(),      'screamer')

    print("\n-- Base sprites --")
    save_sprite(make_base_tent(),     'base_tent')
    save_sprite(make_base_camp(),     'base_camp',    scale=6)
    save_sprite(make_base_outpost(),  'base_outpost', scale=5)

    print("\n-- Structure sprites --")
    save_sprite(make_barricade(),     'struct_barricade')
    save_sprite(make_wall(),          'struct_wall')
    save_sprite(make_trap(),          'struct_trap')
    save_sprite(make_pillbox(),       'struct_pillbox')

    print("\nDone.")

if __name__ == '__main__':
    main()

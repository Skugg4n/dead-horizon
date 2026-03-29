"""
Dead Horizon -- Toolbar icon generator
Creates 9 toolbar icons (32x32 RGBA PNG) for the day-phase UI.
Colors follow docs/art-direction.md palette.
"""
from PIL import Image

BASE_PATH = 'assets/sprites'


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


def save_sprite(img, name, scale=8):
    img.save(f'{BASE_PATH}/{name}.png')
    preview = img.resize(
        (img.width * scale, img.height * scale),
        Image.NEAREST
    )
    preview.save(f'{BASE_PATH}/{name}_preview.png')
    print(f'  Saved: {name}.png + {name}_preview.png')


# ---------------------------------------------------------------------------
# icon_build -- Hammer: construction/building, #4CAF50 green
# ---------------------------------------------------------------------------
def make_icon_build():
    img = create_sprite()
    green = (76, 175, 80)
    dark = (45, 105, 48)
    highlight = (130, 210, 130)
    brown = (92, 64, 51)

    # Hammer handle (diagonal, lower-right)
    handle_pixels = [
        (19, 20), (20, 21), (21, 22), (22, 23), (23, 24),
        (24, 25), (25, 26), (26, 27), (27, 28),
    ]
    for (x, y) in handle_pixels:
        px(img, x, y, brown)
    # Handle thickness
    for (x, y) in handle_pixels:
        px(img, x + 1, y, brown)

    # Hammer head (top-left area, rectangular)
    rect(img, 6, 8, 14, 8, green)
    # Dark face of hammer head
    rect(img, 6, 8, 14, 2, dark)
    # Highlight on top-left corner
    rect(img, 7, 9, 4, 2, highlight)
    # Shadow on bottom
    rect(img, 6, 14, 14, 2, dark)

    # Neck connecting head to handle
    rect(img, 16, 16, 4, 4, dark)
    rect(img, 17, 16, 2, 4, green)

    return img


# ---------------------------------------------------------------------------
# icon_weapons -- Crossed sword/blade: weapon management, #C5A030 gold
# ---------------------------------------------------------------------------
def make_icon_weapons():
    img = create_sprite()
    gold = (197, 160, 48)
    dark = (120, 90, 20)
    highlight = (230, 200, 100)

    # Sword 1: top-left to bottom-right diagonal
    blade1 = [(5, 5), (6, 6), (7, 7), (8, 8), (9, 9), (10, 10),
              (11, 11), (12, 12), (13, 13), (14, 14), (15, 15)]
    # Sword 2: top-right to bottom-left diagonal
    blade2 = [(26, 5), (25, 6), (24, 7), (23, 8), (22, 9), (21, 10),
              (20, 11), (19, 12), (18, 13), (17, 14), (16, 15)]

    # Draw blades with thickness
    for (x, y) in blade1:
        px(img, x, y, gold)
        px(img, x + 1, y, highlight)
        px(img, x, y + 1, dark)
    for (x, y) in blade2:
        px(img, x, y, gold)
        px(img, x - 1, y, highlight)
        px(img, x, y + 1, dark)

    # Guard (crossguard) for sword 1 -- horizontal bar
    rect(img, 12, 17, 8, 2, gold)
    rect(img, 12, 17, 8, 1, highlight)

    # Hilts (handles) going down
    rect(img, 14, 19, 2, 6, dark)
    rect(img, 16, 19, 2, 6, dark)

    # Pommel
    rect(img, 13, 25, 2, 2, gold)
    rect(img, 17, 25, 2, 2, gold)

    # Tips of swords (bottom)
    px(img, 26, 26, gold)
    px(img, 5, 26, gold)

    return img


# ---------------------------------------------------------------------------
# icon_craft -- Wrench: crafting, #8B6914 brown/rust
# ---------------------------------------------------------------------------
def make_icon_craft():
    img = create_sprite()
    brown = (139, 105, 20)
    dark = (80, 55, 10)
    highlight = (185, 150, 70)

    # Wrench body -- diagonal from top-left to bottom-right
    core = [
        (7, 7), (8, 8), (9, 9), (10, 10), (11, 11),
        (12, 12), (13, 13), (14, 14), (15, 15), (16, 16),
        (17, 17), (18, 18), (19, 19), (20, 20), (21, 21),
        (22, 22), (23, 23),
    ]
    for (x, y) in core:
        px(img, x, y, brown)
        px(img, x + 1, y, highlight)
        px(img, x, y + 1, dark)
        px(img, x + 1, y + 1, brown)

    # Open-end wrench jaw (top-left)
    rect(img, 5, 5, 6, 2, brown)   # top jaw
    rect(img, 5, 9, 6, 2, brown)   # bottom jaw
    rect(img, 5, 5, 2, 6, brown)   # left side
    # Gap for the open mouth (x=7..10, y=7..8 is empty -- opening)
    # Highlight on jaws
    rect(img, 5, 5, 6, 1, highlight)
    rect(img, 5, 5, 1, 6, highlight)

    # Rounded tip at bottom-right
    rect(img, 24, 24, 4, 4, brown)
    rect(img, 24, 24, 4, 1, highlight)
    rect(img, 24, 24, 1, 4, highlight)
    px(img, 27, 27, dark)

    return img


# ---------------------------------------------------------------------------
# icon_skills -- Star: skill progression, #C5A030 gold
# ---------------------------------------------------------------------------
def make_icon_skills():
    img = create_sprite()
    gold = (197, 160, 48)
    dark = (120, 90, 20)
    highlight = (240, 210, 110)

    # 5-pointed star centered at (15, 15), radius ~12
    # Pre-computed pixel positions for a 5-point star
    # Top point
    rect(img, 14, 4, 4, 3, gold)
    # Upper-right point
    rect(img, 22, 9, 3, 3, gold)
    # Lower-right point
    rect(img, 20, 20, 3, 3, gold)
    # Lower-left point
    rect(img, 9, 20, 3, 3, gold)
    # Upper-left point
    rect(img, 7, 9, 3, 3, gold)

    # Center filled pentagon
    rect(img, 12, 11, 8, 10, gold)
    rect(img, 10, 13, 12, 6, gold)
    rect(img, 11, 12, 10, 8, gold)

    # Connecting arms
    rect(img, 14, 7, 4, 5, gold)      # top arm down
    rect(img, 18, 10, 5, 3, gold)     # upper-right arm
    rect(img, 16, 18, 5, 3, gold)     # lower-right arm
    rect(img, 11, 18, 5, 3, gold)     # lower-left arm
    rect(img, 9, 10, 5, 3, gold)      # upper-left arm

    # Highlights on top facets
    px(img, 15, 5, highlight)
    px(img, 14, 6, highlight)
    px(img, 22, 9, highlight)
    px(img, 7, 9, highlight)

    # Dark shading
    rect(img, 14, 20, 4, 3, dark)

    return img


# ---------------------------------------------------------------------------
# icon_refugees -- Person silhouette: refugee management, #8B6FC0 purple
# ---------------------------------------------------------------------------
def make_icon_refugees():
    img = create_sprite()
    purple = (139, 111, 192)
    dark = (80, 55, 130)
    highlight = (180, 155, 220)

    # Head circle
    rect(img, 12, 4, 8, 8, purple)
    rect(img, 11, 5, 10, 6, purple)
    rect(img, 12, 4, 8, 1, highlight)
    rect(img, 12, 11, 8, 1, dark)

    # Neck
    rect(img, 14, 12, 4, 2, dark)

    # Body / torso
    rect(img, 9, 14, 14, 9, purple)
    rect(img, 9, 14, 14, 1, highlight)
    rect(img, 9, 22, 14, 1, dark)

    # Arms
    rect(img, 6, 14, 3, 8, purple)
    rect(img, 23, 14, 3, 8, purple)

    # Legs
    rect(img, 10, 23, 4, 8, purple)
    rect(img, 18, 23, 4, 8, purple)

    return img


# ---------------------------------------------------------------------------
# icon_lootrun -- Compass: expeditions/loot runs, #D4A030 orange-gold
# ---------------------------------------------------------------------------
def make_icon_lootrun():
    img = create_sprite()
    gold = (212, 160, 48)
    dark = (130, 90, 20)
    highlight = (240, 200, 100)
    red = (212, 98, 11)    # needle north (Eldorange from palette)
    white = (232, 220, 200)  # needle south (Bandagevit from palette)

    # Outer ring
    # Draw circle by filling rows
    cx, cy, r = 15, 15, 12
    for y in range(32):
        for x in range(32):
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if r - 2 <= dist <= r:
                px(img, x, y, gold)
            elif dist < r - 2:
                px(img, x, y, (40, 40, 40, 180))  # dark interior

    # Compass needle -- North (red/orange) pointing up-right
    needle_north = [(15, 8), (14, 9), (15, 9), (16, 9),
                    (13, 10), (15, 10), (17, 10),
                    (14, 11), (15, 11), (16, 11)]
    for (x, y) in needle_north:
        px(img, x, y, red)

    # Compass needle -- South (white) pointing down-left
    needle_south = [(15, 22), (14, 21), (15, 21), (16, 21),
                    (13, 20), (15, 20), (17, 20),
                    (14, 19), (15, 19), (16, 19)]
    for (x, y) in needle_south:
        px(img, x, y, white)

    # Center dot
    rect(img, 14, 14, 4, 4, gold)
    rect(img, 15, 15, 2, 2, highlight)

    # Highlight on ring (top-left)
    for y in range(32):
        for x in range(32):
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if r - 2 <= dist <= r and x < cx and y < cy:
                px(img, x, y, highlight)

    return img


# ---------------------------------------------------------------------------
# icon_endday -- Moon with arrow: end the day / begin night, #D4620B orange-red
# ---------------------------------------------------------------------------
def make_icon_endday():
    img = create_sprite()
    orange = (212, 98, 11)
    dark = (130, 55, 8)
    highlight = (240, 150, 60)
    moon_color = (240, 210, 100)  # yellow moon
    moon_dark = (180, 150, 60)

    # Crescent moon (top-left area)
    cx, cy, r = 12, 14, 9
    for y in range(32):
        for x in range(32):
            dist_main = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            dist_cut = ((x - cx - 4) ** 2 + (y - cy - 1) ** 2) ** 0.5
            if dist_main < r and dist_cut >= r - 3:
                px(img, x, y, moon_color)

    # Moon shading
    for y in range(32):
        for x in range(32):
            dist_main = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            dist_cut = ((x - cx - 4) ** 2 + (y - cy - 1) ** 2) ** 0.5
            if dist_main < r and dist_cut >= r - 3:
                if y > cy:
                    px(img, x, y, moon_dark)

    # Arrow pointing right (bottom-right area) -- "proceed to night"
    # Arrow shaft
    rect(img, 18, 20, 8, 3, orange)
    rect(img, 18, 20, 8, 1, highlight)
    # Arrow head
    arrowhead = [
        (24, 17), (25, 18), (26, 19), (27, 20), (27, 21),
        (27, 22), (26, 23), (25, 24), (24, 25),
    ]
    for (x, y) in arrowhead:
        px(img, x, y, orange)
    rect(img, 25, 19, 4, 5, orange)
    rect(img, 25, 19, 4, 1, highlight)

    return img


# ---------------------------------------------------------------------------
# icon_heart -- Heart shape: HP display, #F44336 red
# ---------------------------------------------------------------------------
def make_icon_heart():
    img = create_sprite()
    red = (244, 67, 54)
    dark = (160, 30, 20)
    highlight = (255, 140, 130)

    # Heart shape: two circles on top, triangle/V at bottom
    # Left lobe
    for y in range(32):
        for x in range(32):
            dist_l = ((x - 10) ** 2 + (y - 11) ** 2) ** 0.5
            dist_r = ((x - 20) ** 2 + (y - 11) ** 2) ** 0.5
            if dist_l < 7 or dist_r < 7:
                px(img, x, y, red)

    # Fill the bottom V shape
    for row in range(11, 26):
        width = 26 - row
        start = 15 - width
        for x in range(start, start + width * 2 + 2):
            px(img, x, row, red)

    # Highlight (top-left of left lobe)
    for y in range(32):
        for x in range(32):
            dist_l = ((x - 9) ** 2 + (y - 9) ** 2) ** 0.5
            if dist_l < 3:
                px(img, x, y, highlight)

    # Dark shading (bottom)
    for row in range(22, 26):
        width = 26 - row
        start = 15 - width
        for x in range(start, start + width * 2 + 2):
            px(img, x, row, dark)

    return img


# ---------------------------------------------------------------------------
# icon_skull -- Skull shape: kill counter, #E8DCC8 bone white
# ---------------------------------------------------------------------------
def make_icon_skull():
    img = create_sprite()
    bone = (232, 220, 200)
    dark = (140, 128, 108)
    highlight = (255, 248, 235)
    black = (20, 20, 20)

    # Skull cranium (rounded top)
    cx, cy, r = 15, 13, 9
    for y in range(32):
        for x in range(32):
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if dist < r:
                px(img, x, y, bone)

    # Jaw / lower face rectangle
    rect(img, 8, 19, 16, 7, bone)

    # Teeth (3 teeth at bottom of jaw)
    rect(img, 9, 24, 3, 3, bone)
    rect(img, 13, 24, 3, 3, bone)
    rect(img, 17, 24, 3, 3, bone)
    rect(img, 21, 24, 3, 3, bone)

    # Gaps between teeth (dark)
    rect(img, 12, 24, 1, 3, black)
    rect(img, 16, 24, 1, 3, black)
    rect(img, 20, 24, 1, 3, black)

    # Eye sockets (dark circles)
    for y in range(32):
        for x in range(32):
            dist_l = ((x - 11) ** 2 + (y - 13) ** 2) ** 0.5
            dist_r = ((x - 20) ** 2 + (y - 13) ** 2) ** 0.5
            if dist_l < 3.5 or dist_r < 3.5:
                px(img, x, y, black)

    # Nose cavity (small dark oval)
    rect(img, 14, 17, 4, 3, black)
    rect(img, 13, 18, 6, 1, black)

    # Highlights on cranium
    px(img, 11, 7, highlight)
    px(img, 12, 6, highlight)
    px(img, 13, 6, highlight)

    # Shading on jaw
    rect(img, 8, 25, 16, 1, dark)

    return img


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    icons = [
        ('icon_build',    make_icon_build),
        ('icon_weapons',  make_icon_weapons),
        ('icon_craft',    make_icon_craft),
        ('icon_skills',   make_icon_skills),
        ('icon_refugees', make_icon_refugees),
        ('icon_lootrun',  make_icon_lootrun),
        ('icon_endday',   make_icon_endday),
        ('icon_heart',    make_icon_heart),
        ('icon_skull',    make_icon_skull),
    ]

    print(f'Generating {len(icons)} toolbar icons...')
    for name, func in icons:
        img = func()
        save_sprite(img, name)

    print(f'\nDone. All icons saved to assets/sprites/')

"""
Dead Horizon -- Toolbar icon generator v2
Skapar tydligare pixel art-ikoner for DayScene toolbar och resurser.
Alla 24x24 (toolbar) eller 16x16 (resurser), transparant bakgrund.
"""

from PIL import Image

OUTPUT_DIR = "/Users/olabelin/Projects/dead-horizon/public/assets/sprites"

# ============================================================
# Farger fran art-direction.md
# ============================================================
TRANSPARENT   = (0, 0, 0, 0)

# Metall/gratt
METAL_LIGHT   = (190, 190, 195, 255)
METAL_MID     = (140, 140, 148, 255)
METAL_DARK    = (80, 80, 90, 255)
METAL_SHADOW  = (50, 50, 58, 255)

# Tra/brunt
WOOD_LIGHT    = (160, 110, 65, 255)
WOOD_MID      = (120, 78, 42, 255)
WOOD_DARK     = (80, 48, 20, 255)

# Rost/guld
RUST_BROWN    = (139, 69, 19, 255)       # Rostbrunt
AMMO_GOLD     = (197, 160, 48, 255)      # Munitionsguld
AMMO_COPPER   = (176, 96, 32, 255)       # Kopparbas

# Rod
BLOOD_RED     = (139, 0, 0, 255)         # Blodrott
FLANNEL_RED   = (178, 34, 34, 255)       # Flanellrod
BRIGHT_RED    = (220, 40, 40, 255)       # Klarrott (kors, hjarta)

# Gul
AP_YELLOW     = (255, 215, 0, 255)       # AP-gul
STAR_YELLOW   = (255, 200, 0, 255)
STAR_SHADOW   = (180, 130, 0, 255)

# Gron
MOSS_GREEN    = (74, 107, 58, 255)
DARK_GREEN    = (45, 74, 34, 255)
FOOD_GREEN    = (60, 140, 40, 255)
FOOD_RED      = (200, 40, 40, 255)

# Vit/ljus
BANDAGE_WHITE = (232, 220, 200, 255)
PURE_WHITE    = (255, 255, 255, 255)
BONE_WHITE    = (220, 210, 190, 255)

# Bla
MED_BLUE      = (74, 144, 217, 255)
DARK_BLUE     = (30, 80, 160, 255)

# Moon/natt
MOON_YELLOW   = (240, 220, 120, 255)
MOON_SHADOW   = (160, 140, 60, 255)
NIGHT_DARK    = (26, 26, 46, 255)


# ============================================================
# Hjalparfunktioner
# ============================================================

def new_img(size):
    return Image.new("RGBA", (size, size), TRANSPARENT)

def px(img, x, y, color):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), color)

def rect(img, x, y, w, h, color):
    for dy in range(h):
        for dx in range(w):
            px(img, x + dx, y + dy, color)

def hline(img, x, y, length, color):
    for i in range(length):
        px(img, x + i, y, color)

def vline(img, x, y, length, color):
    for i in range(length):
        px(img, x, y + i, color)

def save_icon(img, name, scale=8):
    path = f"{OUTPUT_DIR}/{name}.png"
    img.save(path)
    preview = img.resize(
        (img.width * scale, img.height * scale),
        Image.NEAREST
    )
    preview.save(f"{OUTPUT_DIR}/{name}_preview.png")
    print(f"  Sparad: {name}.png  ({img.width}x{img.height})")


# ============================================================
# 24x24 TOOLBAR-IKONER
# ============================================================

def create_icon_build():
    """Hammare -- brun skaft, grat huvud, tydlig silhuett"""
    img = new_img(24)

    # Hammerhuvud (grat, uppe till vanster)
    # Huvud: 10x6 px, placerat diagonalt
    rect(img,  3,  3, 10,  5, METAL_LIGHT)
    rect(img,  3,  3, 10,  2, METAL_LIGHT)
    # Overyta (ljus highlight)
    hline(img, 3, 3, 10, METAL_LIGHT)
    # Under-skugga
    hline(img, 3, 7, 10, METAL_SHADOW)
    # Vanster skugga
    vline(img, 3, 3, 5, METAL_MID)
    # Hoger highlight
    vline(img, 12, 3, 5, METAL_SHADOW)
    # Huvud kropp
    rect(img, 4, 4, 8, 3, METAL_MID)
    # Klo pa hammerhuvudet (nedre hoger)
    rect(img, 10, 8, 4, 2, METAL_MID)
    hline(img, 11, 10, 2, METAL_DARK)

    # Skaft (brunt, diagonalt -- overfran ner till hoger)
    # Rita diagonalt skaft
    for i in range(10):
        px(img, 8 + i, 8 + i,  WOOD_LIGHT)
        px(img, 9 + i, 8 + i,  WOOD_MID)
        if i < 9:
            px(img, 8 + i, 9 + i, WOOD_MID)

    # Grepp (nedre del av skaft, lite bredare)
    rect(img, 17, 17, 3, 4, WOOD_DARK)
    rect(img, 16, 17, 1, 4, WOOD_MID)

    # Sla om hammarhuvudet med skugglinje for djup
    hline(img, 3, 8, 10, METAL_SHADOW)

    save_icon(img, "icon_build")


def create_icon_ammo():
    """Kula/patron -- gyllene kula med koppar-bas, tydlig form"""
    img = new_img(24)

    # Patronhylsa (cylindrisk, kopparfarg, mitten av bilden)
    # Botten (bred bas)
    rect(img, 9, 17, 6, 2, AMMO_COPPER)
    px(img, 8, 17, AMMO_COPPER)
    px(img, 15, 17, AMMO_COPPER)
    hline(img, 8, 18, 8, AMMO_COPPER)

    # Kanten (rand)
    hline(img, 8, 16, 8, METAL_DARK)
    hline(img, 9, 19, 6, METAL_SHADOW)

    # Hylsa (cylinder, guldgul)
    rect(img, 9, 8, 6, 9, AMMO_GOLD)
    # Vanster skugga pa hylsan
    vline(img, 9, 8, 9, AMMO_COPPER)
    # Hoger highlight
    vline(img, 14, 8, 9, (220, 185, 70, 255))

    # Kula-topp (avrundad, ljusare guld)
    # Oval topp
    hline(img, 10, 7, 4, (230, 200, 80, 255))
    hline(img, 10, 6, 4, (230, 200, 80, 255))
    hline(img, 11, 5, 2, (240, 215, 90, 255))
    px(img,   11, 4, (240, 215, 90, 255))
    px(img,   12, 4, (240, 215, 90, 255))
    px(img,   11, 3, (245, 225, 100, 255))
    px(img,   12, 3, (240, 215, 90, 255))

    # Skugga pa kulan
    vline(img, 10, 4, 4, AMMO_COPPER)

    # Primer (liten cirkel pa botten)
    px(img, 11, 20, METAL_MID)
    px(img, 12, 20, METAL_MID)
    px(img, 11, 21, METAL_MID)
    px(img, 12, 21, METAL_MID)
    px(img, 11, 20, METAL_LIGHT)

    save_icon(img, "icon_ammo")


def create_icon_weapons():
    """Korsade knivar/klingor -- tva korsade blad, metalliska"""
    img = new_img(24)

    # Kniv 1: fran upper-left till lower-right
    # Blad (ljust metall)
    for i in range(13):
        px(img, 2 + i, 2 + i, METAL_LIGHT)
        if i < 12:
            px(img, 3 + i, 2 + i, METAL_MID)
    # Eggskugga
    for i in range(11):
        px(img, 2 + i, 3 + i, METAL_SHADOW)

    # Gardskydd kniv 1 (litet kors-gardskydd)
    rect(img, 8, 8, 4, 2, RUST_BROWN)
    hline(img, 8, 7, 4, WOOD_MID)

    # Skaft kniv 1
    for i in range(5):
        px(img, 13 + i, 13 + i, WOOD_MID)
        px(img, 14 + i, 13 + i, WOOD_DARK)
    px(img, 18, 18, WOOD_DARK)
    px(img, 19, 19, WOOD_DARK)

    # Kniv 2: fran upper-right till lower-left (korsad)
    for i in range(13):
        px(img, 21 - i, 2 + i, METAL_LIGHT)
        if i < 12:
            px(img, 20 - i, 2 + i, METAL_MID)
    # Eggskugga kniv 2
    for i in range(11):
        px(img, 21 - i, 3 + i, METAL_SHADOW)

    # Gardskydd kniv 2
    rect(img, 12, 8, 4, 2, RUST_BROWN)
    hline(img, 12, 7, 4, WOOD_MID)

    # Skaft kniv 2
    for i in range(5):
        px(img, 10 - i, 13 + i, WOOD_MID)
        px(img, 9 - i, 13 + i, WOOD_DARK)
    px(img, 4, 18, WOOD_DARK)
    px(img, 3, 19, WOOD_DARK)

    # Rita om korsningspunkten (oversta kniven syns ovanpa)
    px(img, 11, 11, METAL_LIGHT)
    px(img, 12, 11, METAL_MID)
    px(img, 11, 12, METAL_MID)
    px(img, 12, 12, METAL_MID)
    px(img, 13, 13, METAL_LIGHT)

    save_icon(img, "icon_weapons")


def create_icon_craft():
    """Kugghjul + skiftnyckel"""
    img = new_img(24)

    # Kugghjul (center 7,7 radius 6) -- uppe till vanster
    cx, cy = 8, 8

    # Hjulkropp (fylld cirkel approximation)
    for y in range(3, 14):
        for x in range(3, 14):
            dx, dy = x - cx, y - cy
            if dx*dx + dy*dy <= 25:
                img.putpixel((x, y), METAL_MID)
            elif dx*dx + dy*dy <= 30:
                img.putpixel((x, y), METAL_DARK)

    # Hal i mitten
    for y in range(5, 12):
        for x in range(5, 12):
            dx, dy = x - cx, y - cy
            if dx*dx + dy*dy <= 6:
                img.putpixel((x, y), TRANSPARENT)

    # Kuggar (8 st)
    kugg_pos = [
        (8, 1), (8, 14),   # topp, botten
        (1, 8), (14, 8),   # vanster, hoger
        (3, 3), (12, 3),   # diagonaler
        (3, 12), (12, 12)
    ]
    for kx, ky in kugg_pos:
        px(img, kx, ky, METAL_LIGHT)
        # Lite bredare kuggar
        for ddx in range(-1, 2):
            for ddy in range(-1, 2):
                nx, ny = kx + ddx, ky + ddy
                if 0 <= nx < 24 and 0 <= ny < 24:
                    dx, dy = nx - cx, ny - cy
                    if dx*dx + dy*dy > 25:
                        px(img, nx, ny, METAL_MID)

    # Highlight pa kugghjulet
    for y in range(4, 9):
        for x in range(4, 9):
            dx, dy = x - cx, y - cy
            if 8 < dx*dx + dy*dy <= 25:
                img.putpixel((x, y), METAL_LIGHT)

    # Skiftnyckel (nere till hoger)
    # Skaft
    for i in range(8):
        px(img, 13 + i, 13 + i, METAL_LIGHT)
        px(img, 14 + i, 13 + i, METAL_MID)
        px(img, 13 + i, 14 + i, METAL_MID)
    # Nyckelhuvud (U-form)
    rect(img, 12, 12, 4, 2, METAL_MID)
    rect(img, 12, 11, 2, 4, METAL_MID)
    rect(img, 14, 11, 2, 4, METAL_MID)
    # Oppning i nyckeln
    px(img, 12, 14, TRANSPARENT)
    px(img, 13, 14, TRANSPARENT)
    px(img, 14, 14, TRANSPARENT)
    px(img, 15, 14, TRANSPARENT)
    px(img, 12, 13, METAL_LIGHT)
    px(img, 15, 13, METAL_SHADOW)
    # Nyckel-ande (liten krok)
    rect(img, 20, 20, 3, 2, METAL_MID)
    rect(img, 20, 18, 2, 4, METAL_MID)
    px(img, 20, 18, METAL_LIGHT)
    px(img, 22, 22, METAL_SHADOW)

    save_icon(img, "icon_craft")


def create_icon_refugees():
    """Person-silhuett -- enkel human figur ovanifraN"""
    img = new_img(24)

    # Top-down figur
    # Huvud (cirkel, ovansida)
    head_pixels = [
        (10,2),(11,2),(12,2),(13,2),
        (9,3),(14,3),
        (9,4),(14,4),
        (10,5),(11,5),(12,5),(13,5),
    ]
    for hx, hy in head_pixels:
        px(img, hx, hy, BANDAGE_WHITE)
    # Harhighlight
    px(img, 10, 2, (240, 230, 210, 255))
    px(img, 11, 2, BANDAGE_WHITE)

    # Kropp (ovala/rektangular, muted ton)
    BODY_COLOR = (140, 115, 90, 255)
    BODY_SHADOW = (100, 80, 60, 255)
    body_pixels = [
        (9,7),(10,7),(11,7),(12,7),(13,7),(14,7),
        (8,8),(9,8),(10,8),(11,8),(12,8),(13,8),(14,8),(15,8),
        (8,9),(9,9),(10,9),(11,9),(12,9),(13,9),(14,9),(15,9),
        (8,10),(9,10),(10,10),(11,10),(12,10),(13,10),(14,10),(15,10),
        (8,11),(9,11),(10,11),(11,11),(12,11),(13,11),(14,11),(15,11),
        (9,12),(10,12),(11,12),(12,12),(13,12),(14,12),
    ]
    for bx, by in body_pixels:
        px(img, bx, by, BODY_COLOR)
    # Skugga pa kroppen
    for bx in [8, 9]:
        for by in range(8, 12):
            px(img, bx, by, BODY_SHADOW)

    # Axlar (ljusare)
    px(img, 8, 7, (160, 130, 100, 255))
    px(img, 15, 7, (160, 130, 100, 255))

    # Armar (ut till sidorna)
    ARM_COLOR = (120, 95, 70, 255)
    # Vanster arm
    for i in range(4):
        px(img, 6 - i, 8 + i, ARM_COLOR)
        px(img, 7 - i, 8 + i, ARM_COLOR)
    # Hoger arm
    for i in range(4):
        px(img, 17 + i, 8 + i, ARM_COLOR)
        px(img, 16 + i, 8 + i, ARM_COLOR)

    # Ben (nedre del)
    LEG_COLOR = (90, 70, 50, 255)
    # Vanster ben
    rect(img, 9, 13, 3, 5, LEG_COLOR)
    rect(img, 9, 18, 3, 2, (70, 55, 40, 255))
    # Hoger ben
    rect(img, 12, 13, 3, 5, LEG_COLOR)
    rect(img, 12, 18, 3, 2, (70, 55, 40, 255))

    # Liten detalj: knapp/rem pa kroppen
    px(img, 11, 9, (180, 150, 110, 255))
    px(img, 11, 11, (180, 150, 110, 255))

    save_icon(img, "icon_refugees")


def create_icon_lootrun():
    """Ryggsack -- brun ryggsack med remmar"""
    img = new_img(24)

    # Top-down vy av ryggsack
    # Huvudfack (stor rektangel, brun)
    BAG_MAIN    = (110, 75, 40, 255)
    BAG_LIGHT   = (145, 100, 58, 255)
    BAG_DARK    = (75, 48, 22, 255)
    BAG_STRAP   = (85, 58, 30, 255)
    BUCKLE      = (180, 150, 60, 255)

    # Kropp
    rect(img, 5, 4, 14, 16, BAG_MAIN)
    # Highlight (vanster sida)
    rect(img, 5, 4, 2, 16, BAG_LIGHT)
    # Skugga (hoger sida)
    rect(img, 17, 4, 2, 16, BAG_DARK)
    # Botten
    hline(img, 5, 19, 14, BAG_DARK)

    # Framfack (mindre rektangel, nedre halvan)
    rect(img, 7, 12, 10, 6, BAG_DARK)
    rect(img, 8, 13, 8, 4, (90, 58, 26, 255))
    # Framficka-rand
    hline(img, 7, 12, 10, BAG_STRAP)

    # Spanne/dragkedja pa framfickan
    px(img, 11, 14, BUCKLE)
    px(img, 12, 14, BUCKLE)
    px(img, 11, 15, BUCKLE)
    px(img, 12, 15, (150, 120, 40, 255))

    # Sidorremmar
    rect(img, 3, 6, 2, 12, BAG_STRAP)
    rect(img, 19, 6, 2, 12, BAG_STRAP)

    # Spanner pa remmarna
    rect(img, 3, 9, 2, 2, BUCKLE)
    rect(img, 19, 9, 2, 2, BUCKLE)
    rect(img, 3, 14, 2, 2, BUCKLE)
    rect(img, 19, 14, 2, 2, BUCKLE)

    # Oversta handtag
    hline(img, 9, 3, 6, BAG_STRAP)
    px(img, 9, 4, BAG_STRAP)
    px(img, 14, 4, BAG_STRAP)

    # Liten detalj: sydd linje pa kroppen
    for y in [7, 10]:
        hline(img, 6, y, 12, BAG_DARK)

    save_icon(img, "icon_lootrun")


def create_icon_skills():
    """Stjarna + uppAtriktad pil -- gul stjarna"""
    img = new_img(24)

    # 5-uddig stjarna, centrerad pa (12,12)
    import math

    # Rita 5-uddig stjarna pixel for pixel
    cx, cy = 12, 11

    def in_star(x, y, cx, cy, outer_r, inner_r, points=5):
        dx, dy = x - cx, y - cy
        dist = math.sqrt(dx*dx + dy*dy)
        if dist == 0:
            return True
        angle = math.atan2(dy, dx) + math.pi/2
        segment = math.pi * 2 / points
        normalized = angle % segment
        if normalized > segment / 2:
            normalized = segment - normalized
        # Interpolera radius
        t = normalized / (segment / 2)
        r = inner_r + (outer_r - inner_r) * math.cos(t * math.pi / 2)
        return dist <= r

    outer_r = 9.5
    inner_r = 4.0

    for y in range(1, 23):
        for x in range(1, 23):
            if in_star(x, y, cx, cy, outer_r, inner_r):
                img.putpixel((x, y), STAR_YELLOW)

    # Highlight (oversta vanstre udde)
    for y in range(2, 7):
        for x in range(8, 14):
            dx, dy = x - cx, y - cy
            if in_star(x, y, cx, cy, outer_r, inner_r) and dx < 1 and dy < 0:
                img.putpixel((x, y), (255, 235, 100, 255))

    # Skuggor pa nedre delar
    for y in range(15, 22):
        for x in range(1, 23):
            if in_star(x, y, cx, cy, outer_r, inner_r):
                img.putpixel((x, y), STAR_SHADOW)

    # Liten uppAtpil i mitten
    px(img, 12, 8, PURE_WHITE)
    px(img, 11, 9, PURE_WHITE)
    px(img, 12, 9, PURE_WHITE)
    px(img, 13, 9, PURE_WHITE)
    px(img, 12, 10, PURE_WHITE)
    px(img, 12, 11, PURE_WHITE)
    px(img, 12, 12, PURE_WHITE)
    px(img, 11, 12, PURE_WHITE)
    px(img, 13, 12, PURE_WHITE)

    save_icon(img, "icon_skills")


def create_icon_endday():
    """HalvmAne -- gul halvmane, overgAng till natt"""
    img = new_img(24)

    import math

    # Stjarnhimmel (morkt bla bakgrund -- transparent, men stjarnor)
    # Nagra stjarnor i hornorna
    star_spots = [(3, 3), (20, 2), (2, 18), (21, 19), (18, 8), (5, 15)]
    for sx, sy in star_spots:
        px(img, sx, sy, (200, 200, 230, 200))

    cx, cy = 12, 12

    # Yttre cirkel (hel mane)
    outer_r = 9

    # Inre "skugga"-cirkel -- offset ger halvmane-effekt
    inner_cx, inner_cy = 15, 9
    inner_r = 7

    for y in range(0, 24):
        for x in range(0, 24):
            dx_out, dy_out = x - cx, y - cy
            in_outer = (dx_out*dx_out + dy_out*dy_out) <= outer_r*outer_r

            dx_in, dy_in = x - inner_cx, y - inner_cy
            in_inner = (dx_in*dx_in + dy_in*dy_in) <= inner_r*inner_r

            if in_outer and not in_inner:
                # Halvmane-pixel
                # Gradient: ljusare mot toppen
                brightness = 1.0 - (dy_out + outer_r) / (2 * outer_r) * 0.3
                r = int(240 * brightness)
                g = int(220 * brightness)
                b = int(120 * brightness)
                img.putpixel((x, y), (r, g, b, 255))

    # Highlight pa halvmanen (oversta vanstre kant)
    for y in range(3, 9):
        for x in range(5, 11):
            dx, dy = x - cx, y - cy
            dx_in, dy_in = x - inner_cx, y - inner_cy
            in_outer = dx*dx + dy*dy <= outer_r*outer_r
            in_inner = dx_in*dx_in + dy_in*dy_in <= inner_r*inner_r
            if in_outer and not in_inner and dx < -1:
                img.putpixel((x, y), (255, 245, 180, 255))

    # Liten stjarna bredvid manen
    px(img, 19, 5, (255, 255, 220, 255))
    px(img, 20, 4, (255, 255, 220, 255))
    px(img, 19, 3, (255, 255, 220, 200))
    px(img, 18, 4, (255, 255, 220, 200))
    px(img, 20, 6, (255, 255, 220, 200))

    save_icon(img, "icon_endday")


# ============================================================
# 16x16 RESURS-IKONER
# ============================================================

def create_icon_scrap():
    """Kugghjul/skrot -- metallisk, gra"""
    img = new_img(16)

    cx, cy = 8, 8

    # Kugghjul
    for y in range(16):
        for x in range(16):
            dx, dy = x - cx, y - cy
            dist2 = dx*dx + dy*dy
            if dist2 <= 16:
                img.putpixel((x, y), METAL_MID)
            elif dist2 <= 20:
                img.putpixel((x, y), METAL_DARK)

    # Hal i mitten
    for y in range(16):
        for x in range(16):
            dx, dy = x - cx, y - cy
            if dx*dx + dy*dy <= 4:
                img.putpixel((x, y), TRANSPARENT)

    # Kuggar (4 st)
    kugg = [(8,1),(8,14),(1,8),(14,8),(2,2),(13,2),(2,13),(13,13)]
    for kx, ky in kugg:
        px(img, kx, ky, METAL_LIGHT)
        for dkx in range(-1, 2):
            for dky in range(-1, 2):
                nx, ny = kx+dkx, ky+dky
                if 0 <= nx < 16 and 0 <= ny < 16:
                    dx, dy = nx-cx, ny-cy
                    if dx*dx + dy*dy > 20:
                        px(img, nx, ny, METAL_MID)

    # Highlight
    for y in range(4, 8):
        for x in range(4, 8):
            dx, dy = x-cx, y-cy
            if 4 < dx*dx + dy*dy <= 16:
                img.putpixel((x, y), METAL_LIGHT)

    save_icon(img, "icon_scrap")


def create_icon_food():
    """Apple -- rod med blad, tydlig form"""
    img = new_img(16)

    # Appel-form (rod)
    apple_pixels = [
        (6,3),(7,3),(8,3),(9,3),
        (5,4),(6,4),(7,4),(8,4),(9,4),(10,4),
        (4,5),(5,5),(6,5),(7,5),(8,5),(9,5),(10,5),(11,5),
        (4,6),(5,6),(6,6),(7,6),(8,6),(9,6),(10,6),(11,6),
        (4,7),(5,7),(6,7),(7,7),(8,7),(9,7),(10,7),(11,7),
        (4,8),(5,8),(6,8),(7,8),(8,8),(9,8),(10,8),(11,8),
        (5,9),(6,9),(7,9),(8,9),(9,9),(10,9),
        (5,10),(6,10),(7,10),(8,10),(9,10),(10,10),
        (6,11),(7,11),(8,11),(9,11),
    ]
    APPLE_RED    = (200, 45, 35, 255)
    APPLE_LIGHT  = (230, 80, 65, 255)
    APPLE_DARK   = (150, 25, 15, 255)

    for ax, ay in apple_pixels:
        img.putpixel((ax, ay), APPLE_RED)

    # Highlight (oversta vanster)
    for ax, ay in [(6,4),(7,4),(6,5),(7,5),(6,6)]:
        px(img, ax, ay, APPLE_LIGHT)

    # Skugga (hoger sida)
    for ax, ay in [(10,5),(10,6),(10,7),(10,8),(9,9),(10,9)]:
        px(img, ax, ay, APPLE_DARK)

    # Skaft (brun)
    px(img, 8, 2, WOOD_DARK)
    px(img, 8, 1, WOOD_MID)

    # Blad (gront)
    px(img, 9, 1, FOOD_GREEN)
    px(img, 10, 1, FOOD_GREEN)
    px(img, 10, 2, FOOD_GREEN)
    px(img, 9, 2, MOSS_GREEN)

    # Liten glans-prick
    px(img, 6, 4, (240, 200, 195, 255))

    save_icon(img, "icon_food")


def create_icon_parts():
    """Skiftnyckel -- metallisk"""
    img = new_img(16)

    # Skiftnyckel (diagonal)
    # Nyckelhandtag (skaft, diagonalt)
    for i in range(8):
        px(img, 2 + i, 6 + i, METAL_LIGHT)
        px(img, 3 + i, 6 + i, METAL_MID)
        px(img, 2 + i, 7 + i, METAL_MID)

    # Nyckelklo (uppe till hoger)
    rect(img, 9, 1, 4, 2, METAL_MID)
    rect(img, 11, 3, 2, 3, METAL_MID)
    rect(img, 9, 1, 2, 3, METAL_LIGHT)
    # Oppning i klon
    px(img, 9, 3, TRANSPARENT)
    px(img, 9, 4, TRANSPARENT)
    px(img, 10, 3, TRANSPARENT)
    px(img, 10, 4, TRANSPARENT)

    # Highlight pa skaftet
    for i in range(6):
        px(img, 2+i, 6+i, METAL_LIGHT)

    # Nyckelande (nedre vanster, liten rund)
    rect(img, 1, 12, 3, 2, METAL_MID)
    px(img, 1, 12, METAL_LIGHT)
    px(img, 3, 13, METAL_SHADOW)

    save_icon(img, "icon_parts")


def create_icon_meds():
    """Rott kors -- vit bakgrund, rott kors"""
    img = new_img(16)

    # Vit/kram bakgrund (fyrkantig)
    rect(img, 2, 2, 12, 12, BANDAGE_WHITE)
    # Kant (ljusgra)
    rect(img, 2, 2, 12, 1, METAL_LIGHT)
    rect(img, 2, 13, 12, 1, METAL_LIGHT)
    rect(img, 2, 2, 1, 12, METAL_LIGHT)
    rect(img, 13, 2, 1, 12, METAL_LIGHT)
    # Skugga
    rect(img, 3, 14, 11, 1, METAL_SHADOW)
    rect(img, 14, 3, 1, 11, METAL_SHADOW)

    # Rott kors
    # Horisontell arm
    rect(img, 4, 7, 8, 2, BRIGHT_RED)
    # Vertikal arm
    rect(img, 7, 4, 2, 8, BRIGHT_RED)
    # Kors-highlight
    px(img, 7, 4, (240, 60, 60, 255))
    px(img, 7, 5, (240, 60, 60, 255))

    save_icon(img, "icon_meds")


def create_icon_heart():
    """Hjarta -- rott, fyllt"""
    img = new_img(16)

    # Hjartform
    heart_pixels = [
        (5,3),(6,3),(9,3),(10,3),
        (4,4),(5,4),(6,4),(7,4),(8,4),(9,4),(10,4),(11,4),
        (3,5),(4,5),(5,5),(6,5),(7,5),(8,5),(9,5),(10,5),(11,5),(12,5),
        (3,6),(4,6),(5,6),(6,6),(7,6),(8,6),(9,6),(10,6),(11,6),(12,6),
        (3,7),(4,7),(5,7),(6,7),(7,7),(8,7),(9,7),(10,7),(11,7),(12,7),
        (4,8),(5,8),(6,8),(7,8),(8,8),(9,8),(10,8),(11,8),
        (5,9),(6,9),(7,9),(8,9),(9,9),(10,9),
        (6,10),(7,10),(8,10),(9,10),
        (7,11),(8,11),
    ]
    HEART_RED   = (220, 35, 35, 255)
    HEART_LIGHT = (255, 80, 80, 255)
    HEART_DARK  = (150, 10, 10, 255)

    for hx, hy in heart_pixels:
        img.putpixel((hx, hy), HEART_RED)

    # Highlight (oversta vanster bubbla)
    for hx, hy in [(5,4),(6,4),(5,5),(6,5),(4,5),(4,6)]:
        px(img, hx, hy, HEART_LIGHT)

    # Skugga (nedre hoger)
    for hx, hy in [(10,7),(11,6),(11,7),(10,8),(9,9),(10,9)]:
        px(img, hx, hy, HEART_DARK)

    # Liten glans-prick
    px(img, 6, 4, (255, 160, 160, 255))

    save_icon(img, "icon_heart")


def create_icon_skull():
    """Dodskalle -- vit, enkel"""
    img = new_img(16)

    SKULL_WHITE  = (230, 220, 200, 255)
    SKULL_SHADOW = (170, 158, 138, 255)
    EYE_BLACK    = (30, 30, 30, 255)
    NOSE_BLACK   = (60, 50, 40, 255)

    # Hjassform (rund overst)
    skull_top = [
        (6,2),(7,2),(8,2),(9,2),
        (5,3),(6,3),(7,3),(8,3),(9,3),(10,3),
        (4,4),(5,4),(6,4),(7,4),(8,4),(9,4),(10,4),(11,4),
        (4,5),(5,5),(6,5),(7,5),(8,5),(9,5),(10,5),(11,5),
        (4,6),(5,6),(6,6),(7,6),(8,6),(9,6),(10,6),(11,6),
        (4,7),(5,7),(6,7),(7,7),(8,7),(9,7),(10,7),(11,7),
        (5,8),(6,8),(7,8),(8,8),(9,8),(10,8),
    ]
    for sx, sy in skull_top:
        img.putpixel((sx, sy), SKULL_WHITE)

    # Kakhuvud (nedre del, lite smalare)
    jaw = [
        (5,9),(6,9),(7,9),(8,9),(9,9),(10,9),
        (5,10),(10,10),
        (5,11),(6,11),(7,11),(8,11),(9,11),(10,11),
    ]
    for sx, sy in jaw:
        img.putpixel((sx, sy), SKULL_SHADOW)

    # Tander
    for tx in range(6, 11, 2):
        px(img, tx, 12, SKULL_WHITE)
    for tx in range(7, 10, 2):
        px(img, tx, 12, SKULL_SHADOW)

    # Ogon (svarta, ovala)
    # Vanster oga
    for ox, oy in [(6,5),(7,5),(6,6),(7,6)]:
        img.putpixel((ox, oy), EYE_BLACK)
    # Hoger oga
    for ox, oy in [(9,5),(10,5),(9,6),(10,6)]:
        img.putpixel((ox, oy), EYE_BLACK)

    # Nasgrop
    px(img, 7, 7, NOSE_BLACK)
    px(img, 8, 7, NOSE_BLACK)
    px(img, 7, 8, NOSE_BLACK)

    # Highlight pa hjassan
    px(img, 7, 3, PURE_WHITE)
    px(img, 8, 3, PURE_WHITE)
    px(img, 6, 4, PURE_WHITE)

    # Skugga pa hoger sida
    for sx, sy in [(11,4),(11,5),(11,6),(10,7),(11,7),(10,8)]:
        px(img, sx, sy, SKULL_SHADOW)

    save_icon(img, "icon_skull")


# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    print("Skapar toolbar-ikoner (24x24)...")
    create_icon_build()
    create_icon_ammo()
    create_icon_weapons()
    create_icon_craft()
    create_icon_refugees()
    create_icon_lootrun()
    create_icon_skills()
    create_icon_endday()

    print("\nSkapar resurs-ikoner (16x16)...")
    create_icon_scrap()
    create_icon_food()
    create_icon_parts()
    create_icon_meds()
    create_icon_heart()
    create_icon_skull()

    print("\nKlart! Alla ikoner sparade i public/assets/sprites/")

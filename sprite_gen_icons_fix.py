"""
Dead Horizon -- Ikonkorrigering
Fixar icon_parts (skiftnyckel) och icon_refugees (person-silhuett).
"""

from PIL import Image

OUTPUT_DIR = "/Users/olabelin/Projects/dead-horizon/public/assets/sprites"

TRANSPARENT   = (0, 0, 0, 0)
METAL_LIGHT   = (190, 190, 195, 255)
METAL_MID     = (140, 140, 148, 255)
METAL_DARK    = (80, 80, 90, 255)
METAL_SHADOW  = (50, 50, 58, 255)
WOOD_MID      = (120, 78, 42, 255)
WOOD_DARK     = (80, 48, 20, 255)
BANDAGE_WHITE = (232, 220, 200, 255)
PURE_WHITE    = (255, 255, 255, 255)


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


def create_icon_parts():
    """Skiftnyckel -- tydlig 16x16 med U-klo och skaft"""
    img = new_img(16)

    # Skiftnyckel-design: vertikal, tydligare
    # Klo uppe (U-form, oppnar uppat)
    #
    #   ##  ##    <- topparna av U
    #   ##  ##
    #   ######    <- botten av U-klon
    #    ####     <- skaft borjar
    #    ####
    #    ####
    #    ####
    #    ####
    #    ####     <- skaft slutar
    #    ##       <- nyckelande (rund)
    #    ##

    # Skaft (mitten, vertikalt)
    rect(img, 6, 5, 4, 9, METAL_MID)
    # Highlight pa skaft vanster
    vline(img, 6, 5, 9, METAL_LIGHT)
    # Skugga pa skaft hoger
    vline(img, 9, 5, 9, METAL_SHADOW)

    # Klo (U-form, oppnar uppat)
    # Vanster ben av U
    rect(img, 3, 1, 3, 5, METAL_MID)
    vline(img, 3, 1, 5, METAL_LIGHT)
    vline(img, 5, 1, 5, METAL_SHADOW)
    # Hoger ben av U
    rect(img, 10, 1, 3, 5, METAL_MID)
    vline(img, 10, 1, 5, METAL_LIGHT)
    vline(img, 12, 1, 5, METAL_SHADOW)
    # Botten pa U (kopplar ihop benen)
    rect(img, 3, 5, 10, 2, METAL_MID)
    hline(img, 3, 5, 10, METAL_LIGHT)
    hline(img, 3, 6, 10, METAL_SHADOW)

    # Oppning i U-klon (transparent mitt)
    rect(img, 6, 1, 4, 4, TRANSPARENT)

    # Nyckelande (oval, nedre)
    rect(img, 5, 14, 6, 2, METAL_MID)
    hline(img, 5, 14, 6, METAL_LIGHT)
    hline(img, 5, 15, 6, METAL_SHADOW)
    px(img, 5, 13, METAL_MID)
    px(img, 10, 13, METAL_MID)
    px(img, 6, 13, METAL_LIGHT)

    save_icon(img, "icon_parts")


def create_icon_refugees():
    """Person-silhuett ovanifrAN -- tydlig kropp och huvud"""
    img = new_img(24)

    # Farger
    SKIN         = (210, 170, 130, 255)
    SKIN_SHADOW  = (175, 135, 100, 255)
    HAIR         = (100, 70, 40, 255)
    SHIRT        = (100, 130, 160, 255)   # blaktig skjorta
    SHIRT_SHADOW = (70, 100, 130, 255)
    PANTS        = (80, 80, 100, 255)
    PANTS_SHADOW = (55, 55, 75, 255)
    SHOE         = (60, 45, 35, 255)

    # ---- Huvud (cirkel, overst, skin-farg) ----
    head_pixels = [
        (10,2),(11,2),(12,2),(13,2),
        (9,3),(10,3),(11,3),(12,3),(13,3),(14,3),
        (9,4),(10,4),(11,4),(12,4),(13,4),(14,4),
        (9,5),(10,5),(11,5),(12,5),(13,5),(14,5),
        (10,6),(11,6),(12,6),(13,6),
    ]
    for hx, hy in head_pixels:
        img.putpixel((hx, hy), SKIN)

    # Har (overst pa huvu)
    hline(img, 10, 2, 4, HAIR)
    hline(img, 9, 3, 2, HAIR)
    hline(img, 13, 3, 2, HAIR)

    # Ansikte highlight
    px(img, 11, 4, SKIN_SHADOW)
    px(img, 12, 4, SKIN_SHADOW)

    # Skugga pa hogersida av huvud
    vline(img, 14, 3, 3, SKIN_SHADOW)

    # ---- Kropp (skjorta) ----
    body = [
        (9,7),(10,7),(11,7),(12,7),(13,7),(14,7),
        (8,8),(9,8),(10,8),(11,8),(12,8),(13,8),(14,8),(15,8),
        (8,9),(9,9),(10,9),(11,9),(12,9),(13,9),(14,9),(15,9),
        (8,10),(9,10),(10,10),(11,10),(12,10),(13,10),(14,10),(15,10),
        (8,11),(9,11),(10,11),(11,11),(12,11),(13,11),(14,11),(15,11),
        (9,12),(10,12),(11,12),(12,12),(13,12),(14,12),
    ]
    for bx, by in body:
        img.putpixel((bx, by), SHIRT)
    # Skugga pa vanster axel
    for bx in [8, 9]:
        for by in range(8, 12):
            px(img, bx, by, SHIRT_SHADOW)
    # Highlight pa hogra sida
    for bx in [14, 15]:
        for by in range(8, 10):
            px(img, bx, by, (130, 165, 200, 255))

    # Liten detalj: knappar pa skjortan
    px(img, 11, 8, (80, 110, 145, 255))
    px(img, 11, 10, (80, 110, 145, 255))

    # ---- Armar ----
    ARM = SHIRT
    ARM_SHADOW = SHIRT_SHADOW
    # Vanster arm (ut till vanster)
    rect(img, 5, 8, 3, 3, ARM)
    px(img, 5, 8, ARM_SHADOW)
    px(img, 5, 9, ARM_SHADOW)
    # Hand vanster
    rect(img, 4, 10, 2, 2, SKIN)
    # Hoger arm
    rect(img, 16, 8, 3, 3, ARM)
    px(img, 18, 8, ARM_SHADOW)
    # Hand hoger
    rect(img, 18, 10, 2, 2, SKIN)

    # ---- Ben ----
    # Vanster ben
    rect(img, 9, 13, 3, 5, PANTS)
    px(img, 9, 13, PANTS_SHADOW)
    # Hoger ben
    rect(img, 12, 13, 3, 5, PANTS)
    px(img, 14, 13, PANTS_SHADOW)
    # Skar i mitten (separation)
    vline(img, 11, 13, 4, PANTS_SHADOW)

    # Skor
    rect(img, 9, 18, 3, 2, SHOE)
    rect(img, 12, 18, 3, 2, SHOE)
    # Sko-topp (lite bredare)
    px(img, 8, 18, SHOE)
    px(img, 15, 18, SHOE)

    save_icon(img, "icon_refugees")


if __name__ == "__main__":
    print("Fixar icon_parts och icon_refugees...")
    create_icon_parts()
    create_icon_refugees()
    print("Klart!")

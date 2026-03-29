"""
Dead Horizon -- Character sprite generator
Creates all missing character sprites and animations.
Colors from art-direction.md -- exact palette required.
"""

from PIL import Image, ImageDraw
import os

OUTPUT_DIR = "assets/sprites"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Color palette (exact from art-direction.md and sprite-roadmap.md)
TRANSPARENT = (0, 0, 0, 0)

# Player colors
P_BODY   = (62, 90, 52, 255)    # #3E5A34 jacket
P_DARK   = (40, 60, 34, 255)    # darker jacket shadow
P_BAND   = (178, 34, 34, 255)   # #B22222 bandana
P_PACK   = (92, 64, 51, 255)    # #5C4033 backpack
P_SKIN   = (232, 220, 200, 255) # #E8DCC8 skin
P_PANTS  = (55, 45, 35, 255)    # dark pants
P_BOOT   = (40, 30, 20, 255)    # boots
P_GUN    = (30, 30, 30, 255)    # weapon dark
P_GUN2   = (60, 60, 60, 255)    # weapon light
P_BLOOD  = (100, 20, 15, 255)   # blood

# Walker colors
W_SKIN   = (110, 100, 80, 255)  # #6E6450
W_DARK   = (80, 72, 58, 255)    # darker skin
W_CLOTH  = (70, 65, 55, 255)    # #464137 clothes
W_DARK2  = (50, 46, 38, 255)    # darker clothes
W_BLOOD  = (100, 20, 15, 255)   # #64140F blood
W_EYE    = (180, 20, 20, 255)   # red eye glow

# Runner colors
R_SKIN   = (120, 110, 65, 255)  # #786E41
R_DARK   = (90, 82, 48, 255)    # darker
R_RAGS   = (55, 50, 40, 255)    # #373228 rags
R_DARK2  = (38, 34, 28, 255)    # darker rags
R_EYE    = (200, 30, 10, 255)

# Brute colors
B_SKIN   = (80, 75, 65, 255)    # #504B41
B_DARK   = (55, 52, 44, 255)    # darker
B_ARMOR  = (85, 76, 72, 255)    # #554C48
B_DARK2  = (60, 54, 50, 255)    # darker armor
B_EYE    = (180, 40, 32, 255)   # #B42820

# Spitter colors (green tint, walker-based)
SP_SKIN  = (80, 110, 60, 255)   # green tinted skin
SP_DARK  = (55, 80, 42, 255)
SP_CLOTH = (50, 80, 45, 255)    # green clothes
SP_DARK2 = (36, 58, 32, 255)
SP_DROOL = (68, 255, 68, 255)   # #44FF44 bright green drool
SP_EYE   = (20, 200, 20, 255)

# Screamer colors (purple tint)
SC_SKIN  = (100, 70, 110, 255)  # purple tinted
SC_DARK  = (72, 50, 80, 255)
SC_CLOTH = (80, 55, 100, 255)
SC_DARK2 = (58, 38, 72, 255)
SC_MOUTH = (200, 10, 10, 255)   # open mouth red
SC_EYE   = (170, 68, 255, 255)  # #AA44FF


def save(img: Image.Image, name: str) -> None:
    path = os.path.join(OUTPUT_DIR, name)
    img.save(path)
    print(f"  Saved: {path}")


def save_preview(img: Image.Image, name: str) -> None:
    w, h = img.size
    preview = img.resize((w * 8, h * 8), Image.NEAREST)
    base = name.replace(".png", "_preview.png")
    path = os.path.join(OUTPUT_DIR, base)
    preview.save(path)
    print(f"  Preview: {path}")


def px(draw: ImageDraw.Draw, x: int, y: int, color: tuple) -> None:
    draw.point((x, y), fill=color)


def rect(draw: ImageDraw.Draw, x: int, y: int, w: int, h: int, color: tuple) -> None:
    draw.rectangle([x, y, x + w - 1, y + h - 1], fill=color)


# ---------------------------------------------------------------------------
# PLAYER sprites
# ---------------------------------------------------------------------------

def draw_player_base(draw: ImageDraw.Draw, ox: int = 0, oy: int = 0,
                     leg_l: int = 0, leg_r: int = 0,
                     arm_l: int = 0, arm_r: int = 0,
                     body_bob: int = 0) -> None:
    """Draw a top-down player character with offsets for animation."""
    b = body_bob
    # Backpack (behind body)
    rect(draw, ox+11, oy+16+b, 10, 9, P_PACK)
    px(draw, ox+11, oy+16+b, P_DARK)
    px(draw, ox+20, oy+16+b, P_DARK)

    # Body / jacket
    rect(draw, ox+10, oy+12+b, 12, 11, P_BODY)
    # Jacket detail -- collar / shadow
    px(draw, ox+10, oy+12+b, P_DARK)
    px(draw, ox+21, oy+12+b, P_DARK)
    px(draw, ox+10, oy+22+b, P_DARK)
    px(draw, ox+21, oy+22+b, P_DARK)

    # Head
    rect(draw, ox+11, oy+6+b, 10, 7, P_SKIN)
    # Bandana / hat
    rect(draw, ox+11, oy+6+b, 10, 3, P_BAND)
    # Face detail
    px(draw, ox+13, oy+10+b, P_DARK)  # left eye
    px(draw, ox+18, oy+10+b, P_DARK)  # right eye

    # Left leg
    rect(draw, ox+11, oy+23+b, 4, 5, P_PANTS)
    rect(draw, ox+11, oy+27+b+leg_l, 4, 2, P_BOOT)
    # Right leg
    rect(draw, ox+17, oy+23+b, 4, 5, P_PANTS)
    rect(draw, ox+17, oy+27+b+leg_r, 4, 2, P_BOOT)

    # Left arm
    rect(draw, ox+7, oy+13+b+arm_l, 3, 6, P_BODY)
    # Right arm (weapon side)
    rect(draw, ox+22, oy+13+b+arm_r, 3, 6, P_BODY)
    # Weapon (rifle) -- right side
    rect(draw, ox+24, oy+12+b+arm_r, 3, 10, P_GUN)
    px(draw, ox+25, oy+11+b+arm_r, P_GUN2)
    px(draw, ox+25, oy+21+b+arm_r, P_GUN2)


def make_player_attack() -> None:
    """3-frame attack animation: wind-up, strike, recover."""
    sheet = Image.new("RGBA", (96, 32), TRANSPARENT)
    frames = [
        # frame 0: wind-up -- arm pulled back
        {"arm_r": -2, "arm_l": 1, "body_bob": 0},
        # frame 1: strike -- arm forward + gun extended
        {"arm_r": 2, "arm_l": -1, "body_bob": -1},
        # frame 2: recover
        {"arm_r": 0, "arm_l": 0, "body_bob": 0},
    ]
    for i, f in enumerate(frames):
        frame = Image.new("RGBA", (32, 32), TRANSPARENT)
        d = ImageDraw.Draw(frame)
        draw_player_base(d, 0, 0,
                         arm_r=f["arm_r"], arm_l=f["arm_l"],
                         body_bob=f["body_bob"])
        # Muzzle flash on frame 1
        if i == 1:
            rect(d, 27, 11, 4, 3, (255, 220, 80, 200))
        sheet.paste(frame, (i * 32, 0))
    save(sheet, "player_attack.png")
    save_preview(sheet, "player_attack.png")


def make_player_death() -> None:
    """4-frame death animation: stagger, fall, sprawl, still."""
    sheet = Image.new("RGBA", (128, 32), TRANSPARENT)

    # Frame 0: stagger -- body tilted, still upright
    f0 = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(f0)
    draw_player_base(d, 0, 2, leg_l=1, leg_r=-1, arm_l=2, arm_r=-2)
    # Blood splatter
    px(d, 15, 20, P_BLOOD)
    sheet.paste(f0, (0, 0))

    # Frame 1: falling -- leaning sideways
    f1 = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(f1)
    # Body horizontal, falling left
    rect(d, 6, 14, 11, 9, P_BODY)   # torso sideways
    rect(d, 4, 12, 7, 7, P_SKIN)    # head sideways
    rect(d, 4, 12, 7, 3, P_BAND)
    rect(d, 5, 18, 10, 4, P_PANTS)
    rect(d, 3, 18, 3, 4, P_BOOT)
    rect(d, 6, 22, 10, 3, P_PACK)
    px(d, 7, 15, P_BLOOD)
    px(d, 12, 15, P_BLOOD)
    sheet.paste(f1, (32, 0))

    # Frame 2: sprawl -- mostly horizontal, on ground
    f2 = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(f2)
    rect(d, 3, 17, 14, 7, P_BODY)   # torso flat
    rect(d, 2, 16, 7, 6, P_SKIN)    # head flat
    rect(d, 2, 16, 7, 2, P_BAND)
    rect(d, 17, 18, 10, 3, P_PANTS)
    rect(d, 25, 18, 4, 3, P_BOOT)
    rect(d, 3, 23, 13, 3, P_PACK)
    rect(d, 5, 19, 8, 3, P_BLOOD)   # blood pool forming
    sheet.paste(f2, (64, 0))

    # Frame 3: still -- fully flat, blood pool
    f3 = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(f3)
    rect(d, 3, 17, 14, 7, P_BODY)
    rect(d, 2, 16, 7, 6, P_SKIN)
    rect(d, 2, 16, 7, 2, P_BAND)
    rect(d, 17, 18, 10, 3, P_PANTS)
    rect(d, 25, 18, 4, 3, P_BOOT)
    rect(d, 3, 23, 13, 3, P_PACK)
    rect(d, 3, 18, 14, 6, P_BLOOD)  # larger blood pool
    px(d, 1, 21, P_BLOOD)
    px(d, 18, 24, P_BLOOD)
    sheet.paste(f3, (96, 0))

    save(sheet, "player_death.png")
    save_preview(sheet, "player_death.png")


# ---------------------------------------------------------------------------
# WALKER sprites
# ---------------------------------------------------------------------------

def draw_walker_base(draw: ImageDraw.Draw, ox: int = 0, oy: int = 0,
                     leg_l: int = 0, leg_r: int = 0,
                     arm_l: int = 0, arm_r: int = 0,
                     body_bob: int = 0) -> None:
    """Top-down walker zombie."""
    b = body_bob
    # Body
    rect(draw, ox+10, oy+11+b, 12, 12, W_CLOTH)
    px(draw, ox+10, oy+11+b, W_DARK2)
    px(draw, ox+21, oy+11+b, W_DARK2)
    px(draw, ox+10, oy+22+b, W_DARK2)
    px(draw, ox+21, oy+22+b, W_DARK2)
    # Blood stains on clothes
    px(draw, ox+13, oy+15+b, W_BLOOD)
    px(draw, ox+17, oy+18+b, W_BLOOD)

    # Head
    rect(draw, ox+11, oy+5+b, 10, 7, W_SKIN)
    px(draw, ox+11, oy+5+b, W_DARK)
    px(draw, ox+20, oy+5+b, W_DARK)
    # Eyes (red glow)
    px(draw, ox+13, oy+8+b, W_EYE)
    px(draw, ox+18, oy+8+b, W_EYE)
    # Mouth (open, dark)
    rect(draw, ox+13, oy+10+b, 6, 2, W_DARK2)

    # Arms (outstretched, walker style)
    rect(draw, ox+6, oy+13+b+arm_l, 4, 5, W_SKIN)
    rect(draw, ox+22, oy+13+b+arm_r, 4, 5, W_SKIN)

    # Legs
    rect(draw, ox+11, oy+23+b, 4, 6, W_CLOTH)
    rect(draw, ox+11, oy+28+b+leg_l, 4, 2, W_DARK2)
    rect(draw, ox+17, oy+23+b, 4, 6, W_CLOTH)
    rect(draw, ox+17, oy+28+b+leg_r, 4, 2, W_DARK2)


def make_walker_attack() -> None:
    """3-frame attack: lunge forward, grab, pull back."""
    sheet = Image.new("RGBA", (96, 32), TRANSPARENT)
    frames = [
        {"arm_l": -2, "arm_r": -2, "body_bob": 0},   # wind up arms high
        {"arm_l": 3, "arm_r": 3, "body_bob": -2},     # lunge/grab
        {"arm_l": 0, "arm_r": 0, "body_bob": 0},      # recover
    ]
    for i, f in enumerate(frames):
        frame = Image.new("RGBA", (32, 32), TRANSPARENT)
        d = ImageDraw.Draw(frame)
        draw_walker_base(d, 0, 0,
                         arm_l=f["arm_l"], arm_r=f["arm_r"],
                         body_bob=f["body_bob"])
        sheet.paste(frame, (i * 32, 0))
    save(sheet, "walker_attack.png")
    save_preview(sheet, "walker_attack.png")


def make_walker_death() -> None:
    """4-frame death."""
    sheet = Image.new("RGBA", (128, 32), TRANSPARENT)

    # Frame 0: stagger
    f0 = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(f0)
    draw_walker_base(d, 0, 1, leg_l=1, leg_r=-1, arm_l=-2, arm_r=2)
    px(d, 16, 15, W_BLOOD)
    sheet.paste(f0, (0, 0))

    # Frame 1: falling
    f1 = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(f1)
    rect(d, 5, 14, 12, 9, W_CLOTH)
    rect(d, 3, 13, 7, 6, W_SKIN)
    px(d, 4, 14, W_EYE)
    px(d, 8, 14, W_EYE)
    rect(d, 17, 16, 9, 4, W_CLOTH)
    px(d, 9, 17, W_BLOOD)
    sheet.paste(f1, (32, 0))

    # Frame 2: sprawl
    f2 = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(f2)
    rect(d, 3, 16, 15, 7, W_CLOTH)
    rect(d, 2, 15, 6, 6, W_SKIN)
    rect(d, 18, 18, 10, 3, W_CLOTH)
    rect(d, 4, 19, 10, 4, W_BLOOD)
    sheet.paste(f2, (64, 0))

    # Frame 3: still, blood pool
    f3 = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(f3)
    rect(d, 3, 16, 15, 7, W_CLOTH)
    rect(d, 2, 15, 6, 6, W_SKIN)
    rect(d, 18, 18, 10, 3, W_CLOTH)
    rect(d, 2, 16, 18, 8, W_BLOOD)
    px(d, 1, 20, W_BLOOD)
    px(d, 21, 23, W_BLOOD)
    sheet.paste(f3, (96, 0))

    save(sheet, "walker_death.png")
    save_preview(sheet, "walker_death.png")


# ---------------------------------------------------------------------------
# RUNNER sprites
# ---------------------------------------------------------------------------

def draw_runner_base(draw: ImageDraw.Draw, ox: int = 0, oy: int = 0,
                     leg_l: int = 0, leg_r: int = 0,
                     arm_l: int = 0, arm_r: int = 0,
                     body_bob: int = 0,
                     lean: int = 0) -> None:
    """Top-down runner zombie -- lean/thin, crouched forward."""
    b = body_bob
    # Thin body (narrower than walker)
    rect(draw, ox+11, oy+12+b, 10, 10, R_RAGS)
    px(draw, ox+11, oy+12+b, R_DARK2)
    px(draw, ox+20, oy+12+b, R_DARK2)
    # Ripped cloth detail
    px(draw, ox+12, oy+18+b, R_DARK2)
    px(draw, ox+19, oy+16+b, R_DARK2)

    # Head -- slightly forward lean
    rect(draw, ox+12, oy+5+b+lean, 8, 7, R_SKIN)
    px(draw, ox+12, oy+5+b+lean, R_DARK)
    px(draw, ox+19, oy+5+b+lean, R_DARK)
    # Wild eyes
    px(draw, ox+13, oy+8+b+lean, R_EYE)
    px(draw, ox+17, oy+8+b+lean, R_EYE)
    # Open mouth
    rect(draw, ox+13, oy+10+b+lean, 6, 2, R_DARK2)

    # Arms -- more splayed out (aggressive)
    rect(draw, ox+7, oy+13+b+arm_l, 4, 4, R_SKIN)
    rect(draw, ox+21, oy+13+b+arm_r, 4, 4, R_SKIN)

    # Legs -- longer stride
    rect(draw, ox+12, oy+22+b, 3, 7, R_RAGS)
    rect(draw, ox+12, oy+28+b+leg_l, 3, 2, R_DARK2)
    rect(draw, ox+17, oy+22+b, 3, 7, R_RAGS)
    rect(draw, ox+17, oy+28+b+leg_r, 3, 2, R_DARK2)


def make_runner_walk() -> None:
    """4-frame fast run animation."""
    sheet = Image.new("RGBA", (128, 32), TRANSPARENT)
    frames = [
        {"leg_l": -2, "leg_r": 2, "arm_l": 1, "arm_r": -1, "body_bob": 0, "lean": -1},
        {"leg_l": 0, "leg_r": 0, "arm_l": 0, "arm_r": 0, "body_bob": -1, "lean": 0},
        {"leg_l": 2, "leg_r": -2, "arm_l": -1, "arm_r": 1, "body_bob": 0, "lean": -1},
        {"leg_l": 0, "leg_r": 0, "arm_l": 0, "arm_r": 0, "body_bob": -1, "lean": 0},
    ]
    for i, f in enumerate(frames):
        frame = Image.new("RGBA", (32, 32), TRANSPARENT)
        d = ImageDraw.Draw(frame)
        draw_runner_base(d, 0, 0, **f)
        sheet.paste(frame, (i * 32, 0))
    save(sheet, "runner_walk.png")
    save_preview(sheet, "runner_walk.png")


def make_runner_death() -> None:
    """4-frame death."""
    sheet = Image.new("RGBA", (128, 32), TRANSPARENT)

    f0 = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(f0)
    draw_runner_base(d, 0, 1, leg_l=2, leg_r=-1, arm_l=3, arm_r=-3, body_bob=0)
    px(d, 16, 14, W_BLOOD)
    sheet.paste(f0, (0, 0))

    f1 = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(f1)
    rect(d, 6, 13, 11, 8, R_RAGS)
    rect(d, 4, 12, 6, 5, R_SKIN)
    px(d, 5, 13, R_EYE)
    px(d, 8, 13, R_EYE)
    rect(d, 17, 15, 9, 4, R_RAGS)
    px(d, 10, 16, W_BLOOD)
    sheet.paste(f1, (32, 0))

    f2 = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(f2)
    rect(d, 3, 17, 14, 6, R_RAGS)
    rect(d, 2, 16, 5, 5, R_SKIN)
    rect(d, 17, 18, 10, 3, R_RAGS)
    rect(d, 4, 18, 10, 4, W_BLOOD)
    sheet.paste(f2, (64, 0))

    f3 = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(f3)
    rect(d, 3, 17, 14, 6, R_RAGS)
    rect(d, 2, 16, 5, 5, R_SKIN)
    rect(d, 17, 18, 10, 3, R_RAGS)
    rect(d, 2, 16, 18, 8, W_BLOOD)
    px(d, 1, 20, W_BLOOD)
    sheet.paste(f3, (96, 0))

    save(sheet, "runner_death.png")
    save_preview(sheet, "runner_death.png")


# ---------------------------------------------------------------------------
# BRUTE sprites (48x48)
# ---------------------------------------------------------------------------

def draw_brute_base(draw: ImageDraw.Draw, ox: int = 0, oy: int = 0,
                    leg_l: int = 0, leg_r: int = 0,
                    arm_l: int = 0, arm_r: int = 0,
                    body_bob: int = 0) -> None:
    """Top-down brute zombie -- large 48x48, heavy armor."""
    b = body_bob
    # Massive body with armor plates
    rect(draw, ox+12, oy+14+b, 24, 16, B_SKIN)
    rect(draw, ox+12, oy+14+b, 24, 8, B_ARMOR)   # chest armor
    px(draw, ox+12, oy+14+b, B_DARK2)
    px(draw, ox+35, oy+14+b, B_DARK2)
    px(draw, ox+12, oy+29+b, B_DARK2)
    px(draw, ox+35, oy+29+b, B_DARK2)
    # Armor details -- rivets
    px(draw, ox+14, oy+16+b, B_DARK2)
    px(draw, ox+33, oy+16+b, B_DARK2)
    px(draw, ox+14, oy+20+b, B_DARK2)
    px(draw, ox+33, oy+20+b, B_DARK2)

    # Large head
    rect(draw, ox+14, oy+6+b, 20, 9, B_SKIN)
    px(draw, ox+14, oy+6+b, B_DARK)
    px(draw, ox+33, oy+6+b, B_DARK)
    # Glowing eyes
    rect(draw, ox+17, oy+10+b, 4, 3, B_EYE)
    rect(draw, ox+27, oy+10+b, 4, 3, B_EYE)
    # Snarl / mouth
    rect(draw, ox+18, oy+13+b, 12, 2, B_DARK2)

    # Thick arms
    rect(draw, ox+5, oy+15+b+arm_l, 7, 9, B_SKIN)
    rect(draw, ox+5, oy+15+b+arm_l, 7, 4, B_ARMOR)  # armor on shoulder
    rect(draw, ox+36, oy+15+b+arm_r, 7, 9, B_SKIN)
    rect(draw, ox+36, oy+15+b+arm_r, 7, 4, B_ARMOR)

    # Heavy legs
    rect(draw, ox+13, oy+30+b, 8, 10, B_SKIN)
    rect(draw, ox+13, oy+38+b+leg_l, 8, 4, B_ARMOR)
    rect(draw, ox+27, oy+30+b, 8, 10, B_SKIN)
    rect(draw, ox+27, oy+38+b+leg_r, 8, 4, B_ARMOR)


def make_brute_walk() -> None:
    """4-frame heavy walk animation (192x48)."""
    sheet = Image.new("RGBA", (192, 48), TRANSPARENT)
    frames = [
        {"leg_l": -1, "leg_r": 1, "arm_l": 0, "arm_r": 0, "body_bob": 0},
        {"leg_l": 0, "leg_r": 0, "arm_l": 0, "arm_r": 0, "body_bob": -1},
        {"leg_l": 1, "leg_r": -1, "arm_l": 0, "arm_r": 0, "body_bob": 0},
        {"leg_l": 0, "leg_r": 0, "arm_l": 0, "arm_r": 0, "body_bob": -1},
    ]
    for i, f in enumerate(frames):
        frame = Image.new("RGBA", (48, 48), TRANSPARENT)
        d = ImageDraw.Draw(frame)
        draw_brute_base(d, 0, 0, **f)
        sheet.paste(frame, (i * 48, 0))
    save(sheet, "brute_walk.png")
    save_preview(sheet, "brute_walk.png")


def make_brute_death() -> None:
    """4-frame death animation (192x48)."""
    sheet = Image.new("RGBA", (192, 48), TRANSPARENT)

    f0 = Image.new("RGBA", (48, 48), TRANSPARENT)
    d = ImageDraw.Draw(f0)
    draw_brute_base(d, 0, 1, leg_l=1, leg_r=-1, arm_l=2, arm_r=-2)
    px(d, 24, 20, W_BLOOD)
    sheet.paste(f0, (0, 0))

    f1 = Image.new("RGBA", (48, 48), TRANSPARENT)
    d = ImageDraw.Draw(f1)
    # Tipping sideways
    rect(d, 8, 16, 22, 16, B_SKIN)
    rect(d, 8, 16, 22, 8, B_ARMOR)
    rect(d, 5, 14, 14, 10, B_SKIN)  # head sideways
    rect(d, 30, 20, 14, 8, B_SKIN)  # legs
    px(d, 7, 17, B_EYE)
    px(d, 7, 20, B_EYE)
    rect(d, 10, 24, 14, 4, W_BLOOD)
    sheet.paste(f1, (48, 0))

    f2 = Image.new("RGBA", (48, 48), TRANSPARENT)
    d = ImageDraw.Draw(f2)
    # Mostly down
    rect(d, 4, 22, 28, 14, B_SKIN)
    rect(d, 4, 22, 28, 6, B_ARMOR)
    rect(d, 2, 20, 10, 9, B_SKIN)
    rect(d, 32, 24, 12, 6, B_SKIN)
    rect(d, 5, 24, 22, 8, W_BLOOD)
    sheet.paste(f2, (96, 0))

    f3 = Image.new("RGBA", (48, 48), TRANSPARENT)
    d = ImageDraw.Draw(f3)
    rect(d, 4, 22, 28, 14, B_SKIN)
    rect(d, 4, 22, 28, 6, B_ARMOR)
    rect(d, 2, 20, 10, 9, B_SKIN)
    rect(d, 32, 24, 12, 6, B_SKIN)
    rect(d, 2, 20, 36, 14, W_BLOOD)  # large blood pool
    px(d, 1, 30, W_BLOOD)
    px(d, 40, 32, W_BLOOD)
    sheet.paste(f3, (144, 0))

    save(sheet, "brute_death.png")
    save_preview(sheet, "brute_death.png")


# ---------------------------------------------------------------------------
# SPITTER sprites (green walker variant)
# ---------------------------------------------------------------------------

def draw_spitter_base(draw: ImageDraw.Draw, ox: int = 0, oy: int = 0,
                      arm_l: int = 0, arm_r: int = 0,
                      body_bob: int = 0,
                      drool: bool = False) -> None:
    """Walker-based spitter with green tint and drool."""
    b = body_bob
    # Body
    rect(draw, ox+10, oy+11+b, 12, 12, SP_CLOTH)
    px(draw, ox+10, oy+11+b, SP_DARK2)
    px(draw, ox+21, oy+11+b, SP_DARK2)
    px(draw, ox+10, oy+22+b, SP_DARK2)
    px(draw, ox+21, oy+22+b, SP_DARK2)
    # Green ooze on body
    px(draw, ox+13, oy+15+b, SP_DROOL)
    px(draw, ox+17, oy+18+b, SP_DROOL)

    # Head
    rect(draw, ox+11, oy+5+b, 10, 7, SP_SKIN)
    px(draw, ox+11, oy+5+b, SP_DARK)
    px(draw, ox+20, oy+5+b, SP_DARK)
    # Green eyes
    px(draw, ox+13, oy+8+b, SP_EYE)
    px(draw, ox+18, oy+8+b, SP_EYE)
    # Mouth with drool
    rect(draw, ox+13, oy+10+b, 6, 2, SP_DARK2)
    if drool:
        px(draw, ox+15, oy+12+b, SP_DROOL)
        px(draw, ox+16, oy+13+b, SP_DROOL)
        px(draw, ox+17, oy+12+b, SP_DROOL)

    # Arms
    rect(draw, ox+6, oy+13+b+arm_l, 4, 5, SP_SKIN)
    rect(draw, ox+22, oy+13+b+arm_r, 4, 5, SP_SKIN)

    # Legs
    rect(draw, ox+11, oy+23+b, 4, 6, SP_CLOTH)
    rect(draw, ox+11, oy+28+b, 4, 2, SP_DARK2)
    rect(draw, ox+17, oy+23+b, 4, 6, SP_CLOTH)
    rect(draw, ox+17, oy+28+b, 4, 2, SP_DARK2)


def make_spitter_static() -> None:
    img = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(img)
    draw_spitter_base(d, 0, 0, drool=True)
    save(img, "spitter.png")
    save_preview(img, "spitter.png")


def make_spitter_attack() -> None:
    """3-frame spit attack."""
    sheet = Image.new("RGBA", (96, 32), TRANSPARENT)
    configs = [
        # wind up -- head back
        {"arm_l": -1, "arm_r": -1, "body_bob": 1, "drool": False},
        # spit -- head forward, projectile
        {"arm_l": 0, "arm_r": 0, "body_bob": -2, "drool": True},
        # recover
        {"arm_l": 0, "arm_r": 0, "body_bob": 0, "drool": True},
    ]
    for i, c in enumerate(configs):
        frame = Image.new("RGBA", (32, 32), TRANSPARENT)
        d = ImageDraw.Draw(frame)
        draw_spitter_base(d, 0, 0, **c)
        # Draw projectile on spit frame
        if i == 1:
            rect(d, 22, 8, 6, 3, SP_DROOL)
            px(d, 28, 9, (68, 255, 68, 180))  # fading edge
        sheet.paste(frame, (i * 32, 0))
    save(sheet, "spitter_attack.png")
    save_preview(sheet, "spitter_attack.png")


# ---------------------------------------------------------------------------
# SCREAMER sprites (purple tint)
# ---------------------------------------------------------------------------

def draw_screamer_base(draw: ImageDraw.Draw, ox: int = 0, oy: int = 0,
                       arm_l: int = 0, arm_r: int = 0,
                       body_bob: int = 0,
                       mouth_open: int = 2) -> None:
    """Walker-based screamer with purple tint and wide open mouth."""
    b = body_bob
    # Body
    rect(draw, ox+10, oy+11+b, 12, 12, SC_CLOTH)
    px(draw, ox+10, oy+11+b, SC_DARK2)
    px(draw, ox+21, oy+11+b, SC_DARK2)
    px(draw, ox+10, oy+22+b, SC_DARK2)
    px(draw, ox+21, oy+22+b, SC_DARK2)

    # Head
    rect(draw, ox+11, oy+5+b, 10, 7, SC_SKIN)
    px(draw, ox+11, oy+5+b, SC_DARK)
    px(draw, ox+20, oy+5+b, SC_DARK)
    # Purple eyes (wide)
    rect(draw, ox+12, oy+7+b, 3, 3, SC_EYE)
    rect(draw, ox+17, oy+7+b, 3, 3, SC_EYE)
    # Wide open screaming mouth
    rect(draw, ox+12, oy+10+b, 8, mouth_open, SC_MOUTH)
    if mouth_open >= 3:
        # Inner mouth detail
        px(draw, ox+14, oy+11+b, (80, 0, 0, 255))
        px(draw, ox+17, oy+11+b, (80, 0, 0, 255))

    # Arms (spread wide -- screaming pose)
    rect(draw, ox+5, oy+12+b+arm_l, 5, 5, SC_SKIN)
    rect(draw, ox+22, oy+12+b+arm_r, 5, 5, SC_SKIN)

    # Legs
    rect(draw, ox+11, oy+23+b, 4, 6, SC_CLOTH)
    rect(draw, ox+11, oy+28+b, 4, 2, SC_DARK2)
    rect(draw, ox+17, oy+23+b, 4, 6, SC_CLOTH)
    rect(draw, ox+17, oy+28+b, 4, 2, SC_DARK2)


def make_screamer_static() -> None:
    img = Image.new("RGBA", (32, 32), TRANSPARENT)
    d = ImageDraw.Draw(img)
    draw_screamer_base(d, 0, 0, mouth_open=2)
    save(img, "screamer.png")
    save_preview(img, "screamer.png")


def make_screamer_scream() -> None:
    """3-frame scream animation."""
    sheet = Image.new("RGBA", (96, 32), TRANSPARENT)
    configs = [
        # building up
        {"arm_l": -2, "arm_r": -2, "body_bob": 1, "mouth_open": 2},
        # full scream -- arms out, huge mouth
        {"arm_l": -3, "arm_r": -3, "body_bob": -2, "mouth_open": 4},
        # release
        {"arm_l": -1, "arm_r": -1, "body_bob": 0, "mouth_open": 3},
    ]
    for i, c in enumerate(configs):
        frame = Image.new("RGBA", (32, 32), TRANSPARENT)
        d = ImageDraw.Draw(frame)
        draw_screamer_base(d, 0, 0, **c)
        # Scream wave effect on peak frame
        if i == 1:
            for r in range(3):
                px(d, 15+r*2, 3, (170, 68, 255, 80))
                px(d, 14+r*2, 2, (170, 68, 255, 50))
        sheet.paste(frame, (i * 32, 0))
    save(sheet, "screamer_scream.png")
    save_preview(sheet, "screamer_scream.png")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Generating Dead Horizon character sprites...")

    print("\n--- Player ---")
    make_player_attack()
    make_player_death()

    print("\n--- Walker ---")
    make_walker_attack()
    make_walker_death()

    print("\n--- Runner ---")
    make_runner_walk()
    make_runner_death()

    print("\n--- Brute ---")
    make_brute_walk()
    make_brute_death()

    print("\n--- Spitter ---")
    make_spitter_static()
    make_spitter_attack()

    print("\n--- Screamer ---")
    make_screamer_static()
    make_screamer_scream()

    print("\nDone! All character sprites generated.")

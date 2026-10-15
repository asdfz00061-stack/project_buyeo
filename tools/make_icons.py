"""앱 아이콘 만들기 (부여 시간 탐정)

금동이(정령) 그림의 배경을 지우고 금빛 배경 위에 올려 홈 화면 아이콘을 만듭니다.
준비:  python -m pip install pillow
실행:  python tools/make_icons.py
"""

import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "images" / "characters" / "geumdongi_beast.png"
OUT = ROOT / "icons"
S = 1024  # 작업 크기 (마지막에 줄임)


def cutout(img: Image.Image) -> Image.Image:
    """가장자리와 이어진 단색 배경만 투명하게 (캐릭터 안쪽은 그대로)"""
    rgb = img.convert("RGB")
    marker = (255, 0, 255)
    for seed in [(0, 0), (rgb.width - 1, 0), (0, rgb.height - 1), (rgb.width - 1, rgb.height - 1)]:
        ImageDraw.floodfill(rgb, seed, marker, thresh=34)
    r, g, b = rgb.split()
    is_bg = ImageChops.multiply(
        ImageChops.multiply(r.point(lambda v: 255 if v == 255 else 0), g.point(lambda v: 255 if v == 0 else 0)),
        b.point(lambda v: 255 if v == 255 else 0),
    )
    alpha = ImageChops.invert(is_bg).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    out = img.convert("RGBA")
    out.putalpha(alpha)
    return out


def background(size: int) -> Image.Image:
    """중앙이 은은한 금빛, 가장자리는 게임의 짙은 갈색"""
    bg = Image.new("RGB", (size, size))
    px = bg.load()
    inner, outer = (122, 84, 32), (20, 15, 10)
    c = size / 2
    for y in range(size):
        for x in range(size):
            d = min(1.0, math.hypot(x - c, (y - c * 0.92)) / (size * 0.66))
            t = d ** 1.35
            px[x, y] = tuple(round(inner[i] * (1 - t) + outer[i] * t) for i in range(3))
    # 뒤에서 퍼지는 빛살
    rays = Image.new("L", (size, size), 0)
    dr = ImageDraw.Draw(rays)
    for k in range(18):
        a0 = math.radians(k * 20)
        a1 = a0 + math.radians(7)
        pts = [(c, c * 0.92)] + [(c + math.cos(a) * size, c * 0.92 + math.sin(a) * size) for a in (a0, a1)]
        dr.polygon(pts, fill=22)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([c - size * 0.5, c * 0.92 - size * 0.5, c + size * 0.5, c * 0.92 + size * 0.5], fill=255)
    rays = ImageChops.multiply(rays, mask.filter(ImageFilter.GaussianBlur(size * 0.12)))
    gold = Image.new("RGB", (size, size), (255, 214, 120))
    bg = Image.composite(gold, bg, rays.filter(ImageFilter.GaussianBlur(size * 0.006)))
    return bg


def compose(char: Image.Image, size: int, fill: float) -> Image.Image:
    """fill = 아이콘 높이 대비 캐릭터 높이 (maskable 은 안전 영역 때문에 작게)"""
    bg = background(size).convert("RGBA")
    bbox = char.getbbox()
    c = char.crop(bbox)
    h = round(size * fill)
    w = round(c.width * h / c.height)
    c = c.resize((w, h), Image.LANCZOS)
    # 은은한 후광
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gl = Image.new("L", (size, size), 0)
    x0, y0 = (size - w) // 2, round(size * 0.5 - h * 0.5)
    gl.paste(c.getchannel("A"), (x0, y0))
    gl = gl.filter(ImageFilter.GaussianBlur(size * 0.03)).point(lambda v: v * 0.55)
    glow.putalpha(gl)
    glow = Image.composite(Image.new("RGBA", (size, size), (255, 220, 140, 255)), glow, gl)
    bg.alpha_composite(Image.merge("RGBA", (*glow.split()[:3], gl)))
    bg.alpha_composite(c, (x0, y0))
    return bg


def main():
    OUT.mkdir(exist_ok=True)
    char = cutout(Image.open(SRC))
    full = compose(char, S, 0.82)  # 일반 아이콘 (iPad 등)
    safe = compose(char, S, 0.68)  # maskable (안드로이드가 동그랗게 잘라도 안전)
    for name, img, px in [
        ("icon-512.png", full, 512),
        ("icon-192.png", full, 192),
        ("apple-touch-icon.png", full, 180),
        ("icon-maskable-512.png", safe, 512),
        ("favicon-32.png", full, 32),
    ]:
        img.convert("RGB").resize((px, px), Image.LANCZOS).save(OUT / name, optimize=True)
    print("완료:", ", ".join(sorted(p.name for p in OUT.glob("*.png"))))


if __name__ == "__main__":
    main()

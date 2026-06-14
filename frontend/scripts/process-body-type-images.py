"""Remove solid backgrounds from body-type PNGs and crop to figure bounds."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "public" / "assets" / "onboarding"
FILES = ("body-ectomorph.png", "body-mesomorph.png", "body-endomorph.png")


def sample_background_colors(img: Image.Image, samples: int = 12) -> list[tuple[int, int, int]]:
    w, h = img.size
    points = [
        (0, 0),
        (w - 1, 0),
        (0, h - 1),
        (w - 1, h - 1),
        (w // 2, 0),
        (w // 2, h - 1),
        (0, h // 2),
        (w - 1, h // 2),
    ]
    rgb = img.convert("RGB")
    colors: list[tuple[int, int, int]] = []
    for x, y in points[:samples]:
        colors.append(rgb.getpixel((x, y)))
    return colors


def is_purple_backdrop(r: int, g: int, b: int) -> bool:
    if (r + g + b) / 3 > 150:
        return False
    if g > r * 0.72:
        return False
    return r >= 28 and b >= 18 and (r - g) >= 8


def flood_remove_background(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    pixels = rgba.load()

    bg_mask = [[False] * w for _ in range(h)]
    queue: deque[tuple[int, int]] = deque()

    def matches_bg(x: int, y: int) -> bool:
        r, g, b, _ = pixels[x, y]
        return is_purple_backdrop(r, g, b)

    for x in range(w):
        for y in (0, h - 1):
            if matches_bg(x, y):
                bg_mask[y][x] = True
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not bg_mask[y][x] and matches_bg(x, y):
                bg_mask[y][x] = True
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg_mask[ny][nx] and matches_bg(nx, ny):
                bg_mask[ny][nx] = True
                queue.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if bg_mask[y][x]:
                r, g, b, _ = pixels[x, y]
                pixels[x, y] = (r, g, b, 0)

    return rgba


def fill_internal_holes(img: Image.Image, passes: int = 8) -> Image.Image:
    """Fill transparent pixels fully enclosed by the figure."""
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size

    for _ in range(passes):
        changed = False
        snapshot = rgba.copy()
        snap = snapshot.load()
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                if snap[x, y][3] > 40:
                    continue
                neighbors = [snap[x - 1, y], snap[x + 1, y], snap[x, y - 1], snap[x, y + 1]]
                if not all(n[3] > 180 for n in neighbors):
                    continue
                r = sum(n[0] for n in neighbors) // 4
                g = sum(n[1] for n in neighbors) // 4
                b = sum(n[2] for n in neighbors) // 4
                pixels[x, y] = (r, g, b, 255)
                changed = True
        if not changed:
            break
    return rgba


def fill_holes(img: Image.Image, max_hole: int = 2500) -> Image.Image:
    """Fill tiny transparent islands inside the figure silhouette."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    alpha = rgba.split()[3]
    mask = alpha.point(lambda a: 255 if a > 20 else 0)
    filled = mask.copy()
    fp = filled.load()
    ap = alpha.load()

    for y in range(h):
        for x in range(w):
            if fp[x, y]:
                continue
            stack = [(x, y)]
            region: list[tuple[int, int]] = []
            touches_border = False
            while stack:
                cx, cy = stack.pop()
                if cx < 0 or cy < 0 or cx >= w or cy >= h or fp[cx, cy]:
                    continue
                fp[cx, cy] = 255
                region.append((cx, cy))
                if cx == 0 or cy == 0 or cx == w - 1 or cy == h - 1:
                    touches_border = True
                stack.extend(((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)))
            if not touches_border and len(region) <= max_hole:
                for cx, cy in region:
                    ap[cx, cy] = 255

    return Image.merge("RGBA", (*rgba.split()[:3], alpha))


def soften_edges(img: Image.Image, passes: int = 1) -> Image.Image:
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    for _ in range(passes):
        copy = rgba.copy()
        cp = copy.load()
        for y in range(h):
            for x in range(w):
                r, g, b, a = pixels[x, y]
                if a == 0:
                    continue
                neighbors = []
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        neighbors.append(cp[nx, ny][3])
                if neighbors and min(neighbors) < a:
                    fade = max(neighbors) / 255.0
                    pixels[x, y] = (r, g, b, int(a * (0.65 + 0.35 * fade)))
    return rgba


def heal_alpha(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    r, g, b, a = rgba.split()
    closed = a.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    return Image.merge("RGBA", (r, g, b, closed))


def crop_to_content(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        raise RuntimeError("No visible content after background removal")
    left, top, right, bottom = bbox
    pad_x = max(6, int((right - left) * 0.03))
    pad_y = max(6, int((bottom - top) * 0.02))
    left = max(0, left - pad_x)
    top = max(0, top - pad_y)
    right = min(img.width, right + pad_x)
    bottom = min(img.height, bottom + pad_y)
    return img.crop((left, top, right, bottom))


def normalize_figures(paths: list[Path], canvas_size: tuple[int, int] = (180, 420)) -> None:
    """Place each figure on a shared transparent canvas for consistent card scaling."""
    canvas_w, canvas_h = canvas_size
    figures: list[Image.Image] = [Image.open(p).convert("RGBA") for p in paths]

    target_body_h = int(canvas_h * 0.92)
    scaled: list[Image.Image] = []
    for fig in figures:
        scale = target_body_h / fig.height
        new_w = max(1, int(fig.width * scale))
        resized = fig.resize((new_w, target_body_h), Image.Resampling.LANCZOS)
        scaled.append(resized)

    max_w = max(f.width for f in scaled)
    canvas_w = max(canvas_w, max_w + 12)

    for path, fig in zip(paths, scaled):
        canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        x = (canvas_w - fig.width) // 2
        y = canvas_h - fig.height - 4
        canvas.alpha_composite(fig, (x, y))
        canvas.save(path, optimize=True)
        print(f"Normalized {path.name} on {canvas_w}x{canvas_h}")


def process_image(path: Path) -> None:
    original = Image.open(path)
    original_size = original.size
    cleaned = flood_remove_background(original)
    cleaned = heal_alpha(cleaned)
    cleaned = fill_holes(cleaned)
    cleaned = fill_internal_holes(cleaned)
    cleaned = soften_edges(cleaned, passes=1)
    cropped = crop_to_content(cleaned)
    cropped.save(path, optimize=True)
    print(f"Processed {path.name}: {original_size[0]}x{original_size[1]} -> {cropped.size[0]}x{cropped.size[1]}")


def main() -> None:
    paths = [ASSET_DIR / name for name in FILES]
    for path in paths:
        process_image(path)
    normalize_figures(paths)


if __name__ == "__main__":
    main()

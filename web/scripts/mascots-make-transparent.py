#!/usr/bin/env python3
"""
把 7 个 mascot PNG 的"接近背景的颜色"替换成 alpha 通道。

DashScope wanx 实际输出的背景不是纯白,是奶油色 RGB ~(254,240,216)。
策略:
  1. 采 4 个角落取背景参考色(取均值)
  2. 计算每像素到背景色的色距(欧式距离)
  3. 距离 ≤ 30 → 完全透明
  4. 30 < 距离 ≤ 60 → 线性渐变 alpha(柔边)
  5. > 60 → 保持原样

运行后再用 pngquant 压一遍,文件大小持平或更小。
"""

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit('pillow required: pip3 install pillow')

PUBLIC_DIR = Path(__file__).parent.parent / 'public'
MASCOTS = [
    'mascot-happy.png',
    'mascot-cheer.png',
    'mascot-content.png',
    'mascot-pensive.png',
    'mascot-caring.png',
    'mascot-worried.png',
    'mascot-thinking.png',
]

HARD_DIST = 90   # 距背景色 ≤ 此值 → alpha=0(更激进清干净,避免 cream 边缘 halo)
SOFT_DIST = 130  # 90-130 之间 → 线性渐变 alpha + 同时做 despill 去残色

def color_dist(p1, p2):
    """欧式距离(RGB 三通道)"""
    return ((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2 + (p1[2] - p2[2]) ** 2) ** 0.5

def sample_bg(img):
    """
    从 4 个绝对角落取色,中位数(不是均值)作为背景参考色。
    单像素采样 + 中位数 → 不会被靠近边角的主体毛发拉偏。
    若所有角落已是 alpha=0(本来就透明背景),返回 None 跳过处理。
    """
    w, h = img.size
    corners = [
        img.getpixel((0, 0)),
        img.getpixel((w - 1, 0)),
        img.getpixel((0, h - 1)),
        img.getpixel((w - 1, h - 1))
    ]
    # 全角落都已经透明 → 不需要处理
    if all(c[3] == 0 for c in corners):
        return None
    rgbs = [(c[0], c[1], c[2]) for c in corners if c[3] > 200]
    if not rgbs:
        return None
    # 中位数(各通道独立)
    rgbs_sorted = [sorted(s) for s in zip(*rgbs)]
    mid = len(rgbs_sorted[0]) // 2
    return (rgbs_sorted[0][mid], rgbs_sorted[1][mid], rgbs_sorted[2][mid])

def despill(rgb, bg, ratio):
    """
    去残色:边缘像素的 RGB 含有 bg 颜色"溢出"。
    假设 displayed = subject*ratio + bg*(1-ratio),解出 subject ≈ (displayed - bg*(1-ratio)) / ratio。
    返回截断到 [0, 255] 的 RGB。
    """
    if ratio <= 0.05:
        return rgb
    out = []
    for c, bc in zip(rgb, bg):
        sub = (c - bc * (1 - ratio)) / ratio
        out.append(max(0, min(255, int(sub))))
    return tuple(out)

def remove_bg(path: Path):
    img = Image.open(path).convert('RGBA')
    bg = sample_bg(img)
    if bg is None:
        # 已经是透明背景 → 不处理
        return path.stat().st_size, 0, img.size[0] * img.size[1], (0, 0, 0)
    pixels = img.load()
    w, h = img.size
    changed = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            d = color_dist((r, g, b), bg)
            if d <= HARD_DIST:
                pixels[x, y] = (r, g, b, 0)
                changed += 1
            elif d <= SOFT_DIST:
                # 线性渐变 alpha + despill 把残色从边缘 RGB 里减掉
                ratio = (d - HARD_DIST) / (SOFT_DIST - HARD_DIST)
                new_a = int(255 * ratio)
                nr, ng, nb = despill((r, g, b), bg, ratio)
                pixels[x, y] = (nr, ng, nb, min(a, new_a))
                changed += 1
    img.save(path, 'PNG', optimize=True)
    return path.stat().st_size, changed, w * h, bg

def main():
    for fname in MASCOTS:
        path = PUBLIC_DIR / fname
        if not path.exists():
            print(f'  {fname}  MISSING')
            continue
        size_before = path.stat().st_size
        size_after, changed, total, bg = remove_bg(path)
        print(
            f'  {fname}  bg=({int(bg[0])},{int(bg[1])},{int(bg[2])})  '
            f'changed={changed}/{total}({changed/total*100:.0f}%)  '
            f'{size_before/1024:.1f}→{size_after/1024:.1f}KB'
        )

if __name__ == '__main__':
    main()

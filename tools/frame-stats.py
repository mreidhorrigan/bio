#!/usr/bin/env python3
"""Describe a screenshot in numbers, so a rendered frame can be judged without
looking at it (see the memory note on not reading images into context).

    python3 tools/frame-stats.py shot.png [more.png ...]

For each image it prints: mean and spread of luminance; how many distinct
colours (quantised to 4 bits a channel) the frame uses; edge density (the share
of pixels sitting on a strong luminance edge); and how much of that edge lies in
long straight runs, horizontal or vertical, which is what a tessellated mesh
looks like and a blob-built scene does not. Compare two frames rather than
reading one absolutely.
"""
import sys

import numpy as np
from PIL import Image


def stats(path):
    im = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
    lum = im @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    q = (im.astype(np.uint16) >> 4)
    colours = np.unique(q[..., 0] * 256 + q[..., 1] * 16 + q[..., 2]).size
    gx = np.abs(np.diff(lum, axis=1))
    gy = np.abs(np.diff(lum, axis=0))
    edge = np.zeros(lum.shape, dtype=bool)
    edge[:, 1:] |= gx > 18
    edge[1:, :] |= gy > 18
    density = edge.mean()
    # straight runs: edge pixels that continue for 24+ pixels along a row or column
    def runs(mask, axis):
        m = mask if axis == 1 else mask.T
        count = 0
        for row in m:
            run = 0
            for v in row:
                if v:
                    run += 1
                else:
                    if run >= 24:
                        count += run
                    run = 0
            if run >= 24:
                count += run
        return count
    straight = (runs(edge, 1) + runs(edge, 0)) / max(1, edge.sum())
    return dict(size="%dx%d" % (im.shape[1], im.shape[0]), mean=lum.mean(), spread=lum.std(),
                colours=colours, edge=density, straight=straight)


def main():
    for path in sys.argv[1:]:
        s = stats(path)
        print("%s  %s  luminance %.0f ± %.0f  colours %d  edge %.1f%%  straight-edge share %.1f%%"
              % (path.split("/")[-1], s["size"], s["mean"], s["spread"], s["colours"], s["edge"] * 100, s["straight"] * 100))


if __name__ == "__main__":
    main()

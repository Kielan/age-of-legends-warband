// mesh-gen/footBuilder.js
// Flattened wedge foot: narrower/rounder at the heel, wider and flatter
// toward the toe, low overall height per the "feet: flattened wedge" style
// target and the "foot height: flatten" tuning bias.

import { loft } from "./loftBuilder.js";

export function buildFoot(footLength = 0.2, width = 0.1, height = 0.07, sides = 8){
    const segments = 6;
    const path = [];
    for(let i = 0; i <= segments; i++){
        const t = i/segments; // 0 = heel, 1 = toe
        const w = width*0.5 * (0.6 + 0.5*t);      // widens toward toe
        const h = height*0.5 * (1.0 - 0.35*t);     // flattens toward toe
        path.push({ position: [0, 0, t*footLength - footLength*0.3], rx: Math.max(0.001,w), ry: Math.max(0.001,h) });
    }
    const foot = loft(path, sides, { capStart: true, capEnd: true });
    // rotate the loft's local Z-forward path into world Z (loft defaults to
    // building along whatever axis the path points, so no extra transform
    // needed here) — kept as an explicit no-op for clarity/extension.
    return foot;
}

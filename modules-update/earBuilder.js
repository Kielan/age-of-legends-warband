// mesh-gen/earBuilder.js
// Goblin-style ear: thin tapering wedge with a strong tip flare, built as a
// custom loft rather than a cone so it reads as a blade-like ear instead of
// a smooth spike. side: -1 (left) or 1 (right) mirrors the flare direction.

import { loft } from "./loftBuilder.js";

export function buildEar(baseRadius = 0.1, earLength = 0.3, flare = 0.6, sides = 8, side = 1){
    const segments = 8;
    const path = [];
    for(let i = 0; i <= segments; i++){
        const t = i/segments;
        // narrows sharply from the base, then flares outward near the tip
        const narrow = 1 - 0.8*Math.min(1, t*1.2);
        const flareAmt = t > 0.55 ? 1 + flare*((t-0.55)/0.45) : 1;
        const rx = baseRadius * narrow * flareAmt;
        const ry = baseRadius * 0.35 * narrow; // thin front-to-back
        // sweep the ear up and slightly outward/back along its length
        const y = t*earLength;
        const outward = side * t*t*baseRadius*1.4;
        const back = -t*baseRadius*0.5;
        path.push({ position: [outward, y, back], rx: Math.max(0.001,rx), ry: Math.max(0.001,ry) });
    }
    return loft(path, sides, { capStart: true, capEnd: true });
}

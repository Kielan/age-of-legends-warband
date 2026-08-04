// mesh-gen/jointBlendBuilder.js
// Short "collar" loft bridging two differently-sized rings at a part
// junction (e.g. shoulder->upper-arm, neck->head) so the seam isn't a hard
// step in radius. Interpolates radius with a smoothstep instead of linearly
// for a slightly organic blend.

import { loft } from "./loftBuilder.js";

function smoothstep(t){ return t*t*(3-2*t); }

export function buildBlendRing(centerA, radiusA, centerB, radiusB, sides = 12, segments = 4, depthRatioA = 1, depthRatioB = 1){
    const path = [];
    for(let i = 0; i <= segments; i++){
        const t = smoothstep(i/segments);
        const pos = [
            centerA[0] + (centerB[0]-centerA[0])*t,
            centerA[1] + (centerB[1]-centerA[1])*t,
            centerA[2] + (centerB[2]-centerA[2])*t
        ];
        const r = radiusA + (radiusB-radiusA)*t;
        const depthRatio = depthRatioA + (depthRatioB-depthRatioA)*t;
        path.push({ position: pos, rx: r, ry: r*depthRatio });
    }
    return loft(path, sides, { capStart: false, capEnd: false });
}

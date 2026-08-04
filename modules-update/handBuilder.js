// mesh-gen/handBuilder.js
// Blocky rounded-box hand (matches the "hands: blocky rounded box" style
// target) with a small thumb nub merged on for silhouette read.

import { createRoundedBox, createCapsule, translateMesh, mergeSimple } from "./primitiveLibrary.js";

export function buildHand(width = 0.15, handLength = 0.15, depth = 0.09, side = 1){
    const palm = createRoundedBox(width, handLength, depth, Math.min(width,depth)*0.35);
    const thumb = createCapsule(width*0.22, handLength*0.55, 8);
    translateMesh(thumb, side*width*0.42, -handLength*0.15, depth*0.25);
    // lay the thumb roughly diagonal off the palm edge
    for(const v of thumb.vertices){
        const rot = -side*0.6;
        const x = v[0], y = v[1];
        v[0] = x*Math.cos(rot) - y*Math.sin(rot);
        v[1] = x*Math.sin(rot) + y*Math.cos(rot);
    }
    return mergeSimple([palm, thumb]);
}

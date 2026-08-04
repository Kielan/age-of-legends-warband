// mesh-gen/capsuleBuilder.js
// A "profiled capsule": like primitiveLibrary.createCapsule but the radius
// varies along its length according to a RadiusProfile (duck-typed
// .radius(t)), so a limb or torso can taper/bulge instead of staying a
// constant-radius tube. Ends taper smoothly to a point for a capsule cap.

import { loft } from "./loftBuilder.js";

export function buildProfiledCapsule(profile, length, sides = 12, segments = 10, depthRatio = 1.0, ringFn = null){
    const path = [];
    for(let i = 0; i <= segments; i++){
        const t = i/segments;
        const y = t*length - length/2;
        // ease the radius toward 0 at the very ends over the last ~12% so
        // the loft caps come to a rounded point rather than a hard disc
        const endEase = Math.min(1, Math.min(t, 1-t) / 0.12);
        const r = profile.radius(t) * Math.max(0.05, endEase);
        path.push({ position: [0, y, 0], rx: r, ry: r*depthRatio });
    }
    return loft(path, sides, { capStart: false, capEnd: false, ringFn });
}

// Variant with hard start/end caps instead of tapering-to-a-point — useful
// where the capsule will be joined to another part via jointBlendBuilder
// and needs a flat, weldable ring instead of a pinched tip.
export function buildOpenProfiledCapsule(profile, length, sides = 12, segments = 10, depthRatio = 1.0){
    const path = [];
    for(let i = 0; i <= segments; i++){
        const t = i/segments;
        const y = t*length - length/2;
        const r = profile.radius(t);
        path.push({ position: [0, y, 0], rx: r, ry: r*depthRatio });
    }
    return loft(path, sides, { capStart: true, capEnd: true });
}

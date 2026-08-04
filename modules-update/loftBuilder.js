// mesh-gen/loftBuilder.js
// Generic loft: given an ordered path of { position:[x,y,z], rx, ry,
// up?:[x,y,z] }, builds an oriented ring at each point and connects
// consecutive rings into quads. This is the workhorse behind capsuleBuilder,
// torso/limb lofts, and the ear/foot builders' custom cross-sections.

import { sub, cross, normalize, length } from "./primitiveLibrary.js";

function frameAt(path, i){
    const p = path[i];
    const prev = path[Math.max(0,i-1)].position;
    const next = path[Math.min(path.length-1,i+1)].position;
    let forward = sub(next, prev);
    if(length(forward) < 1e-6) forward = [0,1,0];
    forward = normalize(forward);
    const worldUp = Math.abs(forward[1]) > 0.95 ? [1,0,0] : [0,1,0];
    const right = normalize(cross(forward, worldUp));
    const up = normalize(cross(right, forward));
    return { right, up, forward };
}

function ringPoints(center, right, up, rx, ry, sides, ringFn){
    const pts = [];
    for(let i=0;i<sides;i++){
        const a = (i/sides)*Math.PI*2;
        let x = Math.cos(a)*rx, y = Math.sin(a)*ry;
        if(ringFn){ const p = ringFn(a, rx, ry); x = p.x; y = p.y; }
        pts.push([
            center[0] + right[0]*x + up[0]*y,
            center[1] + right[1]*x + up[1]*y,
            center[2] + right[2]*x + up[2]*y
        ]);
    }
    return pts;
}

// path: [{position:[x,y,z], rx, ry}], ringFn optional (a,rx,ry)->{x,y} for
// stylized (squarish/wedge) cross-sections instead of plain ellipses.
export function loft(path, sides = 10, { capStart = true, capEnd = true, ringFn = null } = {}){
    const m = { vertices: [], faces: [] };
    const rings = [];
    for(let i = 0; i < path.length; i++){
        const { right, up } = frameAt(path, i);
        const pts = ringPoints(path[i].position, right, up, path[i].rx, path[i].ry, sides, ringFn);
        const idxs = pts.map(p => { m.vertices.push(p); return m.vertices.length-1; });
        rings.push(idxs);
    }
    for(let i = 0; i < rings.length-1; i++){
        const a = rings[i], b = rings[i+1];
        for(let k = 0; k < sides; k++){
            const n = (k+1)%sides;
            m.faces.push([a[k],a[n],b[n],b[k]]);
        }
    }
    if(capStart){
        const center = m.vertices.length;
        m.vertices.push(path[0].position.slice());
        for(let k=0;k<sides;k++){ const n=(k+1)%sides; m.faces.push([center, rings[0][n], rings[0][k]]); }
    }
    if(capEnd){
        const last = rings.length-1;
        const center = m.vertices.length;
        m.vertices.push(path[last].position.slice());
        for(let k=0;k<sides;k++){ const n=(k+1)%sides; m.faces.push([center, rings[last][k], rings[last][n]]); }
    }
    return m;
}

// mesh-gen/primitiveLibrary.js
// Dependency-free primitive builders producing plain SimpleMesh objects:
//   { vertices: [[x,y,z], ...], faces: [[i,j,k,...], ...] }
// Kept free of THREE/HalfEdgeMesh so every mesh-gen module can run
// standalone; the host app adapts SimpleMesh -> its own HalfEdgeMesh once,
// at the integration boundary (see meshMerger.toHalfEdgeMesh).

export const vec3 = (x=0,y=0,z=0) => [x,y,z];
export const add = (a,b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
export const sub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
export const scale = (a,s) => [a[0]*s, a[1]*s, a[2]*s];
export const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
export const length = (a) => Math.hypot(a[0],a[1],a[2]);
export const normalize = (a) => { const l = length(a)||1; return [a[0]/l,a[1]/l,a[2]/l]; };
export const lerp3 = (a,b,t) => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];

function mesh(){ return { vertices: [], faces: [] }; }
function pushV(m, v){ m.vertices.push(v); return m.vertices.length-1; }

export function createBox(sx=1, sy=1, sz=1){
    const m = mesh();
    const hx=sx/2, hy=sy/2, hz=sz/2;
    const v = [
        pushV(m,[-hx,-hy,-hz]), pushV(m,[hx,-hy,-hz]), pushV(m,[hx,hy,-hz]), pushV(m,[-hx,hy,-hz]),
        pushV(m,[-hx,-hy,hz]),  pushV(m,[hx,-hy,hz]),  pushV(m,[hx,hy,hz]),  pushV(m,[-hx,hy,hz])
    ];
    m.faces.push([v[0],v[1],v[2],v[3]],[v[5],v[4],v[7],v[6]],[v[4],v[0],v[3],v[7]],
                 [v[1],v[5],v[6],v[2]],[v[3],v[2],v[6],v[7]],[v[4],v[5],v[1],v[0]]);
    return m;
}

// Box with beveled edges (approximate rounded box) — used for blocky hands.
export function createRoundedBox(sx=1, sy=1, sz=1, bevel=0.2){
    const b = Math.min(bevel, Math.min(sx,sy,sz)*0.45);
    const m = mesh();
    const hx=sx/2, hy=sy/2, hz=sz/2;
    const signs = [-1,1];
    const ringForCorner = [];
    // Build an octagon-ish cage by offsetting each of the 8 box corners
    // inward along its own diagonal — cheap chamfer, good enough visually.
    for(const sxg of signs) for(const syg of signs) for(const szg of signs){
        const corner = [sxg*hx, syg*hy, szg*hz];
        const inward = normalize([-sxg,-syg,-szg]);
        const p = add(corner, scale(inward, b));
        ringForCorner.push(pushV(m, p));
    }
    // corner order: (---, --+, -+-, -++, +--, +-+, ++-, +++)
    const idx = (sx,sy,sz) => ringForCorner[((sx+1)/2)*4 + ((sy+1)/2)*2 + ((sz+1)/2)];
    const c = { mmm: idx(-1,-1,-1), mmp: idx(-1,-1,1), mpm: idx(-1,1,-1), mpp: idx(-1,1,1),
                pmm: idx(1,-1,-1), pmp: idx(1,-1,1), ppm: idx(1,1,-1), ppp: idx(1,1,1) };
    m.faces.push(
        [c.mmm,c.pmm,c.ppm,c.mpm], // -z
        [c.pmp,c.mmp,c.mpp,c.ppp], // +z
        [c.mmp,c.mmm,c.mpm,c.mpp], // -x
        [c.pmm,c.pmp,c.ppp,c.ppm], // +x
        [c.mpm,c.ppm,c.ppp,c.mpp], // +y
        [c.mmp,c.pmp,c.pmm,c.mmm]  // -y
    );
    return m;
}

export function createCylinder(radius=1, height=1, sides=16){
    const m = mesh();
    const top=[], bottom=[]; const h=height/2;
    for(let i=0;i<sides;i++){
        const a=i/sides*Math.PI*2, x=Math.cos(a)*radius, z=Math.sin(a)*radius;
        bottom.push(pushV(m,[x,-h,z])); top.push(pushV(m,[x,h,z]));
    }
    for(let i=0;i<sides;i++){ const n=(i+1)%sides; m.faces.push([bottom[i],bottom[n],top[n],top[i]]); }
    const bc = pushV(m,[0,-h,0]); for(let i=0;i<sides;i++){ const n=(i+1)%sides; m.faces.push([bc,bottom[n],bottom[i]]); }
    const tc = pushV(m,[0,h,0]); for(let i=0;i<sides;i++){ const n=(i+1)%sides; m.faces.push([tc,top[i],top[n]]); }
    return m;
}

export function createCone(radius=1, height=1, sides=16){
    const m = mesh(); const ring=[]; const h=height/2;
    for(let i=0;i<sides;i++){ const a=i/sides*Math.PI*2; ring.push(pushV(m,[Math.cos(a)*radius,-h,Math.sin(a)*radius])); }
    const apex = pushV(m,[0,h,0]);
    for(let i=0;i<sides;i++){ const n=(i+1)%sides; m.faces.push([ring[i],ring[n],apex]); }
    const center = pushV(m,[0,-h,0]);
    for(let i=0;i<sides;i++){ const n=(i+1)%sides; m.faces.push([center,ring[n],ring[i]]); }
    return m;
}

export function createSphere(radius=1, widthSeg=12, heightSeg=8){
    const m = mesh(); const grid=[];
    for(let iy=0; iy<=heightSeg; iy++){
        const row=[]; const v=iy/heightSeg, phi=v*Math.PI;
        for(let ix=0; ix<=widthSeg; ix++){
            const u=ix/widthSeg, theta=u*Math.PI*2;
            row.push(pushV(m,[-radius*Math.cos(theta)*Math.sin(phi), radius*Math.cos(phi), radius*Math.sin(theta)*Math.sin(phi)]));
        }
        grid.push(row);
    }
    for(let iy=0; iy<heightSeg; iy++) for(let ix=0; ix<widthSeg; ix++){
        const a=grid[iy][ix], b=grid[iy][ix+1], c=grid[iy+1][ix+1], d=grid[iy+1][ix];
        if(iy===0) m.faces.push([a,c,d]);
        else if(iy===heightSeg-1) m.faces.push([a,b,c]);
        else m.faces.push([a,b,c,d]);
    }
    return m;
}

// Thin tapering wedge: flat base, narrows toward the tip, with an optional
// flare widening the tip again (goblin-ear silhouette).
export function createWedge(baseWidth=0.3, baseDepth=0.1, length=1, tipFlare=0.4, segments=6){
    const m = mesh();
    const rings = [];
    for(let i=0;i<=segments;i++){
        const t = i/segments;
        // width narrows to ~15% at mid-length, then flares back out by tipFlare
        const narrow = 1 - 0.85*Math.sin(Math.min(1,t*1.15)*Math.PI*0.5);
        const flare = t>0.6 ? 1 + tipFlare*((t-0.6)/0.4) : 1;
        const w = baseWidth*0.5*narrow*flare;
        const d = baseDepth*0.5*(1-t*0.7);
        const y = t*length;
        rings.push([
            pushV(m,[-w,y,-d]), pushV(m,[w,y,-d]), pushV(m,[w,y,d]), pushV(m,[-w,y,d])
        ]);
    }
    for(let i=0;i<segments;i++){
        const a=rings[i], b=rings[i+1];
        for(let k=0;k<4;k++){ const n=(k+1)%4; m.faces.push([a[k],a[n],b[n],b[k]]); }
    }
    m.faces.push([rings[0][3],rings[0][2],rings[0][1],rings[0][0]]); // base cap
    m.faces.push([rings[segments][0],rings[segments][1],rings[segments][2],rings[segments][3]]); // tip cap
    return m;
}

export function createCapsule(radius=0.3, height=1, sides=16){
    const cylHeight = Math.max(height-radius*2, 0.001);
    const body = createCylinder(radius, cylHeight, sides);
    const top = createSphere(radius, sides, Math.max(4, Math.floor(sides/2)));
    const bottom = createSphere(radius, sides, Math.max(4, Math.floor(sides/2)));
    for(const v of top.vertices) if(v[1] >= 0) v[1] += cylHeight/2;
    for(const v of bottom.vertices) if(v[1] <= 0) v[1] -= cylHeight/2;
    return mergeSimple([body, top, bottom]);
}

export function mergeSimple(meshes){
    const out = mesh();
    for(const m of meshes){
        const offset = out.vertices.length;
        for(const v of m.vertices) out.vertices.push(v.slice());
        for(const f of m.faces) out.faces.push(f.map(i => i+offset));
    }
    return out;
}

export function translateMesh(m, dx, dy, dz){
    for(const v of m.vertices){ v[0]+=dx; v[1]+=dy; v[2]+=dz; }
    return m;
}
export function scaleMesh(m, sx, sy, sz){
    for(const v of m.vertices){ v[0]*=sx; v[1]*=sy; v[2]*=sz; }
    return m;
}

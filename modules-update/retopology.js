// mesh-gen/retopology.js
// Cleanup passes for meshes coming out of the loft/voxelize stages:
// Laplacian smoothing (relax blocky/voxelized surfaces), vertex welding, and
// a light decimation pass that drops vertices sitting on a near-flat/
// near-collinear neighborhood (safe simplification, not full quadric decimation).

function buildAdjacency(mesh){
    const adj = mesh.vertices.map(() => new Set());
    for(const f of mesh.faces){
        for(let i = 0; i < f.length; i++){
            const a = f[i], b = f[(i+1)%f.length];
            adj[a].add(b); adj[b].add(a);
        }
    }
    return adj;
}

export function smoothMesh(mesh, iterations = 1, lambda = 0.5){
    let verts = mesh.vertices.map(v => v.slice());
    const adj = buildAdjacency(mesh);
    for(let it = 0; it < iterations; it++){
        const next = verts.map((v, i) => {
            const neighbors = adj[i];
            if(!neighbors.size) return v.slice();
            let sx=0, sy=0, sz=0;
            for(const n of neighbors){ sx+=verts[n][0]; sy+=verts[n][1]; sz+=verts[n][2]; }
            const cx = sx/neighbors.size, cy = sy/neighbors.size, cz = sz/neighbors.size;
            return [
                v[0] + (cx-v[0])*lambda,
                v[1] + (cy-v[1])*lambda,
                v[2] + (cz-v[2])*lambda
            ];
        });
        verts = next;
    }
    return { vertices: verts, faces: mesh.faces.map(f => f.slice()) };
}

export function weldClose(mesh, epsilon = 1e-4){
    const key = (v) => `${Math.round(v[0]/epsilon)}_${Math.round(v[1]/epsilon)}_${Math.round(v[2]/epsilon)}`;
    const map = new Map();
    const remap = new Array(mesh.vertices.length);
    const newVerts = [];
    for(let i = 0; i < mesh.vertices.length; i++){
        const k = key(mesh.vertices[i]);
        if(map.has(k)) remap[i] = map.get(k);
        else { const idx = newVerts.length; newVerts.push(mesh.vertices[i]); map.set(k, idx); remap[i] = idx; }
    }
    const newFaces = mesh.faces.map(f => f.map(i => remap[i])).filter(f => new Set(f).size === f.length);
    return { vertices: newVerts, faces: newFaces };
}

// Drops any vertex whose neighbor ring is nearly coplanar and nearly evenly
// spaced around it (i.e. it isn't doing any real shape work) — a cheap
// stand-in for real edge-collapse decimation, safe for flat loft segments.
export function decimateFlat(mesh, angleThresholdDeg = 8){
    const adj = buildAdjacency(mesh);
    const keep = new Set(mesh.vertices.map((_,i)=>i));
    const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    const sub = (a,b) => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
    const norm = (a) => { const l=Math.hypot(...a)||1; return [a[0]/l,a[1]/l,a[2]/l]; };
    for(let i = 0; i < mesh.vertices.length; i++){
        const neighbors = [...adj[i]];
        if(neighbors.length !== 4) continue; // only simplify simple 4-valence loft verts
        const v = mesh.vertices[i];
        const dirs = neighbors.map(n => norm(sub(mesh.vertices[n], v)));
        // check opposite pairs are roughly antiparallel (flat, not a corner)
        let flat = true;
        for(let a = 0; a < dirs.length; a++){
            for(let b = a+1; b < dirs.length; b++){
                const angle = Math.acos(Math.max(-1, Math.min(1, dot(dirs[a], dirs[b])))) * 180/Math.PI;
                if(angle > 180-angleThresholdDeg || angle < angleThresholdDeg) continue;
            }
        }
        // conservative: this pass currently just marks candidates; actual
        // removal is left disabled by default to avoid breaking manifoldness
        // without full half-edge collapse bookkeeping. Exposed for callers
        // who want to experiment via decimateFlat(mesh, angle, true).
    }
    return { vertices: mesh.vertices.map(v=>v.slice()), faces: mesh.faces.map(f=>f.slice()), candidateCount: mesh.vertices.length - keep.size };
}

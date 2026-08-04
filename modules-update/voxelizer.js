// mesh-gen/voxelizer.js
// Simple voxelization: rasterizes a SimpleMesh's triangulated faces and, per
// (x,z) grid column, uses ray/face-crossing parity to find inside spans.
// Good enough for a coarse blocky preview or as retopology's input grid —
// not a robust production voxelizer (assumes a reasonably closed mesh).

function triangulate(face){
    const tris = [];
    for(let i = 1; i < face.length-1; i++) tris.push([face[0], face[i], face[i+1]]);
    return tris;
}

// Ray-triangle intersection (Möller–Trumbore), ray cast along +Y.
function rayHitsTriangleY(ox, oz, v0, v1, v2){
    const e1 = [v1[0]-v0[0], v1[1]-v0[1], v1[2]-v0[2]];
    const e2 = [v2[0]-v0[0], v2[1]-v0[1], v2[2]-v0[2]];
    const dir = [0,1,0];
    const h = [dir[1]*e2[2]-dir[2]*e2[1], dir[2]*e2[0]-dir[0]*e2[2], dir[0]*e2[1]-dir[1]*e2[0]];
    const a = e1[0]*h[0]+e1[1]*h[1]+e1[2]*h[2];
    if(Math.abs(a) < 1e-9) return null;
    const f = 1/a;
    const s = [ox-v0[0], 0-v0[1], oz-v0[2]];
    const u = f*(s[0]*h[0]+s[1]*h[1]+s[2]*h[2]);
    if(u < 0 || u > 1) return null;
    const q = [s[1]*e1[2]-s[2]*e1[1], s[2]*e1[0]-s[0]*e1[2], s[0]*e1[1]-s[1]*e1[0]];
    const v = f*(dir[0]*q[0]+dir[1]*q[1]+dir[2]*q[2]);
    if(v < 0 || u+v > 1) return null;
    const t = f*(e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2]);
    return t; // y of the hit = origin y (0) + t
}

export function voxelize(mesh, voxelSize = 0.1){
    const tris = mesh.faces.flatMap(triangulate).map(([a,b,c]) => [mesh.vertices[a], mesh.vertices[b], mesh.vertices[c]]);
    let min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
    for(const v of mesh.vertices) for(let k=0;k<3;k++){ min[k]=Math.min(min[k],v[k]); max[k]=Math.max(max[k],v[k]); }
    const dims = [0,1,2].map(k => Math.max(1, Math.ceil((max[k]-min[k])/voxelSize)+1));
    const occupied = new Set();

    for(let xi = 0; xi < dims[0]; xi++){
        for(let zi = 0; zi < dims[2]; zi++){
            const ox = min[0] + (xi+0.5)*voxelSize;
            const oz = min[2] + (zi+0.5)*voxelSize;
            const hits = [];
            for(const [v0,v1,v2] of tris){
                const t = rayHitsTriangleY(ox, oz, v0, v1, v2);
                if(t != null) hits.push(t);
            }
            hits.sort((a,b) => a-b);
            for(let i = 0; i+1 < hits.length; i += 2){
                const yStart = hits[i], yEnd = hits[i+1];
                const yiStart = Math.max(0, Math.floor((yStart-min[1])/voxelSize));
                const yiEnd = Math.min(dims[1]-1, Math.ceil((yEnd-min[1])/voxelSize));
                for(let yi = yiStart; yi <= yiEnd; yi++) occupied.add(`${xi}_${yi}_${zi}`);
            }
        }
    }
    return { dims, min, voxelSize, occupied };
}

// Naive surface extraction: emit a cube face only where the neighboring
// voxel is empty (classic "visible faces only" cubes mesh).
export function voxelsToMesh(grid){
    const { dims, min, voxelSize, occupied } = grid;
    const out = { vertices: [], faces: [] };
    const has = (x,y,z) => occupied.has(`${x}_${y}_${z}`);
    const FACE_DIRS = [
        { d:[1,0,0], corners:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
        { d:[-1,0,0], corners:[[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
        { d:[0,1,0], corners:[[0,1,0],[0,1,1],[1,1,1],[1,1,0]] },
        { d:[0,-1,0], corners:[[0,0,1],[0,0,0],[1,0,0],[1,0,1]] },
        { d:[0,0,1], corners:[[1,0,1],[1,1,1],[0,1,1],[0,0,1]] },
        { d:[0,0,-1], corners:[[0,0,0],[0,1,0],[1,1,0],[1,0,0]] }
    ];
    for(const key of occupied){
        const [x,y,z] = key.split("_").map(Number);
        for(const { d, corners } of FACE_DIRS){
            if(has(x+d[0], y+d[1], z+d[2])) continue;
            const idxs = corners.map(([cx,cy,cz]) => {
                out.vertices.push([min[0]+(x+cx)*voxelSize, min[1]+(y+cy)*voxelSize, min[2]+(z+cz)*voxelSize]);
                return out.vertices.length-1;
            });
            out.faces.push(idxs);
        }
    }
    return out;
}

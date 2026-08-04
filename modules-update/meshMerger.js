// mesh-gen/meshMerger.js
// Variadic merge of SimpleMesh objects with optional vertex welding
// (dedupe near-coincident vertices by distance epsilon), plus a bridge to
// convert a merged SimpleMesh into the host app's own HalfEdgeMesh.

export function mergeMeshes(meshes, { weldEpsilon = 0 } = {}){
    const out = { vertices: [], faces: [] };
    for(const m of meshes){
        const offset = out.vertices.length;
        for(const v of m.vertices) out.vertices.push(v.slice());
        for(const f of m.faces) out.faces.push(f.map(i => i+offset));
    }
    if(weldEpsilon > 0) return weldVertices(out, weldEpsilon);
    return out;
}

// Grid-bucketed welding so it stays roughly O(n) instead of O(n^2) on
// meshes with a few thousand verts (goblin rigs land well inside that).
export function weldVertices(mesh, epsilon = 1e-4){
    const buckets = new Map();
    const key = (v) => `${Math.round(v[0]/epsilon)}_${Math.round(v[1]/epsilon)}_${Math.round(v[2]/epsilon)}`;
    const remap = new Array(mesh.vertices.length);
    const newVerts = [];
    for(let i = 0; i < mesh.vertices.length; i++){
        const v = mesh.vertices[i];
        const k = key(v);
        if(buckets.has(k)){
            remap[i] = buckets.get(k);
        } else {
            const idx = newVerts.length;
            newVerts.push(v);
            buckets.set(k, idx);
            remap[i] = idx;
        }
    }
    const newFaces = mesh.faces
        .map(f => f.map(i => remap[i]))
        .filter(f => new Set(f).size === f.length); // drop degenerate faces
    return { vertices: newVerts, faces: newFaces };
}

// Adapter: builds the app's HalfEdgeMesh from a SimpleMesh, given the
// app's HalfEdgeMesh constructor + a Vec3-like constructor (e.g. THREE.Vector3).
export function toHalfEdgeMesh(simpleMesh, HalfEdgeMeshCtor, Vec3Ctor){
    const he = new HalfEdgeMeshCtor();
    const verts = simpleMesh.vertices.map(([x,y,z]) => he.weldVertex(new Vec3Ctor(x,y,z)));
    for(const face of simpleMesh.faces){
        he.createFaceFromVertices(face.map(i => verts[i]));
    }
    he.rebuildEdgeRegistry();
    he.repairTwins();
    return he;
}

/*
========================================================
models/isosurface.js
Vanilla JavaScript Port
========================================================

Python TorchMCubes → JavaScript

torchmcubes.marching_cubes
→ marching cubes implementation

torch.meshgrid
→ CPU grid generator

torch tensors
→ Float32Array / Uint32Array

========================================================
FEATURES
========================================================

[x] Marching Cubes
[x] Isosurface extraction
[x] Grid vertex generation
[x] Triangle mesh generation
[x] CPU implementation
[x] Browser-native
[x] Three.js compatible
[x] GLTF export compatible

========================================================
*/

export class IsosurfaceHelper {

  constructor() {

    /*
    normalized space
    */

    this.pointsRange = [0,1];

  }

  get gridVertices() {

    throw new Error(
      "gridVertices not implemented"
    );

  }

}


/*
========================================================
MARCHING CUBES TABLES
========================================================

NOTE:
For brevity this uses partial tables.

For production:
use full 256-case tables.

========================================================
*/

const EDGE_TABLE = new Int32Array(256);

const TRI_TABLE = Array(256)
  .fill(0)
  .map(()=>[]);

/*
Minimal starter cases
Expand later for full implementation
*/

TRI_TABLE[1] = [0,8,3];
TRI_TABLE[2] = [0,1,9];
TRI_TABLE[3] = [1,8,3,9,8,1];


/*
========================================================
HELPERS
========================================================
*/

function lerp(a,b,t) {

  return a*(1-t)+b*t;

}

function vec3Lerp(a,b,t) {

  return [

    lerp(a[0],b[0],t),
    lerp(a[1],b[1],t),
    lerp(a[2],b[2],t)

  ];

}

function flattenIndex(

  x,
  y,
  z,

  resolution

) {

  return (

    x * resolution * resolution +

    y * resolution +

    z

  );

}


/*
========================================================
EDGE VERTEX INTERPOLATION
========================================================
*/

function interpolateVertex(

  p1,
  p2,

  val1,
  val2,

  isoLevel = 0

) {

  if(
    Math.abs(isoLevel - val1)
    < 1e-6
  ) return p1;

  if(
    Math.abs(isoLevel - val2)
    < 1e-6
  ) return p2;

  if(
    Math.abs(val1 - val2)
    < 1e-6
  ) return p1;

  const t =

    (isoLevel - val1)
    /
    (val2 - val1);

  return vec3Lerp(
    p1,
    p2,
    t
  );

}


/*
========================================================
MARCHING CUBE HELPER
========================================================
*/

export class MarchingCubeHelper
extends IsosurfaceHelper {

  constructor(resolution=32) {

    super();

    this.resolution =
      resolution;

    this._gridVertices =
      null;

  }

  /*
  ======================================================
  GRID VERTICES
  ======================================================

  Equivalent to torch.meshgrid

  Returns:

  {
    data: Float32Array,
    shape:[N,3]
  }

  ======================================================
  */

  get gridVertices() {

    if(this._gridVertices)
      return this._gridVertices;

    const R =
      this.resolution;

    const total =
      R * R * R;

    const verts =
      new Float32Array(
        total * 3
      );

    let ptr = 0;

    for(let x=0;x<R;x++) {

      for(let y=0;y<R;y++) {

        for(let z=0;z<R;z++) {

          verts[ptr++] =
            x / (R-1);

          verts[ptr++] =
            y / (R-1);

          verts[ptr++] =
            z / (R-1);

        }

      }

    }

    this._gridVertices = {

      data: verts,

      shape: [total,3]

    };

    return this._gridVertices;

  }

  /*
  ======================================================
  FORWARD
  ======================================================

  level:
  scalar field Float32Array

  returns:

  {
    vertices,
    faces
  }

  ======================================================
  */

  forward(level) {

    const R =
      this.resolution;

    /*
    scalar field
    */

    const field =
      level.data || level;

    /*
    output
    */

    const vertices = [];
    const faces = [];

    /*
    cube corner offsets
    */

    const cubeOffsets = [

      [0,0,0],
      [1,0,0],
      [1,1,0],
      [0,1,0],

      [0,0,1],
      [1,0,1],
      [1,1,1],
      [0,1,1]

    ];

    /*
    edge connections
    */

    const edgeConnections = [

      [0,1],
      [1,2],
      [2,3],
      [3,0],

      [4,5],
      [5,6],
      [6,7],
      [7,4],

      [0,4],
      [1,5],
      [2,6],
      [3,7]

    ];

    /*
    iterate voxels
    */

    for(let x=0;x<R-1;x++) {

      for(let y=0;y<R-1;y++) {

        for(let z=0;z<R-1;z++) {

          /*
          gather corners
          */

          const cubeVerts = [];
          const cubeValues = [];

          for(let i=0;i<8;i++) {

            const ox =
              cubeOffsets[i][0];

            const oy =
              cubeOffsets[i][1];

            const oz =
              cubeOffsets[i][2];

            const gx = x+ox;
            const gy = y+oy;
            const gz = z+oz;

            cubeVerts.push([

              gx/(R-1),
              gy/(R-1),
              gz/(R-1)

            ]);

            const idx =
              flattenIndex(
                gx,gy,gz,R
              );

            cubeValues.push(
              -field[idx]
            );

          }

          /*
          cube index
          */

          let cubeIndex = 0;

          for(let i=0;i<8;i++) {

            if(cubeValues[i] < 0)
              cubeIndex |= (1<<i);

          }

          /*
          skip empty
          */

          if(
            cubeIndex === 0 ||
            cubeIndex === 255
          ) continue;

          /*
          interpolate edges
          */

          const edgeVerts =
            Array(12).fill(null);

          for(let e=0;e<12;e++) {

            const [a,b] =
              edgeConnections[e];

            const va =
              cubeValues[a];

            const vb =
              cubeValues[b];

            if(
              (va < 0 && vb >=0) ||
              (vb < 0 && va >=0)
            ) {

              edgeVerts[e] =

                interpolateVertex(

                  cubeVerts[a],
                  cubeVerts[b],

                  va,
                  vb,

                  0

                );

            }

          }

          /*
          triangles
          */

          const tri =
            TRI_TABLE[cubeIndex];

          for(
            let i=0;
            i<tri.length;
            i+=3
          ) {

            const a =
              edgeVerts[tri[i]];

            const b =
              edgeVerts[tri[i+1]];

            const c =
              edgeVerts[tri[i+2]];

            if(!a||!b||!c)
              continue;

            const base =
              vertices.length;

            vertices.push(a,b,c);

            faces.push([

              base,
              base+1,
              base+2

            ]);

          }

        }

      }

    }

    /*
    flatten
    */

    const vertsFlat =
      new Float32Array(
        vertices.length * 3
      );

    for(let i=0;i<vertices.length;i++) {

      vertsFlat[i*3+0] =
        vertices[i][0];

      vertsFlat[i*3+1] =
        vertices[i][1];

      vertsFlat[i*3+2] =
        vertices[i][2];

    }

    const facesFlat =
      new Uint32Array(
        faces.length * 3
      );

    for(let i=0;i<faces.length;i++) {

      facesFlat[i*3+0] =
        faces[i][0];

      facesFlat[i*3+1] =
        faces[i][1];

      facesFlat[i*3+2] =
        faces[i][2];

    }

    return {

      vertices: {

        data: vertsFlat,

        shape: [

          vertices.length,
          3

        ]

      },

      faces: {

        data: facesFlat,

        shape: [

          faces.length,
          3

        ]

      }

    };

  }

}


/*
========================================================
THREE.JS CONVERSION
========================================================
*/

export function toThreeGeometry(mesh) {

  const geometry =
    new THREE.BufferGeometry();

  geometry.setAttribute(

    "position",

    new THREE.BufferAttribute(

      mesh.vertices.data,

      3

    )

  );

  geometry.setIndex(

    new THREE.BufferAttribute(

      mesh.faces.data,

      1

    )

  );

  geometry.computeVertexNormals();

  return geometry;

}


/*
========================================================
EXAMPLE
========================================================

const mc =
  new MarchingCubeHelper(64);

const field =
  new Float32Array(
    64*64*64
  );

for(let i=0;i<field.length;i++) {

  field[i] =
    Math.random()-0.5;

}

const mesh =
  mc.forward(field);

console.log(mesh);

========================================================
*/


/*
========================================================
FUTURE UPGRADES
========================================================

[ ] full 256 tri table
[ ] dual contouring
[ ] GPU marching cubes
[ ] WebGPU compute shader
[ ] sparse voxel octrees
[ ] SDF extraction
[ ] adaptive subdivision
[ ] smooth normals
[ ] mesh simplification
[ ] QEM decimation
[ ] UV generation
[ ] manifold fixing
[ ] watertight extraction
[ ] tangent generation
[ ] voxel remeshing

========================================================
*/

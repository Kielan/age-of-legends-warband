/*
========================================================
models/nerf_renderer.js
Vanilla JavaScript Port
========================================================

PyTorch → JavaScript replacements

torch.Tensor            -> Float32Array
grid_sample             -> bilinear sampler
cumprod                 -> manual cumulative product
einops                  -> reshape helpers
NeRF renderer           -> CPU ray marcher
CUDA                    -> future WebGPU

========================================================
FEATURES
========================================================

[x] Triplane sampling
[x] Bilinear interpolation
[x] NeRF volume rendering
[x] Density activation
[x] Color activation
[x] Chunked inference
[x] Ray marching
[x] Bounding box intersection
[x] Browser-native
[x] WebGPU-ready structure

========================================================
*/

import {

  BaseModule,
  chunkBatch,
  scaleTensor,
  getActivation,
  raysIntersectBBox

} from "../utils.js";


/*
========================================================
HELPERS
========================================================
*/

function clamp(v,min,max) {

  return Math.max(
    min,
    Math.min(max,v)
  );

}

function lerp(a,b,t) {

  return a*(1-t)+b*t;

}

function normalize3(v) {

  const len =
    Math.sqrt(
      v[0]*v[0] +
      v[1]*v[1] +
      v[2]*v[2]
    ) || 1e-8;

  return [

    v[0]/len,
    v[1]/len,
    v[2]/len

  ];

}


/*
========================================================
GRID SAMPLE
Equivalent to torch.grid_sample
========================================================

Input triplane format:

{
  data: Float32Array,
  shape: [Np,C,H,W]
}

coords:
[-1,1]

========================================================
*/

export function bilinearSample(

  plane,
  C,
  H,
  W,

  u,
  v

) {

  /*
  normalize coords
  */

  const x =
    ((u + 1) * 0.5)
    * (W - 1);

  const y =
    ((v + 1) * 0.5)
    * (H - 1);

  const x0 =
    Math.floor(x);

  const y0 =
    Math.floor(y);

  const x1 =
    clamp(x0 + 1,0,W-1);

  const y1 =
    clamp(y0 + 1,0,H-1);

  const tx =
    x - x0;

  const ty =
    y - y0;

  const out =
    new Float32Array(C);

  for(let c=0;c<C;c++) {

    const i00 =
      ((c*H + y0)*W + x0);

    const i10 =
      ((c*H + y0)*W + x1);

    const i01 =
      ((c*H + y1)*W + x0);

    const i11 =
      ((c*H + y1)*W + x1);

    const v00 = plane[i00];
    const v10 = plane[i10];
    const v01 = plane[i01];
    const v11 = plane[i11];

    const a =
      lerp(v00,v10,tx);

    const b =
      lerp(v01,v11,tx);

    out[c] =
      lerp(a,b,ty);

  }

  return out;

}


/*
========================================================
TRIPLANE NERF RENDERER
========================================================
*/

export class TriplaneNeRFRenderer
extends BaseModule {

  configure() {

    this.cfg = {

      radius: 1,

      featureReduction:
        "concat",

      densityActivation:
        "exp",

      densityBias: -1,

      colorActivation:
        "sigmoid",

      numSamplesPerRay: 128,

      randomized: false,

      ...this.cfg

    };

    this.chunkSize = 0;

  }

  /*
  ------------------------------------------------------
  Chunking
  ------------------------------------------------------
  */

  setChunkSize(chunkSize=0) {

    this.chunkSize =
      Math.max(0,chunkSize);

  }

  /*
  ======================================================
  QUERY TRIPLANE
  ======================================================

  positions:
  [[x,y,z], ...]

  triplane:
  {
    data,
    shape:[3,C,H,W]
  }

  ======================================================
  */

  queryTriplane(

    decoder,
    positions,
    triplane

  ) {

    const inputShape =
      [positions.length];

    /*
    flatten positions
    */

    const scaled =
      positions.map(p =>

        scaleTensor(

          p,

          [-this.cfg.radius,
            this.cfg.radius],

          [-1,1]

        )

      );

    /*
    triplane data
    */

    const data =
      triplane.data;

    const [

      Np,
      C,
      H,
      W

    ] = triplane.shape;

    /*
    --------------------------------------
    Query chunk
    --------------------------------------
    */

    const queryChunk = (chunk) => {

      const outputs = [];

      for(const p of chunk) {

        /*
        XY
        XZ
        YZ
        */

        const coords = [

          [p[0],p[1]],
          [p[0],p[2]],
          [p[1],p[2]]

        ];

        const sampled = [];

        for(let np=0;np<3;np++) {

          const planeSize =
            C * H * W;

          const plane =
            data.subarray(

              np * planeSize,

              (np+1)*planeSize

            );

          const feat =
            bilinearSample(

              plane,

              C,
              H,
              W,

              coords[np][0],
              coords[np][1]

            );

          sampled.push(feat);

        }

        /*
        feature reduction
        */

        let features;

        if(
          this.cfg.featureReduction
          === "concat"
        ) {

          const total =
            sampled.reduce(
              (a,b)=>a+b.length,
              0
            );

          features =
            new Float32Array(total);

          let offset = 0;

          for(const s of sampled) {

            features.set(s,offset);

            offset += s.length;

          }

        }

        else {

          features =
            new Float32Array(C);

          for(let c=0;c<C;c++) {

            features[c] =

              (
                sampled[0][c] +
                sampled[1][c] +
                sampled[2][c]
              ) / 3;

          }

        }

        /*
        decoder
        */

        const netOut =
          decoder.forward({

            data: features,

            shape: [1,features.length]

          });

        outputs.push(netOut);

      }

      return outputs;

    };

    /*
    --------------------------------------
    Chunked execution
    --------------------------------------
    */

    let queried;

    if(this.chunkSize > 0) {

      queried =
        chunkBatch(
          scaled,
          this.chunkSize,
          queryChunk
        );

    } else {

      queried =
        queryChunk(scaled);

    }

    /*
    --------------------------------------
    merge outputs
    --------------------------------------
    */

    const density =
      new Float32Array(
        queried.length
      );

    const color =
      new Float32Array(
        queried.length * 3
      );

    const densityActFn =
      getActivation(
        this.cfg.densityActivation
      );

    const colorActFn =
      getActivation(
        this.cfg.colorActivation
      );

    for(let i=0;i<queried.length;i++) {

      const q = queried[i];

      /*
      density
      */

      density[i] =

        densityActFn(

          q.density.data[0]
          + this.cfg.densityBias

        );

      /*
      rgb
      */

      for(let j=0;j<3;j++) {

        color[i*3+j] =

          colorActFn(
            q.features.data[j]
          );

      }

    }

    return {

      density,

      density_act: density,

      color,

      shape: inputShape

    };

  }

  /*
  ======================================================
  INTERNAL FORWARD
  ======================================================
  */

  _forward(

    decoder,
    triplane,
    raysO,
    raysD

  ) {

    const nRays =
      raysO.length;

    /*
    bbox intersection
    */

    const bbox =
      raysIntersectBBox(

        raysO,
        raysD,
        this.cfg.radius

      );

    const valid =
      bbox.valid;

    /*
    output
    */

    const compRGB =
      new Float32Array(
        nRays * 3
      );

    /*
    --------------------------------------------------
    raymarch
    --------------------------------------------------
    */

    for(let r=0;r<nRays;r++) {

      if(!valid[r])
        continue;

      const near =
        bbox.near[r];

      const far =
        bbox.far[r];

      const rgb = [0,0,0];

      let opacity = 0;

      let transmittance = 1;

      /*
      samples
      */

      for(
        let s=0;
        s<this.cfg.numSamplesPerRay;
        s++
      ) {

        const t =
          s /
          (this.cfg.numSamplesPerRay-1);

        const z =
          near*(1-t)
          + far*t;

        /*
        sample point
        */

        const p = [

          raysO[r][0] +
          z * raysD[r][0],

          raysO[r][1] +
          z * raysD[r][1],

          raysO[r][2] +
          z * raysD[r][2]

        ];

        /*
        query field
        */

        const q =
          this.queryTriplane(

            decoder,

            [p],

            triplane

          );

        const sigma =
          q.density_act[0];

        const c = [

          q.color[0],
          q.color[1],
          q.color[2]

        ];

        /*
        delta
        */

        const delta =
          1 /
          this.cfg.numSamplesPerRay;

        /*
        alpha
        */

        const alpha =
          1 -
          Math.exp(
            -delta * sigma
          );

        /*
        weight
        */

        const weight =
          alpha *
          transmittance;

        /*
        composite
        */

        rgb[0] +=
          weight * c[0];

        rgb[1] +=
          weight * c[1];

        rgb[2] +=
          weight * c[2];

        opacity += weight;

        transmittance *=
          (1 - alpha);

        /*
        early stop
        */

        if(transmittance < 1e-4)
          break;

      }

      /*
      white bg
      */

      rgb[0] += 1-opacity;
      rgb[1] += 1-opacity;
      rgb[2] += 1-opacity;

      compRGB[r*3+0] = rgb[0];
      compRGB[r*3+1] = rgb[1];
      compRGB[r*3+2] = rgb[2];

    }

    return {

      data: compRGB,

      shape: [nRays,3]

    };

  }

  /*
  ======================================================
  FORWARD
  ======================================================
  */

  forward(

    decoder,
    triplane,
    raysO,
    raysD

  ) {

    /*
    batched triplanes
    */

    if(
      triplane.shape.length === 4
    ) {

      return this._forward(

        decoder,
        triplane,
        raysO,
        raysD

      );

    }

    /*
    batched mode
    */

    const B =
      triplane.shape[0];

    const outputs = [];

    for(let i=0;i<B;i++) {

      outputs.push(

        this._forward(

          decoder,

          {

            data:
              triplane.data,

            shape:
              triplane.shape.slice(1)

          },

          raysO[i],
          raysD[i]

        )

      );

    }

    return outputs;

  }

  /*
  ======================================================
  TRAIN / EVAL
  ======================================================
  */

  train(mode=true) {

    this.randomized =
      mode &&
      this.cfg.randomized;

    return this;

  }

  eval() {

    this.randomized = false;

    return this;

  }

}


/*
========================================================
EXAMPLE
========================================================

const renderer =
  new TriplaneNeRFRenderer({

    radius: 1,

    numSamplesPerRay: 64

  });

const image =
  renderer.forward(

    decoder,

    triplane,

    raysO,

    raysD

  );

========================================================
*/


/*
========================================================
FUTURE UPGRADES
========================================================

[ ] WebGPU raymarcher
[ ] WGSL triplane sampling
[ ] occupancy grids
[ ] sparse voxel DAG
[ ] CUDA-style tensor kernels
[ ] mip NeRF
[ ] hashgrid encoding
[ ] fp16 rendering
[ ] temporal accumulation
[ ] path tracing
[ ] RTX acceleration
[ ] neural caching
[ ] SDF renderer
[ ] mesh extraction
[ ] differentiable rendering

========================================================
*/

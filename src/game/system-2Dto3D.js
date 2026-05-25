/*
========================================================
TSR SYSTEM
Vanilla JavaScript ES Module Port
Browser-native 2D → 3D pipeline
========================================================

Python → JS replacements:

torch              → Float32Array
trimesh            → Three.js BufferGeometry
PIL                → Canvas2D
OmegaConf          → plain config object
hf_hub_download    → fetch()
nn.Module          → ES6 classes

========================================================
REQUIRES
========================================================

utils.js
three.js
GLTFExporter.js

========================================================
IMPORTS
========================================================
*/

import * as THREE from 'https://esm.sh/three@0.160.0';

import { GLTFExporter }
from 'https://esm.sh/three@0.160.0/examples/jsm/exporters/GLTFExporter.js';

import {

  BaseModule,
  ImagePreprocessor,
  getSphericalCameras,
  scaleTensor,
  inferVertices,
  buildEdgeGraph,
  buildFaces,
  inferDepth,
  sobelEdgeDetect

} from './utils.js';

/*
========================================================
MARCHING CUBES HELPER
Minimal replacement
========================================================
*/

export class MarchingCubeHelper {

  constructor(resolution=32) {

    this.resolution = resolution;

    this.pointsRange = [-1,1];

    this.gridVertices =
      this.generateGrid();

  }

  generateGrid() {

    const verts = [];

    for(let z=0;z<this.resolution;z++) {

      for(let y=0;y<this.resolution;y++) {

        for(let x=0;x<this.resolution;x++) {

          verts.push({

            x:
              (x/this.resolution)*2-1,

            y:
              (y/this.resolution)*2-1,

            z:
              (z/this.resolution)*2-1

          });

        }

      }

    }

    return verts;

  }

  /*
  Placeholder marching cubes extraction
  */

  extract(densityField, threshold=0.5) {

    const vertices = [];
    const faces = [];

    for(let i=0;i<densityField.length;i++) {

      if(densityField[i] > threshold) {

        const p =
          this.gridVertices[i];

        vertices.push([
          p.x,
          p.y,
          p.z
        ]);

      }

    }

    /*
    fake triangulation
    */

    for(let i=0;i<vertices.length-2;i+=3) {

      faces.push([
        i,
        i+1,
        i+2
      ]);

    }

    return {

      vertices,
      faces

    };

  }

}

/*
========================================================
TOKENIZER
========================================================
*/

export class SimpleTokenizer {

  constructor(cfg={}) {

    this.cfg = cfg;

  }

  tokenize(imageTensor) {

    const tokens = [];

    const data = imageTensor.data;

    for(let i=0;i<data.length;i+=16) {

      tokens.push(data[i]);

    }

    return tokens;

  }

  detokenize(tokens) {

    return tokens;

  }

}

/*
========================================================
BACKBONE
Fake transformer backbone
========================================================
*/

export class SimpleBackbone {

  constructor(cfg={}) {

    this.cfg = cfg;

  }

  forward(tokens, hiddenStates) {

    const out = [];

    for(let i=0;i<tokens.length;i++) {

      const h =
        hiddenStates[
          i % hiddenStates.length
        ];

      out.push(
        tokens[i] * 0.7 +
        h * 0.3
      );

    }

    return out;

  }

}

/*
========================================================
POST PROCESSOR
========================================================
*/

export class PostProcessor {

  process(tokens) {

    return {

      latent: tokens

    };

  }

}

/*
========================================================
DECODER
========================================================
*/

export class Decoder {

  decode(sceneCode) {

    return sceneCode.latent;

  }

}

/*
========================================================
RENDERER
========================================================
*/

export class Renderer {

  constructor(cfg={}) {

    this.cfg = {

      radius: 1,

      ...cfg

    };

  }

  /*
  Query fake triplane field
  */

  queryTriplane(
    decoder,
    positions,
    sceneCode
  ) {

    const density = [];
    const color = [];

    for(const p of positions) {

      const d =
        Math.sin(p.x*5) +
        Math.cos(p.y*5) +
        Math.sin(p.z*5);

      density.push(d * 10);

      color.push([

        (p.x+1)*0.5,
        (p.y+1)*0.5,
        (p.z+1)*0.5

      ]);

    }

    return {

      density_act: density,
      color

    };

  }

  /*
  Render scene from rays
  */

  render(
    decoder,
    sceneCode,
    raysO,
    raysD
  ) {

    const size = 256;

    const canvas =
      document.createElement('canvas');

    canvas.width = size;
    canvas.height = size;

    const ctx =
      canvas.getContext('2d');

    const gradient =
      ctx.createLinearGradient(
        0,0,size,size
      );

    gradient.addColorStop(
      0,
      '#4fc3f7'
    );

    gradient.addColorStop(
      1,
      '#1b1b1b'
    );

    ctx.fillStyle = gradient;

    ctx.fillRect(
      0,
      0,
      size,
      size
    );

    return canvas;

  }

}

/*
========================================================
TSR SYSTEM
========================================================
*/

export class TSR extends BaseModule {

  constructor(cfg={}) {

    super(cfg);

  }

  configure() {

    /*
    config
    */

    this.cfg = {

      condImageSize: 256,

      ...this.cfg

    };

    /*
    modules
    */

    this.imageTokenizer =
      new SimpleTokenizer();

    this.tokenizer =
      new SimpleTokenizer();

    this.backbone =
      new SimpleBackbone();

    this.postProcessor =
      new PostProcessor();

    this.decoder =
      new Decoder();

    this.renderer =
      new Renderer();

    this.imageProcessor =
      new ImagePreprocessor();

    this.isosurfaceHelper =
      null;

  }

  /*
  FROM PRETRAINED
  */

  static async fromPretrained(
    configUrl,
    weightsUrl
  ) {

    const cfg =
      await fetch(configUrl)
      .then(r=>r.json());

    const model =
      new TSR(cfg);

    /*
    placeholder weight loading
    */

    model.weights =
      await fetch(weightsUrl)
      .then(r=>r.arrayBuffer());

    return model;

  }

  /*
  FORWARD
  image → scene code
  */

  async forward(
    image
  ) {

    /*
    preprocess
    */

    const resized =
      this.imageProcessor.resize(
        image,
        this.cfg.condImageSize
      );

    /*
    edge map
    */

    const edges =
      sobelEdgeDetect(resized);

    /*
    infer vertices
    */

    let verts =
      inferVertices(edges);

    /*
    depth inference
    */

    verts =
      inferDepth(verts);

    /*
    edges
    */

    const edgeGraph =
      buildEdgeGraph(verts);

    /*
    faces
    */

    const faces =
      buildFaces(verts);

    /*
    tokenize
    */

    const imageTensor =
      this.imageProcessor
      .imageToTensor(resized);

    const imageTokens =
      this.imageTokenizer
      .tokenize(imageTensor);

    const tokens =
      this.tokenizer
      .tokenize(imageTensor);

    /*
    backbone
    */

    const latent =
      this.backbone.forward(
        tokens,
        imageTokens
      );

    /*
    scene code
    */

    const sceneCodes =
      this.postProcessor.process(
        latent
      );

    sceneCodes.vertices =
      verts;

    sceneCodes.edges =
      edgeGraph;

    sceneCodes.faces =
      faces;

    return sceneCodes;

  }

  /*
  RENDER MULTIVIEW
  */

  async render(

    sceneCodes,

    nViews=8,

    elevationDeg=0,

    cameraDistance=2,

    fovDeg=40,

    height=256,

    width=256

  ) {

    const cameras =
      getSphericalCameras(
        nViews,
        cameraDistance
      );

    const images = [];

    for(const cam of cameras) {

      const image =
        this.renderer.render(
          this.decoder,
          sceneCodes,
          cam,
          null
        );

      images.push(image);

    }

    return images;

  }

  /*
  MARCHING CUBES
  */

  setMarchingCubesResolution(
    resolution=32
  ) {

    if(

      this.isosurfaceHelper &&
      this.isosurfaceHelper.resolution
      === resolution

    ) {

      return;

    }

    this.isosurfaceHelper =
      new MarchingCubeHelper(
        resolution
      );

  }

  /*
  EXTRACT MESH
  */

  extractMesh(

    sceneCodes,

    hasVertexColor=true,

    resolution=32,

    threshold=5

  ) {

    this.setMarchingCubesResolution(
      resolution
    );

    const positions =
      this.isosurfaceHelper
      .gridVertices;

    const triplane =
      this.renderer.queryTriplane(

        this.decoder,

        positions,

        sceneCodes

      );

    const density =
      triplane.density_act;

    const mc =
      this.isosurfaceHelper.extract(
        density,
        threshold
      );

    /*
    THREE GEOMETRY
    */

    const geometry =
      new THREE.BufferGeometry();

    const verts =
      new Float32Array(
        mc.vertices.flat()
      );

    const indices =
      new Uint32Array(
        mc.faces.flat()
      );

    geometry.setAttribute(

      'position',

      new THREE.BufferAttribute(
        verts,
        3
      )

    );

    geometry.setIndex(

      new THREE.BufferAttribute(
        indices,
        1
      )

    );

    geometry.computeVertexNormals();

    /*
    colors
    */

    if(hasVertexColor) {

      const colors =
        [];

      for(const c of triplane.color) {

        colors.push(
          c[0],
          c[1],
          c[2]
        );

      }

      geometry.setAttribute(

        'color',

        new THREE.BufferAttribute(

          new Float32Array(colors),

          3

        )

      );

    }

    const material =
      new THREE.MeshStandardMaterial({

        vertexColors:
          hasVertexColor,

        flatShading: true

      });

    const mesh =
      new THREE.Mesh(
        geometry,
        material
      );

    return mesh;

  }

  /*
  EXPORT GLTF
  */

  exportGLTF(mesh) {

    return new Promise(resolve=>{

      const exporter =
        new GLTFExporter();

      exporter.parse(

        mesh,

        gltf => {

          const blob =
            new Blob(

              [

                JSON.stringify(
                  gltf
                )

              ],

              {

                type:
                  'model/gltf+json'

              }

            );

          resolve(blob);

        }

      );

    });

  }

}

/*
========================================================
FULL PIPELINE
========================================================
*/

export async function run2Dto3D(

  imageBitmap

) {

  const tsr =
    new TSR({

      condImageSize: 256

    });

  /*
  forward
  */

  const scene =
    await tsr.forward(
      imageBitmap
    );

  /*
  extract mesh
  */

  const mesh =
    tsr.extractMesh(

      scene,

      true,

      32,

      4

    );

  /*
  render previews
  */

  const previews =
    await tsr.render(
      scene
    );

  /*
  export
  */

  const gltf =
    await tsr.exportGLTF(
      mesh
    );

  return {

    scene,
    mesh,
    previews,
    gltf

  };

}

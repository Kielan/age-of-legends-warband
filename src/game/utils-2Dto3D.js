/*
========================================================
2DTO3D UTILS
Minimal JS replacement for PyTorch utility layer
========================================================
*/

/*
========================================================
TENSOR HELPERS
========================================================
*/

export class Tensor {

  constructor(data, shape) {

    this.data =
      data instanceof Float32Array
      ? data
      : new Float32Array(data);

    this.shape = shape;

  }

  static zeros(shape) {

    const size =
      shape.reduce((a,b)=>a*b,1);

    return new Tensor(
      new Float32Array(size),
      shape
    );

  }

  static ones(shape) {

    const size =
      shape.reduce((a,b)=>a*b,1);

    return new Tensor(
      new Float32Array(size).fill(1),
      shape
    );

  }

  clone() {

    return new Tensor(
      this.data.slice(),
      [...this.shape]
    );

  }

}

/*
========================================================
ACTIVATIONS
========================================================
*/

export const Activations = {

  sigmoid(x) {

    return 1 / (1 + Math.exp(-x));

  },

  tanh(x) {

    return Math.tanh(x);

  },

  relu(x) {

    return Math.max(0, x);

  },

  softplus(x) {

    return Math.log(1 + Math.exp(x));

  },

  exp(x) {

    return Math.exp(x);

  }

};

/*
========================================================
IMAGE PREPROCESSOR
========================================================
*/

export class ImagePreprocessor {

  async loadImage(file) {

    return await createImageBitmap(file);

  }

  resize(image, size=256) {

    const canvas =
      document.createElement('canvas');

    canvas.width = size;
    canvas.height = size;

    const ctx =
      canvas.getContext('2d');

    ctx.drawImage(
      image,
      0,
      0,
      size,
      size
    );

    return ctx.getImageData(
      0,
      0,
      size,
      size
    );

  }

  imageToTensor(imageData) {

    const {data,width,height} =
      imageData;

    const out =
      new Float32Array(
        width * height * 4
      );

    for(let i=0;i<data.length;i++) {

      out[i] =
        data[i] / 255;

    }

    return new Tensor(
      out,
      [height,width,4]
    );

  }

}

/*
========================================================
EDGE DETECTION
Simple Sobel
========================================================
*/

export function sobelEdgeDetect(
  imageData
) {

  const w = imageData.width;
  const h = imageData.height;

  const src = imageData.data;

  const out =
    new Float32Array(w*h);

  const gxKernel = [
    -1,0,1,
    -2,0,2,
    -1,0,1
  ];

  const gyKernel = [
    -1,-2,-1,
     0, 0, 0,
     1, 2, 1
  ];

  for(let y=1;y<h-1;y++) {

    for(let x=1;x<w-1;x++) {

      let gx = 0;
      let gy = 0;

      let k = 0;

      for(let ky=-1;ky<=1;ky++) {

        for(let kx=-1;kx<=1;kx++) {

          const px =
            ((y+ky)*w + (x+kx))*4;

          const gray =
            (
              src[px] +
              src[px+1] +
              src[px+2]
            ) / 3;

          gx += gray * gxKernel[k];
          gy += gray * gyKernel[k];

          k++;

        }

      }

      const mag =
        Math.sqrt(gx*gx + gy*gy);

      out[y*w+x] = mag;

    }

  }

  return new Tensor(out,[h,w]);

}

/*
========================================================
VERTEX INFERENCE
========================================================
*/

export function inferVertices(
  edgeTensor,
  threshold=120
) {

  const verts = [];

  const w =
    edgeTensor.shape[1];

  const h =
    edgeTensor.shape[0];

  const data =
    edgeTensor.data;

  for(let y=1;y<h-1;y+=4) {

    for(let x=1;x<w-1;x+=4) {

      const i = y*w + x;

      const v = data[i];

      /*
      line intersection heuristic
      */

      if(v > threshold) {

        let neighbors = 0;

        for(let oy=-1;oy<=1;oy++) {

          for(let ox=-1;ox<=1;ox++) {

            const ni =
              (y+oy)*w + (x+ox);

            if(data[ni] > threshold)
              neighbors++;

          }

        }

        if(neighbors >= 5) {

          verts.push({
            x,
            y,
            z:
              Math.sin(x*.05)*4 +
              Math.cos(y*.05)*4
          });

        }

      }

    }

  }

  return verts;

}

/*
========================================================
EDGE GRAPH
========================================================
*/

export function buildEdgeGraph(
  verts,
  maxDist=18
) {

  const edges = [];

  for(let i=0;i<verts.length;i++) {

    for(let j=i+1;j<verts.length;j++) {

      const a = verts[i];
      const b = verts[j];

      const dx = a.x-b.x;
      const dy = a.y-b.y;

      const dist =
        Math.sqrt(dx*dx+dy*dy);

      if(dist < maxDist) {

        edges.push([i,j]);

      }

    }

  }

  return edges;

}

/*
========================================================
FACE GENERATION
========================================================
*/

export function buildFaces(
  verts
) {

  const faces = [];

  for(let i=0;i<verts.length-2;i+=3) {

    faces.push([
      i,
      i+1,
      i+2
    ]);

  }

  return faces;

}

/*
========================================================
DEPTH ESTIMATION
Fake procedural version
========================================================
*/

export function inferDepth(
  verts
) {

  return verts.map(v => ({

    ...v,

    z:
      Math.sin(v.x * .03) * 8 +
      Math.cos(v.y * .04) * 8

  }));

}

/*
========================================================
RAY DIRECTIONS
Equivalent to get_ray_directions
========================================================
*/

export function getRayDirections(
  width,
  height,
  focal
) {

  const dirs = [];

  const cx = width / 2;
  const cy = height / 2;

  for(let y=0;y<height;y++) {

    for(let x=0;x<width;x++) {

      const dx =
        (x - cx) / focal;

      const dy =
        -(y - cy) / focal;

      const dz = -1;

      const len =
        Math.sqrt(
          dx*dx + dy*dy + dz*dz
        );

      dirs.push({

        x: dx/len,
        y: dy/len,
        z: dz/len

      });

    }

  }

  return dirs;

}

/*
========================================================
BATCH PROCESSOR
Equivalent to chunk_batch
========================================================
*/

export async function chunkBatch(
  array,
  chunkSize,
  fn
) {

  const out = [];

  for(
    let i=0;
    i<array.length;
    i+=chunkSize
  ) {

    const chunk =
      array.slice(i,i+chunkSize);

    const result =
      await fn(chunk);

    out.push(...result);

  }

  return out;

}

/*
========================================================
NORMALIZE
========================================================
*/

export function normalize(v) {

  const len =
    Math.sqrt(
      v.x*v.x +
      v.y*v.y +
      v.z*v.z
    );

  return {

    x: v.x/len,
    y: v.y/len,
    z: v.z/len

  };

}

/*
========================================================
SPHERICAL CAMERAS
========================================================
*/

export function getSphericalCameras(
  views=8,
  radius=4
) {

  const cams = [];

  for(let i=0;i<views;i++) {

    const theta =
      (i/views) * Math.PI * 2;

    cams.push({

      x: Math.cos(theta)*radius,
      y: 1.5,
      z: Math.sin(theta)*radius

    });

  }

  return cams;

}

/*
========================================================
BACKGROUND REMOVAL
Placeholder
========================================================
*/

export async function removeBackground(
  imageBitmap
) {

  /*
  In production:
  use ONNX Runtime Web
  with RMBG model
  */

  return imageBitmap;

}

/*
========================================================
FOREGROUND RESIZE
========================================================
*/

export function resizeForeground(
  imageData,
  ratio=.85
) {

  /*
  simplified crop/pad
  */

  return imageData;

}

/*
========================================================
VIDEO EXPORT
========================================================
*/

export async function saveVideo(
  canvas,
  duration=3000
) {

  const stream =
    canvas.captureStream(30);

  const recorder =
    new MediaRecorder(stream);

  const chunks = [];

  recorder.ondataavailable =
    e => chunks.push(e.data);

  recorder.start();

  await new Promise(r =>
    setTimeout(r,duration)
  );

  recorder.stop();

  return new Promise(resolve => {

    recorder.onstop = () => {

      const blob =
        new Blob(chunks,{
          type:'video/webm'
        });

      resolve(blob);

    };

  });

}

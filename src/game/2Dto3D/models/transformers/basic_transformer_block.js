/*
========================================================
models/transformer/basic_transformer_block.js
Vanilla JavaScript Port
========================================================

PyTorch → Vanilla JS

nn.LayerNorm           -> LayerNorm
nn.Linear              -> DenseLayer
Attention              -> Attention
FeedForward            -> FeedForward
GEGLU                  -> GEGLU
GELU                   -> GELU

========================================================
*/

import { Attention } from "./attention.js";
import { DenseLayer } from "../network_utils.js";


/*
========================================================
HELPERS
========================================================
*/

function gelu(x) {

  return (
    0.5 *
    x *
    (
      1 +
      Math.tanh(
        Math.sqrt(2 / Math.PI) *
        (
          x +
          0.044715 * Math.pow(x,3)
        )
      )
    )
  );

}

function sigmoid(x) {

  return 1 / (1 + Math.exp(-x));

}

function addTensors(a,b) {

  const out =
    new Float32Array(a.length);

  for(let i=0;i<a.length;i++) {

    out[i] =
      a[i] + b[i];

  }

  return out;

}


/*
========================================================
LAYER NORM
========================================================
*/

export class LayerNorm {

  constructor(

    dim,
    eps=1e-5,
    affine=true

  ) {

    this.dim = dim;
    this.eps = eps;
    this.affine = affine;

    this.weight =
      new Float32Array(dim).fill(1);

    this.bias =
      new Float32Array(dim).fill(0);

  }

  forward(tensor) {

    const {

      data,
      shape

    } = tensor;

    const [

      B,
      L,
      D

    ] = shape;

    const out =
      new Float32Array(
        data.length
      );

    for(let b=0;b<B;b++) {

      for(let l=0;l<L;l++) {

        let mean = 0;

        for(let d=0;d<D;d++) {

          const idx =

            (
              (b*L+l)*D+d
            );

          mean += data[idx];

        }

        mean /= D;

        let variance = 0;

        for(let d=0;d<D;d++) {

          const idx =

            (
              (b*L+l)*D+d
            );

          const diff =
            data[idx]-mean;

          variance +=
            diff*diff;

        }

        variance /= D;

        const invStd =
          1 /
          Math.sqrt(
            variance + this.eps
          );

        for(let d=0;d<D;d++) {

          const idx =

            (
              (b*L+l)*D+d
            );

          let value =

            (
              data[idx]-mean
            )
            *
            invStd;

          if(this.affine) {

            value =
              value *
              this.weight[d]
              +
              this.bias[d];

          }

          out[idx] = value;

        }

      }

    }

    return {

      data: out,
      shape

    };

  }

}


/*
========================================================
GELU
========================================================
*/

export class GELU {

  constructor(

    dimIn,
    dimOut,

    approximate="none"

  ) {

    this.proj =
      new DenseLayer(
        dimIn,
        dimOut
      );

    this.approximate =
      approximate;

  }

  forward(hiddenStates) {

    const x =
      this.proj.forward(
        hiddenStates.data
      );

    const out =
      new Float32Array(
        x.length
      );

    for(let i=0;i<x.length;i++) {

      out[i] =
        gelu(x[i]);

    }

    return {

      data: out,

      shape: [

        hiddenStates.shape[0],

        hiddenStates.shape[1],

        this.proj.outFeatures

      ]

    };

  }

}


/*
========================================================
GEGLU
========================================================
*/

export class GEGLU {

  constructor(

    dimIn,
    dimOut

  ) {

    this.dimOut =
      dimOut;

    this.proj =
      new DenseLayer(

        dimIn,

        dimOut * 2

      );

  }

  forward(hiddenStates) {

    const proj =
      this.proj.forward(
        hiddenStates.data
      );

    const total =
      proj.length;

    const half =
      total / 2;

    const out =
      new Float32Array(
        half
      );

    for(let i=0;i<half;i++) {

      const value =
        proj[i];

      const gate =
        proj[i+half];

      out[i] =
        value *
        gelu(gate);

    }

    return {

      data: out,

      shape: [

        hiddenStates.shape[0],

        hiddenStates.shape[1],

        this.dimOut

      ]

    };

  }

}


/*
========================================================
APPROXIMATE GELU
========================================================
*/

export class ApproximateGELU {

  constructor(

    dimIn,
    dimOut

  ) {

    this.proj =
      new DenseLayer(
        dimIn,
        dimOut
      );

    this.dimOut =
      dimOut;

  }

  forward(hiddenStates) {

    const x =
      this.proj.forward(
        hiddenStates.data
      );

    const out =
      new Float32Array(
        x.length
      );

    for(let i=0;i<x.length;i++) {

      out[i] =
        x[i]
        *
        sigmoid(
          1.702 * x[i]
        );

    }

    return {

      data: out,

      shape: [

        hiddenStates.shape[0],

        hiddenStates.shape[1],

        this.dimOut

      ]

    };

  }

}


/*
========================================================
FEED FORWARD
========================================================
*/

export class FeedForward {

  constructor({

    dim,

    dimOut=null,

    mult=4,

    dropout=0,

    activationFn="geglu",

    finalDropout=false

  }) {

    this.dim = dim;

    this.innerDim =
      Math.floor(dim * mult);

    this.dimOut =
      dimOut ?? dim;

    /*
    activation
    */

    if(
      activationFn === "gelu"
    ) {

      this.actFn =
        new GELU(
          dim,
          this.innerDim
        );

    }

    else if(
      activationFn ===
      "gelu-approximate"
    ) {

      this.actFn =
        new GELU(
          dim,
          this.innerDim,
          "tanh"
        );

    }

    else if(
      activationFn === "geglu"
    ) {

      this.actFn =
        new GEGLU(
          dim,
          this.innerDim
        );

    }

    else if(
      activationFn ===
      "geglu-approximate"
    ) {

      this.actFn =
        new ApproximateGELU(
          dim,
          this.innerDim
        );

    }

    /*
    output projection
    */

    this.projOut =
      new DenseLayer(

        this.innerDim,

        this.dimOut

      );

    this.dropout =
      dropout;

    this.finalDropout =
      finalDropout;

  }

  forward(hiddenStates) {

    let x =
      this.actFn.forward(
        hiddenStates
      );

    /*
    TODO:
    dropout
    */

    const proj =
      this.projOut.forward(
        x.data
      );

    return {

      data: proj,

      shape: [

        hiddenStates.shape[0],

        hiddenStates.shape[1],

        this.dimOut

      ]

    };

  }

}


/*
========================================================
BASIC TRANSFORMER BLOCK
========================================================
*/

export class BasicTransformerBlock {

  constructor({

    dim,

    numAttentionHeads,

    attentionHeadDim,

    dropout=0,

    crossAttentionDim=null,

    activationFn="geglu",

    attentionBias=false,

    onlyCrossAttention=false,

    doubleSelfAttention=false,

    upcastAttention=false,

    normElementwiseAffine=true,

    normType="layer_norm",

    finalDropout=false

  }) {

    this.onlyCrossAttention =
      onlyCrossAttention;

    /*
    ====================================================
    Self Attention
    ====================================================
    */

    this.norm1 =
      new LayerNorm(

        dim,
        1e-5,
        normElementwiseAffine

      );

    this.attn1 =
      new Attention({

        queryDim: dim,

        heads:
          numAttentionHeads,

        dimHead:
          attentionHeadDim,

        dropout,

        bias:
          attentionBias,

        crossAttentionDim:

          onlyCrossAttention
          ? crossAttentionDim
          : null,

        upcastAttention

      });

    /*
    ====================================================
    Cross Attention
    ====================================================
    */

    if(
      crossAttentionDim !== null
      ||
      doubleSelfAttention
    ) {

      this.norm2 =
        new LayerNorm(

          dim,
          1e-5,
          normElementwiseAffine

        );

      this.attn2 =
        new Attention({

          queryDim: dim,

          crossAttentionDim:

            !doubleSelfAttention
            ? crossAttentionDim
            : null,

          heads:
            numAttentionHeads,

          dimHead:
            attentionHeadDim,

          dropout,

          bias:
            attentionBias,

          upcastAttention

        });

    }

    else {

      this.norm2 = null;
      this.attn2 = null;

    }

    /*
    ====================================================
    Feed Forward
    ====================================================
    */

    this.norm3 =
      new LayerNorm(

        dim,
        1e-5,
        normElementwiseAffine

      );

    this.ff =
      new FeedForward({

        dim,

        dropout,

        activationFn,

        finalDropout

      });

    /*
    chunking
    */

    this.chunkSize = null;
    this.chunkDim = 0;

  }

  /*
  ======================================================
  Chunk FF
  ======================================================
  */

  setChunkFeedForward(

    chunkSize,
    dim

  ) {

    this.chunkSize =
      chunkSize;

    this.chunkDim =
      dim;

  }

  /*
  ======================================================
  FORWARD
  ======================================================
  */

  forward(

    hiddenStates,

    {

      attentionMask=null,

      encoderHiddenStates=null,

      encoderAttentionMask=null

    }={}

  ) {

    /*
    --------------------------------------------------
    Self Attention
    --------------------------------------------------
    */

    let normHiddenStates =
      this.norm1.forward(
        hiddenStates
      );

    let attnOutput =
      this.attn1.forward(

        normHiddenStates,

        {

          encoderHiddenStates:

            this.onlyCrossAttention
            ? encoderHiddenStates
            : null,

          attentionMask

        }

      );

    hiddenStates = {

      data: addTensors(

        hiddenStates.data,

        attnOutput.data

      ),

      shape:
        hiddenStates.shape

    };

    /*
    --------------------------------------------------
    Cross Attention
    --------------------------------------------------
    */

    if(this.attn2) {

      normHiddenStates =
        this.norm2.forward(
          hiddenStates
        );

      attnOutput =
        this.attn2.forward(

          normHiddenStates,

          {

            encoderHiddenStates,

            attentionMask:
              encoderAttentionMask

          }

        );

      hiddenStates = {

        data: addTensors(

          hiddenStates.data,

          attnOutput.data

        ),

        shape:
          hiddenStates.shape

      };

    }

    /*
    --------------------------------------------------
    Feed Forward
    --------------------------------------------------
    */

    normHiddenStates =
      this.norm3.forward(
        hiddenStates
      );

    let ffOutput;

    /*
    chunked FF
    */

    if(this.chunkSize) {

      /*
      TODO:
      chunking implementation
      */

      ffOutput =
        this.ff.forward(
          normHiddenStates
        );

    }

    else {

      ffOutput =
        this.ff.forward(
          normHiddenStates
        );

    }

    hiddenStates = {

      data: addTensors(

        hiddenStates.data,

        ffOutput.data

      ),

      shape:
        hiddenStates.shape

    };

    return hiddenStates;

  }

}


/*
========================================================
EXAMPLE
========================================================

const block =
  new BasicTransformerBlock({

    dim: 512,

    numAttentionHeads: 8,

    attentionHeadDim: 64,

    crossAttentionDim: 768

  });

const x = {

  data:
    new Float32Array(
      1 * 128 * 512
    ),

  shape: [1,128,512]

};

const out =
  block.forward(x);

console.log(out);

========================================================
*/


/*
========================================================
NEXT UPGRADES
========================================================

[ ] Flash Attention
[ ] WebGPU compute kernels
[ ] fp16 support
[ ] sparse attention
[ ] rotary embeddings
[ ] memory efficient attention
[ ] Triton/WebGPU kernels
[ ] fused MLP kernels
[ ] fused layernorm
[ ] KV cache
[ ] streaming transformer
[ ] diffusion transformer blocks

========================================================
*/

/*
========================================================
models/transformer/transformer_1d.js
Vanilla JavaScript Port
========================================================

PyTorch Transformer → Vanilla JavaScript

torch.nn.Linear         -> DenseLayer
GroupNorm               -> GroupNorm1D
TransformerBlock        -> BasicTransformerBlock
torch.Tensor            -> Float32Array
checkpointing           -> omitted
CUDA                    -> future WebGPU

========================================================
FEATURES
========================================================

[x] Transformer encoder
[x] Multi-head attention
[x] Cross attention
[x] GroupNorm
[x] Residual connections
[x] Layer stacking
[x] Attention masks
[x] Browser-native
[x] WebGPU-ready architecture

========================================================
*/

import {

  BaseModule

} from "../../utils.js";

import {

  DenseLayer

} from "../network_utils.js";

import {

  BasicTransformerBlock

} from "./basic_transformer_block.js";


/*
========================================================
HELPERS
========================================================
*/

function tensorShape(data,shape) {

  return {
    data,
    shape
  };

}

function zeros(size) {

  return new Float32Array(size);

}

function reshape(

  tensor,
  shape

) {

  return {
    data: tensor.data,
    shape
  };

}

function transposeBCLtoBLC(

  tensor

) {

  const {

    data,
    shape

  } = tensor;

  const [

    B,
    C,
    L

  ] = shape;

  const out =
    new Float32Array(
      B * L * C
    );

  let ptr = 0;

  for(let b=0;b<B;b++) {

    for(let l=0;l<L;l++) {

      for(let c=0;c<C;c++) {

        const idx =

          (
            (b*C + c)
            * L + l
          );

        out[ptr++] =
          data[idx];

      }

    }

  }

  return {

    data: out,

    shape: [B,L,C]

  };

}

function transposeBLCtoBCL(

  tensor

) {

  const {

    data,
    shape

  } = tensor;

  const [

    B,
    L,
    C

  ] = shape;

  const out =
    new Float32Array(
      B * C * L
    );

  let ptr = 0;

  for(let b=0;b<B;b++) {

    for(let c=0;c<C;c++) {

      for(let l=0;l<L;l++) {

        const idx =

          (
            (b*L + l)
            * C + c
          );

        out[ptr++] =
          data[idx];

      }

    }

  }

  return {

    data: out,

    shape: [B,C,L]

  };

}


/*
========================================================
GROUP NORM 1D
========================================================

Equivalent to:

torch.nn.GroupNorm

========================================================
*/

export class GroupNorm1D {

  constructor(

    numGroups,
    numChannels,

    eps=1e-6

  ) {

    this.numGroups =
      numGroups;

    this.numChannels =
      numChannels;

    this.eps = eps;

    /*
    affine params
    */

    this.weight =
      new Float32Array(
        numChannels
      ).fill(1);

    this.bias =
      new Float32Array(
        numChannels
      ).fill(0);

  }

  forward(tensor) {

    const {

      data,
      shape

    } = tensor;

    const [

      B,
      C,
      L

    ] = shape;

    const G =
      this.numGroups;

    const channelsPerGroup =
      C / G;

    const out =
      new Float32Array(
        data.length
      );

    for(let b=0;b<B;b++) {

      for(let g=0;g<G;g++) {

        /*
        stats
        */

        let mean = 0;
        let variance = 0;
        let count = 0;

        for(
          let c=0;
          c<channelsPerGroup;
          c++
        ) {

          const cc =
            g*channelsPerGroup+c;

          for(let l=0;l<L;l++) {

            const idx =

              (
                (b*C + cc)
                * L + l
              );

            mean += data[idx];

            count++;

          }

        }

        mean /= count;

        for(
          let c=0;
          c<channelsPerGroup;
          c++
        ) {

          const cc =
            g*channelsPerGroup+c;

          for(let l=0;l<L;l++) {

            const idx =

              (
                (b*C + cc)
                * L + l
              );

            const d =
              data[idx]-mean;

            variance +=
              d*d;

          }

        }

        variance /= count;

        const invStd =
          1 /
          Math.sqrt(
            variance + this.eps
          );

        /*
        normalize
        */

        for(
          let c=0;
          c<channelsPerGroup;
          c++
        ) {

          const cc =
            g*channelsPerGroup+c;

          for(let l=0;l<L;l++) {

            const idx =

              (
                (b*C + cc)
                * L + l
              );

            out[idx] =

              (
                (
                  data[idx]-mean
                )
                * invStd
              )
              *
              this.weight[cc]

              +

              this.bias[cc];

          }

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
TRANSFORMER 1D
========================================================
*/

export class Transformer1D
extends BaseModule {

  configure() {

    /*
    defaults
    */

    this.cfg = {

      numAttentionHeads: 16,

      attentionHeadDim: 88,

      inChannels: 64,

      outChannels: null,

      numLayers: 1,

      dropout: 0,

      normNumGroups: 32,

      crossAttentionDim: null,

      attentionBias: false,

      activationFn: "geglu",

      onlyCrossAttention: false,

      doubleSelfAttention: false,

      upcastAttention: false,

      normType: "layer_norm",

      normElementwiseAffine: true,

      gradientCheckpointing:
        false,

      ...this.cfg

    };

    /*
    inner dim
    */

    this.numAttentionHeads =
      this.cfg.numAttentionHeads;

    this.attentionHeadDim =
      this.cfg.attentionHeadDim;

    this.innerDim =

      this.numAttentionHeads
      *
      this.attentionHeadDim;

    /*
    input
    */

    this.inChannels =
      this.cfg.inChannels;

    this.norm =
      new GroupNorm1D(

        this.cfg.normNumGroups,

        this.cfg.inChannels

      );

    this.projIn =
      new DenseLayer(

        this.cfg.inChannels,

        this.innerDim

      );

    /*
    transformer blocks
    */

    this.transformerBlocks =
      [];

    for(
      let i=0;
      i<this.cfg.numLayers;
      i++
    ) {

      this.transformerBlocks.push(

        new BasicTransformerBlock({

          dim:
            this.innerDim,

          numAttentionHeads:
            this.numAttentionHeads,

          attentionHeadDim:
            this.attentionHeadDim,

          dropout:
            this.cfg.dropout,

          crossAttentionDim:
            this.cfg.crossAttentionDim,

          activationFn:
            this.cfg.activationFn,

          attentionBias:
            this.cfg.attentionBias,

          onlyCrossAttention:
            this.cfg.onlyCrossAttention,

          doubleSelfAttention:
            this.cfg.doubleSelfAttention,

          upcastAttention:
            this.cfg.upcastAttention,

          normType:
            this.cfg.normType

        })

      );

    }

    /*
    output
    */

    this.outChannels =

      this.cfg.outChannels
      ??
      this.cfg.inChannels;

    this.projOut =
      new DenseLayer(

        this.innerDim,

        this.cfg.inChannels

      );

    this.gradientCheckpointing =
      this.cfg.gradientCheckpointing;

  }

  /*
  ======================================================
  MASK → BIAS
  ======================================================
  */

  maskToBias(mask) {

    /*
    mask:
    1 keep
    0 discard

    becomes:

    0 keep
    -10000 discard
    */

    const out =
      new Float32Array(
        mask.length
      );

    for(let i=0;i<mask.length;i++) {

      out[i] =

        (1-mask[i])
        *
        -10000;

    }

    return out;

  }

  /*
  ======================================================
  FORWARD
  ======================================================
  */

  forward(

    hiddenStates,

    {

      encoderHiddenStates=null,

      attentionMask=null,

      encoderAttentionMask=null

    }={}

  ) {

    /*
    hiddenStates:
    [B,C,L]
    */

    const [

      batch,
      channels,
      seqLen

    ] = hiddenStates.shape;

    /*
    masks
    */

    if(attentionMask) {

      attentionMask =
        this.maskToBias(
          attentionMask
        );

    }

    if(encoderAttentionMask) {

      encoderAttentionMask =
        this.maskToBias(
          encoderAttentionMask
        );

    }

    /*
    residual
    */

    const residual =
      hiddenStates.data.slice();

    /*
    --------------------------------------------------
    Input
    --------------------------------------------------
    */

    let x =
      this.norm.forward(
        hiddenStates
      );

    /*
    B,C,L
    →
    B,L,C
    */

    x =
      transposeBCLtoBLC(x);

    /*
    flatten
    */

    const flat =
      x.data;

    /*
    proj in
    */

    const proj =
      this.projIn.forward(
        flat
      );

    x = {

      data: proj,

      shape: [

        batch,

        seqLen,

        this.innerDim

      ]

    };

    /*
    --------------------------------------------------
    Transformer blocks
    --------------------------------------------------
    */

    for(
      const block of
      this.transformerBlocks
    ) {

      x =
        block.forward(

          x,

          {

            attentionMask,

            encoderHiddenStates,

            encoderAttentionMask

          }

        );

    }

    /*
    --------------------------------------------------
    Output
    --------------------------------------------------
    */

    const outProj =
      this.projOut.forward(
        x.data
      );

    x = {

      data: outProj,

      shape: [

        batch,

        seqLen,

        channels

      ]

    };

    /*
    B,L,C
    →
    B,C,L
    */

    x =
      transposeBLCtoBCL(x);

    /*
    residual add
    */

    const out =
      new Float32Array(
        x.data.length
      );

    for(let i=0;i<out.length;i++) {

      out[i] =

        x.data[i]
        +
        residual[i];

    }

    return {

      data: out,

      shape: [

        batch,

        channels,

        seqLen

      ]

    };

  }

}


/*
========================================================
EXAMPLE
========================================================

const transformer =
  new Transformer1D({

    inChannels: 64,

    numLayers: 4,

    numAttentionHeads: 8,

    attentionHeadDim: 64

  });

const input = {

  data: new Float32Array(
    1 * 64 * 128
  ),

  shape: [1,64,128]

};

const output =
  transformer.forward(input);

console.log(output);

========================================================
*/


/*
========================================================
FUTURE UPGRADES
========================================================

[ ] Flash Attention
[ ] WebGPU attention kernels
[ ] CUDA-style tensor ops
[ ] fp16 inference
[ ] KV caching
[ ] Rotary embeddings
[ ] ALiBi attention
[ ] Sparse attention
[ ] Transformer decoder
[ ] Cross-frame attention
[ ] Temporal transformers
[ ] Diffusion transformers
[ ] Multi-query attention
[ ] Triton/WebGPU backend
[ ] ONNX import

========================================================
*/

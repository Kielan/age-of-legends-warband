// attentions.js
// JavaScript / TensorFlow.js port of models/transformers/attentions.py

import * as tf from "@tensorflow/tfjs";

/* ------------------------------------------------------- */
/* Utils */
/* ------------------------------------------------------- */

function softmax(x, axis = -1) {
  return tf.softmax(x, axis);
}

function gelu(x) {
  return tf.mul(
    0.5,
    tf.mul(
      x,
      tf.add(
        1,
        tf.erf(tf.div(x, Math.sqrt(2.0)))
      )
    )
  );
}

function dropout(x, rate = 0.0, training = false) {
  if (!training || rate <= 0.0) return x;

  const keepProb = 1 - rate;
  const mask = tf.randomUniform(x.shape)
    .greater(tf.scalar(rate))
    .toFloat();

  return x.mul(mask).div(tf.scalar(keepProb));
}

/* ------------------------------------------------------- */
/* Linear */
/* ------------------------------------------------------- */

export class Linear {
  constructor(inFeatures, outFeatures, useBias = true) {
    this.inFeatures = inFeatures;
    this.outFeatures = outFeatures;

    this.weight = tf.variable(
      tf.randomNormal([inFeatures, outFeatures], 0, 0.02)
    );

    this.bias = useBias
      ? tf.variable(tf.zeros([outFeatures]))
      : null;
  }

  forward(x) {
    const y = tf.matMul(x, this.weight);

    if (this.bias) {
      return tf.add(y, this.bias);
    }

    return y;
  }
}

/* ------------------------------------------------------- */
/* LayerNorm */
/* ------------------------------------------------------- */

export class LayerNorm {
  constructor(dim, eps = 1e-5) {
    this.gamma = tf.variable(tf.ones([dim]));
    this.beta = tf.variable(tf.zeros([dim]));
    this.eps = eps;
  }

  forward(x) {
    const mean = tf.mean(x, -1, true);
    const variance = tf.mean(
      tf.square(tf.sub(x, mean)),
      -1,
      true
    );

    return tf.add(
      tf.mul(
        tf.div(
          tf.sub(x, mean),
          tf.sqrt(tf.add(variance, this.eps))
        ),
        this.gamma
      ),
      this.beta
    );
  }
}

/* ------------------------------------------------------- */
/* GroupNorm */
/* ------------------------------------------------------- */

export class GroupNorm {
  constructor(numGroups, numChannels, eps = 1e-5) {
    this.numGroups = numGroups;
    this.numChannels = numChannels;
    this.eps = eps;

    this.gamma = tf.variable(tf.ones([numChannels]));
    this.beta = tf.variable(tf.zeros([numChannels]));
  }

  forward(x) {
    // x: [B, C, T]

    const [B, C, T] = x.shape;
    const G = this.numGroups;

    const reshaped = x.reshape([B, G, C / G, T]);

    const mean = tf.mean(reshaped, [2, 3], true);
    const variance = tf.mean(
      tf.square(tf.sub(reshaped, mean)),
      [2, 3],
      true
    );

    let y = tf.div(
      tf.sub(reshaped, mean),
      tf.sqrt(tf.add(variance, this.eps))
    );

    y = y.reshape([B, C, T]);

    y = tf.add(
      tf.mul(y, this.gamma.reshape([1, C, 1])),
      this.beta.reshape([1, C, 1])
    );

    return y;
  }
}

/* ------------------------------------------------------- */
/* Attention */
/* ------------------------------------------------------- */

export class Attention {
  constructor({
    queryDim,
    crossAttentionDim = null,
    heads = 8,
    dimHead = 64,
    dropout = 0.0,
    bias = false,
    upcastAttention = false,
    upcastSoftmax = false,
    crossAttentionNorm = null,
    crossAttentionNormNumGroups = 32,
    addedKvProjDim = null,
    normNumGroups = null,
    outBias = true,
    scaleQk = true,
    onlyCrossAttention = false,
    eps = 1e-5,
    rescaleOutputFactor = 1.0,
    residualConnection = false,
    outDim = null,
  }) {
    this.innerDim = outDim ?? dimHead * heads;
    this.queryDim = queryDim;

    this.crossAttentionDim =
      crossAttentionDim ?? queryDim;

    this.upcastAttention = upcastAttention;
    this.upcastSoftmax = upcastSoftmax;

    this.rescaleOutputFactor =
      rescaleOutputFactor;

    this.residualConnection =
      residualConnection;

    this.dropout = dropout;

    this.scaleQk = scaleQk;

    this.scale = scaleQk
      ? Math.pow(dimHead, -0.5)
      : 1.0;

    this.heads =
      outDim != null
        ? Math.floor(outDim / dimHead)
        : heads;

    this.outDim = outDim ?? queryDim;

    this.onlyCrossAttention =
      onlyCrossAttention;

    this.addedKvProjDim =
      addedKvProjDim;

    if (
      this.addedKvProjDim == null &&
      this.onlyCrossAttention
    ) {
      throw new Error(
        "onlyCrossAttention requires addedKvProjDim"
      );
    }

    /* ----------------------------- */
    /* Norms */
    /* ----------------------------- */

    if (normNumGroups != null) {
      this.groupNorm = new GroupNorm(
        normNumGroups,
        queryDim,
        eps
      );
    } else {
      this.groupNorm = null;
    }

    if (crossAttentionNorm == null) {
      this.normCross = null;
    } else if (crossAttentionNorm === "layer_norm") {
      this.normCross = new LayerNorm(
        this.crossAttentionDim,
        eps
      );
    } else {
      throw new Error(
        "Only layer_norm currently supported in JS port"
      );
    }

    /* ----------------------------- */
    /* Projections */
    /* ----------------------------- */

    this.toQ = new Linear(
      queryDim,
      this.innerDim,
      bias
    );

    if (!onlyCrossAttention) {
      this.toK = new Linear(
        this.crossAttentionDim,
        this.innerDim,
        bias
      );

      this.toV = new Linear(
        this.crossAttentionDim,
        this.innerDim,
        bias
      );
    } else {
      this.toK = null;
      this.toV = null;
    }

    if (addedKvProjDim != null) {
      this.addKProj = new Linear(
        addedKvProjDim,
        this.innerDim
      );

      this.addVProj = new Linear(
        addedKvProjDim,
        this.innerDim
      );
    }

    this.toOut = [
      new Linear(
        this.innerDim,
        this.outDim,
        outBias
      ),
      {
        forward: (x, training = false) =>
          dropout(
            x,
            this.dropout,
            training
          ),
      },
    ];

    this.processor = new AttnProcessor2_0();
  }

  setProcessor(processor) {
    this.processor = processor;
  }

  forward(
    hiddenStates,
    encoderHiddenStates = null,
    attentionMask = null
  ) {
    return this.processor.call(
      this,
      hiddenStates,
      encoderHiddenStates,
      attentionMask
    );
  }

  headToBatchDim(tensor, outDim = 3) {
    // [B, T, D]

    const [B, T, D] = tensor.shape;

    const H = this.heads;
    const Hd = D / H;

    let x = tensor.reshape([B, T, H, Hd]);

    x = tf.transpose(x, [0, 2, 1, 3]);

    if (outDim === 3) {
      x = x.reshape([B * H, T, Hd]);
    }

    return x;
  }

  batchToHeadDim(tensor) {
    // [B*H, T, Hd]

    const H = this.heads;

    const [BH, T, Hd] = tensor.shape;

    const B = Math.floor(BH / H);

    let x = tensor.reshape([B, H, T, Hd]);

    x = tf.transpose(x, [0, 2, 1, 3]);

    x = x.reshape([B, T, H * Hd]);

    return x;
  }

  prepareAttentionMask(
    attentionMask,
    targetLength,
    batchSize,
    outDim = 3
  ) {
    if (attentionMask == null) {
      return null;
    }

    const currentLength =
      attentionMask.shape[
        attentionMask.shape.length - 1
      ];

    if (currentLength !== targetLength) {
      const padAmount =
        targetLength - currentLength;

      const paddings = [
        [0, 0],
        [0, 0],
        [0, padAmount],
      ];

      attentionMask = tf.pad(
        attentionMask,
        paddings
      );
    }

    if (outDim === 3) {
      if (
        attentionMask.shape[0] <
        batchSize * this.heads
      ) {
        attentionMask = tf.tile(
          attentionMask,
          [this.heads, 1, 1]
        );
      }
    } else if (outDim === 4) {
      attentionMask =
        attentionMask.expandDims(1);

      attentionMask = tf.tile(
        attentionMask,
        [1, this.heads, 1, 1]
      );
    }

    return attentionMask;
  }

  normEncoderHiddenStates(x) {
    if (!this.normCross) {
      throw new Error(
        "normCross not initialized"
      );
    }

    return this.normCross.forward(x);
  }

  getAttentionScores(
    query,
    key,
    attentionMask = null
  ) {
    let scores = tf.matMul(
      query,
      key,
      false,
      true
    );

    scores = scores.mul(this.scale);

    if (attentionMask != null) {
      scores = scores.add(attentionMask);
    }

    return softmax(scores, -1);
  }
}

/* ------------------------------------------------------- */
/* Standard Attention Processor */
/* ------------------------------------------------------- */

export class AttnProcessor {
  call(
    attn,
    hiddenStates,
    encoderHiddenStates = null,
    attentionMask = null
  ) {
    const residual = hiddenStates;

    const inputNdim =
      hiddenStates.shape.length;

    let batchSize;
    let sequenceLength;

    if (inputNdim === 4) {
      const [B, C, H, W] =
        hiddenStates.shape;

      hiddenStates = tf.transpose(
        hiddenStates.reshape([
          B,
          C,
          H * W,
        ]),
        [0, 2, 1]
      );
    }

    if (encoderHiddenStates == null) {
      [batchSize, sequenceLength] =
        hiddenStates.shape;
    } else {
      [batchSize, sequenceLength] =
        encoderHiddenStates.shape;
    }

    attentionMask =
      attn.prepareAttentionMask(
        attentionMask,
        sequenceLength,
        batchSize
      );

    if (attn.groupNorm != null) {
      hiddenStates = tf.transpose(
        attn.groupNorm.forward(
          tf.transpose(hiddenStates, [
            0,
            2,
            1,
          ])
        ),
        [0, 2, 1]
      );
    }

    let query =
      attn.toQ.forward(hiddenStates);

    if (encoderHiddenStates == null) {
      encoderHiddenStates =
        hiddenStates;
    } else if (attn.normCross) {
      encoderHiddenStates =
        attn.normEncoderHiddenStates(
          encoderHiddenStates
        );
    }

    let key = attn.toK.forward(
      encoderHiddenStates
    );

    let value = attn.toV.forward(
      encoderHiddenStates
    );

    query =
      attn.headToBatchDim(query);

    key = attn.headToBatchDim(key);

    value = attn.headToBatchDim(value);

    const attentionProbs =
      attn.getAttentionScores(
        query,
        key,
        attentionMask
      );

    hiddenStates = tf.matMul(
      attentionProbs,
      value
    );

    hiddenStates =
      attn.batchToHeadDim(
        hiddenStates
      );

    hiddenStates =
      attn.toOut[0].forward(
        hiddenStates
      );

    hiddenStates =
      attn.toOut[1].forward(
        hiddenStates
      );

    if (attn.residualConnection) {
      hiddenStates =
        hiddenStates.add(residual);
    }

    hiddenStates =
      hiddenStates.div(
        tf.scalar(
          attn.rescaleOutputFactor
        )
      );

    return hiddenStates;
  }
}

/* ------------------------------------------------------- */
/* SDPA / Flash Attention style processor */
/* ------------------------------------------------------- */

export class AttnProcessor2_0 {
  call(
    attn,
    hiddenStates,
    encoderHiddenStates = null,
    attentionMask = null
  ) {
    const residual = hiddenStates;

    const inputNdim =
      hiddenStates.shape.length;

    if (inputNdim === 4) {
      const [B, C, H, W] =
        hiddenStates.shape;

      hiddenStates = tf.transpose(
        hiddenStates.reshape([
          B,
          C,
          H * W,
        ]),
        [0, 2, 1]
      );
    }

    const batchSize =
      hiddenStates.shape[0];

    if (attn.groupNorm != null) {
      hiddenStates = tf.transpose(
        attn.groupNorm.forward(
          tf.transpose(hiddenStates, [
            0,
            2,
            1,
          ])
        ),
        [0, 2, 1]
      );
    }

    let query =
      attn.toQ.forward(hiddenStates);

    if (encoderHiddenStates == null) {
      encoderHiddenStates =
        hiddenStates;
    } else if (attn.normCross) {
      encoderHiddenStates =
        attn.normEncoderHiddenStates(
          encoderHiddenStates
        );
    }

    let key = attn.toK.forward(
      encoderHiddenStates
    );

    let value = attn.toV.forward(
      encoderHiddenStates
    );

    const innerDim =
      key.shape[key.shape.length - 1];

    const headDim =
      innerDim / attn.heads;

    // [B, H, T, Hd]

    query = tf.transpose(
      query.reshape([
        batchSize,
        -1,
        attn.heads,
        headDim,
      ]),
      [0, 2, 1, 3]
    );

    key = tf.transpose(
      key.reshape([
        batchSize,
        -1,
        attn.heads,
        headDim,
      ]),
      [0, 2, 1, 3]
    );

    value = tf.transpose(
      value.reshape([
        batchSize,
        -1,
        attn.heads,
        headDim,
      ]),
      [0, 2, 1, 3]
    );

    // attention
    let scores = tf.matMul(
      query,
      key,
      false,
      true
    );

    scores = scores.mul(attn.scale);

    if (attentionMask != null) {
      attentionMask =
        attn.prepareAttentionMask(
          attentionMask,
          key.shape[2],
          batchSize,
          4
        );

      scores =
        scores.add(attentionMask);
    }

    let probs = softmax(scores, -1);

    hiddenStates = tf.matMul(
      probs,
      value
    );

    hiddenStates = tf.transpose(
      hiddenStates,
      [0, 2, 1, 3]
    );

    hiddenStates =
      hiddenStates.reshape([
        batchSize,
        -1,
        attn.heads * headDim,
      ]);

    hiddenStates =
      attn.toOut[0].forward(
        hiddenStates
      );

    hiddenStates =
      attn.toOut[1].forward(
        hiddenStates
      );

    if (attn.residualConnection) {
      hiddenStates =
        hiddenStates.add(residual);
    }

    hiddenStates =
      hiddenStates.div(
        tf.scalar(
          attn.rescaleOutputFactor
        )
      );

    return hiddenStates;
  }
}

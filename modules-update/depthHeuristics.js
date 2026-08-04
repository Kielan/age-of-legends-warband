// shape-fit/depthHeuristics.js
// A 2D silhouette has no depth information, so depth-to-width ratios are
// supplied per body-part style, matching the goblin tuning targets: head
// stays a wide squarish oval (not spherical), torso reads as a barrel/belly,
// hands/feet are blocky and flattened respectively.

export const DEPTH_RATIOS = {
    head:    0.82,  // moderate, not spherical
    torso:   0.72,  // barrel/belly — deeper than a thin torso
    pelvis:  0.78,
    upperArm:0.95,
    lowerArm:0.90,
    hand:    0.55,  // blocky rounded box, flatter than round
    thigh:   0.92,
    shin:    0.85,
    foot:    0.45,  // flattened wedge
    ear:     0.30   // thin tapering wedge
};

export function estimateDepth(partType, width, overrideRatio = null){
    const ratio = overrideRatio != null ? overrideRatio : (DEPTH_RATIOS[partType] ?? 0.85);
    return Math.max(0.001, width * ratio);
}

// Slight widen/narrow biases from the tuning table (e.g. "head width
// increase 20-35%"), applied on top of the raw measured width before depth
// is derived from it.
export const WIDTH_BIAS = {
    head: 1.28,
    ear: 1.3,
    shoulder: 1.06,
    torsoLower: 1.12,
    hand: 1.32,
    foot: 1.2
};

export function biasedWidth(partType, rawWidth){
    return rawWidth * (WIDTH_BIAS[partType] ?? 1.0);
}

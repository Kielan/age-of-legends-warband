// shape-fit/sectionRegularizer.js
// Clamps a radius/width profile so it can't collapse to zero or jump
// violently between adjacent samples — guards against noisy silhouette
// measurements producing a mesh with pinched or spiky cross-sections.

export function regularizeProfile(samples, { minRadius = 0.01, maxDeltaRatio = 0.35 } = {}){
    const out = samples.map(v => Math.max(minRadius, v));
    for(let i = 1; i < out.length; i++){
        const prev = out[i-1];
        const maxUp = prev * (1+maxDeltaRatio);
        const maxDown = prev * (1-maxDeltaRatio);
        out[i] = Math.min(maxUp, Math.max(maxDown, out[i]));
    }
    // second pass backward so a single wild sample can't just get clamped
    // relative to its (already-clamped) neighbor and leave a visible kink
    for(let i = out.length-2; i >= 0; i--){
        const next = out[i+1];
        const maxUp = next * (1+maxDeltaRatio);
        const maxDown = next * (1-maxDeltaRatio);
        out[i] = Math.min(maxUp, Math.max(maxDown, out[i]));
    }
    return out;
}

export function enforceMonotonic(samples, direction = "decreasing"){
    const out = samples.slice();
    for(let i = 1; i < out.length; i++){
        if(direction === "decreasing") out[i] = Math.min(out[i], out[i-1]);
        else out[i] = Math.max(out[i], out[i-1]);
    }
    return out;
}

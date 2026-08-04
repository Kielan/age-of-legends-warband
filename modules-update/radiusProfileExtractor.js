// shape-fit/radiusProfileExtractor.js
// Builds a RadiusProfile (duck-type compatible with the app's existing
// RadiusProfile class: .samples[] + .radius(t)) from a sampled mask segment,
// converting pixel half-widths into world-space radii via a supplied scale.

import { sampleSegment } from "./segmentSampler.js";
import { smoothWidths } from "./widthProfileSmoother.js";

export class RadiusProfile{
    constructor(samples){
        this.samples = samples && samples.length ? samples : [1.0];
    }
    radius(t){
        const f = t*(this.samples.length-1);
        const i = Math.floor(f);
        const j = Math.min(i+1, this.samples.length-1);
        const a = f-i;
        return this.samples[i]*(1-a) + this.samples[j]*a;
    }
}

export function extractRadiusProfile(mask, yFrom, yTo, scale, { sampleCount = 12, smoothWindow = 3 } = {}){
    const raw = sampleSegment(mask, yFrom, yTo, sampleCount);
    const smoothed = smoothWidths(raw.map(r => r.width), smoothWindow);
    const radii = smoothed.map(w => Math.max(0.001, (w*0.5) * scale));
    return new RadiusProfile(radii);
}

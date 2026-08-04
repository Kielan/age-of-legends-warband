// shape-fit/segmentSampler.js
// Samples a mask's per-row half-widths within a y-range into a normalized
// array of {t, left, right, width} — the raw material every downstream
// cross-section / radius-profile step consumes.

export function sampleSegment(mask, yFrom, yTo, sampleCount = 16){
    const { width, height, data } = mask;
    const y0 = Math.max(0, Math.floor(Math.min(yFrom,yTo)));
    const y1 = Math.min(height, Math.ceil(Math.max(yFrom,yTo)));
    const span = Math.max(1, y1 - y0);
    const samples = [];
    for(let i = 0; i < sampleCount; i++){
        const t = sampleCount === 1 ? 0 : i/(sampleCount-1);
        const y = Math.min(height-1, Math.round(y0 + t*span));
        let left = -1, right = -1;
        for(let x = 0; x < width; x++){
            if(data[y*width+x]){ if(left===-1) left = x; right = x; }
        }
        const w = left === -1 ? 0 : (right-left);
        samples.push({ t, y, left: left===-1?0:left, right: right===-1?0:right, width: w });
    }
    return samples;
}

export function sampleSegmentBetweenLandmarks(mask, landmarkA, landmarkB, sampleCount = 16){
    return sampleSegment(mask, landmarkA.y, landmarkB.y, sampleCount);
}

// image-analysis/silhouetteMetrics.js
// Compares a rendered mesh silhouette against the reference mask: IoU score
// plus a false-color diff ImageData-like buffer (green = agree, red = mesh
// extends outside reference, blue = reference extends beyond mesh) — the
// visual debug view called for in the pipeline notes.

export function computeIoU(referenceMask, renderedMask){
    const { width, height, data: ref } = referenceMask;
    const rend = renderedMask.data;
    let intersection = 0, union = 0;
    for(let i = 0; i < width*height; i++){
        const r = ref[i] ? 1 : 0, m = rend[i] ? 1 : 0;
        if(r || m) union++;
        if(r && m) intersection++;
    }
    return union ? intersection/union : 1;
}

export function diffOverlay(referenceMask, renderedMask){
    const { width, height, data: ref } = referenceMask;
    const rend = renderedMask.data;
    const out = new Uint8ClampedArray(width*height*4);
    for(let i = 0; i < width*height; i++){
        const r = ref[i] ? 1 : 0, m = rend[i] ? 1 : 0;
        let rr=0, gg=0, bb=0;
        if(r && m){ gg = 255; }             // agreement
        else if(m && !r){ rr = 255; }       // mesh extends past reference
        else if(r && !m){ bb = 255; }       // reference extends past mesh
        out[i*4] = rr; out[i*4+1] = gg; out[i*4+2] = bb; out[i*4+3] = 255;
    }
    return { width, height, data: out };
}

export function silhouetteReport(referenceMask, renderedMask){
    return {
        iou: computeIoU(referenceMask, renderedMask),
        overlay: diffOverlay(referenceMask, renderedMask)
    };
}

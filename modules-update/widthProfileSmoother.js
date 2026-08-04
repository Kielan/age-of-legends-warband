// shape-fit/widthProfileSmoother.js
// Moving-average smoothing for a raw width-per-sample array before it's fit
// into a RadiusProfile — keeps single-pixel silhouette noise (stray hair,
// JPEG ringing) from turning into visible mesh bumps.

export function smoothWidths(values, windowSize = 3){
    const n = values.length;
    const out = new Array(n);
    const half = Math.floor(windowSize/2);
    for(let i = 0; i < n; i++){
        let sum = 0, count = 0;
        for(let k = -half; k <= half; k++){
            const j = i+k;
            if(j < 0 || j >= n) continue;
            sum += values[j]; count++;
        }
        out[i] = sum/count;
    }
    return out;
}

// Gaussian-weighted variant for a softer falloff than a flat moving average.
export function gaussianSmoothWidths(values, radius = 2, sigma = 1.2){
    const n = values.length;
    const kernel = [];
    let kSum = 0;
    for(let k = -radius; k <= radius; k++){
        const w = Math.exp(-(k*k)/(2*sigma*sigma));
        kernel.push(w); kSum += w;
    }
    const out = new Array(n);
    for(let i = 0; i < n; i++){
        let sum = 0;
        for(let k = -radius; k <= radius; k++){
            const j = Math.min(n-1, Math.max(0, i+k));
            sum += values[j] * kernel[k+radius];
        }
        out[i] = sum/kSum;
    }
    return out;
}

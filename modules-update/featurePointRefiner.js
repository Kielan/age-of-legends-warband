// image-analysis/featurePointRefiner.js
// Smooths landmark rows against their local neighborhood and assigns a
// confidence score based on how distinct each extremum is from nearby rows —
// a landmark sitting on a flat, ambiguous plateau is a weaker signal than one
// sitting on a sharp peak/valley.

function localWindow(rows, centerY, radius){
    return rows.filter(r => Math.abs(r.y - centerY) <= radius);
}

// confidence in [0,1]: 1 = clearly stands out from its neighborhood,
// 0 = width is basically indistinguishable from nearby rows (noisy pick).
function confidenceFor(rows, landmark, radius, mode){
    const window = localWindow(rows, landmark.y, radius);
    if(window.length < 2) return 0.5;
    const widths = window.map(r => r.width);
    const mean = widths.reduce((a,b)=>a+b,0) / widths.length;
    const spread = Math.max(1, Math.max(...widths) - Math.min(...widths));
    const delta = mode === "max" ? landmark.width - mean : mean - landmark.width;
    return Math.max(0, Math.min(1, delta / spread));
}

export function refineLandmarks(landmarks, rows, radius = 6){
    if(!landmarks) return null;
    const out = { ...landmarks };
    const extremaModes = {
        head: "max", shoulders: "max", hips: "max", forehead: "max",
        neck: "min", waist: "min", chin: "min"
    };
    for(const key of Object.keys(extremaModes)){
        const lm = landmarks[key];
        if(!lm) continue;
        const window = localWindow(rows, lm.y, radius);
        if(window.length){
            // snap y to the true local extremum within the smoothing window,
            // then average width with its immediate neighbors to denoise it
            const mode = extremaModes[key];
            const best = window.reduce((b,r) => (mode==="max" ? r.width>b.width : r.width<b.width) ? r : b, window[0]);
            const near = localWindow(rows, best.y, 1);
            const smoothedWidth = near.reduce((s,r)=>s+r.width,0) / near.length;
            out[key] = { ...best, width: smoothedWidth, confidence: confidenceFor(rows, best, radius, mode) };
        }
    }
    return out;
}

// image-analysis/landmarkDetector.js
// Row width-profile landmark detection: head/neck/shoulders/waist/hips/feet,
// plus a head sub-pass for chin/forehead. Operates on a binary mask
// { width, height, data }.

export function sampleWidths(mask){
    const { width, height, data } = mask;
    const rows = [];
    for(let y = 0; y < height; y++){
        let left = -1, right = -1;
        for(let x = 0; x < width; x++){
            if(data[y*width+x]){
                if(left === -1) left = x;
                right = x;
            }
        }
        rows.push({ y, left: left===-1?0:left, right: right===-1?0:right, width: left===-1?0:(right-left) });
    }
    return rows;
}

function slice(rows, fromFrac, toFrac){
    const n = rows.length;
    const start = Math.max(0, Math.floor(n*fromFrac));
    const end = Math.min(n, Math.ceil(n*toFrac));
    return rows.slice(start, end);
}
function widest(rows, a, b){
    const s = slice(rows,a,b); if(!s.length) return rows[0];
    return s.reduce((best,r)=> r.width>best.width?r:best, s[0]);
}
function narrowest(rows, a, b){
    const s = slice(rows,a,b); if(!s.length) return rows[0];
    return s.reduce((best,r)=> r.width<best.width?r:best, s[0]);
}
function steepestWiden(rows, a, b){
    const s = slice(rows,a,b);
    if(s.length < 2) return s[0] || rows[0];
    let best = s[1], bestDelta = -Infinity;
    for(let i=1;i<s.length;i++){
        const d = s[i].width - s[i-1].width;
        if(d > bestDelta){ bestDelta = d; best = s[i]; }
    }
    return best;
}

export function detectLandmarks(mask){
    const rows = sampleWidths(mask);
    const nonEmpty = rows.filter(r => r.width > 0);
    if(nonEmpty.length < 8) return null;

    const minY = nonEmpty[0].y, maxY = nonEmpty[nonEmpty.length-1].y;
    const head = widest(nonEmpty, 0, 0.25);
    const neck = narrowest(nonEmpty, 0.10, 0.35);
    const shoulders = steepestWiden(nonEmpty, 0.15, 0.45);
    const waist = narrowest(nonEmpty, 0.35, 0.68);
    const hips = widest(nonEmpty, 0.55, 0.82);
    const feet = nonEmpty[nonEmpty.length-1];

    // Head sub-profile: forehead = widest in top third of head band,
    // chin = narrowest just below head's widest point.
    const headBand = nonEmpty.filter(r => r.y <= head.y + (head.y - minY)*0.4 && r.y >= minY);
    const forehead = headBand.length ? widest(headBand, 0, 0.5) : head;
    const chinBand = nonEmpty.filter(r => r.y >= head.y && r.y <= neck.y);
    const chin = chinBand.length ? narrowest(chinBand, 0.5, 1.0) : head;

    return {
        bounds: { minY, maxY, height: maxY-minY, width: mask.width },
        head, neck, shoulders, waist, hips, feet, forehead, chin
    };
}

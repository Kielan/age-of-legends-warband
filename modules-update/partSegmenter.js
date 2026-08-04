// image-analysis/partSegmenter.js
// Splits a silhouette mask into named body-part regions using landmark
// y-bands plus horizontal connected-components within each band (so a band
// spanning "torso + two arms" becomes three separate blobs, classified by
// their x-position relative to the torso center).

function rowRuns(mask, y, minRunLen = 1){
    const { width, data } = mask;
    const runs = [];
    let start = -1;
    for(let x = 0; x <= width; x++){
        const on = x < width && data[y*width+x];
        if(on && start === -1) start = x;
        if(!on && start !== -1){
            if(x - start >= minRunLen) runs.push({ start, end: x-1 });
            start = -1;
        }
    }
    return runs;
}

// Groups per-row runs into blobs across a y-range using simple x-overlap
// continuity (cheap alternative to full connected-component labeling, good
// enough since limbs rarely cross within one band).
function bandBlobs(mask, yFrom, yTo){
    const blobs = []; // { runs:[{y,start,end}], minX, maxX }
    for(let y = yFrom; y < yTo; y++){
        const runs = rowRuns(mask, y);
        for(const run of runs){
            let attached = null;
            for(const b of blobs){
                const last = b.runs[b.runs.length-1];
                if(last && last.y === y-1 && run.start <= last.end+2 && run.end >= last.start-2){
                    attached = b; break;
                }
            }
            if(!attached){ attached = { runs: [], minX: run.start, maxX: run.end }; blobs.push(attached); }
            attached.runs.push({ y, ...run });
            attached.minX = Math.min(attached.minX, run.start);
            attached.maxX = Math.max(attached.maxX, run.end);
        }
    }
    return blobs.filter(b => b.runs.length >= 2);
}

export function segmentParts(mask, landmarks){
    if(!landmarks) return [];
    const { head, neck, shoulders, waist, hips, feet } = landmarks;
    const bands = [
        { name: "head", from: landmarks.bounds.minY, to: neck.y },
        { name: "upperTorsoArms", from: neck.y, to: waist.y },
        { name: "lowerTorsoLegs", from: waist.y, to: feet.y+1 }
    ];
    const parts = [];
    for(const band of bands){
        const blobs = bandBlobs(mask, Math.max(0,Math.floor(band.from)), Math.min(mask.height,Math.ceil(band.to)));
        const centerX = shoulders ? (shoulders.left+shoulders.right)/2 : mask.width/2;
        // sort by horizontal position so we can label left/center/right
        blobs.sort((a,b) => (a.minX+a.maxX) - (b.minX+b.maxX));
        blobs.forEach((b, i) => {
            const cx = (b.minX+b.maxX)/2;
            const side = cx < centerX - 4 ? "L" : (cx > centerX + 4 ? "R" : "C");
            let label = band.name;
            if(band.name === "upperTorsoArms") label = side === "C" ? "torsoUpper" : `arm${side}`;
            if(band.name === "lowerTorsoLegs") label = side === "C" ? "pelvis" : `leg${side}`;
            if(band.name === "head") label = "head";
            const pixelCount = b.runs.reduce((s,r)=>s+(r.end-r.start+1),0);
            parts.push({
                label, side,
                bounds: { minX: b.minX, maxX: b.maxX, minY: b.runs[0].y, maxY: b.runs[b.runs.length-1].y },
                pixelCount
            });
        });
    }
    return parts;
}

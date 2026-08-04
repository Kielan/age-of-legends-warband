// image-analysis/symmetryAnalyzer.js
// Finds the vertical mirror axis that maximizes left/right pixel agreement,
// and returns a per-row symmetry score useful for spotting asymmetric limb
// poses (e.g. one arm raised, weapon held to one side).

export function analyzeSymmetry(mask, axisSearchFrac = [0.3, 0.7], step = 2){
    const { width, height, data } = mask;
    let bestAxis = width/2, bestScore = -Infinity;
    for(let axis = width*axisSearchFrac[0]; axis <= width*axisSearchFrac[1]; axis += step){
        let score = 0, total = 0;
        for(let y = 0; y < height; y++){
            for(let x = 0; x < width; x++){
                const mirrored = Math.round(2*axis - x);
                if(mirrored < 0 || mirrored >= width) continue;
                const v = data[y*width+x], mv = data[y*width+mirrored];
                if(v || mv){ total++; if(v === mv) score++; }
            }
        }
        const norm = total ? score/total : 0;
        if(norm > bestScore){ bestScore = norm; bestAxis = axis; }
    }
    const perRow = [];
    for(let y = 0; y < height; y++){
        let score = 0, total = 0;
        for(let x = 0; x < width; x++){
            const mirrored = Math.round(2*bestAxis - x);
            if(mirrored < 0 || mirrored >= width) continue;
            const v = data[y*width+x], mv = data[y*width+mirrored];
            if(v || mv){ total++; if(v === mv) score++; }
        }
        perRow.push(total ? score/total : 1);
    }
    return { axisX: bestAxis, score: Math.max(0, bestScore), perRow };
}

// Rows whose symmetry score drops well below the global average — likely
// where a limb has broken pose symmetry (raised arm, bent leg, etc).
export function findAsymmetricRows(symmetryResult, threshold = 0.15){
    const { perRow, score } = symmetryResult;
    const flagged = [];
    for(let y = 0; y < perRow.length; y++){
        if(score - perRow[y] > threshold) flagged.push(y);
    }
    return flagged;
}

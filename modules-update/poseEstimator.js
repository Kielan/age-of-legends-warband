// image-analysis/poseEstimator.js
// Coarse pose estimate built on top of symmetryAnalyzer: turntable yaw from
// overall mirror-symmetry strength, plus a rough head-tilt (roll) reading
// from the asymmetry of the head band's left/right extents.

import { analyzeSymmetry } from "./symmetryAnalyzer.js";

export function estimatePose(mask, landmarks = null){
    const sym = analyzeSymmetry(mask);
    const yawDeg = (1 - Math.max(0, sym.score)) * 90; // 0..90, coarse

    let headTiltDeg = 0;
    if(landmarks && landmarks.head){
        const { width, height, data } = mask;
        const headY = Math.max(0, landmarks.head.y - 4);
        const bandBottom = Math.min(height, landmarks.head.y + 12);
        let topLeftSum = 0, topRightSum = 0, n = 0;
        for(let y = headY; y < bandBottom; y++){
            let left = -1, right = -1;
            for(let x = 0; x < width; x++){
                if(data[y*width+x]){ if(left===-1) left = x; right = x; }
            }
            if(left === -1) continue;
            const mid = (left+right)/2;
            topLeftSum += mid - left;
            topRightSum += right - mid;
            n++;
        }
        if(n){
            const asym = (topRightSum - topLeftSum) / Math.max(1, (topLeftSum+topRightSum));
            headTiltDeg = asym * 25; // heuristic scale, capped by clamp below
        }
    }

    return {
        axisX: sym.axisX,
        symmetry: sym.score,
        yawDeg,
        headTiltDeg: Math.max(-25, Math.min(25, headTiltDeg))
    };
}

// image-analysis/contourTracer.js
// Moore-neighbor boundary tracing: walks the outer edge of the mask's main
// blob and returns an ordered polyline [{x,y}, ...] in pixel space.

const NEIGHBORS = [
    [1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]
];

function isOn(mask, x, y){
    if(x < 0 || y < 0 || x >= mask.width || y >= mask.height) return false;
    return !!mask.data[y*mask.width+x];
}

function findStart(mask){
    for(let y = 0; y < mask.height; y++)
        for(let x = 0; x < mask.width; x++)
            if(isOn(mask, x, y)) return { x, y };
    return null;
}

export function traceContour(mask, maxSteps = 20000){
    const start = findStart(mask);
    if(!start) return [];
    const contour = [start];
    let current = start;
    let backtrack = 4; // came from "west" conceptually at the very first pixel
    let steps = 0;
    do {
        let found = null;
        for(let k = 0; k < 8; k++){
            const dir = (backtrack + k) % 8;
            const [dx, dy] = NEIGHBORS[dir];
            const nx = current.x + dx, ny = current.y + dy;
            if(isOn(mask, nx, ny)){
                found = { x: nx, y: ny, dir };
                break;
            }
        }
        if(!found) break;
        contour.push({ x: found.x, y: found.y });
        // next search starts just behind the direction we arrived from
        backtrack = (found.dir + 5) % 8;
        current = found;
        steps++;
    } while(!(current.x === start.x && current.y === start.y) && steps < maxSteps);
    return contour;
}

// Ramer-Douglas-Peucker simplification, useful before feeding a contour
// into landmark/feature detection so noise doesn't dominate curvature.
export function simplifyContour(points, epsilon = 1.5){
    if(points.length < 3) return points.slice();
    const perpDist = (p, a, b) => {
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        return Math.abs((p.x-a.x)*dy - (p.y-a.y)*dx) / len;
    };
    const recurse = (pts) => {
        if(pts.length < 3) return pts;
        let maxD = -1, idx = -1;
        for(let i = 1; i < pts.length-1; i++){
            const d = perpDist(pts[i], pts[0], pts[pts.length-1]);
            if(d > maxD){ maxD = d; idx = i; }
        }
        if(maxD > epsilon){
            const left = recurse(pts.slice(0, idx+1));
            const right = recurse(pts.slice(idx));
            return left.slice(0, -1).concat(right);
        }
        return [pts[0], pts[pts.length-1]];
    };
    return recurse(points);
}

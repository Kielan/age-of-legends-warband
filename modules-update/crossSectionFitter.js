// shape-fit/crossSectionFitter.js
// Turns a (width, depth) pair into an elliptical or stylized cross-section
// descriptor {rx, ry, style} for the loft builder. "style" tags let
// loftBuilder pick a ring-generation shape (round vs squarish vs wedge).

export function fitCrossSection(width, depth, style = "round"){
    const rx = Math.max(0.001, width*0.5);
    const ry = Math.max(0.001, depth*0.5);
    return { rx, ry, style };
}

// Produces a full profile (array of cross-sections) from parallel width/depth
// arrays, e.g. width profile from radiusProfileExtractor and a depth curve
// from depthHeuristics applied per-sample.
export function fitProfile(widths, depths, style = "round"){
    const n = Math.min(widths.length, depths.length);
    const sections = [];
    for(let i = 0; i < n; i++){
        sections.push(fitCrossSection(widths[i]*2, depths[i]*2, style));
    }
    return sections;
}

// Per-angle squarish point (superellipse blend between a circle and a box).
// Matches loftBuilder's ringFn(a, rx, ry) -> {x,y} signature, so it can be
// passed straight into loft() for heads/torsos that shouldn't read as
// perfectly round.
export function squarishRingFn(squareness = 0.35){
    return (a, rx, ry) => {
        const cx = Math.cos(a), sy = Math.sin(a);
        const roundX = cx*rx, roundY = sy*ry;
        const boxX = Math.sign(cx || 1) * rx * Math.pow(Math.abs(cx), 0.4);
        const boxY = Math.sign(sy || 1) * ry * Math.pow(Math.abs(sy), 0.4);
        return {
            x: roundX*(1-squareness) + boxX*squareness,
            y: roundY*(1-squareness) + boxY*squareness
        };
    };
}

// Full ring of squarish points at once (e.g. for direct inspection/debug
// rendering rather than feeding loft()).
export function squarishRingPoints(rx, ry, sides = 12, squareness = 0.35){
    const fn = squarishRingFn(squareness);
    const pts = [];
    for(let i = 0; i < sides; i++) pts.push(fn((i/sides)*Math.PI*2, rx, ry));
    return pts;
}

// image-analysis/distanceTransform.js
// Two-pass chamfer (3-4) distance transform: approximates Euclidean distance
// from each foreground pixel to the nearest background pixel. Cheap and good
// enough for medial-axis / part-thickness estimation — no exact-EDT needed.

export function distanceTransform(mask){
    const { width, height, data } = mask;
    const INF = 1e6;
    const dist = new Float32Array(width*height).fill(INF);
    for(let i = 0; i < data.length; i++) if(!data[i]) dist[i] = 0;

    const at = (x,y) => (x < 0||y < 0||x >= width||y >= height) ? INF : dist[y*width+x];
    const set = (x,y,v) => { if(v < dist[y*width+x]) dist[y*width+x] = v; };

    // forward pass
    for(let y = 0; y < height; y++){
        for(let x = 0; x < width; x++){
            if(!data[y*width+x]) continue;
            let d = dist[y*width+x];
            d = Math.min(d, at(x-1,y)+3, at(x,y-1)+3, at(x-1,y-1)+4, at(x+1,y-1)+4);
            set(x,y,d);
        }
    }
    // backward pass
    for(let y = height-1; y >= 0; y--){
        for(let x = width-1; x >= 0; x--){
            if(!data[y*width+x]) continue;
            let d = dist[y*width+x];
            d = Math.min(d, at(x+1,y)+3, at(x,y+1)+3, at(x+1,y+1)+4, at(x-1,y+1)+4);
            set(x,y,d);
        }
    }
    // chamfer units -> approx pixel units (3 ~ 1px orthogonal step)
    for(let i = 0; i < dist.length; i++){
        if(dist[i] >= INF) dist[i] = 0;
        else dist[i] = dist[i] / 3;
    }
    return { width, height, data: dist };
}

// Local maxima of the distance field along each row = a coarse medial axis,
// useful as ridge points for part_segmenter / depth heuristics.
export function ridgePoints(distField, minDist = 1.5){
    const { width, height, data } = distField;
    const pts = [];
    for(let y = 0; y < height; y++){
        for(let x = 1; x < width-1; x++){
            const v = data[y*width+x];
            if(v < minDist) continue;
            if(v >= data[y*width+x-1] && v >= data[y*width+x+1]){
                pts.push({ x, y, radius: v });
            }
        }
    }
    return pts;
}

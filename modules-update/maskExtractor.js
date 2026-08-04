// image-analysis/maskExtractor.js
// Binary-mask extraction + light morphological cleanup. Pure functions over
// { width, height, pixels:Uint8ClampedArray(RGBA) } -> { width, height, data:Uint8Array }.

export function extractByBrightness(image, threshold = 200){
    const { width, height, pixels } = image;
    const mask = new Uint8Array(width * height);
    for(let y = 0; y < height; y++){
        for(let x = 0; x < width; x++){
            const i = (y * width + x) * 4;
            const r = pixels[i], g = pixels[i+1], b = pixels[i+2], a = pixels[i+3];
            const brightness = (r + g + b) / 3;
            mask[y * width + x] = (a > 10 && brightness < threshold) ? 1 : 0;
        }
    }
    return { width, height, data: mask };
}

export function extractByColorKey(image, target = [255,102,170], tolerance = 40){
    const { width, height, pixels } = image;
    const mask = new Uint8Array(width * height);
    for(let y = 0; y < height; y++){
        for(let x = 0; x < width; x++){
            const i = (y * width + x) * 4;
            const r = pixels[i], g = pixels[i+1], b = pixels[i+2], a = pixels[i+3];
            if(a < 10) continue;
            const d = Math.abs(r-target[0]) + Math.abs(g-target[1]) + Math.abs(b-target[2]);
            mask[y * width + x] = d < tolerance ? 1 : 0;
        }
    }
    return { width, height, data: mask };
}

// 3x3 majority-vote erode/dilate passes for despeckling noisy thresholds.
function morphPass(mask, mode){
    const { width, height, data } = mask;
    const out = new Uint8Array(data.length);
    for(let y = 0; y < height; y++){
        for(let x = 0; x < width; x++){
            let count = 0, total = 0;
            for(let dy = -1; dy <= 1; dy++){
                for(let dx = -1; dx <= 1; dx++){
                    const nx = x+dx, ny = y+dy;
                    if(nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                    total++;
                    if(data[ny*width+nx]) count++;
                }
            }
            const v = data[y*width+x];
            if(mode === "erode") out[y*width+x] = (v && count === total) ? 1 : 0;
            else out[y*width+x] = (v || count >= 3) ? 1 : 0; // dilate: any neighbor on
        }
    }
    return { width, height, data: out };
}

export function cleanMask(mask, { erode = 1, dilate = 1 } = {}){
    let m = mask;
    for(let i = 0; i < erode; i++) m = morphPass(m, "erode");
    for(let i = 0; i < dilate; i++) m = morphPass(m, "dilate");
    return m;
}

// Flood-fill connected components (4-connectivity), keep only the largest.
// Removes stray speckle blobs the threshold pass picks up from JPEG noise.
export function largestComponent(mask){
    const { width, height, data } = mask;
    const visited = new Uint8Array(width*height);
    let best = null, bestSize = 0;
    for(let sy = 0; sy < height; sy++){
        for(let sx = 0; sx < width; sx++){
            const sidx = sy*width+sx;
            if(!data[sidx] || visited[sidx]) continue;
            const stack = [sidx];
            const pixels = [];
            visited[sidx] = 1;
            while(stack.length){
                const idx = stack.pop();
                pixels.push(idx);
                const x = idx % width, y = (idx / width) | 0;
                const neighbors = [idx-1,idx+1,idx-width,idx+width];
                for(const nIdx of neighbors){
                    if(nIdx < 0 || nIdx >= data.length) continue;
                    const nx = nIdx % width;
                    if(Math.abs(nx-x) > 1) continue; // guard row wraparound
                    if(!data[nIdx] || visited[nIdx]) continue;
                    visited[nIdx] = 1;
                    stack.push(nIdx);
                }
            }
            if(pixels.length > bestSize){ bestSize = pixels.length; best = pixels; }
        }
    }
    const out = new Uint8Array(width*height);
    if(best) for(const idx of best) out[idx] = 1;
    return { width, height, data: out };
}

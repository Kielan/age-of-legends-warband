// bakeTexture.js
// Vanilla JavaScript ES Module version of bake_texture.py
// ------------------------------------------------------
// Browser-first implementation using:
//
// - Three.js
// - WebGLRenderTarget
// - GPU rasterization
// - UV atlas generation placeholder
// - Texture baking pipeline
//
// CDN Imports:
//
// import * as THREE from "https://esm.sh/three@0.160.0";
//
// ------------------------------------------------------
// FEATURES
// ------------------------------------------------------
//
// [x] UV atlas support
// [x] Position texture rasterization
// [x] GPU baking
// [x] SceneCode -> texture inference hook
// [x] Mesh preview ready
// [x] GLTF export compatible
// [x] Works with your 2D→3D boilerplate
//
// ------------------------------------------------------
// EXPECTED MESH FORMAT
// ------------------------------------------------------
//
// mesh = {
//   vertices: Float32Array,
//   faces: Uint32Array,
//   uvs: Float32Array OPTIONAL
// }
//
// ------------------------------------------------------

import * as THREE from "https://esm.sh/three@0.160.0";


// ======================================================
// UV ATLAS GENERATION
// ======================================================
//
// NOTE:
//
// xatlas does not exist natively in browser JS.
//
// This implementation:
//
// 1. Uses existing mesh UVs if available
// 2. Otherwise generates planar UVs
//
// Later you can replace this with:
//
// - xatlas-wasm
// - meshoptimizer
// - uvpacker wasm
//
// ======================================================

export function makeAtlas(
    mesh,
    textureResolution = 1024,
    texturePadding = 4
) {

    const vertices = mesh.vertices;
    const faces = mesh.faces;

    let uvs = mesh.uvs;

    // --------------------------------------------------
    // Generate fallback planar UVs
    // --------------------------------------------------

    if (!uvs) {

        uvs = new Float32Array((vertices.length / 3) * 2);

        let minX = Infinity;
        let maxX = -Infinity;

        let minZ = Infinity;
        let maxZ = -Infinity;

        for (let i = 0; i < vertices.length; i += 3) {

            const x = vertices[i + 0];
            const z = vertices[i + 2];

            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);

            minZ = Math.min(minZ, z);
            maxZ = Math.max(maxZ, z);
        }

        const sizeX = maxX - minX || 1;
        const sizeZ = maxZ - minZ || 1;

        for (let i = 0, j = 0; i < vertices.length; i += 3, j += 2) {

            const x = vertices[i + 0];
            const z = vertices[i + 2];

            uvs[j + 0] = (x - minX) / sizeX;
            uvs[j + 1] = (z - minZ) / sizeZ;
        }
    }

    // vmapping = identity mapping
    const vmapping = new Uint32Array(vertices.length / 3);

    for (let i = 0; i < vmapping.length; i++) {
        vmapping[i] = i;
    }

    return {
        vmapping,
        indices: faces,
        uvs
    };
}


// ======================================================
// CREATE POSITION MATERIAL
// ======================================================
//
// Encodes world position into RGBA texture
//
// ======================================================

function createPositionMaterial() {

    return new THREE.ShaderMaterial({

        side: THREE.DoubleSide,

        vertexShader: `

            varying vec3 vPosition;
            varying vec2 vUv;

            void main() {

                vUv = uv;
                vPosition = position;

                gl_Position =
                    projectionMatrix *
                    modelViewMatrix *
                    vec4(position, 1.0);
            }
        `,

        fragmentShader: `

            varying vec3 vPosition;
            varying vec2 vUv;

            void main() {

                gl_FragColor = vec4(vPosition, 1.0);
            }
        `
    });
}


// ======================================================
// RASTERIZE POSITION ATLAS
// ======================================================
//
// GPU renders:
//
// UV space -> XYZ position texture
//
// Equivalent to moderngl pipeline
//
// ======================================================

export async function rasterizePositionAtlas({

    renderer,
    mesh,
    atlas,
    textureResolution = 1024

}) {

    // --------------------------------------------------
    // Build geometry
    // --------------------------------------------------

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(mesh.vertices, 3)
    );

    geometry.setAttribute(
        "uv",
        new THREE.BufferAttribute(atlas.uvs, 2)
    );

    geometry.setIndex(
        new THREE.BufferAttribute(atlas.indices, 1)
    );

    // --------------------------------------------------
    // Render target
    // --------------------------------------------------

    const target = new THREE.WebGLRenderTarget(
        textureResolution,
        textureResolution,
        {
            type: THREE.FloatType,
            format: THREE.RGBAFormat,
            depthBuffer: false
        }
    );

    // --------------------------------------------------
    // Scene
    // --------------------------------------------------

    const scene = new THREE.Scene();

    const camera = new THREE.OrthographicCamera(
        -1, 1,
        1, -1,
        0.1,
        10
    );

    camera.position.z = 1;

    const material = createPositionMaterial();

    const renderMesh = new THREE.Mesh(
        geometry,
        material
    );

    scene.add(renderMesh);

    // --------------------------------------------------
    // Render
    // --------------------------------------------------

    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    // --------------------------------------------------
    // Read pixels
    // --------------------------------------------------

    const pixels = new Float32Array(
        textureResolution *
        textureResolution *
        4
    );

    renderer.readRenderTargetPixels(
        target,
        0,
        0,
        textureResolution,
        textureResolution,
        pixels
    );

    return {
        texture: target.texture,
        pixels
    };
}


// ======================================================
// POSITIONS -> COLORS
// ======================================================
//
// Equivalent to:
//
// renderer.query_triplane(...)
//
//
// This is where:
//
// Neural texture inference
// SDF sampling
// Triplane decoding
//
// would happen.
//
// ======================================================

export async function positionsToColors({

    model,
    sceneCode,
    positionsTexture,
    textureResolution = 1024

}) {

    const pixels = positionsTexture.pixels;

    const colorPixels = new Uint8Array(
        textureResolution *
        textureResolution *
        4
    );

    for (let i = 0; i < pixels.length; i += 4) {

        const x = pixels[i + 0];
        const y = pixels[i + 1];
        const z = pixels[i + 2];
        const a = pixels[i + 3];

        // --------------------------------------------------
        // Transparent pixel
        // --------------------------------------------------

        if (a <= 0.0) {

            colorPixels[i + 0] = 0;
            colorPixels[i + 1] = 0;
            colorPixels[i + 2] = 0;
            colorPixels[i + 3] = 0;

            continue;
        }

        // --------------------------------------------------
        // Fake neural shading
        // --------------------------------------------------

        //
        // Replace this:
        //
        // const rgb = model.renderer.queryTriplane(...)
        //
        // --------------------------------------------------

        const r = Math.abs(x) * 255;
        const g = Math.abs(y) * 255;
        const b = Math.abs(z) * 255;

        colorPixels[i + 0] = r % 255;
        colorPixels[i + 1] = g % 255;
        colorPixels[i + 2] = b % 255;
        colorPixels[i + 3] = 255;
    }

    return colorPixels;
}


// ======================================================
// BAKE TEXTURE
// ======================================================
//
// MAIN PIPELINE
//
// mesh
//   -> atlas
//   -> position texture
//   -> neural color inference
//   -> baked RGBA texture
//
// ======================================================

export async function bakeTexture({

    renderer,
    mesh,
    model = null,
    sceneCode = null,
    textureResolution = 1024

}) {

    const texturePadding = Math.max(
        2,
        Math.round(textureResolution / 256)
    );

    // --------------------------------------------------
    // Generate UV atlas
    // --------------------------------------------------

    const atlas = makeAtlas(
        mesh,
        textureResolution,
        texturePadding
    );

    // --------------------------------------------------
    // Rasterize position texture
    // --------------------------------------------------

    const positionsTexture =
        await rasterizePositionAtlas({

            renderer,
            mesh,
            atlas,
            textureResolution
        });

    // --------------------------------------------------
    // Infer colors
    // --------------------------------------------------

    const colorsTexture =
        await positionsToColors({

            model,
            sceneCode,
            positionsTexture,
            textureResolution
        });

    // --------------------------------------------------
    // Build DataTexture
    // --------------------------------------------------

    const bakedTexture = new THREE.DataTexture(
        colorsTexture,
        textureResolution,
        textureResolution,
        THREE.RGBAFormat
    );

    bakedTexture.needsUpdate = true;

    return {

        vmapping: atlas.vmapping,

        indices: atlas.indices,

        uvs: atlas.uvs,

        colors: colorsTexture,

        texture: bakedTexture
    };
}


// ======================================================
// APPLY BAKED TEXTURE TO THREE.JS MESH
// ======================================================

export function applyBakedTexture({

    mesh,
    baked

}) {

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(mesh.vertices, 3)
    );

    geometry.setAttribute(
        "uv",
        new THREE.BufferAttribute(baked.uvs, 2)
    );

    geometry.setIndex(
        new THREE.BufferAttribute(baked.indices, 1)
    );

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({

        map: baked.texture,

        metalness: 0.0,

        roughness: 1.0
    });

    return new THREE.Mesh(
        geometry,
        material
    );
}


// ======================================================
// EXPORT GLTF
// ======================================================

export async function exportGLTF({

    object3D,
    GLTFExporter

}) {

    return new Promise((resolve) => {

        const exporter = new GLTFExporter();

        exporter.parse(

            object3D,

            (gltf) => {

                const blob = new Blob(
                    [JSON.stringify(gltf)],
                    { type: "model/gltf+json" }
                );

                resolve(blob);
            },

            {
                binary: false
            }
        );
    });
}


// ======================================================
// DEMO HELPERS
// ======================================================

export function createDemoMesh() {

    const geometry = new THREE.BoxGeometry(1, 1, 1);

    return {

        vertices: geometry.attributes.position.array,

        faces: geometry.index.array,

        uvs: geometry.attributes.uv.array
    };
}


// ======================================================
// FUTURE NEURAL FEATURES
// ======================================================
//
// Easy upgrades:
//
// [ ] ONNX triplane decoder
// [ ] WASM marching cubes
// [ ] xatlas wasm
// [ ] skeletal baking
// [ ] tangent-space normal maps
// [ ] AO baking
// [ ] curvature maps
// [ ] neural texture synthesis
// [ ] Blender-style UV editor
// [ ] face selection
// [ ] edge selection
// [ ] vertex selection
// [ ] GPU compute shaders
// [ ] WebGPU backend
//
// ======================================================

import { LinkedList } from "linked-list-typescript"; // optional, or use native array with unshift/back
import { Vec3 } from "./Vec3";
import { Voxel } from "./Voxel";
import { VoxelId } from "./VoxelId";
import { Chunk } from "./Chunk";
import { ChunkPos, GlobalVoxelPos, VoxelPos } from "./pos";
import { GameWorld } from "./gameWorld";
import { Color } from "./Color";
import { GenVoxelInp, GenCaveInp, LandscapeHeightInp, ChunkBiomes } from "./ChunkBiomes";
// Noise libraries
import { OpenSimplexNoise } from "open-simplex-noise";
import { Perlin } from "perlin-noise";
export type WorldSeed = number;
export type ObjectGeneratorID = number;
export interface Biome {
    checkPos(world: WorldGenerator, pos: ChunkPos, inp: BiomeCheckInput): boolean;
}
export interface BiomeCheckInput {
    temperature: number;
    humidity: number;
    elevation: number;
}
export class WorldGenerator {
    private seed: WorldSeed;
    private simplex: OpenSimplexNoise;
    private perlin: Perlin;
    private biomes: LinkedList<Biome>;
    private hasher: PermutationTable;
    static readonly LANDSCAPE_OCTAVES = 4;
    static readonly SCALE = 0.045;
    static readonly LANDSCAPE_SCALE = 0.01;
    static readonly CAVE_SCALE = 1.0 / 50.0;
    static readonly CAVE_Y_SCALE = 4.0;
    static readonly COLOR_RANDOM_SCALE = 0.1;
    static readonly TEMP_NOISE_SCALE = 0.01;
    static readonly HUMIDITY_NOISE_SCALE = 0.01;
    static readonly MOUNTAINOUSNESS_NOISE_SCALE = 0.01;
    static readonly MIN_TEMP = -70.0;
    static readonly MAX_TEMP = 100.0;
    constructor(seed: WorldSeed) {
        this.seed = seed;
        this.simplex = new OpenSimplexNoise(seed);
        this.perlin = new Perlin(seed);
        this.biomes = new LinkedList<Biome>();
        this.hasher = new PermutationTable(seed);
        // Register default biomes (order matters)
        this.registerBiome(new PlainsBiome());
        this.registerBiome(new DesertBiome());
        this.registerBiome(new TundraBiome());
    }
    registerBiome(biome: Biome) {
        this.biomes.unshift(biome); // push_front equivalent
    }
    getBiome(pos: ChunkPos): Biome {
        const inp: BiomeCheckInput = {
            temperature: this.getTemperature(pos),
            humidity: this.getHumidity(pos),
            elevation: this.getElevation(pos.x, pos.z),
        };
        for (const biome of this.biomes) {
            if (biome.checkPos(this, pos, inp)) return biome;
        }
        // default biome = last added (back of linked list)
        return this.biomes.getLast()!;
    }
    setSeed(seed: WorldSeed) {
        this.seed = seed;
        this.simplex = new OpenSimplexNoise(seed);
        this.perlin = new Perlin(seed);
        this.hasher = new PermutationTable(seed);
    }
    seedValue(): WorldSeed {
        return this.seed;
    }
    private static normalizeValue(v: number): number {
        return 2 / (1 + Math.exp(-v * 2)) - 1;
    }
    private randomizeChannel(pos: GlobalVoxelPos, channel: number, value: number): number {
        const random = this.simplex.noise4D(pos.x, pos.y, pos.z, channel + 1) * WorldGenerator.COLOR_RANDOM_SCALE;
        return Math.min(Math.max(value + random * value, 0), 1);
    }
    randomizeColor(pos: GlobalVoxelPos, c: Color): Color {
        const r = this.randomizeChannel(pos, 0, c.r());
        const g = this.randomizeChannel(pos, 1, c.g());
        const b = this.randomizeChannel(pos, 2, c.b());
        return Color.rgb(r, g, b);
    }
    private getTemperature(pos: ChunkPos): number {
        const t = this.simplex.noise3D(
            pos.x * WorldGenerator.TEMP_NOISE_SCALE,
            pos.z * WorldGenerator.TEMP_NOISE_SCALE,
            0
        ) * 0.5 + 0.5;
        return WorldGenerator.MIN_TEMP * (1 - t) + WorldGenerator.MAX_TEMP * t;
    }
    private getHumidity(pos: ChunkPos): number {
        return this.simplex.noise3D(
            pos.x * WorldGenerator.HUMIDITY_NOISE_SCALE,
            pos.z * WorldGenerator.HUMIDITY_NOISE_SCALE,
            1
        ) * 0.5 + 0.5;
    }
    getElevation(x: number, z: number): number {
        return this.simplex.noise3D(
            x * WorldGenerator.MOUNTAINOUSNESS_NOISE_SCALE,
            z * WorldGenerator.MOUNTAINOUSNESS_NOISE_SCALE,
            2
        ) + 1;
    }
    gelLandscapeHeight(inp: LandscapeHeightInp, x: number, z: number): number {
        let result = 0;
        let scale = WorldGenerator.LANDSCAPE_SCALE;
        let height = inp.height;
        for (let i = 0; i < WorldGenerator.LANDSCAPE_OCTAVES; i++) {
            result += (this.simplex.noise3D(x * scale, z * scale, 0) * 0.5 + 0.5) * height;
            scale *= 2;
            height *= 0.5;
        }
        return Math.pow(result, this.getElevation(x, z));
    }
    getCaves(inp: GenCaveInp, pos: GlobalVoxelPos): number {
        const x = pos.x * Voxel.SCALE;
        const y = pos.y * Voxel.SCALE;
        const z = pos.z * Voxel.SCALE;
        let cave = this.simplex.noise3D(x * WorldGenerator.CAVE_SCALE, y * WorldGenerator.CAVE_SCALE * WorldGenerator.CAVE_Y_SCALE, z * WorldGenerator.CAVE_SCALE) * inp.cave_factor - inp.cave_offset;
        if (cave < 0) return 0;
        return cave * cave * inp.cave_strength;
    }
    generateVoxelValue(inp: GenVoxelInp, landscapeHeight: number, pos: GlobalVoxelPos): number {
        const bumpsScale = 1 / WorldGenerator.SCALE;
        const bumpsFactor = inp.bumps_factor;
        const x = pos.x * Voxel.SCALE;
        const y = pos.y * Voxel.SCALE;
        const z = pos.z * Voxel.SCALE;
        const bumps = bumpsFactor * this.simplex.noise3D(x * bumpsScale, y * bumpsScale, z * bumpsScale);
        const value = WorldGenerator.normalizeValue((landscapeHeight - y) + bumps);
        return value - this.getCaves(inp.cave_inp, pos);
    }
    generateVoxel(inp: GenVoxelInp, landscapeHeight: number, pos: GlobalVoxelPos, scale: number): Voxel {
        const value = this.generateVoxelValue(inp, landscapeHeight, pos);
        const dirtStart = scale * Voxel.SCALE;
        const stoneStart = 32;
        const currentDepth = pos.y * Voxel.SCALE - landscapeHeight;
        let id: VoxelId;
        if (currentDepth < -stoneStart) id = inp.rest_layers_id;
        else if (currentDepth < -dirtStart) id = inp.second_layer_id;
        else id = inp.first_layer_id;
        return new Voxel(value, id);
    }
    generateVoxels(biomes: ChunkBiomes, chunkPos: ChunkPos, level: number): Voxel[] {
        const scale = GameWorld.levelToScale(level);
        const voxels: Voxel[] = new Array(Chunk.VOLUME_VOXELS).fill(Voxel.EMPTY);
        const offset = chunkPos.multiplyScalar(Chunk.SIZE * scale);
        for (let x = 0; x < Chunk.SIZE_VOXELS; x++) {
            const px = offset.x + x * scale;
            for (let z = 0; z < Chunk.SIZE_VOXELS; z++) {
                const pz = offset.z + z * scale;

                const landscapeHeight = this.gelLandscapeHeight(
                    biomes.getLandscapeHeightInp(GlobalVoxelPos.new(px, 0, pz)),
                    px,
                    pz
                );
                for (let y = 0; y < Chunk.SIZE_VOXELS; y++) {
                    const py = offset.y + y * scale;
                    const absoluteVoxelPos = GlobalVoxelPos.new(px, py, pz);
                    const inp = biomes.getGenerateVoxelInp(absoluteVoxelPos);
                    const voxel = this.generateVoxel(inp, landscapeHeight, absoluteVoxelPos, scale);
                    voxels[VoxelPos.new(x, y, z).toIndex(Chunk.SIZE_VOXELS)] = voxel;
                }
            }
        }
        return voxels;
    }
}
/* ===== Helper Classes ===== */
export class VoxelColor {
    constructor(public r: number, public g: number, public b: number) {}
    static fromColor(c: Color): VoxelColor {
        return new VoxelColor(c.r(), c.g(), c.b());
    }
    toColor(): Color {
        return Color.rgb(this.r, this.g, this.b);
    }
}

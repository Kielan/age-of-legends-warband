import { Vec3, Transform } from "some-3d-lib"; // Replace with your Vec3/Transform implementation
import { Chunk, VoxelPos, GlobalVoxelPos } from "./chunks";
import { GameWorld } from "./game_world";
import { ObjectSpawner } from "./object_spawner";
import { WorldGenerator, GenVoxelInp, LandscapeHeightInp, ObjectGeneratorID } from "./world_generator";

// Biome modules
export * from "./desert";
export * from "./plains";
export * from "./tundra";

export type BiomeID = string;

export interface BiomeCheckInput {
    temperature: number;
    humidity: number;
    elevation: number;
}

export interface Biome {
    get_id(): BiomeID;

    get_landscape_height_inp(gen: WorldGenerator, pos: ChunkPos): LandscapeHeightInp;

    get_generate_voxel_inp(gen: WorldGenerator, pos: ChunkPos): GenVoxelInp;

    check_pos(gen: WorldGenerator, pos: ChunkPos, inp: BiomeCheckInput): boolean;

    spawn_objects(
        biomes: ChunkBiomes,
        chunk_pos: ChunkPos,
        commands: any[], // Simplified for TS; normally ECS Commands
        gen: WorldGenerator
    ): number;
}

export interface SpawnObjectInp {
    chance?: number;
    amount?: number;
    allow_air?: boolean;
    get_spawner?: (transform: Transform) => ObjectSpawner;
    offset?: Vec3;
}

export function spawn_object(
    biomes: ChunkBiomes,
    chunk_pos: ChunkPos,
    commands: any[],
    gen: WorldGenerator,
    id: ObjectGeneratorID,
    inp: SpawnObjectInp
): number {
    const chance = inp.chance ?? 0.25;
    const amount = inp.amount ?? 1;
    const allow_air = inp.allow_air ?? false;
    const offset = inp.offset ?? new Vec3(0, 0, 0);
    const get_spawner = inp.get_spawner ?? (() => { throw new Error("No spawner set"); });

    let spawned = 0;

    for (let i = 0; i < amount; i++) {
        const groundPos = gen.get_ground_object_pos(
            biomes,
            chunk_pos,
            id,
            chance,
            i,
            amount,
            allow_air
        );

        if (!groundPos) continue;

        const [pos, y_angle] = groundPos;
        spawned++;

        const transform = new Transform(pos.add(offset));
        transform.rotateY(y_angle);

        const spawner = get_spawner(transform);
        const name = `object_spawner:${spawner.id()}`;

        commands.push({ spawner, name });
    }

    return spawned;
}

export function spawn_objects(
    biomes: ChunkBiomes,
    chunk_pos: ChunkPos,
    commands: any[],
    gen: WorldGenerator,
    objects: SpawnObjectInp[]
): number {
    let count = 0;

    objects.forEach((inp, id) => {
        count += spawn_object(biomes, chunk_pos, commands, gen, id, inp);
    });

    return count;
}

export class ChunkBiomes {
    voxel_inputs: GenVoxelInp[];
    landscape_inputs: LandscapeHeightInp[];
    region_pos: ChunkPos;

    constructor(gen: WorldGenerator, region_pos: ChunkPos) {
        this.region_pos = region_pos;

        const scale = GameWorld.level_to_scale(0);
        const size_chunks = scale + 2;
        const chunk_offset = region_pos.multiplyScalar(scale);

        // landscape_inputs
        this.landscape_inputs = Array(size_chunks * size_chunks).fill(null).map((_, i) => {
            const pos = chunk_offset.add(ChunkPos.fromIndex2D(i, size_chunks));
            return gen.get_biome(pos).get_landscape_height_inp(gen, pos);
        });

        // voxel_inputs
        this.voxel_inputs = Array(size_chunks * size_chunks * size_chunks).fill(null).map((_, i) => {
            const pos = chunk_offset.add(ChunkPos.fromIndex(i, size_chunks));
            return gen.get_biome(pos).get_generate_voxel_inp(gen, pos);
        });
    }

    private static get_size() {
        return GameWorld.REGION_SIZE + 2;
    }

    get_generate_voxel_inp(voxel_pos: GlobalVoxelPos): GenVoxelInp {
        const rel_pos = voxel_pos.subtract(this.region_pos.multiplyScalar(GameWorld.REGION_SIZE * Chunk.SIZE));
        const chunk_pos = Chunk.global_voxel_pos_to_chunk_pos(rel_pos);

        const size = ChunkBiomes.get_size();
        const idx = (pos: VoxelPos) => pos.toIndex(size);

        const xyz000 = this.voxel_inputs[idx(chunk_pos)];
        const xyz100 = this.voxel_inputs[idx(chunk_pos.add(new VoxelPos(1, 0, 0)))];
        const xyz010 = this.voxel_inputs[idx(chunk_pos.add(new VoxelPos(0, 1, 0)))];
        const xyz110 = this.voxel_inputs[idx(chunk_pos.add(new VoxelPos(1, 1, 0)))];
        const xyz001 = this.voxel_inputs[idx(chunk_pos.add(new VoxelPos(0, 0, 1)))];
        const xyz101 = this.voxel_inputs[idx(chunk_pos.add(new VoxelPos(1, 0, 1)))];
        const xyz011 = this.voxel_inputs[idx(chunk_pos.add(new VoxelPos(0, 1, 1)))];
        const xyz111 = this.voxel_inputs[idx(chunk_pos.add(new VoxelPos(1, 1, 1)))];

        const in_chunk_pos = Chunk.normalize_pos(rel_pos).toVec3();
        const transition = in_chunk_pos.divideScalar(Chunk.SIZE);

        const yz00 = xyz000.lerp(xyz100, transition.x);
        const yz10 = xyz010.lerp(xyz110, transition.x);
        const yz01 = xyz001.lerp(xyz101, transition.x);
        const yz11 = xyz011.lerp(xyz111, transition.x);

        const z0 = yz00.lerp(yz10, transition.y);
        const z1 = yz01.lerp(yz11, transition.y);

        return z0.lerp(z1, transition.z);
    }

    get_landscape_height_inp(voxel_pos: GlobalVoxelPos): LandscapeHeightInp {
        const rel_pos = voxel_pos.subtract(this.region_pos.multiplyScalar(GameWorld.REGION_SIZE * Chunk.SIZE));
        const chunk_pos = Chunk.global_voxel_pos_to_chunk_pos(rel_pos);

        if (chunk_pos.x < 0 || chunk_pos.z < 0) {
            throw new Error(`voxel_pos is out of bounds: ${voxel_pos.toString()}`);
        }

        const size = ChunkBiomes.get_size();
        const idx2D = (pos: VoxelPos) => pos.toIndex2D(size);

        const xz00 = this.landscape_inputs[idx2D(chunk_pos)];
        const xz10 = this.landscape_inputs[idx2D(chunk_pos.add(new VoxelPos(1, 0, 0)))];
        const xz01 = this.landscape_inputs[idx2D(chunk_pos.add(new VoxelPos(0, 0, 1)))];
        const xz11 = this.landscape_inputs[idx2D(chunk_pos.add(new VoxelPos(1, 0, 1)))];

        const in_chunk_pos = Chunk.normalize_pos(rel_pos).toVec3();
        const transition = in_chunk_pos.divideScalar(Chunk.SIZE);

        const z0 = xz00.lerp(xz10, transition.x);
        const z1 = xz01.lerp(xz11, transition.x);

        return z0.lerp(z1, transition.z);
    }
}

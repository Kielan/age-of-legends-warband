import { Vec3 } from "some-3d-lib"; // Replace with your Vec3 implementation
import { Biome, BiomeCheckInput, ChunkBiomes, SpawnObjectInp, spawn_objects } from "./BiomeBase";
import { ChunkPos } from "./chunks";
import { WorldGenerator, GenVoxelInp, GenCaveInp, LandscapeHeightInp } from "./world_generator";
import { VoxelId } from "./voxel_types";
import { FlaxObject } from "./objects/flax";
import { TreeObject } from "./objects/tree";
import { BranchItem } from "./items/branch";
import { RockItem } from "./items/rock";

export class PlainsBiome implements Biome {
    static readonly ID: string = "plains";
    constructor() {
        // no state needed
    }
    static new(): PlainsBiome {
        return new PlainsBiome();
    }
    get_id(): string {
        return PlainsBiome.ID;
    }
    get_generate_voxel_inp(_gen: WorldGenerator, _pos: ChunkPos): GenVoxelInp {
        return {
            cave_inp: {
                cave_factor: 1.3,
                cave_offset: 0.3,
                cave_strength: 100.0,
            } as GenCaveInp,
            bumps_factor: 0.05,
            first_layer_id: VoxelId.GRASS,
            second_layer_id: VoxelId.DIRT,
            rest_layers_id: VoxelId.STONE,
        } as GenVoxelInp;
    }
    get_landscape_height_inp(_gen: WorldGenerator, _pos: ChunkPos): LandscapeHeightInp {
        return { height: 10.0 } as LandscapeHeightInp;
    }
    check_pos(_gen: WorldGenerator, _pos: ChunkPos, _inp: BiomeCheckInput): boolean {
        // Default biome, always true
        return true;
    }
    spawn_objects(
        biomes: ChunkBiomes,
        chunk_pos: ChunkPos,
        commands: any[], // Simplified ECS commands
        gen: WorldGenerator
    ): number {
        return spawn_objects(
            biomes,
            chunk_pos,
            commands,
            gen,
            [
                {
                    allow_air: false,
                    amount: 2,
                    chance: 0.2,
                    get_spawner: (t: any) => FlaxObject.to_spawner(t),
                    offset: new Vec3(0, 0, 0),
                },
                {
                    allow_air: false,
                    amount: 1,
                    chance: 0.05,
                    get_spawner: (t: any) => TreeObject.to_spawner(t),
                    offset: new Vec3(0, 0, 0),
                },
                {
                    allow_air: false,
                    amount: 1,
                    chance: 0.15,
                    get_spawner: (t: any) => BranchItem.to_spawner(t),
                    offset: new Vec3(0, 0.1, 0),
                },
                {
                    allow_air: false,
                    amount: 1,
                    chance: 0.125,
                    get_spawner: (t: any) => RockItem.to_spawner(t),
                    offset: new Vec3(0, 0.1, 0),
                },
            ] as SpawnObjectInp[]
        );
    }
}

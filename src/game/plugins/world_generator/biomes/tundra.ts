import { Vec3 } from "some-3d-lib"; // Replace with your Vec3 implementation
import { Biome, BiomeCheckInput, ChunkBiomes, SpawnObjectInp, spawn_objects } from "./BiomeBase";
import { ChunkPos } from "./chunks";
import { WorldGenerator, GenVoxelInp, GenCaveInp, LandscapeHeightInp } from "./world_generator";
import { VoxelId } from "./voxel_types";
import { BranchItem } from "./items/branch";
import { SpruceObject } from "./objects/spruce";

export class TundraBiome implements Biome {
    static readonly ID: string = "tundra";
    constructor() {
        // no internal state
    }
    static new(): TundraBiome {
        return new TundraBiome();
    }
    get_id(): string {
        return TundraBiome.ID;
    }
    get_generate_voxel_inp(_gen: WorldGenerator, _pos: ChunkPos): GenVoxelInp {
        return {
            cave_inp: {
                cave_factor: 1.3,
                cave_offset: 0.3,
                cave_strength: 100.0,
            } as GenCaveInp,
            bumps_factor: 0.1,
            first_layer_id: VoxelId.SNOW,
            second_layer_id: VoxelId.DIRT,
            rest_layers_id: VoxelId.STONE,
        } as GenVoxelInp;
    }
    get_landscape_height_inp(_gen: WorldGenerator, _pos: ChunkPos): LandscapeHeightInp {
        return { height: 10.0 } as LandscapeHeightInp;
    }
    check_pos(_gen: WorldGenerator, _pos: ChunkPos, inp: BiomeCheckInput): boolean {
        return inp.temperature < 0.0;
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
                    amount: 1,
                    chance: 0.05,
                    get_spawner: (t: any) => SpruceObject.WITH_SNOW.clone().to_spawner(t),
                    offset: new Vec3(0, 0, 0),
                },
                {
                    allow_air: false,
                    amount: 1,
                    chance: 0.075,
                    get_spawner: (t: any) => BranchItem.to_spawner(t),
                    offset: new Vec3(0, 0.1, 0),
                },
            ] as SpawnObjectInp[]
        );
    }
}

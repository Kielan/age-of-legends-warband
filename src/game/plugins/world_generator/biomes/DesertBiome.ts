import { Vec3 } from "some-3d-lib"; // Replace with your Vec3 implementation
import { Biome, BiomeCheckInput, ChunkBiomes, SpawnObjectInp, spawn_objects } from "./ChunkBiomes";
import { ChunkPos } from "./chunks";
import { WorldGenerator, GenVoxelInp, GenCaveInp, LandscapeHeightInp } from "./world_generator";
import { VoxelId } from "./voxel_types";
import { CactusObject } from "./objects/cactus";
import { RockItem } from "./objects/items/rock";
import { ObjectSpawner } from "./object_spawner";

export class DesertBiome implements Biome {
    static readonly ID: string = "desert";

    constructor() {
        // no state needed
    }

    static new(): DesertBiome {
        return new DesertBiome();
    }

    get_id(): string {
        return DesertBiome.ID;
    }

    get_generate_voxel_inp(_gen: WorldGenerator, _pos: ChunkPos): GenVoxelInp {
        return {
            cave_inp: {
                cave_factor: 1.3,
                cave_offset: 0.3,
                cave_strength: 0.0,
            } as GenCaveInp,
            bumps_factor: 0.1,
            first_layer_id: VoxelId.SAND,
            second_layer_id: VoxelId.SAND_STONE,
            rest_layers_id: VoxelId.STONE,
        } as GenVoxelInp;
    }

    get_landscape_height_inp(_gen: WorldGenerator, _pos: ChunkPos): LandscapeHeightInp {
        return { height: 10.0 } as LandscapeHeightInp;
    }

    check_pos(_gen: WorldGenerator, _pos: ChunkPos, inp: BiomeCheckInput): boolean {
        return inp.temperature > 30.0;
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
                    chance: 0.0125,
                    get_spawner: (t: any) => CactusObject.to_spawner(t),
                    offset: new Vec3(0, 0, 0),
                },
                {
                    allow_air: false,
                    amount: 1,
                    chance: 0.25,
                    get_spawner: (t: any) => RockItem.to_spawner(t),
                    offset: new Vec3(0, 0.1, 0), // Vec3.Y * 0.1 equivalent
                },
            ] as SpawnObjectInp[]
        );
    }
}

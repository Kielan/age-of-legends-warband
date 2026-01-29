import { VoxelId } from "./VoxelId";
import { ChunkPos } from "./pos";
import { LandscapeHeightInp } from "./landscapeTypes"; // placeholder, must define separately
// Equivalent of Rust's GenCaveInp
export class GenCaveInp {
    constructor(
        public caveFactor: number,
        public caveOffset: number,
        public caveStrength: number
    ) {}
    // Optional: copy/clone helper
    clone(): GenCaveInp {
        return new GenCaveInp(this.caveFactor, this.caveOffset, this.caveStrength);
    }
}
// Equivalent of Rust's GenVoxelInp
export class GenVoxelInp {
    constructor(
        public caveInp: GenCaveInp,
        public firstLayerId: VoxelId,
        public secondLayerId: VoxelId,
        public restLayersId: VoxelId,
        public bumpsFactor: number
    ) {}
    // Optional: clone helper
    clone(): GenVoxelInp {
        return new GenVoxelInp(
            this.caveInp.clone(),
            this.firstLayerId,
            this.secondLayerId,
            this.restLayersId,
            this.bumpsFactor
        );
    }
    // Lerp-like helper (mimicking Rust #[lerp(f32)] behavior)
    lerp(other: GenVoxelInp, t: number): GenVoxelInp {
        return new GenVoxelInp(
            this.caveInp.clone(), // caves are static here; you can implement f64 interpolation if needed
            this.firstLayerId.lerp(other.firstLayerId, t),
            this.secondLayerId.lerp(other.secondLayerId, t),
            this.restLayersId.lerp(other.restLayersId, t),
            this.bumpsFactor * (1 - t) + other.bumpsFactor * t
        );
    }
}
// Equivalent of PrimitiveEngineering's ChunkBiomes
export class ChunkBiomes {
    voxelInputs: GenVoxelInp[];
    landscapeInputs: LandscapeHeightInp[];
    regionPos: ChunkPos;
    constructor(
        regionPos: ChunkPos,
        voxelInputs: GenVoxelInp[] = [],
        landscapeInputs: LandscapeHeightInp[] = []
    ) {
        this.regionPos = regionPos;
        this.voxelInputs = voxelInputs;
        this.landscapeInputs = landscapeInputs;
    }
    // Optional: helper to add a voxel input
    addVoxelInput(input: GenVoxelInp) {
        this.voxelInputs.push(input);
    }
    addLandscapeInput(input: LandscapeHeightInp) {
        this.landscapeInputs.push(input);
    }
}

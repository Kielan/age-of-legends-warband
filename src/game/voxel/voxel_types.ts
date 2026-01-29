import { Color } from "./color"; // assuming you have a Color class like in your Rust code
export class VoxelId {
    constructor(public id: number) {}
    // Constants
    static readonly GRASS = new VoxelId(0);
    static readonly DIRT = new VoxelId(1);
    static readonly STONE = new VoxelId(2);
    static readonly SAND = new VoxelId(3);
    static readonly SAND_STONE = new VoxelId(4);
    static readonly SNOW = new VoxelId(5);
    // Constructor helper
    static new(id: number): VoxelId {
        return new VoxelId(id);
    }
    // Check if the voxel is "empty" (id 0)
    isEmpty(): boolean {
        return this.id === 0;
    }
    // Linear interpolation (random choice)
    lerp(other: VoxelId, pos: number): VoxelId {
        return Math.random() > pos ? this : other;
    }
    // Get color for this voxel id
    getColor(): Color {
        switch (this.id) {
            case 0: return Color.rgb_u8(40, 133, 7);      // GRASS
            case 1: return Color.rgb_u8(65, 40, 22);      // DIRT
            case 2: return Color.rgb_u8(100, 100, 100);   // STONE
            case 3: return Color.rgb_u8(218, 185, 113);   // SAND
            case 4: return Color.rgb_u8(200, 158, 100);   // SAND_STONE
            case 5: return Color.rgb_u8(255, 255, 255);   // SNOW
            default: return Color.rgb_u8(255, 0, 255);    // Unknown voxel id
    // Comparison helper
    equals(other: VoxelId): boolean {
        return this.id === other.id;
    }
}

// Module imports (equivalent to Rust `mod` + `use`)
import { VoxelId } from "./voxel_types";
// Side-effect / internal modules (Rust: pub(self) mod ...)
import "./add_edge";
import "./append_triangle";
import "./triangulation_table";
// Public re-exports (Rust: pub mod ...)
export * from "./voxel_types";
export * from "./voxels_to_vertex";
/* Types */
// Rust: pub type VoxelValue = u16;
export type VoxelValue = number;
// Equivalent to u16::MAX
const VOXEL_VALUE_MAX = 0xffff;
/* Converts a float val to a voxel val.
 * Note: The value should be between 0.0 and 1.0.
 * Values outside this range will be clamped. */
function f32ToVoxelValue(value: number): VoxelValue {
  const clamped = Math.min(Math.max(value, 0.0), 1.0);
  return Math.floor(clamped * VOXEL_VALUE_MAX);
}
/* Voxel Structs */
export interface NotEmptyVoxel {
  readonly kind: "NotEmpty";
  modified: boolean;
  value: VoxelValue;
  id: VoxelId;
}
export interface EmptyVoxel {
  readonly kind: "Empty";
  value: VoxelValue;
  modified: boolean;
}
export type Voxel = EmptyVoxel | NotEmptyVoxel;
/* Voxel Helpers */
export const Voxel = {
  SCALE: 0.25,
  EMPTY: {
    kind: "Empty" as const,
    value: 0,
    modified: false,
  } satisfies EmptyVoxel,
  /* Creates a new voxel.
   * If the value is less than 0.0, the voxel will be empty.
   * Note: The value should be between -1.0 and 1.0.
   * Values outside this range will be clamped. */
  new(value: number, id: VoxelId): Voxel {
    if (value < 0.0) {
      return {
        kind: "Empty",
        value: f32ToVoxelValue(-value),
        modified: false,
      };
    }
    return {
      kind: "NotEmpty",
      value: f32ToVoxelValue(value),
      id,
      modified: false,
    };
  },
  isModified(voxel: Voxel): boolean {
    return voxel.modified;
  },
  isEmpty(voxel: Voxel): boolean {
    return voxel.kind === "Empty";
  },
  /* Returns the voxel id.
   * If the voxel is empty, the default id is returned. */
  id(voxel: Voxel): VoxelId {
    return voxel.kind === "Empty"
      ? VoxelId.default()
      : voxel.id;
  },
  value(voxel: Voxel): number {
    const raw =
      voxel.kind === "Empty"
        ? -voxel.value
        : voxel.value;

    return raw / VOXEL_VALUE_MAX;
  },
  setModified(voxel: Voxel, modified: boolean): void {
    voxel.modified = modified;
  },
  /* Subtracts a val from the voxel val.
   * The val should be between 0.0 and 1.0.
   * Vals outside this range will be clamped. */
  sub(voxel: Voxel, rhs: number): Voxel {
    const result = Voxel.new(
      Voxel.value(voxel) - rhs,
      Voxel.id(voxel)
    );
    Voxel.setModified(result, voxel.modified);
    return result;
  },
};

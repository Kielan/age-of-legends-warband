import { Vector3 } from "three";
import { appendTriangleWithNormal } from "./append_triangle";
import { Chunk } from "../internal/chunks/chunk";
import { Color } from "../internal/color/color";
import { VoxelPos } from "../internal/pos/voxel_pos";
import { Vertex } from "../plugins/static_mesh/components/vertex";
const FRAME_SIZE = 0.25;
/* Additional mesh at the chunk border to hide seams between chunks with
 * different LODs. */
export function appendEdge(
  vertices: Vertex[],
  color: Color,
  scale: number,
  pos: VoxelPos,
  normal: Vector3,
  points: [Vector3, Vector3, Vector3]
): void {
  const chunkSize = Chunk.SIZE;
  const [a, b, c] = points;
  const f = (
    a: Vector3,
    b: Vector3,
    mask: Vector3,
    color: Color
  ): void => {
    const dir = normal
      .clone()
      .negate()
      .multiply(mask)
      .normalize()
      .multiplyScalar(FRAME_SIZE);
    const c2 = b.clone().add(dir);
    const d = a.clone().add(dir);
    appendTriangleWithNormal(vertices, scale, color, c2, b, a, normal);
    appendTriangleWithNormal(vertices, scale, color, a, d, c2, normal);
  };
  // X axis borders
  if (pos.x === 0) {
    if (a.x === 0 && b.x === 0) {
      f(a, b, new Vector3(0, 1, 1), color);
    } else if (a.x === 0 && c.x === 0) {
      f(c, a, new Vector3(0, 1, 1), color);
    } else if (b.x === 0 && c.x === 0) {
      f(b, c, new Vector3(0, 1, 1), color);
    }
  } else if (pos.x === Chunk.SIZE - 1) {
    if (a.x === chunkSize && b.x === chunkSize) {
      f(a, b, new Vector3(0, 1, 1), color);
    } else if (a.x === chunkSize && c.x === chunkSize) {
      f(c, a, new Vector3(0, 1, 1), color);
    } else if (b.x === chunkSize && c.x === chunkSize) {
      f(b, c, new Vector3(0, 1, 1), color);
    }
  }
  // Y axis borders
  if (pos.y === 0) {
    if (a.y === 0 && b.y === 0) {
      f(a, b, new Vector3(1, 0, 1), color);
    } else if (a.y === 0 && c.y === 0) {
      f(c, a, new Vector3(1, 0, 1), color);
    } else if (b.y === 0 && c.y === 0) {
      f(b, c, new Vector3(1, 0, 1), color);
    }
  } else if (pos.y === Chunk.SIZE - 1) {
    if (a.y === chunkSize && b.y === chunkSize) {
      f(a, b, new Vector3(1, 0, 1), color);
    } else if (a.y === chunkSize && c.y === chunkSize) {
      f(c, a, new Vector3(1, 0, 1), color);
    } else if (b.y === chunkSize && c.y === chunkSize) {
      f(b, c, new Vector3(1, 0, 1), color);
    }
  }
  // Z axis borders
  if (pos.z === 0) {
    if (a.z === 0 && b.z === 0) {
      f(a, b, new Vector3(1, 1, 0), color);
    } else if (a.z === 0 && c.z === 0) {
      f(c, a, new Vector3(1, 1, 0), color);
    } else if (b.z === 0 && c.z === 0) {
      f(b, c, new Vector3(1, 1, 0), color);
    }
  } else if (pos.z === Chunk.SIZE - 1) {
    if (a.z === chunkSize && b.z === chunkSize) {
      f(a, b, new Vector3(1, 1, 0), color);
    } else if (a.z === chunkSize && c.z === chunkSize) {
      f(c, a, new Vector3(1, 1, 0), color);
    } else if (b.z === chunkSize && c.z === chunkSize) {
      f(b, c, new Vector3(1, 1, 0), color);
    }
  }
}

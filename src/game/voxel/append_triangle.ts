import { Vector3 } from "three";

import { Color } from "../internal/color/color";
import { Vertex } from "../plugins/static_mesh/components/vertex";

/**
 * Appends a triangle and returns its computed normal.
 */
export function appendTriangle(
  vertices: Vertex[],
  scale: number,
  color: Color,
  a: Vector3,
  b: Vector3,
  c: Vector3
): Vector3 {
  // normal = (c - a).cross(b - a).normalize()
  const normal = c
    .clone()
    .sub(a)
    .cross(b.clone().sub(a))
    .normalize();

  appendTriangleWithNormal(vertices, scale, color, a, b, c, normal);

  return normal;
}

/**
 * Appends a triangle using a precomputed normal.
 */
export function appendTriangleWithNormal(
  vertices: Vertex[],
  scale: number,
  color: Color,
  a: Vector3,
  b: Vector3,
  c: Vector3,
  normal: Vector3
): void {
  vertices.push({
    color,
    normal,
    pos: c.clone().multiplyScalar(scale),
  });

  vertices.push({
    color,
    normal,
    pos: b.clone().multiplyScalar(scale),
  });

  vertices.push({
    color,
    normal,
    pos: a.clone().multiplyScalar(scale),
  });
}

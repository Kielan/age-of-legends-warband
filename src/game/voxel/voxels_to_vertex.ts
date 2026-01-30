import { Vector3 } from "three";
import { appendEdge } from "./add_edge";
import { appendTriangle } from "./append_triangle";
import { TABLE, getIndexByVoxels } from "./triangulation_table";
import { Voxel } from "./voxel";
import { Chunk } from "../internal/chunks/chunk";
import { ChunkPos, GlobalVoxelPos, VoxelPos } from "../internal/pos";
import { GameWorld } from "../plugins/game_world/resources/game_world";
import { WorldGenerator } from "../plugins/world_generator/resources/world_generator";
import { Vertex } from "../plugins/static_mesh/components/vertex";
/* Node Types */
interface VertexNode {
  index: number;
  pos: Vector3;
}
/* Node Definitions */
const NODE_DN: VertexNode = { index: 0, pos: new Vector3(0.5, 0.0, 1.0) };
const NODE_DE: VertexNode = { index: 1, pos: new Vector3(1.0, 0.0, 0.5) };
const NODE_DS: VertexNode = { index: 2, pos: new Vector3(0.5, 0.0, 0.0) };
const NODE_DW: VertexNode = { index: 3, pos: new Vector3(0.0, 0.0, 0.5) };

const NODE_UN: VertexNode = { index: 4, pos: new Vector3(0.5, 1.0, 1.0) };
const NODE_UE: VertexNode = { index: 5, pos: new Vector3(1.0, 1.0, 0.5) };
const NODE_US: VertexNode = { index: 6, pos: new Vector3(0.5, 1.0, 0.0) };
const NODE_UW: VertexNode = { index: 7, pos: new Vector3(0.0, 1.0, 0.5) };

const NODE_NW: VertexNode = { index: 8, pos: new Vector3(0.0, 0.5, 1.0) };
const NODE_NE: VertexNode = { index: 9, pos: new Vector3(1.0, 0.5, 1.0) };
const NODE_SE: VertexNode = { index: 10, pos: new Vector3(1.0, 0.5, 0.0) };
const NODE_SW: VertexNode = { index: 11, pos: new Vector3(0.0, 0.5, 0.0) };

const BASE_NODES: VertexNode[] = [
  NODE_DN, NODE_DE, NODE_DS, NODE_DW,
  NODE_UN, NODE_UE, NODE_US, NODE_UW,
  NODE_NW, NODE_NE, NODE_SE, NODE_SW,
];
type Nodes = Voxel[];
type VoxelsBlock = Voxel[][][];
/* Voxel Helpers */
function getVoxel(chunk: Chunk, pos: VoxelPos): Voxel {
  return (
    chunk.getVoxel(
      new GlobalVoxelPos(pos.x, pos.y, pos.z)
    ) ?? Voxel.EMPTY
  );
}

function getVoxelsForVertex(
  chunk: Chunk,
  basePos: VoxelPos
): VoxelsBlock {
  return [
    [
      [
        getVoxel(chunk, basePos.add(0, 0, 0)),
        getVoxel(chunk, basePos.add(0, 0, 1)),
      ],
      [
        getVoxel(chunk, basePos.add(0, 1, 0)),
        getVoxel(chunk, basePos.add(0, 1, 1)),
      ],
    ],
    [
      [
        getVoxel(chunk, basePos.add(1, 0, 0)),
        getVoxel(chunk, basePos.add(1, 0, 1)),
      ],
      [
        getVoxel(chunk, basePos.add(1, 1, 0)),
        getVoxel(chunk, basePos.add(1, 1, 1)),
      ],
    ],
  ];
}

function chooseVoxelForNode(a: Voxel, b: Voxel): Voxel {
  const aVal = Voxel.value(a);
  const bVal = Voxel.value(b);
  if (Voxel.isEmpty(a)) {
    return Voxel.new(-aVal / (bVal - aVal), Voxel.id(b));
  }
  if (Voxel.isEmpty(b)) {
    return Voxel.new(1.0 - (-bVal) / (aVal - bVal), Voxel.id(a));
  }
  return a;
}
function getVertexNodes(voxels: VoxelsBlock): Nodes {
  const result: Nodes = Array(12).fill(Voxel.EMPTY);

  result[NODE_DS.index] = chooseVoxelForNode(voxels[0][0][0], voxels[1][0][0]);
  result[NODE_DE.index] = chooseVoxelForNode(voxels[1][0][0], voxels[1][0][1]);
  result[NODE_DN.index] = chooseVoxelForNode(voxels[0][0][1], voxels[1][0][1]);
  result[NODE_DW.index] = chooseVoxelForNode(voxels[0][0][0], voxels[0][0][1]);

  result[NODE_NE.index] = chooseVoxelForNode(voxels[1][0][1], voxels[1][1][1]);
  result[NODE_NW.index] = chooseVoxelForNode(voxels[0][0][1], voxels[0][1][1]);
  result[NODE_SE.index] = chooseVoxelForNode(voxels[1][0][0], voxels[1][1][0]);
  result[NODE_SW.index] = chooseVoxelForNode(voxels[0][0][0], voxels[0][1][0]);

  result[NODE_US.index] = chooseVoxelForNode(voxels[0][1][0], voxels[1][1][0]);
  result[NODE_UE.index] = chooseVoxelForNode(voxels[1][1][0], voxels[1][1][1]);
  result[NODE_UN.index] = chooseVoxelForNode(voxels[0][1][1], voxels[1][1][1]);
  result[NODE_UW.index] = chooseVoxelForNode(voxels[0][1][0], voxels[0][1][1]);
  return result;
}
function shiftNodePos(pos: Vector3, value: number): Vector3 {
  if (pos.x === 0.5) return new Vector3(value, pos.y, pos.z);
  if (pos.y === 0.5) return new Vector3(pos.x, value, pos.z);
  if (pos.z === 0.5) return new Vector3(pos.x, pos.y, value);
  throw new Error(`Failed to process pos ${pos.toArray()}`);
}
/* Triangle Construction */
function appendVoxelTriangle(
  gen: WorldGenerator,
  chunkPos: ChunkPos,
  pos: VoxelPos,
  vertices: Vertex[],
  nodes: Nodes,
  points: [VertexNode, VertexNode, VertexNode],
  scale: number,
  withEdges: boolean
): void {
  const [a, b, c] = points;
  const av = nodes[a.index];
  const bv = nodes[b.index];
  const cv = nodes[c.index];
  if (Voxel.isEmpty(av) || Voxel.isEmpty(bv) || Voxel.isEmpty(cv)) {
    return;
  }
  const basePos = new Vector3(pos.x, pos.y, pos.z);
  const aPos = shiftNodePos(a.pos, Voxel.value(av)).add(basePos);
  const bPos = shiftNodePos(b.pos, Voxel.value(bv)).add(basePos);
  const cPos = shiftNodePos(c.pos, Voxel.value(cv)).add(basePos);
  const baseColor = Voxel.id(av).getColor();
  const color = gen.randomizeColor(
    chunkPos.mul(Chunk.SIZE).add(GlobalVoxelPos.from(pos)),
    baseColor
  );
  const scaled = Voxel.SCALE * scale;
  const normal = appendTriangle(vertices, scaled, color, aPos, bPos, cPos);
  if (withEdges) {
    appendEdge(vertices, color, scaled, pos, normal, [aPos, bPos, cPos]);
  }
}
/* Public API */
export function appendVertex(
  gen: WorldGenerator,
  chunkPos: ChunkPos,
  pos: VoxelPos,
  chunk: Chunk,
  vertices: Vertex[],
  level: number
): void {
  const scale = GameWorld.levelToScale(level);
  const voxels = getVoxelsForVertex(chunk, pos);
  const nodes = getVertexNodes(voxels);
  const trianglePoints = TABLE[getIndexByVoxels(voxels)];
  let offset = 0;
  while (trianglePoints[offset] !== -1) {
    const a = BASE_NODES[trianglePoints[offset]];
    const b = BASE_NODES[trianglePoints[offset + 1]];
    const c = BASE_NODES[trianglePoints[offset + 2]];
    appendVoxelTriangle(
      gen,
      chunkPos,
      pos,
      vertices,
      nodes,
      [a, b, c],
      scale,
      level !== GameWorld.MAX_DETAIL_LEVEL
    );
    offset += 3;
  }
}

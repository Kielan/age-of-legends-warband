export class Entity {}

// Equivalent of `pub struct Tick { tick: u32 }`
export class Tick {
  tick: number;

  constructor(tick: number) {
    this.tick = tick >>> 0; // force u32 semantics
  }

  static new(tick: number): Tick {
    return new Tick(tick);
  }
}

// A location of an entity in an archetype.
export interface EntityLocation {
  // archetypeId?: ArchetypeId;
  // archetypeRow?: ArchetypeRow;
  // tableId?: TableId;
  // tableRow?: TableRow;
}

export class EntityGeneration {
  value: number;

  private constructor(value: number) {
    this.value = value >>> 0;
  }

  // pub const FIRST: Self = Self(0);
  static readonly FIRST = new EntityGeneration(0);
}

// Placeholder for MaybeLocation (since it wasn't included)
export class MaybeLocation {
  static caller(): MaybeLocation {
    return new MaybeLocation();
  }
}

class SpawnedOrDespawned {
  by: MaybeLocation;
  tick: Tick;

  constructor(by: MaybeLocation, tick: Tick) {
    this.by = by;
    this.tick = tick;
  }
}

class EntityMeta {
  // The current EntityGeneration of the EntityIndex
  generation: EntityGeneration;

  // The current location of the EntityIndex
  location: EntityLocation | null;

  // Location and tick of the last spawn/despawn
  spawnedOrDespawned: SpawnedOrDespawned;

  constructor(
    generation: EntityGeneration,
    location: EntityLocation | null,
    spawnedOrDespawned: SpawnedOrDespawned
  ) {
    this.generation = generation;
    this.location = location;
    this.spawnedOrDespawned = spawnedOrDespawned;
  }

  // const FRESH: EntityMeta = ...
  static readonly FRESH = new EntityMeta(
    EntityGeneration.FIRST,
    null,
    new SpawnedOrDespawned(
      MaybeLocation.caller(),
      Tick.new(0)
    )
  );
}

export function spawnChunk(
  commands: Commands,
  meshes: Assets<Mesh>,
  assets: GameAssets,
  world: GameWorld,
  chunk: ChunkPointer,
  vertices: Vertex[]
): Entity {
  const mesh = StaticMeshComponent.spawn(
    commands,
    meshes,
    assets,
    vertices
  );

  commands
    .entity(mesh)
    .insert(ChunkMeshComponent)
    .insert(new Name("chunk:mesh"));

  const chunkPosVec = chunk.getTranslation();

  const chunkEntity = commands.spawn([
    InspectorGroupChunks,
    new Name(
      `chunk[${chunk.getPos()}-${chunk.getLevel()}]`
    ),
    new ChunkComponent({
      chunk: chunk.clone(),
    }),
    GlobalTransform.default(),
    Transform.fromTranslation(chunkPosVec),
    VisibilityBundle.default(),
  ]);

  chunkEntity.addChild(mesh);

  const pos = chunk.getPos();
  const level = chunk.getLevel();

  const entity = chunkEntity.id();

  try {
    world.updateChunk(chunk.clone(), entity);
  } catch {
    throw new Error(
      `Failed to update chunk ${pos}-${level}`
    );
  }

  if (chunk.isReal()) {
    chunkEntity.insert(RealChunkComponent);
  }

  return entity;
}

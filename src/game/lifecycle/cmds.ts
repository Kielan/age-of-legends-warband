/* cmdq used to perform **structural changes** to the World.
 * Cmds are deferred: instead of mutating the World immediately,
 * they are q'd and later applied **in order** by a dedicated
 * “apply deferred” step in the scheduler.
 * This design exists bc each cmd requires exclusive access
 * to the World. Deferring them allows systems to remain composable
 * and safe while still performing powerful mutations.
 * ---
 * ## What cmds can do
 * Each cmd may mutate the World in arbitrary ways, incl:
 * - spawning or despawning entities
 * - inserting or removing components
 * - inserting or mutating resources
 * - any other structural ECS change
 * ---
 * ## Usage
 * A `Commands` instance is typically injected into a system fn.
 * The system records commands, and they are executed later when the
 * scheduler runs the deferred-application phase.
 * ```ts
 * function mySystem(commands: Commands) {
 *   // queue world mutations here
 * }
 * ```
 * Most of the time, `Cmds` is provided automatically by the ECS
 * as a sys param.
 * ---
 * ## Implementing cmds
 * Built-in cmds are exposed as methods (for example, `spawn()`).
 * You can also enq **custom cmds** by pushing a fn
 * that receives mutable access to the World.
 * This allows one-off, ad-hoc cmds wo defining new types.
 * ---
 * ## Error handling
 * Cmds may throw or return errs. Errs are forwarded to a
 * config'able err handler.
 * By default, erro are treated as fatal, but this behavior can be
 * customized globally or per-cmd. */
export class Cmds {
  /* Internal cmd buffer */
  private queue: InternalQueue;
  /* Shared entity metadata storage */
  private entities: Entities;
  /* Allocator used for creating new entity IDs */
  private allocator: EntityAllocator;
  constructor(
    queue: InternalQueue,
    entities: Entities,
    allocator: EntityAllocator
  ) {
    this.queue = queue;
    this.entities = entities;
    this.allocator = allocator;
  }
  // Example placeholder for built-in commands:
  // spawn(): Entity { ... }
  // queue(command: (world: World) => void): void { ... }
}

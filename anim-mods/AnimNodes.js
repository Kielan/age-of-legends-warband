export class EvaluationContext {

    constructor() {

        this.deltaTime = 0;

        this.time = 0;

        this.velocity = 0;

        this.direction = 0;

        this.isGrounded = true;

        this.isCrouching = false;

        this.isJumping = false;

        this.weaponEquipped = false;

        this.aimTarget = null;

        this.character = null;
    }

}

export class RuntimePose {

    constructor(boneCount) {

        this.positions = [];

        this.rotations = [];

        this.scales = [];

        for (let i = 0; i < boneCount; i++) {

            this.positions.push(
                new THREE.Vector3()
            );

            this.rotations.push(
                new THREE.Quaternion()
            );

            this.scales.push(
                new THREE.Vector3(1, 1, 1)
            );
        }
    }

    clone() {

        const p =
            new RuntimePose(
                this.rotations.length
            );

        p.copy(this);

        return p;
    }

    copy(other) {

        for (let i = 0; i < this.rotations.length; i++) {

            this.positions[i].copy(
                other.positions[i]
            );

            this.rotations[i].copy(
                other.rotations[i]
            );

            this.scales[i].copy(
                other.scales[i]
            );
        }
    }

}

export class ExecutionNode {

    constructor() {

        this.id =
            crypto.randomUUID();

        this.inputs = [];

        this.outputs = [];

        this.cachedPose = null;

        this.dirty = true;
    }

    invalidate() {

        this.dirty = true;

        this.cachedPose = null;
    }

    evaluate(context) {

        throw new Error(
            "evaluate() not implemented"
        );
    }

}

export class ClipNode
extends ExecutionNode {

    constructor(clip) {

        super();

        this.clip = clip;

        this.playbackSpeed = 1;

        this.loop = true;

        this.time = 0;
    }

    evaluate(context) {

        this.time += context.deltaTime *
            this.playbackSpeed;

        return this.clip.sample(
            this.time
        );
    }

}


export class BlendNode
extends ExecutionNode {

    constructor() {

        super();

        this.alpha = 0.5;
    }

    evaluate(context) {

        const a =
            this.inputs[0]
                .evaluate(context);

        const b =
            this.inputs[1]
                .evaluate(context);

        const output =
            a.clone();

        for (
            let i = 0;
            i < a.rotations.length;
            i++
        ) {

            output.positions[i]
                .lerpVectors(
                    a.positions[i],
                    b.positions[i],
                    this.alpha
                );

            output.rotations[i]
                .slerpQuaternions(
                    a.rotations[i],
                    b.rotations[i],
                    this.alpha
                );
        }

        return output;
    }

}


export class AdditiveNode
extends ExecutionNode {

    evaluate(context) {

        const base =
            this.inputs[0]
                .evaluate(context);

        const additive =
            this.inputs[1]
                .evaluate(context);

        const output =
            base.clone();

        for (
            let i = 0;
            i < output.rotations.length;
            i++
        ) {

            output.rotations[i]
                .multiply(
                    additive.rotations[i]
                );
        }

        return output;
    }

}


export class LayerNode
extends ExecutionNode {

    constructor(mask) {

        super();

        this.mask = mask;
    }

    evaluate(context) {

        const base =
            this.inputs[0]
                .evaluate(context);

        const overlay =
            this.inputs[1]
                .evaluate(context);

        const output =
            base.clone();

        for (
            const index
            of this.mask
        ) {

            output.positions[index]
                .copy(
                    overlay.positions[index]
                );

            output.rotations[index]
                .copy(
                    overlay.rotations[index]
                );
        }

        return output;
    }

}

export class ConditionalNode
extends ExecutionNode {

    constructor(callback) {

        super();

        this.callback =
            callback;
    }

    evaluate(context) {

        const condition =
            this.callback(
                context
            );

        if (condition) {

            return this.inputs[0]
                .evaluate(context);
        }

        return this.inputs[1]
            .evaluate(context);
    }

}

export class IKNode
extends ExecutionNode {

    constructor(solver) {

        super();

        this.solver =
            solver;
    }

    evaluate(context) {

        const pose =
            this.inputs[0]
                .evaluate(context);

        this.solver.solve(

            pose,

            context.aimTarget
        );

        return pose;
    }

}

export class MotionMatchingNode
extends ExecutionNode {

    constructor(database) {

        super();

        this.database =
            database;
    }

    evaluate(context) {

        return this.database
            .findNearest(

                context.velocity,

                context.direction
            );
    }

}

export class StateMachine {

    constructor() {

        this.states =
            new Map();

        this.transitions =
            [];

        this.current =
            null;
    }

    addState(name, node) {

        this.states.set(
            name,
            node
        );
    }

    addTransition(
        from,
        to,
        predicate
    ) {

        this.transitions.push({

            from,

            to,

            predicate
        });
    }

    update(context) {

        for (
            const transition
            of this.transitions
        ) {

            if (
                transition.from
                !== this.current
            ) {

                continue;
            }

            if (
                transition.predicate(
                    context
                )
            ) {

                this.current =
                    transition.to;

                break;
            }
        }

        return this.states
            .get(this.current)
            .evaluate(context);
    }

}

export class ExecutionScheduler {

    topologicalSort(nodes) {

        const visited =
            new Set();

        const order =
            [];

        const visit =
            node => {

                if (
                    visited.has(node)
                ) {

                    return;
                }

                visited.add(node);

                for (
                    const input
                    of node.inputs
                ) {

                    visit(input);
                }

                order.push(node);
            };

        for (
            const node
            of nodes
        ) {

            visit(node);
        }

        return order;
    }

}

export class RuntimeEvaluator {

    constructor() {

        this.scheduler =
            new ExecutionScheduler();
    }

    evaluate(graph, context) {

        const executionOrder =
            this.scheduler
                .topologicalSort(
                    graph.nodes
                );

        for (
            const node
            of executionOrder
        ) {

            node.cachedPose =
                node.evaluate(
                    context
                );

            node.dirty =
                false;
        }

        return graph.output
            .cachedPose;
    }

}

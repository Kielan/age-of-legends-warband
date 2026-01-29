export class CmdQ {
  /* This buffer densely stores all queued commands.
   * For each command, one CommandMeta is stored, followed by zero or more bytes
   * to store the command itself. */
  bytes: number[];
  cursor: number;
  panicRecovery: number[];
  caller: MaybeLocation;
  constructor(
    bytes: number[] = [],
    cursor: number = 0,
    panicRecovery: number[] = [],
    caller: MaybeLocation = MaybeLocation.caller()
  ) {
    this.bytes = bytes;
    this.cursor = cursor;
    this.panicRecovery = panicRecovery;
    this.caller = caller;
  }
  /* Rust: impl Default for CommandQueue mapped to typescript */
  static default(): CmdQ {
    return new CmdQ();
  }
}

/* Wraps refs to a CmdQ, used internally to avoid stacked borrow rules
 * when partially applying the world's cmd queue recursively. */
export class RawCmdQ {
  bytes: number[];
  cursor: { value: number };
  panicRecovery: number[];
  constructor(
    bytes: number[],
    cursor: { value: number },
    panicRecovery: number[]
  ) {
    this.bytes = bytes;
    this.cursor = cursor;
    this.panicRecovery = panicRecovery;
  }

  clone(): RawCmdQ {
    return new RawCmdQ(
      this.bytes,
      this.cursor,
      this.panicRecovery
    );
  }
}

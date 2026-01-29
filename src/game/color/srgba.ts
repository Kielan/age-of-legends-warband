/* sRGBA – non-linear standard RGB w alpha
 * This is a faithful port of the Rust `Srgba` type (provided by chatgpt)
 * - Channels are in the range [0.0, 1.0]
 * - Gamma correction follows the sRGB specification
 * - Methods mirror Rust impl blocks and trait behavior */
export class Srgba {
  /* Red channel [0.0, 1.0] */
  red: number;
  /* Green channel [0.0, 1.0] */
  green: number;
  /* Blue channel [0.0, 1.0] */
  blue: number;
  /* Alpha channel [0.0, 1.0] */
  alpha: number;
  constructor(red: number, green: number, blue: number, alpha: number) {
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = alpha;
  }
  /* Constants (standard VGA colors) */
  static readonly BLACK = new Srgba(0.0, 0.0, 0.0, 1.0);
  static readonly NONE  = new Srgba(0.0, 0.0, 0.0, 0.0);
  static readonly WHITE = new Srgba(1.0, 1.0, 1.0, 1.0);
  static readonly RED   = new Srgba(1.0, 0.0, 0.0, 1.0);
  static readonly GREEN = new Srgba(0.0, 1.0, 0.0, 1.0);
  static readonly BLUE  = new Srgba(0.0, 0.0, 1.0, 1.0);
  /* Constructors */
  static new(red: number, green: number, blue: number, alpha: number): Srgba {
    return new Srgba(red, green, blue, alpha);
  }
  static rgb(red: number, green: number, blue: number): Srgba {
    return new Srgba(red, green, blue, 1.0);
  }
  withRed(red: number): Srgba {
    return new Srgba(red, this.green, this.blue, this.alpha);
  }
  withGreen(green: number): Srgba {
    return new Srgba(this.red, green, this.blue, this.alpha);
  }
  withBlue(blue: number): Srgba {
    return new Srgba(this.red, this.green, blue, this.alpha);
  }
  /*  Hex parsing / formatting */
  static hex(hex: string): Srgba {
    const value = hex.startsWith("#") ? hex.slice(1) : hex;
    const parseU16 = (s: string) => {
      if (!/^[0-9a-fA-F]+$/.test(s)) {
        throw new HexColorError("Parse");
      }
      return parseInt(s, 16);
    };
    switch (value.length) {
      // RGB (12-bit)
      case 3: {
        const n = parseU16(value);
        const r = (n >> 8) & 0xF;
        const g = (n >> 4) & 0xF;
        const b = n & 0xF;
        return Srgba.rgbU8(
          (r << 4) | r,
          (g << 4) | g,
          (b << 4) | b
        );
      }
      // RGBA (16-bit)
      case 4: {
        const n = parseU16(value);
        const r = (n >> 12) & 0xF;
        const g = (n >> 8) & 0xF;
        const b = (n >> 4) & 0xF;
        const a = n & 0xF;
        return Srgba.rgbaU8(
          (r << 4) | r,
          (g << 4) | g,
          (b << 4) | b,
          (a << 4) | a
        );
      }
      // RRGGBB
      case 6: {
        const n = parseU16(value);
        return Srgba.rgbU8(
          (n >> 16) & 0xff,
          (n >> 8) & 0xff,
          n & 0xff
        );
      }
      // RRGGBBAA
      case 8: {
        const n = parseU16(value);
        return Srgba.rgbaU8(
          (n >> 24) & 0xff,
          (n >> 16) & 0xff,
          (n >> 8) & 0xff,
          n & 0xff
        );
      }
      default:
        throw new HexColorError("Length");
    }
  }
  toHex(): string {
    const [r, g, b, a] = this.toU8Array();
    if (a === 255) {
      return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
    }
    return `#${hex2(r)}${hex2(g)}${hex2(b)}${hex2(a)}`;
  }
  /* u8 / float conversions */
  static rgbU8(r: number, g: number, b: number): Srgba {
    return Srgba.fromU8ArrayNoAlpha([r, g, b]);
  }
  static rgbaU8(r: number, g: number, b: number, a: number): Srgba {
    return Srgba.fromU8Array([r, g, b, a]);
  }
  toU8Array(): [number, number, number, number] {
    return [
      clampU8(this.red),
      clampU8(this.green),
      clampU8(this.blue),
      clampU8(this.alpha),
    ];
  }
  toU8ArrayNoAlpha(): [number, number, number] {
    return [
      clampU8(this.red),
      clampU8(this.green),
      clampU8(this.blue),
    ];
  }
  static fromU8Array(color: [number, number, number, number]): Srgba {
    return new Srgba(
      color[0] / 255,
      color[1] / 255,
      color[2] / 255,
      color[3] / 255
    );
  }
  static fromU8ArrayNoAlpha(color: [number, number, number]): Srgba {
    return new Srgba(
      color[0] / 255,
      color[1] / 255,
      color[2] / 255,
      1.0
    );
  }
  /*  Gamma correction */
  static gammaFunction(value: number): number {
    if (value <= 0.0) return value;
    if (value <= 0.04045) {
      return value / 12.92;
    }
    return Math.pow((value + 0.055) / 1.055, 2.4);
  }
  static gammaFunctionInverse(value: number): number {
    if (value <= 0.0) return value;
    if (value <= 0.0031308) {
      return value * 12.92;
    }
    return 1.055 * Math.pow(value, 1.0 / 2.4) - 0.055;
  }
  /* Luminance / mixing / alpha */
  mix(other: Srgba, factor: number): Srgba {
    const n = 1.0 - factor;
    return new Srgba(
      this.red * n + other.red * factor,
      this.green * n + other.green * factor,
      this.blue * n + other.blue * factor,
      this.alpha * n + other.alpha * factor
    );
  }
  withAlpha(alpha: number): Srgba {
    return new Srgba(this.red, this.green, this.blue, alpha);
  }
  setAlpha(alpha: number): void {
    this.alpha = alpha;
  }
  distanceSquared(other: Srgba): number {
    const dr = this.red - other.red;
    const dg = this.green - other.green;
    const db = this.blue - other.blue;
    return dr * dr + dg * dg + db * db;
  }
  /* Defaults */
  static default(): Srgba {
    return Srgba.WHITE;
  }
}
/* Errs */
export class HexColorError extends Error {
  kind: "Parse" | "Length" | "Char";
  constructor(kind: "Parse" | "Length" | "Char") {
    super(kind);
    this.kind = kind;
  }
}
/* Helpers */
function clampU8(v: number): number {
  return Math.round(Math.min(1, Math.max(0, v)) * 255);
}
function hex2(v: number): string {
  return v.toString(16).padStart(2, "0").toUpperCase();
}

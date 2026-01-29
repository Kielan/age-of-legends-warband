/* LinearRgba
 * Linear (non-gamma-corrected) RGBA color.
 * Intended for internal math, rendering pipelines, and shader usage.
 * Channels are in the range [0.0, 1.0]. */

export class LinearRgba {
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
  /* Constants */
  static readonly BLACK = new LinearRgba(0.0, 0.0, 0.0, 1.0);
  static readonly WHITE = new LinearRgba(1.0, 1.0, 1.0, 1.0);
  static readonly NONE  = new LinearRgba(0.0, 0.0, 0.0, 0.0);
  static readonly RED   = new LinearRgba(1.0, 0.0, 0.0, 1.0);
  static readonly GREEN = new LinearRgba(0.0, 1.0, 0.0, 1.0);
  static readonly BLUE  = new LinearRgba(0.0, 0.0, 1.0, 1.0);
  /* Invalid / sentinel color */
  static readonly NAN = new LinearRgba(
    Number.NaN,
    Number.NaN,
    Number.NaN,
    Number.NaN
  );
  /* Constructors */
  static new(red: number, green: number, blue: number, alpha: number): LinearRgba {
    return new LinearRgba(red, green, blue, alpha);
  }
  static rgb(red: number, green: number, blue: number): LinearRgba {
    return new LinearRgba(red, green, blue, 1.0);
  }
  withRed(red: number): LinearRgba {
    return new LinearRgba(red, this.green, this.blue, this.alpha);
  }
  withGreen(green: number): LinearRgba {
    return new LinearRgba(this.red, green, this.blue, this.alpha);
  }
  withBlue(blue: number): LinearRgba {
    return new LinearRgba(this.red, this.green, blue, this.alpha);
  }
  /* ------------------------------------------------------------------------
   * Lightness adjustment (internal helper)
   * --------------------------------------------------------------------- */
  private adjustLightness(amount: number): void {
    const luminance = this.luminance();
    const target = clamp01(luminance + amount);
    if (target < luminance) {
      const adjustment = (luminance - target) / luminance;
      this.mixAssign(new LinearRgba(0.0, 0.0, 0.0, this.alpha), adjustment);
    } else if (target > luminance) {
      const adjustment = (target - luminance) / (1.0 - luminance);
      this.mixAssign(new LinearRgba(1.0, 1.0, 1.0, this.alpha), adjustment);
    }
  }
  /* Packed / numeric conversions */
  /* Convert to little-endian RGBA u32 (A is MSB, R is LSB) */
  asU32(): number {
    const [r, g, b, a] = this.toU8Array();
    return (
      (a << 24) |
      (b << 16) |
      (g << 8) |
      r
    ) >>> 0;
  }
  /* Defaults */
  static default(): LinearRgba {
    return LinearRgba.WHITE;
  }
  /* Luminance */
  /* Relative luminance (CIE XYZ) */
  luminance(): number {
    return (
      this.red * 0.2126 +
      this.green * 0.7152 +
      this.blue * 0.0722
    );
  }
  withLuminance(luminance: number): LinearRgba {
    const current = this.luminance();
    const adjustment = luminance / current;
    return new LinearRgba(
      clamp01(this.red * adjustment),
      clamp01(this.green * adjustment),
      clamp01(this.blue * adjustment),
      this.alpha
    );
  }
  darker(amount: number): LinearRgba {
    const result = this.clone();
    result.adjustLightness(-amount);
    return result;
  }
  lighter(amount: number): LinearRgba {
    const result = this.clone();
    result.adjustLightness(amount);
    return result;
  }
  /* Mixing */
  mix(other: LinearRgba, factor: number): LinearRgba {
    const n = 1.0 - factor;
    return new LinearRgba(
      this.red * n + other.red * factor,
      this.green * n + other.green * factor,
      this.blue * n + other.blue * factor,
      this.alpha * n + other.alpha * factor
    );
  }
  private mixAssign(other: LinearRgba, factor: number): void {
    const n = 1.0 - factor;
    this.red   = this.red * n + other.red * factor;
    this.green = this.green * n + other.green * factor;
    this.blue  = this.blue * n + other.blue * factor;
    this.alpha = this.alpha * n + other.alpha * factor;
  }
  /* Alpha */
  withAlpha(alpha: number): LinearRgba {
    return new LinearRgba(this.red, this.green, this.blue, alpha);
  }
  getAlpha(): number {
    return this.alpha;
  }
  setAlpha(alpha: number): void {
    this.alpha = alpha;
  }
  /* Distance */
  distanceSquared(other: LinearRgba): number {
    const dr = this.red - other.red;
    const dg = this.green - other.green;
    const db = this.blue - other.blue;
    return dr * dr + dg * dg + db * db;
  }
  /* Component conversions */
  toF32Array(): [number, number, number, number] {
    return [this.red, this.green, this.blue, this.alpha];
  }
  toF32ArrayNoAlpha(): [number, number, number] {
    return [this.red, this.green, this.blue];
  }
  toVec4(): Vec4 {
    return new Vec4(this.red, this.green, this.blue, this.alpha);
  }
  toVec3(): Vec3 {
    return new Vec3(this.red, this.green, this.blue);
  }
  static fromF32Array(color: [number, number, number, number]): LinearRgba {
    return new LinearRgba(color[0], color[1], color[2], color[3]);
  }
  static fromF32ArrayNoAlpha(color: [number, number, number]): LinearRgba {
    return new LinearRgba(color[0], color[1], color[2], 1.0);
  }
  static fromVec4(color: Vec4): LinearRgba {
    return new LinearRgba(color.x, color.y, color.z, color.w);
  }
  static fromVec3(color: Vec3): LinearRgba {
    return new LinearRgba(color.x, color.y, color.z, 1.0);
  }
  /* Packed u8 conversions */
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
  static fromU8Array(color: [number, number, number, number]): LinearRgba {
    return new LinearRgba(
      color[0] / 255,
      color[1] / 255,
      color[2] / 255,
      color[3] / 255
    );
  }
  static fromU8ArrayNoAlpha(color: [number, number, number]): LinearRgba {
    return new LinearRgba(
      color[0] / 255,
      color[1] / 255,
      color[2] / 255,
      1.0
    );
  }
  /* Utils */
  clone(): LinearRgba {
    return new LinearRgba(this.red, this.green, this.blue, this.alpha);
  }
}
/* Helpers */
function clamp01(v: number): number {
  return Math.min(1.0, Math.max(0.0, v));
}
function clampU8(v: number): number {
  return Math.round(clamp01(v) * 255);
}


pub enum Color {
    /// A color in the sRGB color space with alpha.
    Srgba(Srgba),
    /// A color in the linear sRGB color space with alpha.
    LinearRgba(LinearRgba),
}

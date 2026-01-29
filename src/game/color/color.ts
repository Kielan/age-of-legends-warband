import {
  Srgba,
  LinearRgba,
  Hsla,
  Hsva,
  Hwba,
  Laba,
  Lcha,
  Oklaba,
  Oklcha,
  Xyza,
} from "./colors";
import { MismatchedUnitsError } from "./errors";
/* ============================================================================
 * Color (tagged union)
 * ========================================================================== */
export type ColorKind =
  | "Srgba"
  | "LinearRgba"
  | "Hsla"
  | "Hsva"
  | "Hwba"
  | "Laba"
  | "Lcha"
  | "Oklaba"
  | "Oklcha"
  | "Xyza";
export class Color {
  readonly kind: ColorKind;
  readonly value:
    | Srgba
    | LinearRgba
    | Hsla
    | Hsva
    | Hwba
    | Laba
    | Lcha
    | Oklaba
    | Oklcha
    | Xyza;
  private constructor(kind: ColorKind, value: any) {
    this.kind = kind;
    this.value = value;
  }
  /* ------------------------------------------------------------------------
   * Conversions
   * --------------------------------------------------------------------- */
  toLinear(): LinearRgba {
    return LinearRgba.fromColor(this);
  }
  toSrgba(): Srgba {
    return Srgba.fromColor(this);
  }
  /* ------------------------------------------------------------------------
   * Constructors
   * --------------------------------------------------------------------- */
  static srgba(r: number, g: number, b: number, a: number): Color {
    return new Color("Srgba", new Srgba(r, g, b, a));
  }
  static srgb(r: number, g: number, b: number): Color {
    return Color.srgba(r, g, b, 1.0);
  }
  static srgbaU8(r: number, g: number, b: number, a: number): Color {
    return Color.srgba(r / 255, g / 255, b / 255, a / 255);
  }
  static srgbU8(r: number, g: number, b: number): Color {
    return Color.srgba(r / 255, g / 255, b / 255, 1.0);
  }
  static linearRgba(r: number, g: number, b: number, a: number): Color {
    return new Color("LinearRgba", new LinearRgba(r, g, b, a));
  }
  static linearRgb(r: number, g: number, b: number): Color {
    return Color.linearRgba(r, g, b, 1.0);
  }
  static hsla(h: number, s: number, l: number, a: number): Color {
    return new Color("Hsla", new Hsla(h, s, l, a));
  }
  static hsl(h: number, s: number, l: number): Color {
    return Color.hsla(h, s, l, 1.0);
  }
  static hsva(h: number, s: number, v: number, a: number): Color {
    return new Color("Hsva", new Hsva(h, s, v, a));
  }
  static hsv(h: number, s: number, v: number): Color {
    return Color.hsva(h, s, v, 1.0);
  }
  static hwba(h: number, w: number, b: number, a: number): Color {
    return new Color("Hwba", new Hwba(h, w, b, a));
  }
  static hwb(h: number, w: number, b: number): Color {
    return Color.hwba(h, w, b, 1.0);
  }
  static laba(l: number, a: number, b: number, alpha: number): Color {
    return new Color("Laba", new Laba(l, a, b, alpha));
  }
  static lab(l: number, a: number, b: number): Color {
    return Color.laba(l, a, b, 1.0);
  }
  static lcha(l: number, c: number, h: number, a: number): Color {
    return new Color("Lcha", new Lcha(l, c, h, a));
  }
  static lch(l: number, c: number, h: number): Color {
    return Color.lcha(l, c, h, 1.0);
  }
  static oklaba(l: number, a: number, b: number, alpha: number): Color {
    return new Color("Oklaba", new Oklaba(l, a, b, alpha));
  }
  static oklab(l: number, a: number, b: number): Color {
    return Color.oklaba(l, a, b, 1.0);
  }
  static oklcha(l: number, c: number, h: number, a: number): Color {
    return new Color("Oklcha", new Oklcha(l, c, h, a));
  }
  static oklch(l: number, c: number, h: number): Color {
    return Color.oklcha(l, c, h, 1.0);
  }
  static xyza(x: number, y: number, z: number, a: number): Color {
    return new Color("Xyza", new Xyza(x, y, z, a));
  }
  static xyz(x: number, y: number, z: number): Color {
    return Color.xyza(x, y, z, 1.0);
  }
  /* Constants */
  static readonly WHITE = Color.linearRgb(1, 1, 1);
  static readonly BLACK = Color.linearRgb(0, 0, 0);
  static readonly NONE = Color.linearRgba(0, 0, 0, 0);
  /* Alpha */
  withAlpha(alpha: number): Color {
    return new Color(this.kind, this.value.withAlpha(alpha));
  }
  alpha(): number {
    return this.value.alpha();
  }
  setAlpha(alpha: number): Color {
    return this.withAlpha(alpha);
  }
  /* Luminance (ChosenColorSpace = Oklcha) */
  luminance(): number {
    switch (this.kind) {
      case "Hsva":
      case "Hwba":
        return Oklcha.from(this.value).luminance();
      default:
        return this.value.luminance();
    }
  }
  withLuminance(value: number): Color {
    switch (this.kind) {
      case "Hsva":
      case "Hwba":
        return new Color(this.kind, Oklcha.from(this.value).withLuminance(value).into(this.kind));
      default:
        return new Color(this.kind, this.value.withLuminance(value));
    }
  }
  darker(amount: number): Color {
    return this.withLuminance(this.luminance() - amount);
  }
  lighter(amount: number): Color {
    return this.withLuminance(this.luminance() + amount);
  }
  /* Hue */
  hue(): number {
    switch (this.kind) {
      case "Hsla":
      case "Hsva":
      case "Hwba":
      case "Lcha":
      case "Oklcha":
        return this.value.hue();
      default:
        return Oklcha.from(this.value).hue();
    }
  }
  withHue(hue: number): Color {
    switch (this.kind) {
      case "Hsla":
      case "Hsva":
      case "Hwba":
      case "Lcha":
      case "Oklcha":
        return new Color(this.kind, this.value.withHue(hue));
      default:
        return new Color(this.kind, Oklcha.from(this.value).withHue(hue).into(this.kind));
    }
  }
  /* Saturation (via Hsla) */
  saturation(): number {
    return Hsla.from(this.value).saturation();
  }
  withSaturation(s: number): Color {
    return Hsla.from(this.value).withSaturation(s).intoColor();
  }
  /* Mixing */
  mix(other: Color, factor: number): Color {
    return new Color(
      this.kind,
      this.value.mix(other.value.into(this.kind), factor)
    );
  }
  /* Distance */
  distanceSquared(other: Color): number {
    switch (this.kind) {
      case "Oklaba":
      case "Oklcha":
        return this.value.distanceSquared(other.value.into(this.kind));
      default:
        return Oklcha.from(this.value).distanceSquared(
          Oklcha.from(other.value)
        );
    }
  }
  /* Stable interpolation */
  tryInterpolateStable(other: Color, t: number): Color {
    if (this.kind !== other.kind) {
      throw new MismatchedUnitsError();
    }
    return new Color(this.kind, this.value.mix(other.value, t));
  }
}

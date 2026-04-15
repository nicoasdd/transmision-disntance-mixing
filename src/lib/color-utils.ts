/**
 * Color space conversions and perceptual distance calculations.
 * Pure functions, no DOM — safe for Web Workers.
 */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// sRGB → linear RGB (inverse gamma)
function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

// linear RGB → sRGB (gamma)
function linearToSrgb(c: number): number {
  const s = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(s * 255)));
}

export function rgbToLab(
  r: number,
  g: number,
  b: number
): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  // sRGB → XYZ (D65 illuminant)
  let x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
  let y = 0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb;
  let z = 0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb;

  // D65 reference white
  x /= 0.95047;
  y /= 1.0;
  z /= 1.08883;

  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bVal = 200 * (fy - fz);

  return [L, a, bVal];
}

export function labToRgb(
  L: number,
  a: number,
  b: number
): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const eps = 0.008856;
  const kappa = 903.3;

  const xr = fx * fx * fx > eps ? fx * fx * fx : (116 * fx - 16) / kappa;
  const yr = L > kappa * eps ? Math.pow((L + 16) / 116, 3) : L / kappa;
  const zr = fz * fz * fz > eps ? fz * fz * fz : (116 * fz - 16) / kappa;

  const x = xr * 0.95047;
  const y = yr * 1.0;
  const z = zr * 1.08883;

  const lr = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const lg = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z;
  const lb = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;

  return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
}

/** CIE76 Delta-E: Euclidean distance in CIELAB space */
export function deltaE(
  lab1: [number, number, number],
  lab2: [number, number, number]
): number {
  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

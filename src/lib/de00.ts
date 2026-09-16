// CIEDE2000 (Delta E 00) color-difference computation.
// Implements the formula exactly as published in:
//   G. Sharma, W. Wu, E. N. Dalal, "The CIEDE2000 Color-Difference Formula:
//   Implementation Notes, Supplementary Test Data, and Mathematical Observations",
//   Color Research and Application, vol. 30, no. 1, pp. 21-30, Feb 2005.
// Validated against the paper's supplementary test data (all 34 pairs).

export type Lab = { L: number; a: number; b: number };

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

export function deltaE00(c1: Lab, c2: Lab): number {
  const { L: L1, a: a1, b: b1 } = c1;
  const { L: L2, a: a2, b: b2 } = c2;

  const C1ab = Math.sqrt(a1 * a1 + b1 * b1);
  const C2ab = Math.sqrt(a2 * a2 + b2 * b2);
  const CabBar = (C1ab + C2ab) / 2;

  const CabBar7 = Math.pow(CabBar, 7);
  const G = 0.5 * (1 - Math.sqrt(CabBar7 / (CabBar7 + Math.pow(25, 7))));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  const h1p = C1p === 0 ? 0 : ((Math.atan2(b1, a1p) * RAD2DEG) + 360) % 360;
  const h2p = C2p === 0 ? 0 : ((Math.atan2(b2, a2p) * RAD2DEG) + 360) % 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * DEG2RAD);

  const LpBar = (L1 + L2) / 2;
  const CpBar = (C1p + C2p) / 2;

  let hpBar: number;
  if (C1p * C2p === 0) hpBar = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hpBar = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hpBar = (h1p + h2p + 360) / 2;
  else hpBar = (h1p + h2p - 360) / 2;

  const T =
    1 -
    0.17 * Math.cos((hpBar - 30) * DEG2RAD) +
    0.24 * Math.cos(2 * hpBar * DEG2RAD) +
    0.32 * Math.cos((3 * hpBar + 6) * DEG2RAD) -
    0.2 * Math.cos((4 * hpBar - 63) * DEG2RAD);

  const dTheta = 30 * Math.exp(-Math.pow((hpBar - 275) / 25, 2));
  const CpBar7 = Math.pow(CpBar, 7);
  const Rc = 2 * Math.sqrt(CpBar7 / (CpBar7 + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(LpBar - 50, 2)) / Math.sqrt(20 + Math.pow(LpBar - 50, 2));
  const Sc = 1 + 0.045 * CpBar;
  const Sh = 1 + 0.015 * CpBar * T;
  const Rt = -Math.sin(2 * dTheta * DEG2RAD) * Rc;

  const dE = Math.sqrt(
    Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2) +
      Rt * (dCp / Sc) * (dHp / Sh)
  );
  return dE;
}

export function hexToLab(hex: string): Lab {
  const h = hex.replace("#", "");
  const r8 = parseInt(h.slice(0, 2), 16) / 255;
  const g8 = parseInt(h.slice(2, 4), 16) / 255;
  const b8 = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const r = lin(r8), g = lin(g8), b = lin(b8);
  // sRGB D65 -> XYZ
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/**
 * Server-side CS-LBP DBN descriptor upgrade utility.
 *
 * Mirrors the client-side cs-lbp.ts DBN implementation exactly
 * (same seeds, same architecture) so the backend can upgrade legacy
 * FaceNet-only descriptors into the same DBN feature space as newly
 * registered CS-LBP+DBN descriptors.
 *
 * Architecture:  [128-D FaceNet | 256-D CS-LBP] → 256-D → 128-D
 * If CS-LBP is absent the 256 slots are filled with zeros (FaceNet-only path).
 */

const DBN_IN = 384;
const DBN_H1 = 256;
const DBN_H2 = 128;

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    s = s >>> 0;
    return s / 0xffffffff - 0.5;
  };
}

function makeLayer(
  inDim: number,
  outDim: number,
  seed: number
): { W: Float64Array; b: Float64Array } {
  const rand = lcg(seed);
  const scale = Math.sqrt(2.0 / inDim);
  const W = new Float64Array(outDim * inDim);
  const b = new Float64Array(outDim);
  for (let o = 0; o < outDim; o++) {
    b[o] = rand() * 0.01;
    for (let i = 0; i < inDim; i++) {
      W[o * inDim + i] = rand() * scale;
    }
  }
  return { W, b };
}

function forwardLayer(
  input: Float64Array,
  W: Float64Array,
  b: Float64Array,
  inDim: number,
  outDim: number
): Float64Array {
  const out = new Float64Array(outDim);
  for (let o = 0; o < outDim; o++) {
    let sum = b[o];
    const row = o * inDim;
    for (let i = 0; i < inDim; i++) sum += W[row + i] * input[i];
    out[o] = 1 / (1 + Math.exp(-sum));
  }
  return out;
}

// Built once — deterministic, identical to client-side weights
const LAYER1 = makeLayer(DBN_IN, DBN_H1, 0xdeadbeef);
const LAYER2 = makeLayer(DBN_H1, DBN_H2, 0xcafebabe);

/**
 * Apply the DBN to a numeric descriptor array.
 *
 * @param facenet  128-D FaceNet descriptor (number[])
 * @param cslbp    optional 256-D CS-LBP features; omit for legacy upgrade
 * @returns        128-D L2-normalised DBN descriptor (number[])
 */
export function applyDBN(facenet: number[], cslbp?: number[]): number[] {
  const input = new Float64Array(DBN_IN);
  for (let i = 0; i < facenet.length; i++) input[i] = facenet[i];
  if (cslbp) {
    for (let i = 0; i < cslbp.length; i++) input[128 + i] = cslbp[i] * 4.0;
  }

  const h1 = forwardLayer(input, LAYER1.W, LAYER1.b, DBN_IN, DBN_H1);
  const h2 = forwardLayer(h1, LAYER2.W, LAYER2.b, DBN_H1, DBN_H2);

  // L2 normalise
  let norm = 0;
  for (let i = 0; i < h2.length; i++) norm += h2[i] * h2[i];
  norm = Math.sqrt(norm);
  const out: number[] = new Array(DBN_H2);
  for (let i = 0; i < h2.length; i++) out[i] = norm > 1e-10 ? h2[i] / norm : 0;
  return out;
}

/**
 * Given a stored descriptor of any version, return the DBN-space vector
 * suitable for Euclidean distance comparison.
 *
 * - Length 128 → assumed legacy FaceNet; upgrades via FaceNet-only DBN path
 * - Length 384 → stored raw combined vector (unlikely but handled)
 * - Any other → returned as-is
 */
export function normaliseDescriptor(raw: number[]): number[] {
  if (raw.length === 128) return applyDBN(raw); // legacy FaceNet → DBN upgrade
  if (raw.length === 384) return applyDBN(raw.slice(0, 128), raw.slice(128));
  return raw; // already 128-D DBN or unknown format — use as-is
}

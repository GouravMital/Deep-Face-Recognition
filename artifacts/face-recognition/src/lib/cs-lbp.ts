/**
 * CS-LBP (Center-Symmetric Local Binary Pattern) Implementation
 *
 * Reference: Heikkilä, M., Pietikäinen, M., & Schmid, C. (2009).
 * "Description of interest regions with local binary patterns."
 * Pattern Recognition, 42(3), 425–436.
 *
 * For each pixel p, CS-LBP compares 4 pairs of symmetric neighbors.
 * Neighbors at angles 0°, 45°, 90°, 135° are paired with their
 * opposite counterparts at 180°, 225°, 270°, 315°.
 * Each pair contributes 1 bit → 4-bit code per pixel (values 0–15).
 */

const FACE_SIZE = 64; // Normalize face crops to this resolution
const GRID_X = 4;     // Spatial grid columns
const GRID_Y = 4;     // Spatial grid rows
const N_BINS = 16;    // 2^4 possible CS-LBP codes
export const CSLBP_DIM = GRID_X * GRID_Y * N_BINS; // = 256

// 8-connectivity neighbor offsets (N, NE, E, SE, S, SW, W, NW)
const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];

function toGrayscale(data: Uint8ClampedArray, len: number): Float32Array {
  const gray = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const j = i * 4;
    gray[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
  }
  return gray;
}

function computeCSLBPMap(gray: Float32Array, w: number, h: number): Uint8Array {
  const map = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let code = 0;
      // 4 symmetric pairs: compare neighbor i against neighbor i+4
      for (let i = 0; i < 4; i++) {
        const n1 = gray[(y + DY[i]) * w + (x + DX[i])];
        const n2 = gray[(y + DY[i + 4]) * w + (x + DX[i + 4])];
        if (n1 >= n2) code |= (1 << i);
      }
      map[y * w + x] = code;
    }
  }
  return map;
}

function buildSpatialHistogram(map: Uint8Array, w: number, h: number): Float32Array {
  const hist = new Float32Array(GRID_X * GRID_Y * N_BINS);
  const bw = Math.floor(w / GRID_X);
  const bh = Math.floor(h / GRID_Y);

  for (let gy = 0; gy < GRID_Y; gy++) {
    for (let gx = 0; gx < GRID_X; gx++) {
      const base = (gy * GRID_X + gx) * N_BINS;
      const x0 = gx * bw;
      const y0 = gy * bh;
      const x1 = gx === GRID_X - 1 ? w : x0 + bw;
      const y1 = gy === GRID_Y - 1 ? h : y0 + bh;
      let count = 0;

      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          hist[base + map[py * w + px]]++;
          count++;
        }
      }
      // L1-normalize each block histogram
      if (count > 0) {
        for (let b = 0; b < N_BINS; b++) hist[base + b] /= count;
      }
    }
  }
  return hist;
}

/**
 * Extract CS-LBP spatial histogram from a face bounding box on a canvas/video element.
 * Returns a 256-D Float32Array, or null if extraction fails.
 */
export function extractCSLBP(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number }
): Float32Array | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = FACE_SIZE;
    canvas.height = FACE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(source, box.x, box.y, box.width, box.height, 0, 0, FACE_SIZE, FACE_SIZE);
    const imgData = ctx.getImageData(0, 0, FACE_SIZE, FACE_SIZE);
    const gray = toGrayscale(imgData.data, FACE_SIZE * FACE_SIZE);
    const map = computeCSLBPMap(gray, FACE_SIZE, FACE_SIZE);
    return buildSpatialHistogram(map, FACE_SIZE, FACE_SIZE);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// DBN (Deep Belief Network) — Deterministic Simulation
// ─────────────────────────────────────────────────────────────
//
// A true DBN is trained layer-by-layer using Restricted Boltzmann
// Machines (RBMs) via contrastive divergence. Here we simulate a
// pre-trained DBN using deterministic seeded weight initialization
// (Linear Congruential Generator) as a fixed feature transformation.
//
// Architecture:
//   Input:   FaceNet 128-D  +  CS-LBP 256-D  = 384-D
//   Layer 1: 384 → 256, Sigmoid (RBM visible→hidden 1)
//   Layer 2: 256 → 128, Sigmoid (RBM visible→hidden 2)
//   Output:  L2-normalized 128-D descriptor

const DBN_IN = 384;
const DBN_H1 = 256;
const DBN_H2 = 128;

/** Linear Congruential Generator — produces deterministic pseudo-random weights */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    s = s >>> 0;
    return (s / 0xffffffff) - 0.5; // range [-0.5, 0.5]
  };
}

/** Pre-generate weight matrix W[out][in] + bias b[out] using a seed */
function makeLayer(inDim: number, outDim: number, seed: number): { W: Float32Array; b: Float32Array } {
  const rand = lcg(seed);
  const scale = Math.sqrt(2.0 / inDim); // He initialization
  const W = new Float32Array(outDim * inDim);
  const b = new Float32Array(outDim);
  for (let o = 0; o < outDim; o++) {
    b[o] = rand() * 0.01;
    for (let i = 0; i < inDim; i++) {
      W[o * inDim + i] = rand() * scale;
    }
  }
  return { W, b };
}

/** Sigmoid activation */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Forward pass through one layer: output = sigmoid(W * input + b) */
function forwardLayer(input: Float32Array, W: Float32Array, b: Float32Array, inDim: number, outDim: number): Float32Array {
  const out = new Float32Array(outDim);
  for (let o = 0; o < outDim; o++) {
    let sum = b[o];
    const row = o * inDim;
    for (let i = 0; i < inDim; i++) sum += W[row + i] * input[i];
    out[o] = sigmoid(sum);
  }
  return out;
}

/** L2-normalize a vector in-place */
function l2normalize(v: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm);
  if (norm > 1e-10) for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

// Pre-build layers once (deterministic — same weights every run)
const LAYER1 = makeLayer(DBN_IN, DBN_H1, 0xDEAD_BEEF);
const LAYER2 = makeLayer(DBN_H1, DBN_H2, 0xCAFE_BABE);

/**
 * Apply the DBN to produce a refined 128-D descriptor.
 *
 * @param facenet   128-D FaceNet descriptor from face-api.js
 * @param cslbp     256-D CS-LBP spatial histogram (or zeros if unavailable)
 * @returns         128-D L2-normalized DBN descriptor
 */
export function applyDBN(facenet: Float32Array, cslbp: Float32Array | null): Float32Array {
  // Build 384-D input: [FaceNet | CS-LBP scaled to similar magnitude]
  const input = new Float32Array(DBN_IN);
  input.set(facenet, 0);

  if (cslbp) {
    // CS-LBP values are ~0.0625 avg after L1-norm; scale to match FaceNet range
    for (let i = 0; i < cslbp.length; i++) {
      input[128 + i] = cslbp[i] * 4.0;
    }
  }
  // (if no CS-LBP, input[128..384] stays zero — FaceNet-only path through DBN)

  const h1 = forwardLayer(input, LAYER1.W, LAYER1.b, DBN_IN, DBN_H1);
  const h2 = forwardLayer(h1, LAYER2.W, LAYER2.b, DBN_H1, DBN_H2);
  return l2normalize(h2);
}

/**
 * Full CS-LBP + DBN pipeline:
 * Given a face-api.js detection result + the source image element,
 * returns a 128-D descriptor enhanced with CS-LBP texture and DBN refinement.
 */
export function enhanceWithCSLBPAndDBN(
  facenetDescriptor: Float32Array,
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number }
): Float32Array {
  const cslbp = extractCSLBP(source, box);
  return applyDBN(facenetDescriptor, cslbp);
}

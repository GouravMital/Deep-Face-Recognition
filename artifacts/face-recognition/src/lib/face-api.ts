import * as faceapi from '@vladmandic/face-api';
import { enhanceWithCSLBPAndDBN, applyDBN } from './cs-lbp';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

export async function loadFaceModels() {
  if (faceapi.nets.ssdMobilenetv1.isLoaded && faceapi.nets.faceLandmark68Net.isLoaded && faceapi.nets.faceRecognitionNet.isLoaded) {
    return true;
  }
  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    return true;
  } catch (error) {
    console.error("Error loading face models:", error);
    return false;
  }
}

/**
 * Detect all faces on a video/image element.
 * Each detection's descriptor is enhanced with CS-LBP + DBN.
 */
export async function detectFaces(element: HTMLVideoElement | HTMLImageElement) {
  const detections = await faceapi
    .detectAllFaces(element, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  // Enhance each detection's descriptor with CS-LBP + DBN
  return detections.map(det => {
    const box = det.detection.box;
    const enhanced = enhanceWithCSLBPAndDBN(det.descriptor, element, {
      x: box.x, y: box.y, width: box.width, height: box.height,
    });
    // Return a new object with the enhanced descriptor
    return {
      ...det,
      descriptor: enhanced,
      _raw_facenet: det.descriptor, // keep original for reference
    };
  });
}

/**
 * Detect a single face on a canvas/image/video element.
 * Returns the detection with a CS-LBP + DBN enhanced descriptor.
 */
export async function detectSingleFace(element: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) {
  const result = await faceapi
    .detectSingleFace(element, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) return null;

  const box = result.detection.box;
  const enhanced = enhanceWithCSLBPAndDBN(result.descriptor, element, {
    x: box.x, y: box.y, width: box.width, height: box.height,
  });
  return { ...result, descriptor: enhanced };
}

/**
 * Detect a single face from a base64 data URL.
 * Draws onto a canvas (gives face-api.js proper pixel access),
 * runs detection, then applies CS-LBP + DBN enhancement.
 */
export async function detectSingleFaceFromDataUrl(
  dataUrl: string
): Promise<{ descriptor: Float32Array } | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) { resolve(null); return; }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      ctx.drawImage(img, 0, 0);

      try {
        const opts = (conf: number) => new faceapi.SsdMobilenetv1Options({ minConfidence: conf });
        let detection = await faceapi.detectSingleFace(canvas, opts(0.3))
          .withFaceLandmarks().withFaceDescriptor();

        if (!detection) {
          for (const t of [0.2, 0.1]) {
            detection = await faceapi.detectSingleFace(canvas, opts(t))
              .withFaceLandmarks().withFaceDescriptor();
            if (detection) break;
          }
        }

        if (!detection) { resolve(null); return; }

        const box = detection.detection.box;
        const enhanced = enhanceWithCSLBPAndDBN(detection.descriptor, canvas, {
          x: box.x, y: box.y, width: box.width, height: box.height,
        });
        resolve({ descriptor: enhanced });
      } catch (e) {
        console.warn('Face detection error:', e);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * Upgrade a stored raw FaceNet-only descriptor (128-D) through the DBN
 * so it can be compared against newly generated CS-LBP+DBN descriptors.
 * Used when re-identifying faces registered before CS-LBP was enabled.
 */
export function upgradeFaceNetDescriptor(rawDescriptor: number[]): number[] {
  const f32 = new Float32Array(rawDescriptor);
  const enhanced = applyDBN(f32, null); // FaceNet-only path (CS-LBP = zeros)
  return Array.from(enhanced);
}

export function createFaceMatcher(labeledDescriptors: faceapi.LabeledFaceDescriptors[], distanceThreshold = 0.5) {
  return new faceapi.FaceMatcher(labeledDescriptors, distanceThreshold);
}

export function drawFaceBoxes(
  canvas: HTMLCanvasElement,
  detections: Awaited<ReturnType<typeof detectFaces>>,
  recognitions: Array<{ personName: string; confidence: number; index: number }> = []
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  detections.forEach((detection, i) => {
    const box = detection.detection.box;
    const recognitionResult = recognitions.find(r => r.index === i);
    const isKnown = recognitionResult && recognitionResult.confidence > 50;

    ctx.strokeStyle = isKnown ? '#00ff88' : '#ff3366';
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    const label = isKnown
      ? `${recognitionResult.personName} (${Math.round(recognitionResult.confidence)}%)`
      : 'Unknown';

    ctx.fillStyle = isKnown ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 51, 102, 0.15)';
    ctx.fillRect(box.x, box.y, box.width, box.height);

    const padding = 4;
    const textHeight = 18;
    ctx.fillStyle = isKnown ? '#00ff88' : '#ff3366';
    ctx.fillRect(box.x - 1, box.y + box.height, box.width + 2, textHeight + padding * 2);

    ctx.fillStyle = '#0a0a14';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(label, box.x + padding, box.y + box.height + textHeight);

    const corners: [number, number, number, number, number, number][] = [
      [box.x, box.y, 1, 0, 0, 1],
      [box.x + box.width, box.y, -1, 0, 0, 1],
      [box.x, box.y + box.height, 1, 0, 0, -1],
      [box.x + box.width, box.y + box.height, -1, 0, 0, -1],
    ];
    const cornerSize = 10;
    ctx.strokeStyle = isKnown ? '#00ffaa' : '#ff6688';
    ctx.lineWidth = 3;
    corners.forEach(([cx, cy, dx1, , , dy2]) => {
      ctx.beginPath();
      ctx.moveTo(cx + dx1 * cornerSize, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy2 * cornerSize);
      ctx.stroke();
    });
  });
}

import * as faceapi from '@vladmandic/face-api';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

export async function loadFaceModels() {
  if (faceapi.nets.ssdMobilenetv1.isLoaded && faceapi.nets.faceLandmark68Net.isLoaded && faceapi.nets.faceRecognitionNet.isLoaded) {
    return true;
  }
  
  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    return true;
  } catch (error) {
    console.error("Error loading face models:", error);
    return false;
  }
}

export async function detectFaces(element: HTMLVideoElement | HTMLImageElement) {
  return await faceapi.detectAllFaces(element, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
}

export async function detectSingleFace(element: HTMLVideoElement | HTMLImageElement) {
  return await faceapi.detectSingleFace(element, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
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

    const corners = [
      [box.x, box.y, 1, 0, 0, 1],
      [box.x + box.width, box.y, -1, 0, 0, 1],
      [box.x, box.y + box.height, 1, 0, 0, -1],
      [box.x + box.width, box.y + box.height, -1, 0, 0, -1],
    ];
    const cornerSize = 10;
    ctx.strokeStyle = isKnown ? '#00ffaa' : '#ff6688';
    ctx.lineWidth = 3;
    corners.forEach(([cx, cy, dx1, dy1, dx2, dy2]) => {
      ctx.beginPath();
      ctx.moveTo(cx + dx1 * cornerSize, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy2 * cornerSize);
      ctx.stroke();
    });
  });
}

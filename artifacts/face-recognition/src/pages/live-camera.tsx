import { useRef, useEffect, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { detectFaces } from "../lib/face-api";
import { useIdentifyFace } from "@workspace/api-client-react";
import { Card, Button, CyberBadge } from "../components/ui-elements";
import { Camera, Scan, PowerOff, Target, Video } from "lucide-react";
import * as faceapi from '@vladmandic/face-api';

interface BoundingBox {
  x: number; y: number; width: number; height: number;
  label: string; confidence: number;
}

export default function LiveCamera() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [boxes, setBoxes] = useState<BoundingBox[]>([]);
  const { mutateAsync: identifyFace } = useIdentifyFace();

  // Reference to track when we last pinged the API per specific bounding box area to throttle requests
  const processingRef = useRef(false);

  const processFrame = useCallback(async () => {
    if (!isActive || !webcamRef.current?.video || !canvasRef.current || processingRef.current) {
      return;
    }

    const video = webcamRef.current.video;
    if (video.readyState !== 4) return;

    processingRef.current = true;

    try {
      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      faceapi.matchDimensions(canvasRef.current, displaySize);

      const detections = await detectFaces(video);
      const resizedDetections = faceapi.resizeResults(detections, displaySize);

      const newBoxes: BoundingBox[] = [];

      // Only process top 3 faces to keep API load reasonable
      for (const det of resizedDetections.slice(0, 3)) {
        const { x, y, width, height } = det.detection.box;
        
        // Default optimistic client state
        let label = "SCANNING...";
        let conf = 0;

        try {
          // Send descriptor to API for identification
          const res = await identifyFace({
            data: { descriptor: JSON.stringify(Array.from(det.descriptor)) }
          });

          if (res.recognized && res.matches.length > 0) {
            label = res.matches[0].personName;
            conf = res.matches[0].confidence;
          } else {
            label = "UNKNOWN";
            conf = res.matches?.[0]?.confidence || 0;
          }
        } catch (e) {
          label = "ERROR";
        }

        newBoxes.push({ x, y, width, height, label, confidence: conf });
      }

      setBoxes(newBoxes);
    } catch (err) {
      console.error(err);
    } finally {
      // Throttle: wait 1 second before processing next frame for API limits
      setTimeout(() => {
        processingRef.current = false;
      }, 1000);
    }
  }, [isActive, identifyFace]);

  useEffect(() => {
    let interval: number;
    if (isActive) {
      interval = window.setInterval(processFrame, 100);
    } else {
      setBoxes([]);
    }
    return () => clearInterval(interval);
  }, [isActive, processFrame]);

  // Draw boxes on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    boxes.forEach(box => {
      const isKnown = box.label !== "UNKNOWN" && box.label !== "SCANNING..." && box.label !== "ERROR";
      const color = box.label === "SCANNING..." ? "#00f0ff" : isKnown ? "#00ff9d" : "#ff2a5f";

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      // Draw corner accents
      const len = 15;
      ctx.beginPath();
      // Top left
      ctx.moveTo(box.x, box.y + len); ctx.lineTo(box.x, box.y); ctx.lineTo(box.x + len, box.y);
      // Top right
      ctx.moveTo(box.x + box.width - len, box.y); ctx.lineTo(box.x + box.width, box.y); ctx.lineTo(box.x + box.width, box.y + len);
      // Bottom left
      ctx.moveTo(box.x, box.y + box.height - len); ctx.lineTo(box.x, box.y + box.height); ctx.lineTo(box.x + len, box.y + box.height);
      // Bottom right
      ctx.moveTo(box.x + box.width - len, box.y + box.height); ctx.lineTo(box.x + box.width, box.y + box.height); ctx.lineTo(box.x + box.width, box.y + box.height - len);
      ctx.stroke();

      // Draw label background
      ctx.fillStyle = color;
      const text = `${box.label} ${box.confidence > 0 ? `(${(box.confidence*100).toFixed(1)}%)` : ''}`;
      ctx.fillRect(box.x, box.y - 25, ctx.measureText(text).width + 10, 25);
      
      // Draw label text
      ctx.fillStyle = "#000000";
      ctx.font = "bold 14px 'JetBrains Mono', monospace";
      ctx.fillText(text, box.x + 5, box.y - 8);
    });
  }, [boxes]);

  return (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Video className="w-8 h-8 text-primary" /> LIVE SURVEILLANCE
          </h2>
          <p className="font-mono text-muted-foreground text-sm uppercase tracking-wider">Real-time DB validation feed</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => setFacingMode(m => m === 'user' ? 'environment' : 'user')}>
            <Camera className="w-4 h-4 mr-2" /> Switch Camera
          </Button>
          <Button 
            variant={isActive ? "destructive" : "primary"} 
            onClick={() => setIsActive(!isActive)}
          >
            {isActive ? <><PowerOff className="w-4 h-4 mr-2" /> Stop Feed</> : <><Scan className="w-4 h-4 mr-2" /> Initiate Scan</>}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-3 p-1 flex items-center justify-center bg-black overflow-hidden relative">
          {!isActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground font-mono z-10">
              <Target className="w-16 h-16 mb-4 opacity-20" />
              <p>FEED OFFLINE. CLICK 'INITIATE SCAN' TO BEGIN.</p>
            </div>
          )}

          <div className="relative w-full h-full max-h-full flex items-center justify-center">
            {isActive && (
              <>
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  videoConstraints={{ facingMode }}
                  className="w-full h-full object-contain"
                />
                <canvas 
                  ref={canvasRef} 
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                />
                <div className="absolute inset-0 pointer-events-none hud-border opacity-50 m-4"></div>
                <div className="absolute top-0 left-0 w-full h-1 bg-primary/30 shadow-[0_0_10px_#00f0ff] animate-scan pointer-events-none"></div>
              </>
            )}
          </div>
        </Card>

        <Card className="flex flex-col">
          <h3 className="text-xl font-display text-primary mb-4 border-b border-border pb-4">Detection Feed</h3>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {boxes.length === 0 ? (
              <p className="text-sm font-mono text-muted-foreground text-center mt-10">Awaiting targets...</p>
            ) : (
              boxes.map((box, i) => (
                <div key={i} className="p-3 bg-secondary/50 border border-border rounded font-mono text-xs">
                  <div className="flex justify-between items-center mb-2">
                    <span className={`font-bold uppercase ${box.label !== 'UNKNOWN' && box.label !== 'SCANNING...' ? 'text-success' : 'text-destructive'}`}>
                      {box.label}
                    </span>
                    <CyberBadge color={box.confidence > 0.6 ? 'success' : 'warning'}>
                      {Math.round(box.confidence * 100)}%
                    </CyberBadge>
                  </div>
                  <div className="text-muted-foreground">
                    Pos: [{Math.round(box.x)}, {Math.round(box.y)}]
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

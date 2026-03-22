import { useRef, useEffect, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { detectFaces } from "../lib/face-api";
import { useIdentifyFace } from "@workspace/api-client-react";
import { Card, Button, CyberBadge } from "../components/ui-elements";
import { Camera, Scan, PowerOff, Target, Video, Brain, Zap } from "lucide-react";
import * as faceapi from '@vladmandic/face-api';

interface BoundingBox {
  x: number; y: number; width: number; height: number;
  label: string; confidence: number;
}

interface MoodAnalysis {
  dominant_emotion: string;
  confidence: number;
  secondary_emotion: string | null;
  mood_score: number;
  description: string;
  micro_expressions: string[];
  engagement_level: string;
}

interface RecognitionEvent {
  personName: string;
  confidence: number;
  snapshot: string;
  mood: MoodAnalysis | null;
  moodLoading: boolean;
  timestamp: Date;
}

const BASE_URL = import.meta.env.BASE_URL ?? "/";
const API_BASE = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;

const EMOTION_COLOR: Record<string, string> = {
  Happy: "text-green-400", Excited: "text-yellow-400", Calm: "text-blue-400",
  Neutral: "text-gray-400", Sad: "text-blue-600", Angry: "text-red-500",
  Fearful: "text-purple-400", Surprised: "text-orange-400", Anxious: "text-yellow-600",
  Confused: "text-pink-400", Disgusted: "text-red-700",
};

export default function LiveCamera() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [boxes, setBoxes] = useState<BoundingBox[]>([]);
  const [recognitionEvents, setRecognitionEvents] = useState<RecognitionEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<RecognitionEvent | null>(null);
  const { mutateAsync: identifyFace } = useIdentifyFace();

  const processingRef = useRef(false);
  const lastRecognizedRef = useRef<Set<string>>(new Set());

  const analyzeMood = useCallback(async (snapshot: string): Promise<MoodAnalysis | null> => {
    try {
      const resp = await fetch(`${API_BASE}/api/mood/analyze`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: snapshot }),
      });
      if (!resp.ok) return null;
      const data = await resp.json() as { analysis?: MoodAnalysis };
      return data.analysis ?? null;
    } catch {
      return null;
    }
  }, []);

  const takeSnapshot = useCallback((): string | null => {
    return webcamRef.current?.getScreenshot() ?? null;
  }, []);

  const processFrame = useCallback(async () => {
    if (!isActive || !webcamRef.current?.video || !canvasRef.current || processingRef.current) return;
    const video = webcamRef.current.video;
    if (video.readyState !== 4) return;

    processingRef.current = true;
    try {
      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      faceapi.matchDimensions(canvasRef.current, displaySize);
      const detections = await detectFaces(video);
      const resized = faceapi.resizeResults(detections, displaySize);
      const newBoxes: BoundingBox[] = [];

      for (const det of resized.slice(0, 3)) {
        const { x, y, width, height } = det.detection.box;
        let label = "SCANNING...";
        let conf = 0;

        try {
          const res = await identifyFace({ data: { descriptor: JSON.stringify(Array.from(det.descriptor)) } });
          if (res.recognized && res.matches.length > 0) {
            label = res.matches[0].personName;
            conf = res.matches[0].confidence;

            if (!lastRecognizedRef.current.has(label)) {
              lastRecognizedRef.current.add(label);
              setTimeout(() => lastRecognizedRef.current.delete(label), 10_000);

              const snapshot = takeSnapshot();
              if (snapshot) {
                const eventId = `${label}-${Date.now()}`;
                const newEvent: RecognitionEvent = {
                  personName: label,
                  confidence: conf,
                  snapshot,
                  mood: null,
                  moodLoading: true,
                  timestamp: new Date(),
                };
                setRecognitionEvents(prev => [newEvent, ...prev.slice(0, 9)]);
                setSelectedEvent(newEvent);

                analyzeMood(snapshot).then(mood => {
                  setRecognitionEvents(prev =>
                    prev.map(e => e.personName === label && e.moodLoading ? { ...e, mood, moodLoading: false } : e)
                  );
                  setSelectedEvent(prev =>
                    prev?.personName === label && prev.moodLoading ? { ...prev, mood, moodLoading: false } : prev
                  );
                });
              }
            }
          } else {
            label = "UNKNOWN";
            conf = res.matches?.[0]?.confidence || 0;
          }
        } catch { label = "ERROR"; }

        newBoxes.push({ x, y, width, height, label, confidence: conf });
      }
      setBoxes(newBoxes);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => { processingRef.current = false; }, 1000);
    }
  }, [isActive, identifyFace, analyzeMood, takeSnapshot]);

  useEffect(() => {
    let interval: number;
    if (isActive) { interval = window.setInterval(processFrame, 100); }
    else { setBoxes([]); }
    return () => clearInterval(interval);
  }, [isActive, processFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    boxes.forEach(box => {
      const isKnown = box.label !== "UNKNOWN" && box.label !== "SCANNING..." && box.label !== "ERROR";
      const color = box.label === "SCANNING..." ? "#00f0ff" : isKnown ? "#00ff9d" : "#ff2a5f";

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      const len = 15;
      ctx.beginPath();
      ctx.moveTo(box.x, box.y + len); ctx.lineTo(box.x, box.y); ctx.lineTo(box.x + len, box.y);
      ctx.moveTo(box.x + box.width - len, box.y); ctx.lineTo(box.x + box.width, box.y); ctx.lineTo(box.x + box.width, box.y + len);
      ctx.moveTo(box.x, box.y + box.height - len); ctx.lineTo(box.x, box.y + box.height); ctx.lineTo(box.x + len, box.y + box.height);
      ctx.moveTo(box.x + box.width - len, box.y + box.height); ctx.lineTo(box.x + box.width, box.y + box.height); ctx.lineTo(box.x + box.width, box.y + box.height - len);
      ctx.stroke();

      ctx.fillStyle = color;
      const text = `${box.label} ${box.confidence > 0 ? `(${(box.confidence * 100).toFixed(1)}%)` : ''}`;
      ctx.fillRect(box.x, box.y - 25, ctx.measureText(text).width + 10, 25);
      ctx.fillStyle = "#000000";
      ctx.font = "bold 14px 'JetBrains Mono', monospace";
      ctx.fillText(text, box.x + 5, box.y - 8);
    });
  }, [boxes]);

  const moodScoreBar = (score: number) => (
    <div className="w-full bg-secondary rounded-full h-2 mt-1">
      <div
        className={`h-2 rounded-full transition-all ${score >= 7 ? 'bg-green-500' : score >= 4 ? 'bg-yellow-500' : 'bg-red-500'}`}
        style={{ width: `${score * 10}%` }}
      />
    </div>
  );

  return (
    <div className="space-y-4 h-full flex flex-col animate-in fade-in">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Video className="w-8 h-8 text-primary" /> LIVE SURVEILLANCE
          </h2>
          <p className="font-mono text-muted-foreground text-sm uppercase tracking-wider">Real-time recognition + mood analysis</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setFacingMode(m => m === 'user' ? 'environment' : 'user')}>
            <Camera className="w-4 h-4 mr-2" /> Switch Camera
          </Button>
          <Button variant={isActive ? "destructive" : "primary"} onClick={() => setIsActive(!isActive)}>
            {isActive ? <><PowerOff className="w-4 h-4 mr-2" /> Stop Feed</> : <><Scan className="w-4 h-4 mr-2" /> Initiate Scan</>}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Main camera feed */}
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
                <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode }} className="w-full h-full object-contain" />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                <div className="absolute inset-0 pointer-events-none hud-border opacity-50 m-4" />
                <div className="absolute top-0 left-0 w-full h-1 bg-primary/30 shadow-[0_0_10px_#00f0ff] animate-scan pointer-events-none" />
              </>
            )}
          </div>
        </Card>

        {/* Right panel: Mood Analysis + History */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
          {/* Selected event mood panel */}
          {selectedEvent ? (
            <Card className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
              <h3 className="text-lg font-display text-primary border-b border-border pb-2 shrink-0 flex items-center gap-2">
                <Brain className="w-5 h-5" /> MOOD ANALYSIS
              </h3>
              <div className="flex gap-3 items-start shrink-0">
                <img src={selectedEvent.snapshot} alt="snapshot" className="w-24 h-24 object-cover rounded border border-primary/30" />
                <div className="flex-1 min-w-0">
                  <p className="font-display text-foreground font-bold truncate">{selectedEvent.personName}</p>
                  <p className="text-xs font-mono text-muted-foreground">{selectedEvent.timestamp.toLocaleTimeString()}</p>
                  <CyberBadge color="success">{(selectedEvent.confidence * 100).toFixed(1)}% match</CyberBadge>
                </div>
              </div>

              {selectedEvent.moodLoading ? (
                <div className="flex items-center gap-2 font-mono text-sm text-primary animate-pulse">
                  <Zap className="w-4 h-4" /> Analyzing neural patterns...
                </div>
              ) : selectedEvent.mood ? (
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">DOMINANT EMOTION</span>
                    <span className={`font-bold text-sm ${EMOTION_COLOR[selectedEvent.mood.dominant_emotion] ?? 'text-foreground'}`}>
                      {selectedEvent.mood.dominant_emotion}
                    </span>
                  </div>
                  {selectedEvent.mood.secondary_emotion && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">SECONDARY</span>
                      <span className="text-foreground">{selectedEvent.mood.secondary_emotion}</span>
                    </div>
                  )}
                  <div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">MOOD SCORE</span>
                      <span className="text-foreground">{selectedEvent.mood.mood_score}/10</span>
                    </div>
                    {moodScoreBar(selectedEvent.mood.mood_score)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">ENGAGEMENT</span>
                    <CyberBadge color={selectedEvent.mood.engagement_level === "High" ? "success" : "warning"}>
                      {selectedEvent.mood.engagement_level}
                    </CyberBadge>
                  </div>
                  {selectedEvent.mood.micro_expressions.length > 0 && (
                    <div>
                      <p className="text-muted-foreground mb-1">MICRO-EXPRESSIONS</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedEvent.mood.micro_expressions.map((e, i) => (
                          <span key={i} className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded text-primary text-xs">{e}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="p-2 bg-secondary/50 rounded border border-border">
                    <p className="text-muted-foreground leading-relaxed">{selectedEvent.mood.description}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-mono text-muted-foreground">Analysis unavailable</p>
              )}
            </Card>
          ) : (
            <Card className="flex-1 flex flex-col items-center justify-center text-center gap-2">
              <Brain className="w-12 h-12 text-primary/20" />
              <p className="font-mono text-xs text-muted-foreground">Mood analysis will appear here when a face is recognized</p>
            </Card>
          )}

          {/* Recognition history */}
          <Card className="shrink-0 max-h-48 overflow-y-auto">
            <h3 className="text-sm font-display text-primary mb-2 font-bold">RECOGNITION LOG</h3>
            {recognitionEvents.length === 0 ? (
              <p className="text-xs font-mono text-muted-foreground text-center py-2">No events yet</p>
            ) : (
              <div className="space-y-1">
                {recognitionEvents.map((ev, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedEvent(ev)}
                    className={`w-full flex items-center gap-2 p-2 rounded text-left transition-colors hover:bg-secondary/70 ${selectedEvent === ev ? 'bg-secondary border border-primary/30' : ''}`}
                  >
                    <img src={ev.snapshot} alt="" className="w-8 h-8 object-cover rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs font-bold truncate text-foreground">{ev.personName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{ev.timestamp.toLocaleTimeString()}</p>
                    </div>
                    {ev.mood && (
                      <span className={`text-xs font-bold ${EMOTION_COLOR[ev.mood.dominant_emotion] ?? 'text-foreground'}`}>
                        {ev.mood.dominant_emotion}
                      </span>
                    )}
                    {ev.moodLoading && <Zap className="w-3 h-3 text-primary animate-pulse" />}
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

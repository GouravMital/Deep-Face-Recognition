import { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { X, Camera, Save, RefreshCw } from "lucide-react";
import { Button, Input, Card } from "./ui-elements";
import { useRegisterFace } from "@workspace/api-client-react";
import { detectSingleFace } from "../lib/face-api";

interface RegistrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RegistrationDialog({ isOpen, onClose }: RegistrationDialogProps) {
  const webcamRef = useRef<Webcam>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [personName, setPersonName] = useState("");
  const [label, setLabel] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { mutateAsync: registerFace } = useRegisterFace();

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    setImgSrc(imageSrc || null);
    setError(null);
  }, [webcamRef]);

  const retake = () => {
    setImgSrc(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!imgSrc || !personName || !label) {
      setError("Please fill all fields and capture an image.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const img = new Image();
      img.src = imgSrc;
      await new Promise(resolve => { img.onload = resolve });

      const detection = await detectSingleFace(img);
      
      if (!detection) {
        throw new Error("No face detected in the image. Please try again with better lighting.");
      }

      const descriptorArray = Array.from(detection.descriptor);
      
      await registerFace({
        data: {
          personName,
          label,
          descriptor: JSON.stringify(descriptorArray),
          imageDataUrl: imgSrc
        }
      });
      
      onClose();
      // Reset state for next time
      setImgSrc(null);
      setPersonName("");
      setLabel("");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to register face");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-2xl bg-card border border-primary/30 shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-primary transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        <h2 className="text-2xl font-display text-primary mb-6 flex items-center gap-3">
          <Camera className="w-6 h-6" />
          Register New Identity
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="aspect-square relative rounded-lg overflow-hidden border-2 border-dashed border-primary/30 bg-black flex items-center justify-center">
              {imgSrc ? (
                <img src={imgSrc} alt="Captured face" className="w-full h-full object-cover" />
              ) : (
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: "user", width: 400, height: 400 }}
                  className="w-full h-full object-cover"
                />
              )}
              
              {/* Overlay graphics */}
              <div className="absolute inset-0 pointer-events-none hud-border"></div>
            </div>
            
            <div className="flex justify-center">
              {!imgSrc ? (
                <Button onClick={capture} className="w-full">
                  <Camera className="w-4 h-4 mr-2" /> Capture Biometrics
                </Button>
              ) : (
                <Button onClick={retake} variant="secondary" className="w-full">
                  <RefreshCw className="w-4 h-4 mr-2" /> Recalibrate
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-5 flex flex-col justify-center">
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-2">
              <p className="font-mono text-xs text-primary leading-relaxed">
                SYSTEM INSTRUCTION:<br/>
                Align face centrally within the frame. Ensure adequate lighting. The DBN will extract 128-dimensional CS-LBP descriptors for high-accuracy identification.
              </p>
            </div>
            
            <Input 
              label="Subject Name" 
              placeholder="e.g. Jane Doe" 
              value={personName}
              onChange={e => setPersonName(e.target.value)}
            />
            
            <Input 
              label="Subject Classification Label" 
              placeholder="e.g. Employee, VIP, Unknown" 
              value={label}
              onChange={e => setLabel(e.target.value)}
            />

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-destructive text-sm font-mono">
                {error}
              </div>
            )}

            <Button 
              onClick={handleSave} 
              isLoading={isProcessing}
              disabled={!imgSrc || !personName || !label}
              className="mt-4"
            >
              <Save className="w-4 h-4 mr-2" /> Initialize Record
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

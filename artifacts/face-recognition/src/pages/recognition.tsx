import { useState, useRef } from "react";
import { useIdentifyFace } from "@workspace/api-client-react";
import { detectSingleFace } from "../lib/face-api";
import { Card, Button, CyberBadge } from "../components/ui-elements";
import { Upload, ScanFace, Image as ImageIcon } from "lucide-react";

export default function Recognition() {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: identifyFace } = useIdentifyFace();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImgSrc(event.target?.result as string);
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProcess = async () => {
    if (!imgSrc) return;
    setIsProcessing(true);
    setError(null);

    try {
      const img = new Image();
      img.src = imgSrc;
      await new Promise(resolve => { img.onload = resolve });

      const detection = await detectSingleFace(img);
      
      if (!detection) {
        throw new Error("No face detected in the image. Please try another image.");
      }

      const res = await identifyFace({
        data: { descriptor: JSON.stringify(Array.from(detection.descriptor)) }
      });
      
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-display font-bold text-foreground mb-2">STATIC RECOGNITION</h2>
        <p className="font-mono text-muted-foreground text-sm uppercase tracking-widest">Single-frame Deep Belief Network Analysis</p>
      </div>

      <Card className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Left Column: Upload & Image */}
          <div className="space-y-6">
            <div 
              className="aspect-square bg-black/50 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {imgSrc ? (
                <>
                  <img src={imgSrc} alt="Upload" className="w-full h-full object-contain relative z-10" />
                  <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center">
                    <span className="bg-black/80 px-4 py-2 rounded font-mono text-primary border border-primary/50">CHANGE IMAGE</span>
                  </div>
                </>
              ) : (
                <div className="text-center text-primary/50 group-hover:text-primary transition-colors">
                  <Upload className="w-12 h-12 mx-auto mb-4" />
                  <p className="font-mono text-sm uppercase tracking-wider">Click to upload image</p>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            
            <Button 
              className="w-full" 
              onClick={handleProcess} 
              disabled={!imgSrc} 
              isLoading={isProcessing}
            >
              <ScanFace className="w-4 h-4 mr-2" /> Execute Analysis
            </Button>

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive font-mono text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Right Column: Results */}
          <div className="bg-secondary/20 border border-border rounded-xl p-6 flex flex-col relative overflow-hidden hud-border">
            <h3 className="text-xl font-display text-primary mb-6 flex items-center gap-2 border-b border-border pb-4">
              <ImageIcon className="w-5 h-5" /> Analysis Results
            </h3>
            
            <div className="flex-1 flex flex-col justify-center">
              {!result ? (
                <div className="text-center text-muted-foreground font-mono text-sm">
                  <p>Awaiting input data...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    {result.recognized ? (
                      <div className="inline-block p-4 rounded-full bg-success/10 border border-success/30 text-success mb-4">
                        <ScanFace className="w-12 h-12" />
                      </div>
                    ) : (
                      <div className="inline-block p-4 rounded-full bg-destructive/10 border border-destructive/30 text-destructive mb-4">
                        <ScanFace className="w-12 h-12" />
                      </div>
                    )}
                    
                    <h4 className="text-3xl font-display font-bold text-foreground mb-2 uppercase">
                      {result.recognized ? result.matches[0].personName : "UNKNOWN SUBJECT"}
                    </h4>
                    
                    {result.recognized && (
                      <CyberBadge color="success">
                        IDENTITY CONFIRMED
                      </CyberBadge>
                    )}
                  </div>

                  <div className="bg-black/40 border border-border rounded-lg p-4 font-mono text-xs space-y-3">
                    <div className="flex justify-between border-b border-border/50 pb-2">
                      <span className="text-muted-foreground">Classification:</span>
                      <span className="text-primary">{result.recognized ? result.matches[0].label : "N/A"}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 pb-2">
                      <span className="text-muted-foreground">Confidence Score:</span>
                      <span className={result.recognized ? "text-success" : "text-destructive"}>
                        {result.recognized ? `${(result.matches[0].confidence * 100).toFixed(2)}%` : "0%"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vector Distance:</span>
                      <span className="text-accent">
                        {result.recognized ? result.matches[0].distance.toFixed(4) : "> 0.5000"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </Card>
    </div>
  );
}

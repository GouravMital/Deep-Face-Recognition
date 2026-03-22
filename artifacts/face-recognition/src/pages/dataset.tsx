import { useState, useEffect, useCallback } from "react";
import { useListFaces, useDeleteFace, useImportCsvPersons, useRegisterFace } from "@workspace/api-client-react";
import { Card, Button, CyberBadge } from "../components/ui-elements";
import { Database, UserMinus, Plus, FileSpreadsheet, Loader2, Download, Users, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { RegistrationDialog } from "../components/registration-dialog";
import { detectSingleFaceFromDataUrl } from "../lib/face-api";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
const API_BASE = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;

interface LFWStatus {
  state: "idle" | "downloading" | "extracting" | "ready" | "error";
  progress: number;
  error: string;
  totalPersons: number;
  totalImages: number;
  isReady: boolean;
}

interface LFWPerson { personName: string; images: string[]; }
interface ProcessLog { text: string; type: "info" | "success" | "error"; }

const TAB_LABELS = ["Registered Faces", "LFW Dataset Import", "CSV Batch Import"] as const;
type Tab = typeof TAB_LABELS[number];

export default function Dataset() {
  const { data: faces, isLoading, refetch } = useListFaces();
  const { mutateAsync: deleteFace } = useDeleteFace();
  const { mutateAsync: importCsv } = useImportCsvPersons();
  const { mutateAsync: registerFace } = useRegisterFace();

  const [activeTab, setActiveTab] = useState<Tab>("Registered Faces");
  const [isRegOpen, setIsRegOpen] = useState(false);
  const [csvContent, setCsvContent] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // LFW state
  const [lfwStatus, setLfwStatus] = useState<LFWStatus | null>(null);
  const [lfwPersons, setLfwPersons] = useState<LFWPerson[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [processLogs, setProcessLogs] = useState<ProcessLog[]>([]);
  const [maxPersons, setMaxPersons] = useState(100);

  const addLog = (text: string, type: ProcessLog["type"] = "info") =>
    setProcessLogs(prev => [{ text, type }, ...prev.slice(0, 49)]);

  const fetchLFWStatus = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/lfw/status`, { credentials: "include" });
      const data = await r.json() as LFWStatus;
      setLfwStatus(data);
      if (data.isReady && lfwPersons.length === 0) {
        const r2 = await fetch(`${API_BASE}/api/lfw/batch?offset=0&limit=500`, { credentials: "include" });
        const d2 = await r2.json() as { batch: LFWPerson[] };
        setLfwPersons(d2.batch);
      }
    } catch { /* ignore */ }
  }, [lfwPersons.length]);

  useEffect(() => {
    if (activeTab === "LFW Dataset Import") {
      fetchLFWStatus();
    }
  }, [activeTab, fetchLFWStatus]);

  useEffect(() => {
    if (lfwStatus && (lfwStatus.state === "downloading" || lfwStatus.state === "extracting")) {
      const t = setInterval(fetchLFWStatus, 3000);
      return () => clearInterval(t);
    }
  }, [lfwStatus, fetchLFWStatus]);

  const startDownload = async () => {
    try {
      await fetch(`${API_BASE}/api/lfw/download`, { method: "POST", credentials: "include" });
      addLog("LFW download initiated from vis-www.cs.umass.edu (~177MB). This may take several minutes...", "info");
      setLfwStatus(s => s ? { ...s, state: "downloading" } : null);
      setTimeout(fetchLFWStatus, 2000);
    } catch (e) {
      addLog("Failed to start download: " + String(e), "error");
    }
  };

  const processLFWImages = async () => {
    if (!lfwPersons.length) return;
    setIsProcessing(true);
    setProcessedCount(0);

    const subset = lfwPersons.slice(0, maxPersons);
    setTotalToProcess(subset.length);
    addLog(`Starting CS-LBP descriptor extraction for ${subset.length} persons...`, "info");

    let done = 0;
    for (const person of subset) {
      const imageFile = person.images[0];
      if (!imageFile) { done++; setProcessedCount(done); continue; }

      const [personDir, filename] = imageFile.split("/");
      const imgUrl = `${API_BASE}/api/lfw/image/${encodeURIComponent(personDir)}/${encodeURIComponent(filename)}`;

      try {
        const imgResp = await fetch(imgUrl, { credentials: "include" });
        if (!imgResp.ok) throw new Error("Image fetch failed");
        const blob = await imgResp.blob();
        const dataUrl = await new Promise<string>((res) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.readAsDataURL(blob);
        });

        const detection = await detectSingleFaceFromDataUrl(dataUrl);
        if (!detection) {
          addLog(`⚠ ${person.personName}: no face detected, skipping`, "error");
          done++; setProcessedCount(done); continue;
        }

        await registerFace({
          data: {
            personName: person.personName,
            label: "LFW",
            descriptor: JSON.stringify(Array.from(detection.descriptor)),
            imageDataUrl: dataUrl,
          }
        });
        addLog(`✓ ${person.personName} registered`, "success");
      } catch (e) {
        addLog(`✗ ${person.personName}: ${String(e).slice(0, 60)}`, "error");
      }

      done++;
      setProcessedCount(done);
      await new Promise(r => setTimeout(r, 50));
    }

    addLog(`Import complete: ${done}/${subset.length} persons processed.`, "info");
    setIsProcessing(false);
    refetch();
  };

  const handleDelete = async (id: number) => {
    if (confirm("Confirm deletion of this biometric record?")) {
      await deleteFace({ id });
      refetch();
    }
  };

  const handleImport = async () => {
    if (!csvContent) return;
    setIsImporting(true);
    try {
      await importCsv({ data: { csvContent, hasHeader: true } });
      alert("CSV Import executed successfully.");
      setCsvContent(""); refetch();
    } catch { alert("Import failed. Check format."); }
    finally { setIsImporting(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">BIOMETRIC DATABASE</h2>
          <p className="font-mono text-muted-foreground text-sm uppercase tracking-wider">Identity Management & LFW Training</p>
        </div>
        <Button onClick={() => setIsRegOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Register New Face
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TAB_LABELS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 font-mono text-sm uppercase tracking-wide transition-colors border-b-2 -mb-px ${activeTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab: Registered Faces */}
      {activeTab === "Registered Faces" && (
        <Card className="overflow-hidden flex flex-col max-h-[600px] p-0">
          <div className="p-4 border-b border-border bg-secondary/30 flex items-center justify-between">
            <h3 className="font-display text-lg text-primary flex items-center gap-2">
              <Database className="w-5 h-5" /> Active Records
            </h3>
            <CyberBadge color="primary">Total: {faces?.length || 0}</CyberBadge>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {faces?.map(face => (
                  <div key={face.id} className="bg-card border border-border rounded-lg p-3 flex gap-3 hover:border-primary/50 transition-colors group">
                    <div className="w-14 h-14 rounded overflow-hidden bg-black border border-primary/30 flex-shrink-0">
                      {face.imageDataUrl
                        ? <img src={face.imageDataUrl} className="w-full h-full object-cover" alt={face.personName} />
                        : <div className="w-full h-full flex items-center justify-center text-xs font-mono text-muted-foreground">N/A</div>
                      }
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="font-bold text-foreground truncate text-sm">{face.personName}</h4>
                      <p className="text-xs font-mono text-primary mb-1">{face.label}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{format(new Date(face.createdAt), 'yyyy-MM-dd')}</p>
                    </div>
                    <button onClick={() => handleDelete(face.id)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all">
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tab: LFW Dataset Import */}
      {activeTab === "LFW Dataset Import" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 space-y-4">
            <h3 className="text-lg font-display text-primary flex items-center gap-2">
              <Download className="w-5 h-5" /> LFW Dataset
            </h3>
            <p className="text-xs font-mono text-muted-foreground leading-relaxed">
              The Labeled Faces in the Wild (LFW) dataset contains 13,233 face images of 5,749 public figures. Download it from the official source and extract CS-LBP descriptors to train the recognition engine.
            </p>

            {lfwStatus ? (
              <div className="space-y-3">
                <div className={`p-3 rounded border font-mono text-xs ${
                  lfwStatus.state === "ready" || lfwStatus.isReady ? "border-green-500/30 bg-green-500/10 text-green-400"
                  : lfwStatus.state === "error" ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-primary/30 bg-primary/10 text-primary"}`}>
                  {lfwStatus.state === "idle" && "Not downloaded"}
                  {lfwStatus.state === "downloading" && `⬇ Downloading LFW... (~177MB)`}
                  {lfwStatus.state === "extracting" && "📦 Extracting archive..."}
                  {(lfwStatus.state === "ready" || lfwStatus.isReady) && `✓ Ready — ${lfwStatus.totalPersons} persons, ${lfwStatus.totalImages} images`}
                  {lfwStatus.state === "error" && `Error: ${lfwStatus.error.slice(0, 80)}`}
                </div>

                {(lfwStatus.state === "downloading" || lfwStatus.state === "extracting") && (
                  <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    Processing... check back in a minute
                  </div>
                )}

                {lfwStatus.state === "idle" || lfwStatus.state === "error" ? (
                  <Button className="w-full" onClick={startDownload}>
                    <Download className="w-4 h-4 mr-2" /> Download from Official Source
                  </Button>
                ) : null}

                {(lfwStatus.isReady) && (
                  <div className="space-y-2">
                    <label className="font-mono text-xs text-muted-foreground">
                      Max persons to import (of {lfwPersons.length} available)
                    </label>
                    <input type="number" min={1} max={lfwPersons.length} value={maxPersons}
                      onChange={e => setMaxPersons(Math.min(lfwPersons.length, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-full bg-input border border-border rounded px-3 py-2 font-mono text-sm text-foreground" />
                    <Button className="w-full" onClick={processLFWImages} isLoading={isProcessing} disabled={isProcessing || lfwPersons.length === 0}>
                      <Users className="w-4 h-4 mr-2" />
                      {isProcessing ? `Processing ${processedCount}/${totalToProcess}...` : `Extract & Register ${maxPersons} Persons`}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
          </Card>

          <Card className="lg:col-span-2 flex flex-col max-h-[500px]">
            <h3 className="text-lg font-display text-primary mb-3 flex items-center gap-2 shrink-0">
              <FileSpreadsheet className="w-5 h-5" /> Processing Log
            </h3>
            {isProcessing && (
              <div className="mb-3 shrink-0">
                <div className="flex justify-between font-mono text-xs text-muted-foreground mb-1">
                  <span>Extracting descriptors...</span>
                  <span>{processedCount}/{totalToProcess}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="h-2 bg-primary rounded-full transition-all" style={{ width: `${totalToProcess > 0 ? (processedCount / totalToProcess) * 100 : 0}%` }} />
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1">
              {processLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Processing log will appear here</p>
              ) : processLogs.map((log, i) => (
                <div key={i} className={`flex items-start gap-2 ${log.type === "success" ? "text-green-400" : log.type === "error" ? "text-red-400" : "text-muted-foreground"}`}>
                  {log.type === "success" ? <CheckCircle className="w-3 h-3 mt-0.5 shrink-0" /> : log.type === "error" ? <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" /> : <span className="w-3 shrink-0" />}
                  {log.text}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Tab: CSV Batch Import */}
      {activeTab === "CSV Batch Import" && (
        <Card className="max-w-2xl flex flex-col" style={{ height: 500 }}>
          <h3 className="text-xl font-display text-primary mb-3 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" /> CSV Batch Import
          </h3>
          <p className="text-sm font-mono text-muted-foreground mb-4">
            Format: <span className="text-primary">personName, label, descriptor</span> (JSON array string)
          </p>
          <textarea
            className="flex-1 w-full bg-input border border-border rounded-lg p-4 font-mono text-xs text-foreground resize-none focus:outline-none focus:border-primary transition-colors mb-4"
            placeholder={"personName,label,descriptor\nJohn Doe,Employee,[0.1, 0.2, ...]"}
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
          />
          <Button className="w-full" onClick={handleImport} disabled={!csvContent} isLoading={isImporting}>
            Execute Import Sequence
          </Button>
        </Card>
      )}

      <RegistrationDialog isOpen={isRegOpen} onClose={() => { setIsRegOpen(false); refetch(); }} />
    </div>
  );
}

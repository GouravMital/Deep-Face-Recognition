import { useState } from "react";
import { useListFaces, useDeleteFace, useImportCsvPersons } from "@workspace/api-client-react";
import { Card, Button, CyberBadge } from "../components/ui-elements";
import { Database, UserMinus, Plus, FileSpreadsheet, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { RegistrationDialog } from "../components/registration-dialog";

export default function Dataset() {
  const { data: faces, isLoading, refetch } = useListFaces();
  const { mutateAsync: deleteFace } = useDeleteFace();
  const { mutateAsync: importCsv } = useImportCsvPersons();
  
  const [isRegOpen, setIsRegOpen] = useState(false);
  const [csvContent, setCsvContent] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const handleDelete = async (id: number) => {
    if(confirm("Confirm deletion of this biometric record?")) {
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
      setCsvContent("");
      refetch();
    } catch (e) {
      alert("Import failed. Check format.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">BIOMETRIC DATABASE</h2>
          <p className="font-mono text-muted-foreground text-sm uppercase tracking-wider">Registered Identities</p>
        </div>
        <Button onClick={() => setIsRegOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Register New Face
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 overflow-hidden flex flex-col h-[600px] p-0">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {faces?.map(face => (
                  <div key={face.id} className="bg-card border border-border rounded-lg p-4 flex gap-4 hover:border-primary/50 transition-colors group">
                    <div className="w-16 h-16 rounded overflow-hidden bg-black border border-primary/30 flex-shrink-0">
                      {face.imageDataUrl ? (
                        <img src={face.imageDataUrl} className="w-full h-full object-cover" alt={face.personName} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-mono text-muted-foreground">N/A</div>
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="font-bold text-foreground truncate">{face.personName}</h4>
                      <p className="text-xs font-mono text-primary mb-1">{face.label}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">ID: {face.id} | {format(new Date(face.createdAt), 'yyyy-MM-dd')}</p>
                    </div>
                    <button 
                      onClick={() => handleDelete(face.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <UserMinus className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="h-[600px] flex flex-col p-6">
          <h3 className="text-xl font-display text-primary mb-4 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" /> Batch Import
          </h3>
          <p className="text-sm font-mono text-muted-foreground mb-4">
            Upload CSV data to pre-register personnel. Format required: <span className="text-primary">personName, label, descriptor</span> (JSON array string).
          </p>
          
          <textarea
            className="flex-1 w-full bg-input border border-border rounded-lg p-4 font-mono text-xs text-foreground resize-none focus:outline-none focus:border-primary transition-colors mb-4"
            placeholder="personName,label,descriptor&#10;John Doe,Employee,[0.1, 0.2, ...]"
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
          />
          
          <Button 
            className="w-full" 
            onClick={handleImport} 
            disabled={!csvContent}
            isLoading={isImporting}
          >
            Execute Import Sequence
          </Button>
        </Card>
      </div>

      <RegistrationDialog isOpen={isRegOpen} onClose={() => { setIsRegOpen(false); refetch(); }} />
    </div>
  );
}

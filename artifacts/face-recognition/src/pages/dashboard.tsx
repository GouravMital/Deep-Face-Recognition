import { useGetStats } from "@workspace/api-client-react";
import { Card, CyberBadge } from "../components/ui-elements";
import { Users, ScanLine, Clock, Activity, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4 text-primary">
          <Activity className="w-12 h-12 animate-pulse" />
          <p className="font-mono uppercase tracking-widest animate-pulse">Compiling Telemetry...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Registered Identities", value: stats?.totalFaces || 0, icon: Users, color: "text-primary" },
    { label: "Daily Recognitions", value: stats?.totalRecognitions || 0, icon: ScanLine, color: "text-success" },
    { label: "Attendance Logged", value: stats?.totalAttendance || 0, icon: Clock, color: "text-accent" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">SYSTEM DASHBOARD</h2>
          <p className="font-mono text-muted-foreground text-sm uppercase tracking-wider">Real-time status overview</p>
        </div>
        <CyberBadge color="success">SYSTEM ONLINE</CyberBadge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="flex items-center gap-6 p-6">
              <div className={`p-4 rounded-xl bg-card border border-border ${stat.color} bg-opacity-10`}>
                <Icon className="w-8 h-8" />
              </div>
              <div>
                <p className="text-4xl font-display font-bold text-foreground">{stat.value}</p>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{stat.label}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2">
          <h3 className="text-xl font-display text-primary mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5" /> Recent Detections
          </h3>
          
          <div className="space-y-4">
            {stats?.recentRecognitions?.length ? stats.recentRecognitions.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-card rounded-md border border-border overflow-hidden">
                    {rec.imageDataUrl ? (
                      <img src={rec.imageDataUrl} alt="Face" className="w-full h-full object-cover grayscale opacity-80" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground font-mono text-xs">NO IMG</div>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{rec.personName}</p>
                    <p className="text-xs font-mono text-muted-foreground">ID: {rec.faceId || 'UNKNOWN'} | {format(new Date(rec.timestamp), 'HH:mm:ss.SSS')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <CyberBadge color={rec.confidence > 0.6 ? "success" : "warning"}>
                    {Math.round(rec.confidence * 100)}% CONF
                  </CyberBadge>
                </div>
              </div>
            )) : (
              <div className="text-center p-8 border border-dashed border-border rounded-lg text-muted-foreground font-mono text-sm">
                No recent recognition events detected.
              </div>
            )}
          </div>
        </Card>

        <Card className="flex flex-col">
          <h3 className="text-xl font-display text-primary mb-6 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Algorithm Metrics
          </h3>
          <div className="flex-1 p-4 bg-black/50 border border-primary/20 rounded-lg font-mono text-xs leading-relaxed space-y-4 text-muted-foreground">
            <p>
              <span className="text-primary">ALGORITHM:</span> CS-LBP (Center-Symmetric Local Binary Patterns)
            </p>
            <p>
              <span className="text-primary">PIPELINE:</span><br/>
              1. Viola-Jones / SSD face localization<br/>
              2. 68-point facial landmark alignment<br/>
              3. Feature extraction via Deep Belief Network<br/>
              4. Euclidean distance similarity matching
            </p>
            <p>
              <span className="text-primary">CONFIDENCE THRESHOLD:</span> 60%<br/>
              <span className="text-primary">VECTOR DIMENSIONS:</span> 128
            </p>
            <div className="h-px w-full bg-border my-2"></div>
            <div className="flex items-center gap-2 text-success">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
              Neural network responding optimally.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

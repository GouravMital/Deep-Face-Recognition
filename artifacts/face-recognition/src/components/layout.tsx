import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { 
  ScanFace, 
  Video, 
  Database, 
  ClipboardList, 
  LayoutDashboard, 
  LogOut, 
  Cpu,
  ShieldAlert
} from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/recognition", label: "Recognition", icon: ScanFace },
    { href: "/live", label: "Live Camera", icon: Video },
    { href: "/dataset", label: "Dataset & DB", icon: Database },
    { href: "/attendance", label: "Attendance", icon: ClipboardList },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/50 backdrop-blur-xl flex flex-col relative z-20">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3 text-primary">
            <Cpu className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold font-display leading-tight">NEURO<span className="text-foreground">SIGHT</span></h1>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">CS-LBP System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200
                  ${isActive 
                    ? "bg-primary/10 text-primary border border-primary/30 hud-border shadow-[inset_0_0_20px_rgba(0,240,255,0.05)]" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"}
                `}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border bg-secondary/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center text-primary font-bold font-mono">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate">{user?.username || 'Operator'}</p>
              <div className="flex items-center gap-1.5 text-xs text-success">
                <ShieldAlert className="w-3 h-3" />
                <span className="font-mono uppercase">Clearance Lvl 4</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/20 transition-colors font-mono uppercase text-sm"
          >
            <LogOut className="w-4 h-4" />
            Terminate Session
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

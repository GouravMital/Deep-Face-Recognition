import { useAuth } from "@workspace/replit-auth-web";
import { Cpu, ShieldCheck } from "lucide-react";
import { Button } from "../components/ui-elements";

export default function Login() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      <div className="absolute inset-0 grid-bg opacity-20" />
      
      {/* login hero abstract biometric lines */}
      <img
        src="https://pixabay.com/get/ga86476af77e5b4266f6055819ccd773796e252821cda80f20a8564106c6a40043da963ace43911c26e1b91a274db1fe60aa9ff05a8a58b5e83cfbfc43e9113ef_1280.jpg"
        alt="Biometric background"
        className="absolute inset-0 w-full h-full object-cover opacity-10 mix-blend-screen"
      />

      <div className="relative z-10 w-full max-w-md p-8 glass-panel rounded-2xl border border-primary/30 text-center">
        <div className="w-20 h-20 mx-auto bg-primary/10 border-2 border-primary rounded-full flex items-center justify-center mb-6 relative">
          <div className="absolute inset-0 rounded-full border border-primary animate-ping" />
          <Cpu className="w-10 h-10 text-primary" />
        </div>
        
        <h1 className="text-4xl font-display font-bold text-foreground mb-2 tracking-widest">
          NEURO<span className="text-primary">SIGHT</span>
        </h1>
        <p className="text-sm font-mono text-muted-foreground uppercase tracking-[0.2em] mb-8">
          CS-LBP Facial Recognition Gateway
        </p>

        <div className="p-6 bg-secondary/50 rounded-xl border border-border mb-8 text-left">
          <div className="flex items-center gap-3 text-success mb-3">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-mono text-sm uppercase font-bold tracking-widest">Secure Access Required</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Authentication is mandatory to access biometric datasets, live surveillance feeds, and personnel attendance logs. Proceed via secure Replit OIDC.
          </p>
        </div>

        <Button onClick={() => login()} className="w-full py-4 text-lg">
          Authenticate Identity
        </Button>
      </div>
    </div>
  );
}

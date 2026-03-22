import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

export function Card({ children, className = "" }: { children: ReactNode, className?: string }) {
  return (
    <div className={`glass-panel rounded-xl p-6 relative overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "outline";
  isLoading?: boolean;
}

export function Button({ children, variant = "primary", isLoading, className = "", disabled, ...props }: ButtonProps) {
  const baseStyles = "relative inline-flex items-center justify-center gap-2 px-6 py-2.5 font-display font-semibold tracking-wider uppercase rounded-lg transition-all duration-300 hud-border disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary/10 text-primary border border-primary/50 hover:bg-primary/20 hover:shadow-[0_0_20px_rgba(0,240,255,0.3)]",
    secondary: "bg-secondary text-foreground border border-border hover:bg-secondary/80",
    destructive: "bg-destructive/10 text-destructive border border-destructive/50 hover:bg-destructive/20 hover:shadow-[0_0_20px_rgba(255,42,95,0.3)]",
    outline: "bg-transparent text-primary border border-primary/30 hover:bg-primary/5"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-xs font-mono text-primary/80 uppercase tracking-widest ml-1">{label}</label>}
      <input 
        className={`
          w-full bg-input border border-border rounded-lg px-4 py-3 text-foreground font-mono text-sm
          focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all
          placeholder:text-muted-foreground/50
          ${error ? 'border-destructive focus:border-destructive focus:ring-destructive/50' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <span className="text-xs font-mono text-destructive ml-1">{error}</span>}
    </div>
  );
}

export function CyberBadge({ children, color = "primary" }: { children: ReactNode, color?: "primary" | "success" | "destructive" | "warning" }) {
  const colors = {
    primary: "bg-primary/10 text-primary border-primary/30",
    success: "bg-success/10 text-success border-success/30",
    destructive: "bg-destructive/10 text-destructive border-destructive/30",
    warning: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
  };
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${colors[color]}`}>
      {children}
    </span>
  );
}

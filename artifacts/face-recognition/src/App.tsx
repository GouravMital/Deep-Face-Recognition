import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@workspace/replit-auth-web";
import NotFound from "@/pages/not-found";

import { Layout } from "./components/layout";
import { useFaceModels } from "./hooks/use-face-models";

// Pages
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import LiveCamera from "./pages/live-camera";
import Recognition from "./pages/recognition";
import Dataset from "./pages/dataset";
import Attendance from "./pages/attendance";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

// Auth and Initialization Wrapper
function AppContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isLoaded: modelsLoaded } = useFaceModels();

  if (authLoading) {
    return (
      <div className="h-screen w-full bg-background flex flex-col items-center justify-center gap-4 text-primary">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="font-mono tracking-widest uppercase">Authenticating...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  if (!modelsLoaded) {
    return (
      <div className="h-screen w-full bg-background flex flex-col items-center justify-center gap-4 text-primary">
        <div className="w-64 h-1 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary animate-pulse w-full origin-left" style={{ animationDuration: '1s' }} />
        </div>
        <p className="font-mono tracking-widest uppercase text-xs">Initializing Biometric Neural Networks...</p>
      </div>
    );
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/recognition" component={Recognition} />
        <Route path="/live" component={LiveCamera} />
        <Route path="/dataset" component={Dataset} />
        <Route path="/attendance" component={Attendance} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppContent />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

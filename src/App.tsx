import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navigation from "./components/Navigation";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import JudgeAgents from "./pages/JudgeAgents";
import JudgeAgentEdit from "./pages/JudgeAgentEdit";
import PromptOptimizer from "./pages/PromptOptimizer";
import ProjectTools from "./pages/ProjectTools";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <Navigation />
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<Projects />} />
              <Route path="/project/:projectId" element={<ProjectDetail />} />
              <Route path="/project/:projectId/tools" element={<ProjectTools />} />
              <Route path="/project/:projectId/optimizer" element={<PromptOptimizer />} />
              <Route path="/judges" element={<JudgeAgents />} />
              <Route path="/judges/:agentId" element={<JudgeAgentEdit />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

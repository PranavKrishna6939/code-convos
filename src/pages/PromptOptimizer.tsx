import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Lightbulb, RefreshCw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

export default function PromptOptimizer() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>('');

  const { data: project, isLoading: isProjectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId!),
    enabled: !!projectId
  });

  const { data: judges = [] } = useQuery({
    queryKey: ['judges'],
    queryFn: api.getJudges
  });

  // Set initial selected judge if available
  useEffect(() => {
    if (judges.length > 0 && !selectedJudgeId) {
      setSelectedJudgeId(judges[0].id);
    }
  }, [judges, selectedJudgeId]);

  const optimizeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedJudgeId || !projectId) return;
      return api.optimizePrompt(projectId, selectedJudgeId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      if (data?.buckets?.length === 0) {
        toast({
          title: "Analysis Complete",
          description: "No errors found to analyze for this judge.",
          variant: "default",
        });
      } else {
        toast({
          title: "Analysis Complete",
          description: "Prompt optimization suggestions generated.",
          variant: "default",
        });
      }
    },
    onError: (error) => {
      console.error("Optimization failed:", error);
      toast({
        title: "Optimization Failed",
        description: "Failed to generate prompt suggestions. Check console for details.",
        variant: "destructive",
      });
    }
  });

  const optimizationResult = project?.optimizations?.[selectedJudgeId];

  if (isProjectLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!project) {
    return <div className="min-h-screen flex items-center justify-center">Project not found</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0 bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${projectId}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Project
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Prompt Optimizer</h1>
            <p className="text-sm text-muted-foreground">Analyze errors and improve judge prompts</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={selectedJudgeId} onValueChange={setSelectedJudgeId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a judge to analyze" />
            </SelectTrigger>
            <SelectContent>
              {judges.map(judge => (
                <SelectItem key={judge.id} value={judge.id}>
                  {judge.label_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            onClick={() => optimizeMutation.mutate()} 
            disabled={!selectedJudgeId || optimizeMutation.isPending}
            className="min-w-[140px]"
          >
            {optimizeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Re-Analyze
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {optimizationResult ? (
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Analysis Results</h2>
              <span className="text-sm text-muted-foreground">
                Generated {new Date(optimizationResult.timestamp).toLocaleString()}
              </span>
            </div>

            <div className="grid gap-8">
              {optimizationResult.buckets.map((bucket, idx) => (
                <Card key={idx} className="border-l-4 border-l-primary">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold flex items-center gap-3">
                      <Badge variant="secondary" className="text-base px-3 py-1">Category {idx + 1}</Badge>
                      {bucket.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <p className="text-base text-muted-foreground leading-relaxed border-b pb-4">
                      {bucket.description}
                    </p>
                    
                    <div className="space-y-6">
                      <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Representative Examples</h3>
                      {bucket.examples.map((example, exIdx) => (
                        <div key={exIdx} className="bg-muted/30 rounded-lg border p-6 space-y-4">
                          {/* Context */}
                          {example.context && (
                            <div className="space-y-3 bg-background p-4 rounded border text-sm">
                              <div className="grid grid-cols-[80px_1fr] gap-2">
                                <span className="font-medium text-muted-foreground text-right">User:</span>
                                <span>{example.context.user_before}</span>
                              </div>
                              <div className="grid grid-cols-[80px_1fr] gap-2 bg-red-50/50 dark:bg-red-900/10 -mx-2 px-2 py-1 rounded">
                                <span className="font-medium text-red-600 dark:text-red-400 text-right">Assistant:</span>
                                <span className="text-foreground font-medium">{example.context.assistant}</span>
                              </div>
                              <div className="grid grid-cols-[80px_1fr] gap-2">
                                <span className="font-medium text-muted-foreground text-right">User:</span>
                                <span>{example.context.user_after}</span>
                              </div>
                            </div>
                          )}

                          <div className="grid md:grid-cols-2 gap-6">
                            <div>
                              <span className="text-xs font-bold uppercase text-red-500 mb-2 block">Error Reason</span>
                              <p className="text-sm leading-relaxed">{example.reason}</p>
                            </div>

                            <div>
                              <span className="text-xs font-bold uppercase text-green-600 mb-2 block">Suggested Correction</span>
                              <p className="text-sm leading-relaxed bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-100 dark:border-green-900/30 text-green-900 dark:text-green-100">
                                {example.suggestion}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
            <div className="bg-muted/30 p-8 rounded-full mb-6">
              <Lightbulb className="h-16 w-16 opacity-20" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Analysis Available</h3>
            <p className="max-w-md text-center">
              Select a judge from the dropdown above and click "Analyze Errors" to generate insights and prompt improvements.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

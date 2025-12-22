import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Project, JudgeAgent, OptimizationResult } from '@/types/judge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Sparkles, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PromptOptimizerDialogProps {
  project: Project;
  judges: JudgeAgent[];
}

export function PromptOptimizerDialog({ project, judges }: PromptOptimizerDialogProps) {
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const optimizeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedJudgeId) return;
      return api.optimizePrompt(project.id, selectedJudgeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
    }
  });

  const selectedJudge = judges.find(j => j.id === selectedJudgeId);
  const optimizationResult = project.optimizations?.[selectedJudgeId];

  const handleAnalyze = () => {
    optimizeMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Prompt Optimizer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Prompt Optimizer</DialogTitle>
          <DialogDescription>
            Analyze errors to identify patterns and generate improvements for your judge prompts.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-4">
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
            onClick={handleAnalyze} 
            disabled={!selectedJudgeId || optimizeMutation.isPending}
          >
            {optimizeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Lightbulb className="mr-2 h-4 w-4" />
                Analyze Errors
              </>
            )}
          </Button>
        </div>

        <ScrollArea className="flex-1 pr-4">
          {optimizationResult ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Analysis Results</h3>
                <span className="text-sm text-muted-foreground">
                  Generated {new Date(optimizationResult.timestamp).toLocaleString()}
                </span>
              </div>

              <div className="grid gap-4">
                {optimizationResult.buckets.map((bucket, idx) => (
                  <Card key={idx}>
                    <CardHeader>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Badge variant="secondary">Category {idx + 1}</Badge>
                        {bucket.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">{bucket.description}</p>
                      
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="examples">
                          <AccordionTrigger>View Examples & Suggestions</AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-4 pt-2">
                              {bucket.examples.map((example, exIdx) => (
                                <div key={exIdx} className="border rounded-md p-4 space-y-3 bg-muted/30">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Turn {example.turnIndex}</span>
                                    <span>Conv: {example.conversationId.slice(0, 8)}...</span>
                                  </div>
                                  
                                  <div>
                                    <span className="text-xs font-semibold uppercase text-red-500">Error Reason</span>
                                    <p className="text-sm mt-1">{example.reason}</p>
                                  </div>

                                  <div>
                                    <span className="text-xs font-semibold uppercase text-green-600">Suggested Correction</span>
                                    <p className="text-sm mt-1 bg-green-50/50 p-2 rounded border border-green-100 dark:bg-green-900/10 dark:border-green-900/30">
                                      {example.suggestion}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <Sparkles className="h-12 w-12 mb-4 opacity-20" />
              <p>Select a judge and click "Analyze Errors" to generate insights.</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Conversation, TurnError } from '@/types/judge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Trash2, CheckCircle2, BarChart3 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { AnalyticsDialog } from '@/components/AnalyticsDialog';
import { PromptOptimizerDialog } from '@/components/PromptOptimizerDialog';

const ProjectDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: project, isLoading: isProjectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId!),
    enabled: !!projectId
  });

  const { data: judges = [] } = useQuery({
    queryKey: ['judges'],
    queryFn: api.getJudges
  });

  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number | null>(null);
  const [selectedJudge, setSelectedJudge] = useState<string>('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualLabelInput, setManualLabelInput] = useState<Record<number, string[]>>({});
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // Set initial selected conversation
  useEffect(() => {
    if (project?.conversations?.length && !selectedConvId) {
      setSelectedConvId(project.conversations[0].id);
    }
  }, [project, selectedConvId]);

  const filteredConversations = useMemo(() => {
    if (!project?.conversations) return [];
    if (outcomeFilter === 'all') return project.conversations;
    return project.conversations.filter(c => c.outcome === outcomeFilter);
  }, [project?.conversations, outcomeFilter]);

  const outcomes = useMemo(() => {
    if (!project?.conversations) return [];
    const uniqueOutcomes = Array.from(new Set(project.conversations.map(c => c.outcome || 'unknown')));
    return ['all', ...uniqueOutcomes];
  }, [project?.conversations]);

  const selectedConversation = useMemo(() => 
    project?.conversations.find(c => c.id === selectedConvId),
    [project, selectedConvId]
  );

  // Get assistant turn indices
  const assistantTurns = useMemo(() => {
    if (!selectedConversation) return [];
    let turnIndex = 0;
    return selectedConversation.messages.map((msg, idx) => {
      if (msg.role === 'assistant') {
        return { messageIndex: idx, turnIndex: turnIndex++ };
      }
      return { messageIndex: idx, turnIndex: -1 };
    });
  }, [selectedConversation]);

  const getAssistantTurnIndex = (messageIndex: number) => {
    return assistantTurns[messageIndex]?.turnIndex ?? -1;
  };

  const getErrorsForTurn = (turnIndex: number): TurnError[] => {
    return selectedConversation?.turn_errors[turnIndex] || [];
  };

  const runJudgeMutation = useMutation({
    mutationFn: async ({ convId }: { convId: string }) => {
      if (!selectedJudge || !projectId) return;
      return api.runJudge(projectId, convId, selectedJudge);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (error) => {
      console.error(error);
      toast({ title: "Error", description: "Failed to run judge", variant: "destructive" });
    }
  });

  const updateReasonMutation = useMutation({
    mutationFn: async ({ turnIndex, label, reason }: { turnIndex: number, label: string, reason: string }) => {
      if (!selectedConvId || !projectId) return;
      return api.updateEvaluation(projectId, selectedConvId, turnIndex, label, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast({ title: "Saved", description: "Reason updated" });
    }
  });

  const deleteAllLabelsMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) return;
      return api.deleteAllLabels(projectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast({ title: "Success", description: "All labels deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete labels", variant: "destructive" });
    }
  });

  const deleteLabelMutation = useMutation({
    mutationFn: async ({ convId, turnIndex, label }: { convId: string, turnIndex: number, label: string }) => {
      if (!projectId) return;
      return api.deleteLabel(projectId, convId, turnIndex, label);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast({ title: "Success", description: "Label deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete label", variant: "destructive" });
    }
  });

  const updateManualLabelsMutation = useMutation({
    mutationFn: async ({ convId, turnIndex, labels }: { convId: string, turnIndex: number, labels: string[] }) => {
      if (!projectId) return;
      return api.updateManualLabels(projectId, convId, turnIndex, labels);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    }
  });

  const markLabelledMutation = useMutation({
    mutationFn: async ({ convId, labelled }: { convId: string, labelled: boolean }) => {
      if (!projectId) return;
      return api.markManuallyLabelled(projectId, convId, labelled);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    }
  });

  const handleRunJudge = () => {
    if (selectedConvId) {
      runJudgeMutation.mutate({ convId: selectedConvId });
      toast({ title: "Success", description: "Judge run started" });
    }
  };

  const handleRunAllFiltered = async () => {
    if (!selectedJudge || !projectId || filteredConversations.length === 0) return;
    
    setIsBatchRunning(true);
    toast({ title: "Batch Run Started", description: `Running judge on ${filteredConversations.length} conversations...` });

    let completed = 0;
    const total = filteredConversations.length;

    for (const conv of filteredConversations) {
      completed++;
      try {
        await api.runJudge(projectId, conv.id, selectedJudge, { current: completed, total });
      } catch (e) {
        console.error(`Failed to run judge on ${conv.id}`, e);
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    setIsBatchRunning(false);
    toast({ title: "Batch Run Completed", description: "All conversations processed." });
  };

  const handleUpdateReason = (turnIndex: number, label: string, newReason: string) => {
    updateReasonMutation.mutate({ turnIndex, label, reason: newReason });
  };

  const handleDeleteAllLabels = () => {
    if (confirm('Are you sure you want to delete all labels from this project?')) {
      deleteAllLabelsMutation.mutate();
    }
  };

  const handleDeleteLabel = (turnIndex: number, label: string) => {
    if (!selectedConvId) return;
    deleteLabelMutation.mutate({ convId: selectedConvId, turnIndex, label });
  };

  const handleStartManualMode = () => {
    // Load first unlabelled conversation, then labelled ones
    const unlabelled = filteredConversations.find(c => !c.manually_labelled);
    if (unlabelled) {
      setSelectedConvId(unlabelled.id);
    } else if (filteredConversations.length > 0) {
      setSelectedConvId(filteredConversations[0].id);
    }
    setIsManualMode(true);
    setManualLabelInput({});
  };

  const handleManualLabelConv = (convId: string) => {
    setSelectedConvId(convId);
    setIsManualMode(true);
    setManualLabelInput({});
  };

  const handleToggleManualLabel = (turnIndex: number, label: string) => {
    if (!selectedConvId || !selectedConversation) return;
    
    const currentLabels = selectedConversation.manual_labels?.[turnIndex] || [];
    const newLabels = currentLabels.includes(label)
      ? currentLabels.filter(l => l !== label)
      : [...currentLabels, label];
    
    updateManualLabelsMutation.mutate({ convId: selectedConvId, turnIndex, labels: newLabels });
  };

  const handleMarkLabelled = () => {
    if (!selectedConvId) return;
    markLabelledMutation.mutate({ convId: selectedConvId, labelled: true });
    toast({ title: "Success", description: "Conversation marked as labelled" });
    
    // Move to next unlabelled conversation
    const currentIdx = filteredConversations.findIndex(c => c.id === selectedConvId);
    const nextUnlabelled = filteredConversations.slice(currentIdx + 1).find(c => !c.manually_labelled);
    if (nextUnlabelled) {
      setSelectedConvId(nextUnlabelled.id);
    } else {
      setIsManualMode(false);
      toast({ title: "Complete", description: "All conversations labelled!" });
    }
  };

  if (isProjectLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  const currentTurnErrors = selectedTurnIndex !== null 
    ? getErrorsForTurn(selectedTurnIndex) 
    : [];

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-foreground">{project.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {isManualMode ? (
            <>
              <Button 
                size="sm" 
                variant="default"
                onClick={handleMarkLabelled}
                disabled={!selectedConvId}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Mark as Labelled
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setIsManualMode(false)}
              >
                Exit Manual Mode
              </Button>
            </>
          ) : (
            <>
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleStartManualMode}
              >
                Start Manual Labeling
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setAnalyticsOpen(true)}
              >
                <BarChart3 className="w-3 h-3 mr-1" />
                Analytics
              </Button>
              <PromptOptimizerDialog project={project} judges={judges} />
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger className="w-32 h-8 text-sm">
                  <SelectValue placeholder="Filter Outcome" />
                </SelectTrigger>
                <SelectContent>
                  {outcomes.map(outcome => (
                    <SelectItem key={outcome} value={outcome}>
                      {outcome === 'all' ? 'All Outcomes' : outcome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="h-4 w-px bg-border mx-2" />
              <Select value={selectedJudge} onValueChange={setSelectedJudge}>
                <SelectTrigger className="w-48 h-8 text-sm">
                  <SelectValue placeholder="Select judge..." />
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
                size="sm" 
                variant="outline" 
                onClick={handleRunJudge} 
                disabled={!selectedJudge || runJudgeMutation.isPending || isBatchRunning}
              >
                <Play className="w-3 h-3 mr-1" />
                Run
              </Button>
              <Button 
                size="sm" 
                variant="default" 
                onClick={handleRunAllFiltered} 
                disabled={!selectedJudge || isBatchRunning || filteredConversations.length === 0}
              >
                {isBatchRunning ? 'Running All...' : `Run All (${filteredConversations.length})`}
              </Button>
              <div className="h-4 w-px bg-border mx-2" />
              <Button 
                size="sm" 
                variant="destructive" 
                onClick={handleDeleteAllLabels}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear Labels
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Three-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Conversation List */}
        <div className="w-48 border-r border-border overflow-y-auto">
          {filteredConversations.map((conv) => {
            const hasErrors = conv.turn_errors && Object.keys(conv.turn_errors).length > 0;
            const isSelected = selectedConvId === conv.id;
            const isManuallyLabelled = conv.manually_labelled;
            
            return (
              <div
                key={conv.id}
                onClick={() => {
                  setSelectedConvId(conv.id);
                  setSelectedTurnIndex(null);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleManualLabelConv(conv.id);
                }}
                className={cn(
                  "px-3 py-2 border-b border-border cursor-pointer text-sm relative",
                  isSelected
                    ? "bg-black" 
                    : hasErrors
                      ? "bg-destructive/10 hover:bg-destructive/20"
                      : "hover:bg-muted/50"
                )}
              >
                {isManuallyLabelled && (
                  <CheckCircle2 className={cn(
                    "absolute top-2 right-2 h-3 w-3",
                    isSelected ? "text-green-400" : "text-green-600"
                  )} />
                )}
                <span className={cn(
                  "font-mono truncate block pr-5",
                  isSelected ? "text-white" : "text-muted-foreground"
                )} title={conv.id}>{conv.id}</span>
                <span className={cn(
                  "text-xs block mt-1 truncate",
                  isSelected ? "text-gray-400" : "text-muted-foreground"
                )}>{conv.outcome}</span>
              </div>
            );
          })}
        </div>

        {/* Center: Conversation View */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedConversation ? (
            <div className="space-y-3 max-w-2xl">
              {selectedConversation.messages.map((msg, idx) => {
                const turnIndex = getAssistantTurnIndex(idx);
                const hasErrors = turnIndex >= 0 && selectedConversation.turn_errors && Object.keys(selectedConversation.turn_errors).includes(turnIndex.toString());
                const errors = turnIndex >= 0 ? getErrorsForTurn(turnIndex) : [];
                const isSelected = selectedTurnIndex === turnIndex && turnIndex >= 0;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (msg.role === 'assistant') {
                        setSelectedTurnIndex(turnIndex);
                      }
                    }}
                    className={cn(
                      "p-3 rounded border",
                      msg.role === 'user' 
                        ? "bg-muted/30 border-border ml-0 mr-12" 
                        : hasErrors
                          ? "bg-destructive/10 border-destructive/30 ml-12 mr-0 cursor-pointer"
                          : "bg-card border-border ml-12 mr-0 cursor-pointer",
                      isSelected && "ring-2 ring-primary"
                    )}
                  >
                    <div className="text-xs text-muted-foreground mb-1 font-mono">
                      {msg.role === 'assistant' ? `assistant [turn ${turnIndex}]` : 'user'}
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{msg.content}</p>
                    
                    {/* Error chips */}
                    {errors.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {errors.map((err, errIdx) => (
                          <span 
                            key={errIdx}
                            className="px-2 py-0.5 text-xs font-mono bg-destructive/20 text-destructive rounded"
                          >
                            {err.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              Select a conversation
            </div>
          )}
        </div>

        {/* Right: Error & Judge Panel */}
        <div className="w-80 border-l border-border flex flex-col bg-background">
          {selectedTurnIndex !== null ? (
            <>
              {isManualMode ? (
                /* Manual Labeling Mode */
                <div className="flex-1 overflow-y-auto p-4">
                  <h3 className="text-sm font-medium text-foreground mb-2">
                    Manual Labels - Turn {selectedTurnIndex}
                  </h3>
                  <div className="text-xs text-muted-foreground mb-4">
                    Click labels to toggle for this assistant turn
                  </div>
                  <div className="space-y-2">
                    {judges.map(judge => {
                      const manualLabels = selectedConversation?.manual_labels?.[selectedTurnIndex] || [];
                      const isAssigned = manualLabels.includes(judge.label_name);
                      
                      return (
                        <div 
                          key={judge.id}
                          onClick={() => handleToggleManualLabel(selectedTurnIndex, judge.label_name)}
                          className={cn(
                            "p-2 rounded border text-sm cursor-pointer transition-colors",
                            isAssigned 
                              ? "bg-primary text-primary-foreground border-primary" 
                              : "bg-muted/30 border-border hover:bg-muted/50"
                          )}
                        >
                          <div className="font-mono">{judge.label_name}</div>
                          <div className={cn(
                            "text-xs mt-1",
                            isAssigned ? "text-primary-foreground/80" : "text-muted-foreground"
                          )}>{judge.description}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Normal LLM Judge Mode */
                <>
                  {/* Top: Open Codes (Flexible, takes remaining space) */}
                  <div className="flex-1 overflow-y-auto p-4 min-h-0">
                    <h3 className="text-sm font-medium text-foreground mb-2">Open Codes</h3>
                    {currentTurnErrors.length > 0 ? (
                      <div className="space-y-3 h-full flex flex-col">
                        {currentTurnErrors.map((error, idx) => (
                          <div key={`${selectedTurnIndex}-${error.label}`} className="space-y-1 flex-1 flex flex-col">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono text-muted-foreground">{error.label}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleDeleteLabel(selectedTurnIndex, error.label)}
                              >
                                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </div>
                            <Textarea
                              defaultValue={error.edited_reason ?? error.original_reason}
                              onBlur={(e) => handleUpdateReason(selectedTurnIndex, error.label, e.target.value)}
                              className="text-sm font-mono flex-1 min-h-[150px] resize-none"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No errors flagged for this turn</p>
                    )}
                  </div>

                  {/* Bottom: Axial Codes (Fixed height, pinned to bottom) */}
                  <div className="h-[400px] border-t border-border p-4 overflow-y-auto bg-muted/5">
                    <h3 className="text-sm font-medium text-foreground mb-2">Axial Codes (Labels)</h3>
                    <div className="space-y-2">
                      {judges.map(judge => {
                        const isAssigned = currentTurnErrors.some(e => e.label === judge.label_name);
                        return (
                          <div 
                            key={judge.id}
                            className={cn(
                              "p-2 rounded border text-sm",
                              isAssigned 
                                ? "bg-destructive/10 border-destructive/30" 
                                : "bg-muted/30 border-border"
                            )}
                          >
                            <div className="font-mono text-foreground">{judge.label_name}</div>
                            <div className="text-xs text-muted-foreground">{judge.description}</div>
                            <div className="text-xs mt-1">
                              {isAssigned ? (
                                <span className="text-destructive">Assigned</span>
                              ) : (
                                <span className="text-muted-foreground">Not Assigned</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-4 text-sm">
              Click an assistant turn to view details
            </div>
          )}
        </div>
      </div>

      {/* Analytics Dialog */}
      <AnalyticsDialog 
        projectId={projectId || ''} 
        open={analyticsOpen} 
        onOpenChange={setAnalyticsOpen} 
      />
    </div>
  );
};

export default ProjectDetail;

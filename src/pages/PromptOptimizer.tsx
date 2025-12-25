import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Lightbulb, RefreshCw, Wand2, Check, X, Eye, Settings2, FileCode, Plus, Trash2, Pencil } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as Diff from 'diff';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface AgentPrompt {
  id: string;
  title: string;
  description: string;
  content: string;
}

const PROMPT_SEPARATOR = "\n\n<<<<< PROMPT_SECTION_DELIMITER >>>>>\n\n";

const serializePrompts = (prompts: AgentPrompt[]) => {
  return prompts.map(p => 
    `### TITLE: ${p.title}\n### DESCRIPTION: ${p.description}\n${p.content}`
  ).join(PROMPT_SEPARATOR);
};

const parsePrompts = (text: string): AgentPrompt[] => {
  if (!text) return [];
  // Check if it has our separator or format
  if (!text.includes('### TITLE:') && !text.includes('<<<<< PROMPT_SECTION_DELIMITER >>>>>')) {
    // Legacy single prompt
    return [{
      id: 'default-master',
      title: 'Master Prompt',
      description: 'Main system prompt',
      content: text
    }];
  }

  const sections = text.split(PROMPT_SEPARATOR);
  return sections.map((section, index) => {
    const titleMatch = section.match(/### TITLE: (.*)(\n|$)/);
    const descMatch = section.match(/### DESCRIPTION: (.*)(\n|$)/);
    
    let content = section;
    if (titleMatch) content = content.replace(titleMatch[0], '');
    if (descMatch) content = content.replace(descMatch[0], '');
    
    return {
      id: `prompt-${index}-${Date.now()}`,
      title: titleMatch ? titleMatch[1].trim() : `Prompt ${index + 1}`,
      description: descMatch ? descMatch[1].trim() : '',
      content: content.trim()
    };
  });
};

const DiffViewer = ({ oldText, newText }: { oldText: string, newText: string }) => {
  const diff = Diff.diffLines(oldText, newText);

  return (
    <div className="font-mono text-sm whitespace-pre-wrap bg-muted/30 p-4 rounded-md border">
      {diff.map((part, index) => {
        const color = part.added ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-100' :
                      part.removed ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-100' : 
                      'text-foreground';
        return (
          <span key={index} className={color}>
            {part.value}
          </span>
        );
      })}
    </div>
  );
};

export default function PromptOptimizer() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>('');
  
  // Diff / Fix State
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [isMasterPromptOpen, setIsMasterPromptOpen] = useState(false);
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentPrompts, setAgentPrompts] = useState<AgentPrompt[]>([]);
  const [editingPrompt, setEditingPrompt] = useState<AgentPrompt | null>(null);
  const [activeBucketIndex, setActiveBucketIndex] = useState<number | null>(null);
  const [isGeneratingFix, setIsGeneratingFix] = useState(false);
  
  // Global Fix State - Removed
  // const [isGlobalFixOpen, setIsGlobalFixOpen] = useState(false);
  // const [selectedGlobalJudges, setSelectedGlobalJudges] = useState<string[]>([]);

  // Suggestion Generation State
  const [isSuggestionDialogOpen, setIsSuggestionDialogOpen] = useState(false);
  const [selectedSuggestionJudges, setSelectedSuggestionJudges] = useState<string[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  // Optimizer Settings
  const [optimizerProvider, setOptimizerProvider] = useState<string>('google');
  const [optimizerModel, setOptimizerModel] = useState<string>('gemini-3-flash-preview');
  const [optimizerTemperature, setOptimizerTemperature] = useState<number>(0.2);

  // Meta Prompts State
  const [isMetaPromptOpen, setIsMetaPromptOpen] = useState(false);
  const [metaPrompts, setMetaPrompts] = useState({ bucketing: '', suggestions: '', optimization: '' });

  const { data: fetchedMetaPrompts } = useQuery({
    queryKey: ['metaPrompts'],
    queryFn: api.getMetaPrompts,
    enabled: isMetaPromptOpen
  });

  useEffect(() => {
    if (fetchedMetaPrompts) {
      setMetaPrompts(fetchedMetaPrompts);
    }
  }, [fetchedMetaPrompts]);

  const updateMetaPromptsMutation = useMutation({
    mutationFn: async () => {
      return api.updateMetaPrompts(metaPrompts);
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Meta prompts updated successfully." });
      setIsMetaPromptOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update meta prompts.", variant: "destructive" });
    }
  });

  const { data: project, isLoading: isProjectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId!),
    enabled: !!projectId
  });

  // Load agent prompt from project
  useEffect(() => {
    if (project?.agentPrompt) {
      setAgentPrompt(project.agentPrompt);
      setAgentPrompts(parsePrompts(project.agentPrompt));
    }
  }, [project]);

  const updateProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!projectId) return;
      return api.updateProject(projectId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast({ title: "Saved", description: "Agent Master Prompt saved to project." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save Agent Master Prompt.", variant: "destructive" });
    }
  });

  const { data: judges = [] } = useQuery({
    queryKey: ['judges'],
    queryFn: api.getJudges
  });

  const selectedJudge = judges.find(j => j.id === selectedJudgeId);

  // Set initial selected judge if available
  useEffect(() => {
    if (judges.length > 0 && !selectedJudgeId) {
      setSelectedJudgeId(judges[0].id);
    }
  }, [judges, selectedJudgeId]);

  const optimizeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedJudgeId || !projectId) return;
      return api.optimizePrompt(
        projectId, 
        selectedJudgeId,
        optimizerProvider,
        optimizerModel,
        optimizerTemperature
      );
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

  const updateJudgeMutation = useMutation({
    mutationFn: async (updatedJudge: any) => {
      return api.updateJudge(selectedJudgeId, updatedJudge);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judges'] });
      toast({ title: "Success", description: "Master prompt updated successfully." });
      setIsDiffOpen(false);
      setIsMasterPromptOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update prompt.", variant: "destructive" });
    }
  });

  const generateSuggestionsMutation = useMutation({
    mutationFn: async () => {
      if (!projectId || selectedSuggestionJudges.length === 0) return;
      return api.generateGlobalSuggestions(
        projectId, 
        selectedSuggestionJudges,
        optimizerProvider,
        optimizerModel,
        optimizerTemperature
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast({ title: "Success", description: "Global suggestions generated." });
      setIsSuggestionDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate suggestions.", variant: "destructive" });
    }
  });

  const markFixedMutation = useMutation({
    mutationFn: async (bucketIndex: number) => {
      if (!projectId || !selectedJudgeId) return;
      return api.markBucketFixed(projectId, selectedJudgeId, bucketIndex);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    }
  });

  const handleFixPrompt = async (bucket: any, index: number) => {
    if (!selectedJudge) return;
    
    if (!agentPrompt.trim()) {
      toast({
        title: "Agent Prompt Required",
        description: "Please click 'Agent Master Prompt' and paste the Voice AI Agent's system prompt before generating a fix.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingFix(true);
    setActiveBucketIndex(index);
    setOriginalPrompt(agentPrompt);

    try {
      const result = await api.optimizeJudgePrompt(
        selectedJudgeId, 
        bucket, 
        agentPrompt,
        optimizerProvider,
        optimizerModel,
        optimizerTemperature
      );
      setNewPrompt(result.optimizedPrompt);
      setIsDiffOpen(true);
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate fix.", variant: "destructive" });
    } finally {
      setIsGeneratingFix(false);
    }
  };

  const handleFixAll = async () => {
    if (!selectedJudge || !projectId) return;
    
    if (!agentPrompt.trim()) {
      toast({
        title: "Agent Prompt Required",
        description: "Please click 'Agent Master Prompt' and paste the Voice AI Agent's system prompt before generating a fix.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingFix(true);
    setActiveBucketIndex(-1); // -1 indicates "All"
    setOriginalPrompt(agentPrompt);

    try {
      const result = await api.optimizeJudgePromptAll(
        projectId,
        selectedJudgeId, 
        agentPrompt,
        optimizerProvider,
        optimizerModel,
        optimizerTemperature
      );
      setNewPrompt(result.optimizedPrompt);
      setIsDiffOpen(true);
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate fix for all issues.", variant: "destructive" });
    } finally {
      setIsGeneratingFix(false);
    }
  };

  const handleAcceptChanges = async () => {
    if (activeBucketIndex === null) return;
    
    // Update the local agent prompt state with the new version
    setAgentPrompt(newPrompt);
    setAgentPrompts(parsePrompts(newPrompt));
    
    // Save to project
    updateProjectMutation.mutate({ agentPrompt: newPrompt });

    // Mark bucket(s) as fixed
    if (activeBucketIndex === -1) {
      // Mark ALL buckets of CURRENT judge as fixed
      if (optimizationResult?.buckets) {
        const promises = optimizationResult.buckets.map((_, idx) => 
          api.markBucketFixed(projectId!, selectedJudgeId, idx)
        );
        await Promise.all(promises);
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      }
    } else {
      markFixedMutation.mutate(activeBucketIndex);
    }
    
    toast({ 
      title: "Prompt Updated", 
      description: "The Agent Prompt has been updated and saved to the project." 
    });
    
    setIsDiffOpen(false);
  };

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
          <Button variant="ghost" size="sm" onClick={() => navigate(`/project/${projectId}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Project
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Prompt Optimizer</h1>
            <p className="text-sm text-muted-foreground">Analyze errors and improve judge prompts</p>
          </div>
        </div>
      </div>
        
      {/* Toolbar */}
      <div className="border-b border-border px-6 py-3 flex items-center gap-4 shrink-0 bg-muted/30 overflow-x-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" title="Optimizer Settings">
                <Settings2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Optimizer Settings</h4>
                  <p className="text-sm text-muted-foreground">
                    Configure the LLM used for optimization.
                  </p>
                </div>
                <div className="grid gap-2">
                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="provider">Provider</Label>
                    <Select value={optimizerProvider} onValueChange={setOptimizerProvider}>
                      <SelectTrigger id="provider" className="col-span-2 h-8">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="google">Google</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="model">Model</Label>
                    <Input
                      id="model"
                      value={optimizerModel}
                      onChange={(e) => setOptimizerModel(e.target.value)}
                      className="col-span-2 h-8"
                    />
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="temperature">Temperature</Label>
                      <span className="w-12 rounded-md border border-transparent px-2 py-0.5 text-right text-sm text-muted-foreground hover:border-border">
                        {optimizerTemperature}
                      </span>
                    </div>
                    <Slider
                      id="temperature"
                      max={1}
                      step={0.1}
                      value={[optimizerTemperature]}
                      onValueChange={(value) => setOptimizerTemperature(value[0])}
                      className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="icon" title="Edit Meta Prompts" onClick={() => setIsMetaPromptOpen(true)}>
            <FileCode className="h-4 w-4" />
          </Button>

          <Dialog open={isMetaPromptOpen} onOpenChange={setIsMetaPromptOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Meta Prompts</DialogTitle>
                <DialogDescription>
                  Modify the system prompts used for Error Bucketing and Suggestion Generation.
                  Variables like {'${judge.label_name}'} will be replaced at runtime.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label>Error Bucketing Prompt</Label>
                  <Textarea 
                    value={metaPrompts.bucketing}
                    onChange={(e) => setMetaPrompts(prev => ({ ...prev, bucketing: e.target.value }))}
                    className="h-64 font-mono text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Suggestion Generation Prompt</Label>
                  <Textarea 
                    value={metaPrompts.suggestions}
                    onChange={(e) => setMetaPrompts(prev => ({ ...prev, suggestions: e.target.value }))}
                    className="h-64 font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Prompt Optimization Prompt</Label>
                  <p className="text-xs text-muted-foreground">
                    Used when clicking "Fix in Prompt" or "Fix All Issues".
                  </p>
                  <Textarea 
                    value={metaPrompts.optimization}
                    onChange={(e) => setMetaPrompts(prev => ({ ...prev, optimization: e.target.value }))}
                    className="h-64 font-mono text-sm"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsMetaPromptOpen(false)}>Cancel</Button>
                <Button onClick={() => updateMetaPromptsMutation.mutate()}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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

          <Dialog open={isMasterPromptOpen} onOpenChange={setIsMasterPromptOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!selectedJudge}>
                <Wand2 className="mr-2 h-4 w-4" />
                Agent Master Prompt
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Voice AI Agent Master Prompt</DialogTitle>
                <DialogDescription>
                  Manage the system prompts for the Voice AI Agent. You can define multiple prompt sections.
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-hidden py-4">
                {editingPrompt ? (
                  <div className="flex flex-col h-full gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Prompt Title</Label>
                        <Input 
                          value={editingPrompt.title}
                          onChange={(e) => setEditingPrompt({...editingPrompt, title: e.target.value})}
                          placeholder="e.g. Role Definition"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input 
                          value={editingPrompt.description}
                          onChange={(e) => setEditingPrompt({...editingPrompt, description: e.target.value})}
                          placeholder="e.g. Defines the persona"
                        />
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 flex flex-col">
                      <Label>Prompt Content</Label>
                      <Textarea 
                        className="flex-1 font-mono text-sm resize-none" 
                        value={editingPrompt.content}
                        onChange={(e) => setEditingPrompt({...editingPrompt, content: e.target.value})}
                        placeholder="Enter the prompt content here..."
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setEditingPrompt(null)}>Cancel</Button>
                      <Button onClick={() => {
                        if (agentPrompts.find(p => p.id === editingPrompt.id)) {
                          setAgentPrompts(agentPrompts.map(p => p.id === editingPrompt.id ? editingPrompt : p));
                        } else {
                          setAgentPrompts([...agentPrompts, editingPrompt]);
                        }
                        setEditingPrompt(null);
                      }}>Save Prompt</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-medium text-muted-foreground">Defined Prompts ({agentPrompts.length})</h3>
                      <Button size="sm" onClick={() => setEditingPrompt({
                        id: `new-${Date.now()}`,
                        title: '',
                        description: '',
                        content: ''
                      })}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Prompt
                      </Button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto pr-4 min-h-0">
                      <div className="space-y-3">
                        {agentPrompts.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                            No prompts defined. Click "Add Prompt" to start.
                          </div>
                        )}
                        {agentPrompts.map((prompt) => (
                          <Card key={prompt.id} className="relative group">
                            <CardHeader className="py-3 px-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <CardTitle className="text-base">{prompt.title || 'Untitled Prompt'}</CardTitle>
                                  <p className="text-xs text-muted-foreground mt-1">{prompt.description}</p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingPrompt(prompt)}>
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => {
                                    setAgentPrompts(agentPrompts.filter(p => p.id !== prompt.id));
                                  }}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="py-3 px-4 bg-muted/20">
                              <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                                {prompt.content}
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {!editingPrompt && (
                <DialogFooter>
                  <Button onClick={() => {
                    const serialized = serializePrompts(agentPrompts);
                    setAgentPrompt(serialized);
                    updateProjectMutation.mutate({ agentPrompt: serialized });
                    setIsMasterPromptOpen(false);
                  }}>Save All & Close</Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={isSuggestionDialogOpen} onOpenChange={setIsSuggestionDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="border-dashed"
              >
                <Lightbulb className="mr-2 h-4 w-4" />
                Generate Suggestions
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Global Suggestions</DialogTitle>
                <DialogDescription>
                  Select judges to include. Suggestions will be generated for ALL selected judges' errors, ensuring compliance with ALL selected judges' rules.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                {judges.map(judge => (
                  <div key={judge.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`sugg-judge-${judge.id}`} 
                      checked={selectedSuggestionJudges.includes(judge.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedSuggestionJudges([...selectedSuggestionJudges, judge.id]);
                        } else {
                          setSelectedSuggestionJudges(selectedSuggestionJudges.filter(id => id !== judge.id));
                        }
                      }}
                    />
                    <Label htmlFor={`sugg-judge-${judge.id}`}>{judge.label_name}</Label>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button 
                  onClick={() => generateSuggestionsMutation.mutate()} 
                  disabled={selectedSuggestionJudges.length === 0 || generateSuggestionsMutation.isPending}
                >
                  {generateSuggestionsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Suggestions"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button 
            onClick={handleFixAll}
            disabled={!selectedJudgeId || isGeneratingFix || !optimizationResult?.buckets.some(b => !b.fixed)}
            variant="secondary"
            className="min-w-[140px]"
          >
            {isGeneratingFix && activeBucketIndex === -1 ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fixing All...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Fix All Issues
              </>
            )}
          </Button>

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

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-8">
        {optimizationResult ? (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Analysis Results</h2>
              <span className="text-sm text-muted-foreground">
                Generated {new Date(optimizationResult.timestamp).toLocaleString()}
              </span>
            </div>

            <div className="grid gap-8">
              {optimizationResult.buckets.map((bucket, idx) => (
                <Card key={idx} className={`border-l-4 ${bucket.fixed ? 'border-l-green-500 opacity-70' : 'border-l-primary'}`}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xl font-bold flex items-center gap-3">
                      <Badge variant={bucket.fixed ? "outline" : "secondary"} className="text-base px-3 py-1">
                        {bucket.fixed ? <Check className="w-3 h-3 mr-1" /> : null}
                        Category {idx + 1}
                      </Badge>
                      {bucket.title}
                    </CardTitle>
                    {!bucket.fixed && (
                      <Button 
                        size="sm" 
                        onClick={() => handleFixPrompt(bucket, idx)}
                        disabled={isGeneratingFix && activeBucketIndex === idx}
                      >
                        {isGeneratingFix && activeBucketIndex === idx ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Wand2 className="w-4 h-4 mr-2" />
                        )}
                        Fix in Master Prompt
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-6 pt-4">
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
                              {example.suggestion ? (
                                <p className="text-sm leading-relaxed bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-100 dark:border-green-900/30 text-green-900 dark:text-green-100">
                                  {example.suggestion}
                                </p>
                              ) : (
                                <div className="text-sm text-muted-foreground italic bg-muted/30 p-3 rounded border border-dashed">
                                  No suggestion generated yet. Click "Generate Suggestions" above to create corrections that satisfy multiple judges.
                                </div>
                              )}
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
          <div className="flex flex-col items-center justify-center h-[40vh] text-muted-foreground">
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

      {/* Diff Dialog */}
      <Dialog open={isDiffOpen} onOpenChange={setIsDiffOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Review Prompt Changes</DialogTitle>
            <DialogDescription>
              Review the proposed changes to the master prompt. Green indicates additions, red indicates removals.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto border rounded-md mt-4 min-h-[300px]">
            <DiffViewer oldText={originalPrompt} newText={newPrompt} />
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setIsDiffOpen(false)}>
              <X className="w-4 h-4 mr-2" />
              Reject
            </Button>
            <Button onClick={handleAcceptChanges} disabled={markFixedMutation.isPending}>
              {markFixedMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Accept & Update Master Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

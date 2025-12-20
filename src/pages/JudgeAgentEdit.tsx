import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Trash2, Plus, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const JudgeAgentEdit = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const isNew = agentId === 'new';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: existingAgent } = useQuery({
    queryKey: ['judge', agentId],
    queryFn: () => api.getJudge(agentId!),
    enabled: !isNew
  });

  const [labelName, setLabelName] = useState('');
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('gpt-4.1-mini');
  const [temperature, setTemperature] = useState('0.5');
  const [provider, setProvider] = useState('openai');
  const [judgeType, setJudgeType] = useState<'single' | 'multi'>('single');
  const [labelsSchema, setLabelsSchema] = useState<Record<string, { type: string; description: string; enum?: string[] }>>({});

  useEffect(() => {
    if (existingAgent) {
      setLabelName(existingAgent.label_name);
      setDescription(existingAgent.description);
      setPrompt(existingAgent.prompt);
      setModel(existingAgent.model || 'gpt-4.1-mini');
      setTemperature(existingAgent.temperature?.toString() || '0.5');
      setProvider(existingAgent.provider || 'openai');
      setJudgeType(existingAgent.judge_type || 'single');
      setLabelsSchema(existingAgent.labels_schema || {});
    }
  }, [existingAgent]);

  const createMutation = useMutation({
    mutationFn: api.createJudge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judges'] });
      toast({ title: "Success", description: "Judge agent created" });
      navigate('/judges');
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.updateJudge(agentId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judges'] });
      queryClient.invalidateQueries({ queryKey: ['judge', agentId] });
      toast({ title: "Success", description: "Judge agent updated" });
      navigate('/judges');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteJudge(agentId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judges'] });
      toast({ title: "Success", description: "Judge agent deleted" });
      navigate('/judges');
    }
  });

  const handleSave = () => {
    const data = { 
      label_name: labelName, 
      description, 
      prompt,
      model,
      temperature: parseFloat(temperature),
      provider,
      judge_type: judgeType,
      labels_schema: judgeType === 'multi' ? labelsSchema : undefined
    };
    if (isNew) {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this judge agent?')) {
      deleteMutation.mutate();
    }
  };

  const addLabel = () => {
    const labelKey = `label_${Object.keys(labelsSchema).length + 1}`;
    setLabelsSchema({
      ...labelsSchema,
      [labelKey]: { type: 'boolean', description: '' }
    });
  };

  const removeLabel = (key: string) => {
    const newSchema = { ...labelsSchema };
    delete newSchema[key];
    setLabelsSchema(newSchema);
  };

  const updateLabelKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    const newSchema = { ...labelsSchema };
    newSchema[newKey] = newSchema[oldKey];
    delete newSchema[oldKey];
    setLabelsSchema(newSchema);
  };

  const updateLabelProperty = (key: string, property: 'type' | 'description' | 'enum', value: any) => {
    setLabelsSchema({
      ...labelsSchema,
      [key]: {
        ...labelsSchema[key],
        [property]: value
      }
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/judges')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">
              {isNew ? 'Create Judge Agent' : 'Edit Judge Agent'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button 
                size="sm" 
                variant="destructive"
                onClick={handleDelete} 
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="judgeType">Judge Type</Label>
            <Select value={judgeType} onValueChange={(v) => setJudgeType(v as 'single' | 'multi')}>
              <SelectTrigger id="judgeType" className="max-w-md">
                <SelectValue placeholder="Select judge type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single Label (one error type)</SelectItem>
                <SelectItem value="multi">Multi Label (multiple error types per turn)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {judgeType === 'single' 
                ? 'Single-label judges check for one specific error type at a time.'
                : 'Multi-label judges can detect multiple error types in each turn.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="labelName">Label Name</Label>
            <Input
              id="labelName"
              placeholder="e.g., context_loss"
              value={labelName}
              onChange={(e) => setLabelName(e.target.value)}
              className="max-w-md font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Short description of what this judge detects..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="max-w-md min-h-20"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                placeholder="e.g., gpt-4.1-mini"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature</Label>
              <Input
                id="temperature"
                type="number"
                step="0.1"
                min="0"
                max="2"
                placeholder="0.5"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt">Judge Prompt</Label>
            <p className="text-xs text-muted-foreground">
              This prompt is sent directly to the LLM. Define your evaluation criteria here.
            </p>
            <Textarea
              id="prompt"
              placeholder="You are an evaluation judge. Analyze the conversation and..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-64 font-mono text-sm"
            />
          </div>

          {judgeType === 'multi' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Label Schema</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Define the labels that can be extracted from each turn. Each label will have a value and optional reason.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={addLabel}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add Label
                </Button>
              </div>

              <div className="space-y-3 mt-4">
                {Object.entries(labelsSchema).map(([key, schema]) => (
                  <div key={key} className="border border-border rounded-md p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Label Key</Label>
                            <Input
                              placeholder="e.g., bonus_committed"
                              value={key}
                              onChange={(e) => updateLabelKey(key, e.target.value)}
                              className="font-mono text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Type</Label>
                            <Select 
                              value={schema.type} 
                              onValueChange={(v) => updateLabelProperty(key, 'type', v)}
                            >
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="boolean">Boolean</SelectItem>
                                <SelectItem value="string">String</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Textarea
                            placeholder="Describe what this label detects..."
                            value={schema.description}
                            onChange={(e) => updateLabelProperty(key, 'description', e.target.value)}
                            className="text-sm min-h-20"
                          />
                        </div>
                        {schema.type === 'string' && (
                          <div className="space-y-1">
                            <Label className="text-xs">Enum Values (comma-separated, optional)</Label>
                            <Input
                              placeholder="e.g., Available, Other, Personal"
                              value={schema.enum?.join(', ') || ''}
                              onChange={(e) => {
                                const values = e.target.value.split(',').map(v => v.trim()).filter(Boolean);
                                updateLabelProperty(key, 'enum', values.length > 0 ? values : undefined);
                              }}
                              className="text-sm"
                            />
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 mt-6"
                        onClick={() => removeLabel(key)}
                      >
                        <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {Object.keys(labelsSchema).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-md">
                    No labels defined. Click "Add Label" to create your first label.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JudgeAgentEdit;

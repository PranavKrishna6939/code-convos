import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
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

  useEffect(() => {
    if (existingAgent) {
      setLabelName(existingAgent.label_name);
      setDescription(existingAgent.description);
      setPrompt(existingAgent.prompt);
      setModel(existingAgent.model || 'gpt-4.1-mini');
      setTemperature(existingAgent.temperature?.toString() || '0.5');
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

  const handleSave = () => {
    const data = { 
      label_name: labelName, 
      description, 
      prompt,
      model,
      temperature: parseFloat(temperature)
    };
    if (isNew) {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
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
          <Button size="sm" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="space-y-6">
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
          <div className="grid grid-cols-2 gap-4">
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
        </div>
      </div>
    </div>
  );
};

export default JudgeAgentEdit;

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dummyJudgeAgents } from '@/data/dummyData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';

const JudgeAgentEdit = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const isNew = agentId === 'new';

  const existingAgent = !isNew ? dummyJudgeAgents.find(a => a.id === agentId) : null;

  const [labelName, setLabelName] = useState(existingAgent?.label_name || '');
  const [description, setDescription] = useState(existingAgent?.description || '');
  const [prompt, setPrompt] = useState(existingAgent?.prompt || '');

  useEffect(() => {
    if (existingAgent) {
      setLabelName(existingAgent.label_name);
      setDescription(existingAgent.description);
      setPrompt(existingAgent.prompt);
    }
  }, [existingAgent]);

  const handleSave = () => {
    // In production, this would save to backend
    console.log('Saving agent:', { labelName, description, prompt });
    navigate('/judges');
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
          <Button size="sm" onClick={handleSave}>
            Save
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

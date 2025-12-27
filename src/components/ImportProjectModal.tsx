import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Project } from '@/types/judge';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

interface ImportProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (project: Project) => void;
}

const ImportProjectModal = ({ open, onOpenChange, onImport }: ImportProjectModalProps) => {
  const [apiKey, setApiKey] = useState('');
  const [projectName, setProjectName] = useState('');
  const [numConversations, setNumConversations] = useState('10');
  const [outcomes, setOutcomes] = useState('');
  const [agent, setAgent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleImport = async () => {
    if (!apiKey || !projectName || !numConversations || !agent) return;

    setIsLoading(true);
    
    try {
      const outcomeArray = outcomes.split(',').map(s => s.trim()).filter(s => s.length > 0);
      const newProject = await api.importProject(apiKey, projectName, parseInt(numConversations), outcomeArray, agent);
      onImport(newProject);
      
      // Reset form
      setApiKey('');
      setProjectName('');
      setNumConversations('10');
      setOutcomes('');
      setAgent('');
      
      toast({
        title: "Success",
        description: "Project imported successfully",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to import project. Please check your API key.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Project</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="hm_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              placeholder="e.g., Customer Support Q4"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="numConversations">Number of Conversations</Label>
            <Input
              id="numConversations"
              type="number"
              min="1"
              max="100"
              value={numConversations}
              onChange={(e) => setNumConversations(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="outcomes">Outcomes (comma separated)</Label>
            <Input
              id="outcomes"
              placeholder="e.g., completed, no_answer"
              value={outcomes}
              onChange={(e) => setOutcomes(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent">Agent Name</Label>
            <Input
              id="agent"
              placeholder="e.g., clickpost_order_confirmation_hi-IN_v4"
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport}
            disabled={!apiKey || !projectName || !numConversations || !agent || isLoading}
          >
            {isLoading ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportProjectModal;

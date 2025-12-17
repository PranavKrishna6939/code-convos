import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Project } from '@/types/judge';
import { dummyConversations } from '@/data/dummyData';

interface ImportProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (project: Project) => void;
}

const ImportProjectModal = ({ open, onOpenChange, onImport }: ImportProjectModalProps) => {
  const [apiKey, setApiKey] = useState('');
  const [projectName, setProjectName] = useState('');
  const [numConversations, setNumConversations] = useState('10');
  const [isLoading, setIsLoading] = useState(false);

  const handleImport = async () => {
    if (!apiKey || !projectName || !numConversations) return;

    setIsLoading(true);
    
    // Simulate API call - in production this would call:
    // GET https://api.hoomanlabs.com/routes/v1/conversations/?type=call&direction=outbound&limit={{N}}
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newProject: Project = {
      id: Date.now().toString(),
      name: projectName,
      conversations: dummyConversations.slice(0, parseInt(numConversations)),
      api_key: apiKey
    };

    setIsLoading(false);
    onImport(newProject);
    
    // Reset form
    setApiKey('');
    setProjectName('');
    setNumConversations('10');
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
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport}
            disabled={!apiKey || !projectName || !numConversations || isLoading}
          >
            {isLoading ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportProjectModal;

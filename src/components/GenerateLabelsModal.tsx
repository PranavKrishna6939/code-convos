import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Plus } from 'lucide-react';
import { AxialCode } from '@/types/project';
import { useToast } from '@/hooks/use-toast';

interface GenerateLabelsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (labels: AxialCode[]) => void;
  existingCodes: AxialCode[];
}

const GenerateLabelsModal = ({ open, onOpenChange, onGenerate, existingCodes }: GenerateLabelsModalProps) => {
  const [numLabels, setNumLabels] = useState('5');
  const [autoDecide, setAutoDecide] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLabels, setGeneratedLabels] = useState<AxialCode[]>([]);
  const { toast } = useToast();

  const mockGenerateLabels = (count: number): AxialCode[] => {
    const labelTemplates = [
      { name: 'Reasoning Error', color: '#ef4444', description: 'LLM made logical mistake' },
      { name: 'Hallucination', color: '#f97316', description: 'Fabricated information' },
      { name: 'Irrelevant Response', color: '#f59e0b', description: 'Off-topic answer' },
      { name: 'Context Ignored', color: '#84cc16', description: 'Did not use conversation history' },
      { name: 'Tone Mismatch', color: '#10b981', description: 'Inappropriate tone' },
      { name: 'Incomplete Answer', color: '#06b6d4', description: 'Missing key information' },
      { name: 'Factual Error', color: '#3b82f6', description: 'Incorrect facts' },
      { name: 'Repetitive', color: '#6366f1', description: 'Repeated previous responses' },
      { name: 'Overly Complex', color: '#8b5cf6', description: 'Unnecessarily complicated' },
      { name: 'Assumption Made', color: '#ec4899', description: 'Assumed without confirmation' },
    ];

    return labelTemplates.slice(0, count).map((template, idx) => ({
      id: `generated-${Date.now()}-${idx}`,
      ...template,
    }));
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    
    // Simulate API call
    setTimeout(() => {
      const count = autoDecide ? Math.floor(Math.random() * 5) + 5 : parseInt(numLabels) || 5;
      const labels = mockGenerateLabels(count);
      setGeneratedLabels(labels);
      setIsGenerating(false);
      
      toast({
        title: 'Labels generated',
        description: `${count} labels have been generated successfully.`,
      });
    }, 1500);
  };

  const handleAddLabel = () => {
    const newLabel: AxialCode = {
      id: `custom-${Date.now()}`,
      name: 'New Label',
      color: '#6366f1',
      description: '',
    };
    setGeneratedLabels([...generatedLabels, newLabel]);
  };

  const handleUpdateLabel = (id: string, field: keyof AxialCode, value: string) => {
    setGeneratedLabels(generatedLabels.map((label) => (label.id === id ? { ...label, [field]: value } : label)));
  };

  const handleDeleteLabel = (id: string) => {
    setGeneratedLabels(generatedLabels.filter((label) => label.id !== id));
  };

  const handleApply = () => {
    onGenerate(generatedLabels);
    setGeneratedLabels([]);
    setNumLabels('5');
    setAutoDecide(false);
    onOpenChange(false);
    
    toast({
      title: 'Labels added',
      description: `${generatedLabels.length} labels have been added to your project.`,
    });
  };

  const handleClose = () => {
    if (generatedLabels.length > 0) {
      const confirm = window.confirm('You have unsaved generated labels. Close anyway?');
      if (!confirm) return;
    }
    setGeneratedLabels([]);
    setNumLabels('5');
    setAutoDecide(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Labels using LLM</DialogTitle>
          <DialogDescription>
            Use AI to automatically generate relevant axial codes for your project
          </DialogDescription>
        </DialogHeader>

        {generatedLabels.length === 0 ? (
          <div className="space-y-4 mt-4">
            <div className="space-y-3">
              <label className="text-sm font-medium">Number of Labels</label>
              <Input
                type="number"
                value={numLabels}
                onChange={(e) => setNumLabels(e.target.value)}
                placeholder="Enter number of labels"
                disabled={autoDecide}
                min="1"
                max="20"
              />
            </div>

            <div className="flex items-center space-x-2 p-4 border border-border rounded-lg">
              <Checkbox
                id="auto-decide"
                checked={autoDecide}
                onCheckedChange={(checked) => setAutoDecide(checked as boolean)}
              />
              <label
                htmlFor="auto-decide"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Let the LLM automatically choose how many labels to generate
              </label>
            </div>

            <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
              {isGenerating ? 'Generating...' : 'Generate Labels'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Generated Labels ({generatedLabels.length})</h3>
              <p className="text-xs text-muted-foreground">Edit labels before applying</p>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {generatedLabels.map((label) => (
                <div
                  key={label.id}
                  className="flex items-center gap-2 p-3 border border-border rounded-lg group"
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  <Input
                    value={label.name}
                    onChange={(e) => handleUpdateLabel(label.id, 'name', e.target.value)}
                    className="flex-1 h-8 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteLabel(label.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>

            <Button variant="outline" onClick={handleAddLabel} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add New Label
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleApply} className="flex-1">
                Apply Labels
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GenerateLabelsModal;

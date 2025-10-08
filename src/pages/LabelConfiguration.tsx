import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dummyProjects } from '@/data/dummyProjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Sparkles, Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AxialCode } from '@/types/project';
import GenerateLabelsModal from '@/components/GenerateLabelsModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LabelConfiguration = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const project = dummyProjects.find((p) => p.id === projectId);

  const [axialCodes, setAxialCodes] = useState<AxialCode[]>(project?.axial_codes || []);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [labelingOrder, setLabelingOrder] = useState<'sequential' | 'rating'>('sequential');

  if (!project) {
    return <div>Project not found</div>;
  }

  const handleAddLabel = () => {
    const newLabel: AxialCode = {
      id: `code-${Date.now()}`,
      name: 'New Label',
      color: '#6366f1',
      description: '',
    };
    setAxialCodes([...axialCodes, newLabel]);
  };

  const handleUpdateLabel = (id: string, field: keyof AxialCode, value: string) => {
    setAxialCodes(axialCodes.map((code) => (code.id === id ? { ...code, [field]: value } : code)));
  };

  const handleDeleteLabel = (id: string) => {
    setAxialCodes(axialCodes.filter((code) => code.id !== id));
  };

  const handleSave = () => {
    toast({
      title: 'Configuration saved',
      description: 'Label configuration has been updated successfully.',
    });
  };

  const handleGeneratedLabels = (labels: AxialCode[]) => {
    setAxialCodes([...axialCodes, ...labels]);
  };

  const handleStartLabeling = () => {
    navigate(`/project/${projectId}/label?order=${labelingOrder}`);
  };

  const colorOptions = [
    { value: '#ef4444', label: 'Red' },
    { value: '#f97316', label: 'Orange' },
    { value: '#f59e0b', label: 'Amber' },
    { value: '#84cc16', label: 'Lime' },
    { value: '#10b981', label: 'Green' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#3b82f6', label: 'Blue' },
    { value: '#6366f1', label: 'Indigo' },
    { value: '#8b5cf6', label: 'Violet' },
    { value: '#ec4899', label: 'Pink' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(`/project/${projectId}`)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Label Configuration</h1>
                <p className="text-sm text-muted-foreground mt-1">{project.project_name}</p>
              </div>
            </div>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Labeling Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Labeling Order</label>
                <Select value={labelingOrder} onValueChange={(value: 'sequential' | 'rating') => setLabelingOrder(value)}>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sequential">Sequential Order (Dataset order)</SelectItem>
                    <SelectItem value="rating">By Customer Rating (Lowest first)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleStartLabeling}>Start Labeling with Current Settings</Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Axial Codes</h2>
              <Button variant="outline" onClick={() => setGenerateModalOpen(true)}>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Labels using LLM
              </Button>
            </div>

            <div className="space-y-3">
              {axialCodes.map((code) => (
                <div key={code.id} className="flex items-start gap-3 p-4 border border-border rounded-lg">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <Input
                        value={code.name}
                        onChange={(e) => handleUpdateLabel(code.id, 'name', e.target.value)}
                        placeholder="Label name"
                        className="flex-1"
                      />
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded border border-border"
                          style={{ backgroundColor: code.color }}
                        />
                        <select
                          value={code.color}
                          onChange={(e) => handleUpdateLabel(code.id, 'color', e.target.value)}
                          className="border border-input bg-background rounded-md px-2 py-1 text-sm"
                        >
                          {colorOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteLabel(code.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <Input
                      value={code.description || ''}
                      onChange={(e) => handleUpdateLabel(code.id, 'description', e.target.value)}
                      placeholder="Description (optional)"
                    />
                  </div>
                </div>
              ))}

              <Button variant="outline" onClick={handleAddLabel} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Label
              </Button>
            </div>
          </Card>
        </div>
      </main>

      <GenerateLabelsModal
        open={generateModalOpen}
        onOpenChange={setGenerateModalOpen}
        onGenerate={handleGeneratedLabels}
        existingCodes={axialCodes}
      />
    </div>
  );
};

export default LabelConfiguration;

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: any) => void;
}

export const ImportModal = ({ open, onOpenChange, onImport }: ImportModalProps) => {
  const [jsonInput, setJsonInput] = useState('');
  const [isValidJson, setIsValidJson] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const { toast } = useToast();

  const handleJsonChange = (value: string) => {
    setJsonInput(value);
    try {
      const parsed = JSON.parse(value);
      if (parsed.project_name && parsed.conversations && Array.isArray(parsed.conversations)) {
        setIsValidJson(true);
        setPreviewData(parsed);
      } else {
        setIsValidJson(false);
        setPreviewData(null);
      }
    } catch {
      setIsValidJson(false);
      setPreviewData(null);
    }
  };

  const handleImport = () => {
    if (isValidJson && previewData) {
      onImport(previewData);
      toast({
        title: 'Project imported successfully',
        description: `${previewData.conversations.length} conversations ready for labeling.`,
      });
      setJsonInput('');
      setPreviewData(null);
      onOpenChange(false);
    }
  };

  const exampleJson = `{
  "project_name": "Example Project",
  "conversations": [
    {
      "conversation_id": 1,
      "messages": [
        {"role": "customer", "text": "Hello"},
        {"role": "llm", "text": "Hi there!"}
      ],
      "customer_rating": 4
    }
  ]
}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Conversation Dataset</DialogTitle>
          <DialogDescription>
            Paste your JSON data below. The format should include project name, conversations with messages and customer ratings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium mb-2 block">JSON Data</label>
            <Textarea
              placeholder={exampleJson}
              value={jsonInput}
              onChange={(e) => handleJsonChange(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
            {isValidJson && (
              <div className="flex items-center gap-2 mt-2 text-sm text-success">
                <CheckCircle2 className="w-4 h-4" />
                <span>Valid JSON format detected</span>
              </div>
            )}
          </div>

          {previewData && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Preview</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Project: <span className="text-foreground font-medium">{previewData.project_name}</span></p>
                <p>Conversations: <span className="text-foreground font-medium">{previewData.conversations.length}</span></p>
                <p className="text-xs mt-2">First conversation preview:</p>
                <div className="mt-2 p-2 bg-background rounded text-xs">
                  {previewData.conversations[0]?.messages.slice(0, 2).map((msg: any, idx: number) => (
                    <div key={idx} className="mb-1">
                      <span className="font-medium">{msg.role}:</span> {msg.text.substring(0, 50)}...
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!isValidJson}>
              <Upload className="w-4 h-4 mr-2" />
              Import Project
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

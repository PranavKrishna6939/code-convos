import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';

interface AnalyticsDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RecallMetric {
  label: string;
  recall: number;
  truePositives: number;
  falseNegatives: number;
  totalManualLabels: number;
}

export function AnalyticsDialog({ projectId, open, onOpenChange }: AnalyticsDialogProps) {
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['analytics', projectId],
    queryFn: () => api.getRecallAnalytics(projectId),
    enabled: open && !!projectId,
  });

  const analytics: RecallMetric[] = analyticsData?.analytics || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Judge Performance Analytics
          </DialogTitle>
          <DialogDescription>
            Recall metrics comparing LLM judge predictions against manual labels
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading analytics...
          </div>
        ) : analytics.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No analytics available. Make sure you have manually labelled conversations and run the LLM judge.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-3 text-left font-medium">Label</th>
                    <th className="p-3 text-right font-medium">Recall</th>
                    <th className="p-3 text-right font-medium">TP</th>
                    <th className="p-3 text-right font-medium">FN</th>
                    <th className="p-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.map((metric, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="p-3 font-medium">{metric.label}</td>
                      <td className="p-3 text-right">
                        <span className={`font-semibold ${
                          metric.recall >= 80 ? 'text-green-600' :
                          metric.recall >= 60 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {metric.recall.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {metric.truePositives}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {metric.falseNegatives}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {metric.totalManualLabels}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
              <p className="font-medium mb-2">Metrics Explanation:</p>
              <ul className="space-y-1 ml-4">
                <li><strong>Recall:</strong> Percentage of manual labels correctly identified by the LLM judge</li>
                <li><strong>TP (True Positives):</strong> LLM correctly detected the error</li>
                <li><strong>FN (False Negatives):</strong> Manual label exists but LLM missed it</li>
                <li><strong>Total:</strong> Total manual labels for this error type</li>
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

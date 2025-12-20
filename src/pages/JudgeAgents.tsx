import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const JudgeAgents = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: agents = [] } = useQuery({
    queryKey: ['judges'],
    queryFn: api.getJudges
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteJudge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judges'] });
      toast({ title: "Success", description: "Judge agent deleted" });
    }
  });

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this judge agent?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">Judge Agents</h1>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/judges/new')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="border border-border rounded-md overflow-hidden">
          {agents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No judge agents yet. Click Create to add one.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Label Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Description</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr 
                    key={agent.id}
                    className="border-t border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/judges/${agent.id}`)}
                  >
                    <td className="px-4 py-3 text-sm font-mono text-foreground">{agent.label_name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{agent.description}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => handleDelete(e, agent.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default JudgeAgents;

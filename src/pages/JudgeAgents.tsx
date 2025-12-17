import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dummyJudgeAgents } from '@/data/dummyData';
import { JudgeAgent } from '@/types/judge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const JudgeAgents = () => {
  const navigate = useNavigate();
  const [agents] = useState<JudgeAgent[]>(dummyJudgeAgents);

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

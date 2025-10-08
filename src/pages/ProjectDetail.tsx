import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { dummyProjects } from '@/data/dummyProjects';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Play, MessageSquare, Star } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const ProjectDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  
  const project = dummyProjects.find((p) => p.id === projectId);

  if (!project) {
    return <div>Project not found</div>;
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="warning">In Progress</Badge>;
      default:
        return <Badge variant="secondary">Not Labeled</Badge>;
    }
  };

  const handleStartLabeling = (order: 'sequential' | 'rating') => {
    setOrderModalOpen(false);
    navigate(`/project/${projectId}/label?order=${order}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{project.project_name}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {project.labeled_count} of {project.conversations.length} conversations labeled
                </p>
              </div>
            </div>
            <Button onClick={() => setOrderModalOpen(true)}>
              <Play className="w-4 h-4 mr-2" />
              Start Labeling
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {project.axial_codes && project.axial_codes.length > 0 && (
          <Card className="p-4 mb-6">
            <h3 className="font-semibold mb-3">Axial Codes</h3>
            <div className="flex flex-wrap gap-2">
              {project.axial_codes.map((code) => (
                <span
                  key={code.id}
                  className="px-3 py-1.5 rounded-md text-sm font-medium"
                  style={{ backgroundColor: `${code.color}20`, color: code.color }}
                >
                  {code.name}
                  {code.description && (
                    <span className="ml-2 text-xs opacity-75">• {code.description}</span>
                  )}
                </span>
              ))}
            </div>
          </Card>
        )}

        <div className="space-y-4">
          {project.conversations.map((conversation) => (
            <Card key={conversation.conversation_id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <h3 className="font-medium">Conversation #{conversation.conversation_id}</h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-warning text-warning" />
                    <span className="text-sm font-medium">{conversation.customer_rating}/5</span>
                  </div>
                  {getStatusBadge(conversation.status)}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="text-sm">
                  <span className="font-medium text-foreground">Customer:</span>{' '}
                  <span className="text-muted-foreground">
                    {conversation.messages[0]?.text.substring(0, 100)}
                    {conversation.messages[0]?.text.length > 100 && '...'}
                  </span>
                </div>
              </div>

              {conversation.axial_codes && conversation.axial_codes.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                  {conversation.axial_codes.map((codeName, idx) => {
                    const code = project.axial_codes?.find((c) => c.name === codeName);
                    return (
                      <span
                        key={idx}
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: code ? `${code.color}20` : '#e5e7eb',
                          color: code?.color || '#6b7280',
                        }}
                      >
                        {codeName}
                      </span>
                    );
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
      </main>

      <Dialog open={orderModalOpen} onOpenChange={setOrderModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Labeling Order</DialogTitle>
            <DialogDescription>
              Select how you'd like to go through the conversations
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => handleStartLabeling('sequential')}
            >
              <div className="text-left">
                <div className="font-medium">Sequential Order</div>
                <div className="text-sm text-muted-foreground">Label conversations in dataset order</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => handleStartLabeling('rating')}
            >
              <div className="text-left">
                <div className="font-medium">By Customer Rating</div>
                <div className="text-sm text-muted-foreground">Start with lowest-rated conversations</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectDetail;

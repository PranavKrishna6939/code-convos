import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Project } from '@/types/judge';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Copy } from 'lucide-react';
import ImportProjectModal from '@/components/ImportProjectModal';
import { useToast } from '@/components/ui/use-toast';

const Projects = () => {
  const navigate = useNavigate();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: projects = [], refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: "Success", description: "Project deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete project", variant: "destructive" });
    }
  });

  const duplicateMutation = useMutation({
    mutationFn: api.duplicateProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: "Success", description: "Project duplicated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to duplicate project", variant: "destructive" });
    }
  });

  const handleImport = (project: Project) => {
    refetch();
    setIsImportOpen(false);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleDuplicate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    duplicateMutation.mutate(id);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">Projects</h1>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsImportOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Import
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="border border-border rounded-md overflow-hidden">
          {projects.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No projects yet. Click Import to add conversations.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Name</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Conversations</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr 
                    key={project.id}
                    className="border-t border-border hover:bg-muted/30 cursor-pointer group"
                    onClick={() => navigate(`/project/${project.id}`)}
                  >
                    <td className="px-4 py-3 text-sm text-foreground">{project.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground text-right">
                      {project.conversationCount ?? project.conversations?.length ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleDuplicate(e, project.id)}
                          title="Duplicate project"
                        >
                          <Copy className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleDelete(e, project.id)}
                          title="Delete project"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ImportProjectModal 
        open={isImportOpen} 
        onOpenChange={setIsImportOpen}
        onImport={handleImport}
      />
    </div>
  );
};

export default Projects;

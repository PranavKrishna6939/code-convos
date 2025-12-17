import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dummyProjects } from '@/data/dummyData';
import { Project } from '@/types/judge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import ImportProjectModal from '@/components/ImportProjectModal';

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>(dummyProjects);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const handleImport = (project: Project) => {
    setProjects([...projects, project]);
    setIsImportOpen(false);
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
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr 
                    key={project.id}
                    className="border-t border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/project/${project.id}`)}
                  >
                    <td className="px-4 py-3 text-sm text-foreground">{project.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground text-right">
                      {project.conversations.length}
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

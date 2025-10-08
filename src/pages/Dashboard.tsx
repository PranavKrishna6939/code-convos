import { useState } from 'react';
import { ProjectCard } from '@/components/ProjectCard';
import { ImportModal } from '@/components/ImportModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import { dummyProjects } from '@/data/dummyProjects';

const Dashboard = () => {
  const [projects, setProjects] = useState(dummyProjects);
  const [searchQuery, setSearchQuery] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);

  const filteredProjects = projects.filter((project) =>
    project.project_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleImport = (data: any) => {
    const newProject = {
      id: String(projects.length + 1),
      project_name: data.project_name,
      date_imported: new Date().toISOString().split('T')[0],
      labeled_count: 0,
      conversations: data.conversations.map((conv: any) => ({
        ...conv,
        status: 'not_labeled' as const,
      })),
    };
    setProjects([newProject, ...projects]);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Conversation Labeling Platform</h1>
              <p className="text-sm text-muted-foreground mt-1">Analyze and annotate LLM interactions</p>
            </div>
            <Button onClick={() => setImportModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Import Project
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No projects found. Import your first dataset to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>

      <ImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onImport={handleImport}
      />
    </div>
  );
};

export default Dashboard;

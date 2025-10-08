import { Project } from '@/types/project';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Calendar, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProjectCardProps {
  project: Project;
}

export const ProjectCard = ({ project }: ProjectCardProps) => {
  const totalConversations = project.conversations.length;
  const completionPercentage = totalConversations > 0 
    ? Math.round((project.labeled_count / totalConversations) * 100)
    : 0;

  return (
    <Link to={`/project/${project.id}`}>
      <Card className="p-6 hover:shadow-lg transition-all duration-200 hover:border-primary/50 cursor-pointer group">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
              {project.project_name}
            </h3>
            <Badge variant={completionPercentage === 100 ? 'success' : completionPercentage > 0 ? 'warning' : 'secondary'}>
              {completionPercentage}% Complete
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="w-4 h-4" />
              <span>{totalConversations} conversations</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4" />
              <span>{project.labeled_count} / {totalConversations} labeled</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>Imported {new Date(project.date_imported).toLocaleDateString()}</span>
            </div>
          </div>

          {project.axial_codes && project.axial_codes.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2 border-t border-border">
              {project.axial_codes.slice(0, 3).map((code) => (
                <span
                  key={code.id}
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{ backgroundColor: `${code.color}20`, color: code.color }}
                >
                  {code.name}
                </span>
              ))}
              {project.axial_codes.length > 3 && (
                <span className="px-2 py-1 rounded text-xs font-medium text-muted-foreground">
                  +{project.axial_codes.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
};

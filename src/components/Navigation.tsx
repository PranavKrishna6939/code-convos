import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const Navigation = () => {
  const location = useLocation();
  
  const isProjectsActive = location.pathname === '/' || location.pathname.startsWith('/project');
  const isJudgesActive = location.pathname.startsWith('/judges');

  return (
    <nav className="border-b border-border bg-card">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex gap-6">
          <Link
            to="/"
            className={cn(
              "py-3 text-sm font-medium border-b-2 -mb-px",
              isProjectsActive 
                ? "border-primary text-foreground" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Projects
          </Link>
          <Link
            to="/judges"
            className={cn(
              "py-3 text-sm font-medium border-b-2 -mb-px",
              isJudgesActive 
                ? "border-primary text-foreground" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Judge Agents
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;

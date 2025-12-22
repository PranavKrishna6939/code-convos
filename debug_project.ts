import { Project, JudgeAgent, TurnError } from './src/types/judge';

const API_BASE = 'http://localhost:4001/api';

const api = {
  getProjects: async (): Promise<Project[]> => {
    const res = await fetch(`${API_BASE}/projects`);
    return res.json() as Promise<Project[]>;
  },
  getProject: async (id: string): Promise<Project> => {
    const res = await fetch(`${API_BASE}/projects/${id}`);
    return res.json() as Promise<Project>;
  },
  getJudges: async (): Promise<JudgeAgent[]> => {
    const res = await fetch(`${API_BASE}/judges`);
    return res.json() as Promise<JudgeAgent[]>;
  }
};

async function debug() {
  try {
    const projects = await api.getProjects();
    if (projects.length === 0) {
      console.log('No projects found');
      return;
    }
    const project = await api.getProject(projects[0].id);
    console.log('Project:', project.name);
    
    const judges = await api.getJudges();
    console.log('Judges:', judges.map(j => ({ id: j.id, name: j.label_name, type: j.judge_type })));

    let totalErrors = 0;
    project.conversations.forEach((c) => {
      if (c.turn_errors) {
        Object.values(c.turn_errors).forEach((errors: TurnError[]) => {
          errors.forEach((e) => {
            console.log(`Error label: "${e.label}"`);
            totalErrors++;
          });
        });
      }
    });
    console.log('Total errors found:', totalErrors);

  } catch (e) {
    console.error(e);
  }
}

debug();

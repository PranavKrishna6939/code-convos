const fetch = require('node-fetch'); // Assuming node-fetch is available or I can use native fetch in Node 18+

const API_BASE = 'http://localhost:4001/api';

async function debug() {
  try {
    const resProjects = await fetch(`${API_BASE}/projects`);
    const projects = await resProjects.json();
    
    if (projects.length === 0) {
      console.log('No projects found');
      return;
    }
    
    const resProject = await fetch(`${API_BASE}/projects/${projects[0].id}`);
    const project = await resProject.json();
    console.log('Project:', project.name);
    
    const resJudges = await fetch(`${API_BASE}/judges`);
    const judges = await resJudges.json();
    console.log('Judges:', judges.map(j => ({ id: j.id, name: j.label_name, type: j.judge_type })));

    let totalErrors = 0;
    project.conversations.forEach(c => {
      if (c.turn_errors) {
        Object.values(c.turn_errors).forEach(errors => {
          errors.forEach(e => {
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

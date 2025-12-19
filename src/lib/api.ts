import { Project, JudgeAgent, Conversation } from '@/types/judge';

const API_BASE = '/api';

export const api = {
  // Projects
  getProjects: async (): Promise<Project[]> => {
    const res = await fetch(`${API_BASE}/projects`);
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  },

  getProject: async (id: string): Promise<Project> => {
    const res = await fetch(`${API_BASE}/projects/${id}`);
    if (!res.ok) throw new Error('Failed to fetch project');
    return res.json();
  },

  importProject: async (apiKey: string, name: string, limit: number, outcomes?: string[]): Promise<Project> => {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, name, limit, outcomes }),
    });
    if (!res.ok) throw new Error('Failed to import project');
    return res.json();
  },

  deleteProject: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete project');
    return res.json();
  },

  // Judges
  getJudges: async (): Promise<JudgeAgent[]> => {
    const res = await fetch(`${API_BASE}/judges`);
    if (!res.ok) throw new Error('Failed to fetch judges');
    return res.json();
  },

  getJudge: async (id: string): Promise<JudgeAgent> => {
    const res = await fetch(`${API_BASE}/judges/${id}`);
    if (!res.ok) throw new Error('Failed to fetch judge');
    return res.json();
  },

  createJudge: async (judge: Omit<JudgeAgent, 'id'>): Promise<JudgeAgent> => {
    const res = await fetch(`${API_BASE}/judges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(judge),
    });
    if (!res.ok) throw new Error('Failed to create judge');
    return res.json();
  },

  updateJudge: async (id: string, judge: Omit<JudgeAgent, 'id'>): Promise<JudgeAgent> => {
    const res = await fetch(`${API_BASE}/judges/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(judge),
    });
    if (!res.ok) throw new Error('Failed to update judge');
    return res.json();
  },

  // Evaluations
  runJudge: async (projectId: string, conversationId: string, judgeId: string, progress?: { current: number, total: number }) => {
    const res = await fetch(`${API_BASE}/run-judge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, conversationId, judgeId, progress }),
    });
    if (!res.ok) throw new Error('Failed to run judge');
    return res.json();
  },

  updateEvaluation: async (projectId: string, conversationId: string, turnIndex: number, label: string, editedReason: string) => {
    const res = await fetch(`${API_BASE}/evaluations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, conversationId, turnIndex, label, editedReason }),
    });
    if (!res.ok) throw new Error('Failed to update evaluation');
    return res.json();
  }
};

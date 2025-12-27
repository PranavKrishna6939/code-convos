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

  getProjectTools: async (id: string, agent?: string): Promise<any> => {
    let url = `${API_BASE}/projects/${id}/tools`;
    if (agent) {
      url += `?agent=${encodeURIComponent(agent)}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch project tools');
    return res.json();
  },

  importProject: async (apiKey: string, name: string, limit: number, outcomes?: string[], agent?: string): Promise<Project> => {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, name, limit, outcomes, agent }),
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

  updateProject: async (id: string, data: Partial<Project>): Promise<Project> => {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update project');
    return res.json();
  },

  duplicateProject: async (id: string): Promise<Project> => {
    const res = await fetch(`${API_BASE}/projects/${id}/duplicate`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to duplicate project');
    return res.json();
  },

  deleteAllLabels: async (projectId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/labels`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete all labels');
    return res.json();
  },

  deleteLabel: async (projectId: string, convId: string, turnIndex: number, label: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/conversations/${convId}/turns/${turnIndex}/labels/${encodeURIComponent(label)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete label');
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

  deleteJudge: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/judges/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete judge');
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

  runAnalysisJudge: async (projectId: string, conversationId: string, judgeId: string) => {
    const res = await fetch(`${API_BASE}/run-analysis-judge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, conversationId, judgeId }),
    });
    if (!res.ok) throw new Error('Failed to run analysis judge');
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
  },

  // Manual Labeling
  updateManualLabels: async (projectId: string, conversationId: string, turnIndex: number, labels: string[]) => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/conversations/${conversationId}/manual-labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnIndex, labels }),
    });
    if (!res.ok) throw new Error('Failed to update manual labels');
    return res.json();
  },

  markManuallyLabelled: async (projectId: string, conversationId: string, labelled: boolean) => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/conversations/${conversationId}/mark-labelled`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labelled }),
    });
    if (!res.ok) throw new Error('Failed to mark conversation');
    return res.json();
  },

  // Analytics
  getRecallAnalytics: async (projectId: string) => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/analytics/recall`);
    if (!res.ok) throw new Error('Failed to get recall analytics');
    return res.json();
  },

  optimizePrompt: async (projectId: string, judgeId: string, provider?: string, model?: string, temperature?: number): Promise<{ success: boolean, buckets: any[] }> => {
    const res = await fetch(`${API_BASE}/optimize-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, judgeId, provider, model, temperature }),
    });
    if (!res.ok) throw new Error('Failed to optimize prompt');
    return res.json();
  },

  getMetaPrompts: async (): Promise<{ bucketing: string, suggestions: string, optimization: string }> => {
    const res = await fetch(`${API_BASE}/meta-prompts`);
    if (!res.ok) throw new Error('Failed to fetch meta prompts');
    return res.json();
  },

  updateMetaPrompts: async (prompts: { bucketing?: string, suggestions?: string, optimization?: string }): Promise<void> => {
    const res = await fetch(`${API_BASE}/meta-prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompts),
    });
    if (!res.ok) throw new Error('Failed to update meta prompts');
    return res.json();
  },

  optimizeJudgePrompt: async (judgeId: string, bucket: any, agentPrompt?: string, provider?: string, model?: string, temperature?: number): Promise<{ success: boolean, optimizedPrompt: string }> => {
    const res = await fetch(`${API_BASE}/optimize-judge-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ judgeId, bucket, agentPrompt, provider, model, temperature }),
    });
    if (!res.ok) throw new Error('Failed to generate optimized prompt');
    return res.json();
  },

  optimizeJudgePromptAll: async (projectId: string, judgeId: string, agentPrompt?: string, provider?: string, model?: string, temperature?: number): Promise<{ success: boolean, optimizedPrompt: string }> => {
    const res = await fetch(`${API_BASE}/optimize-judge-prompt/all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, judgeId, agentPrompt, provider, model, temperature }),
    });
    if (!res.ok) throw new Error('Failed to generate optimized prompt');
    return res.json();
  },

  optimizeGlobalPrompt: async (projectId: string, judgeIds: string[], agentPrompt?: string, provider?: string, model?: string, temperature?: number): Promise<{ success: boolean, optimizedPrompt: string }> => {
    const res = await fetch(`${API_BASE}/optimize-global-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, judgeIds, agentPrompt, provider, model, temperature }),
    });
    if (!res.ok) throw new Error('Failed to generate global optimized prompt');
    return res.json();
  },

  generateGlobalSuggestions: async (projectId: string, judgeIds: string[], provider?: string, model?: string, temperature?: number): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_BASE}/generate-global-suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, judgeIds, provider, model, temperature }),
    });
    if (!res.ok) throw new Error('Failed to generate global suggestions');
    return res.json();
  },

  runAnalysisOptimization: async (projectId: string, judgeId: string, provider?: string, model?: string, temperature?: number): Promise<{ success: boolean, buckets: any[] }> => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/analysis-optimizations/${judgeId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, temperature }),
    });
    if (!res.ok) throw new Error('Failed to run analysis optimization');
    return res.json();
  },

  markBucketFixed: async (projectId: string, judgeId: string, bucketIndex: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/optimizations/${judgeId}/buckets/${bucketIndex}/fix`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to mark bucket as fixed');
    return res.json();
  },
};

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface ToolProperty {
  type: string;
  description?: string;
  enum?: string[];
}

interface ToolSchema {
  name?: string;
  description?: string;
  data?: {
    function?: {
      name?: string;
      description?: string;
      parameters?: any;
    }
  };
  parameters?: {
    type: string;
    properties: Record<string, ToolProperty>;
    required?: string[];
  };
  // Some APIs might return schema directly or wrapped
  type?: string;
  properties?: Record<string, ToolProperty>;
  required?: string[];
}

const ProjectTools = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [agentName, setAgentName] = useState('');
  const [toolPrompts, setToolPrompts] = useState<Record<string, string>>({});

  // Fetch Project
  const { data: project, isLoading: isProjectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId!),
    enabled: !!projectId,
  });

  // Fetch Tools
  const { data: toolsData, isLoading: isToolsLoading, refetch: refetchTools } = useQuery({
    queryKey: ['project-tools', projectId, agentName],
    queryFn: () => api.getProjectTools(projectId!, agentName),
    enabled: !!projectId && !!agentName,
    retry: false
  });

  // Initialize state from project
  useEffect(() => {
    if (project) {
      if (project.agent) {
        setAgentName(project.agent);
      }
      if (project.tool_prompts) {
        setToolPrompts(project.tool_prompts);
      }
    }
  }, [project]);

  // Update Project Mutation
  const updateProjectMutation = useMutation({
    mutationFn: (data: { agent?: string; tool_prompts?: Record<string, string> }) => 
      api.updateProject(projectId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Project updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update project: ${error.message}`);
    }
  });

  const handleSaveAgent = () => {
    if (!agentName.trim()) {
      toast.error('Please enter an agent name');
      return;
    }
    updateProjectMutation.mutate({ agent: agentName });
    // Refetch tools will happen automatically due to query key dependency or we can force it
    setTimeout(() => refetchTools(), 100);
  };

  const handleSavePrompt = (toolName: string) => {
    const newPrompts = { ...toolPrompts };
    updateProjectMutation.mutate({ tool_prompts: newPrompts });
  };

  const handlePromptChange = (toolName: string, value: string) => {
    setToolPrompts(prev => ({
      ...prev,
      [toolName]: value
    }));
  };

  // Filter tools
  const relevantTools = ['info_extraction', 'call_outcome'];
  
  // Helper to normalize tool data structure
  const getToolList = (data: any): ToolSchema[] => {
    if (!data) return [];
    // If data is array
    if (Array.isArray(data)) return data;
    // If data has tools property
    if (data.tools && Array.isArray(data.tools)) return data.tools;
    // If data has data property (common in some APIs)
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  };

  const allTools = getToolList(toolsData);
  const filteredTools = allTools.filter(t => {
    const name = t.name || t.data?.function?.name;
    return name && relevantTools.includes(name);
  });

  if (isProjectLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="container mx-auto py-6 max-w-5xl space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/project/${projectId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agent Tools</h1>
          <p className="text-muted-foreground">Configure tools and prompts for {project?.name}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent Configuration</CardTitle>
          <CardDescription>Specify the agent to load tools for.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4 items-end">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <label htmlFor="agent" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Agent Name
            </label>
            <Input 
              id="agent" 
              placeholder="e.g. clickpost_order_confirmation_hi-IN_v4" 
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
            />
          </div>
          <Button onClick={handleSaveAgent} disabled={updateProjectMutation.isPending}>
            {updateProjectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Load Tools
          </Button>
        </CardContent>
      </Card>

      {isToolsLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isToolsLoading && filteredTools.length === 0 && agentName && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
          <p>No relevant tools (info_extraction, call_outcome) found for this agent.</p>
          {toolsData && (
             <div className="mt-4 text-xs text-left bg-muted p-4 rounded overflow-auto max-h-64 max-w-2xl mx-auto">
               <p className="font-bold mb-2">Debug Info (Raw Response Structure):</p>
               <pre>{JSON.stringify(Array.isArray(toolsData) ? 'Array[' + toolsData.length + ']' : Object.keys(toolsData), null, 2)}</pre>
               {!Array.isArray(toolsData) && toolsData.data && (
                 <>
                   <p className="font-bold mt-2 mb-1">toolsData.data type:</p>
                   <pre>{Array.isArray(toolsData.data) ? 'Array[' + toolsData.data.length + ']' : typeof toolsData.data}</pre>
                 </>
               )}
             </div>
          )}
        </div>
      )}

      <div className="grid gap-6">
        {filteredTools.map((tool) => {
          const toolName = tool.name || tool.data?.function?.name;
          if (!toolName) return null;

          // Handle different schema structures (some APIs return parameters inside, some at root)
          const description = tool.description || tool.data?.function?.description;
          const parameters = tool.parameters || tool.data?.function?.parameters || {};
          const properties = parameters.properties || tool.properties || {};
          const required = parameters.required || tool.required || [];

          return (
            <Card key={toolName} className="overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-mono text-lg">{toolName}</CardTitle>
                  <Badge variant="outline">Tool</Badge>
                </div>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                
                {/* Parameters Section */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Parameters</h3>
                  <div className="border rounded-md divide-y">
                    {Object.entries(properties).map(([key, prop]: [string, any]) => (
                      <div key={key} className="p-3 text-sm grid grid-cols-[1fr_2fr] gap-4">
                        <div>
                          <div className="font-mono font-semibold flex items-center gap-2">
                            {key}
                            {required.includes(key) && <span className="text-destructive text-xs">*</span>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">{prop.type}</div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-muted-foreground">{prop.description}</p>
                          {prop.enum && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {prop.enum.map((e: string) => (
                                <Badge key={e} variant="secondary" className="text-xs font-mono">
                                  {e}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prompt Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Tool Prompt</h3>
                    <Button 
                      size="sm" 
                      onClick={() => handleSavePrompt(toolName)}
                      disabled={updateProjectMutation.isPending}
                    >
                      {updateProjectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                      Save Prompt
                    </Button>
                  </div>
                  <Textarea 
                    placeholder={`Enter prompt for ${toolName}...`}
                    className="font-mono text-sm min-h-[150px]"
                    value={toolPrompts[toolName] || ''}
                    onChange={(e) => handlePromptChange(toolName, e.target.value)}
                  />
                </div>

              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectTools;

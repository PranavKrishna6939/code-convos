import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dummyProjects, dummyJudgeAgents } from '@/data/dummyData';
import { Conversation, TurnError } from '@/types/judge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const ProjectDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  const project = dummyProjects.find(p => p.id === projectId);
  const [conversations, setConversations] = useState<Conversation[]>(project?.conversations || []);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(conversations[0]?.id || null);
  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number | null>(null);
  const [selectedJudge, setSelectedJudge] = useState<string>('');

  const selectedConversation = useMemo(() => 
    conversations.find(c => c.id === selectedConvId),
    [conversations, selectedConvId]
  );

  // Get assistant turn indices
  const assistantTurns = useMemo(() => {
    if (!selectedConversation) return [];
    let turnIndex = 0;
    return selectedConversation.messages.map((msg, idx) => {
      if (msg.role === 'assistant') {
        return { messageIndex: idx, turnIndex: turnIndex++ };
      }
      return { messageIndex: idx, turnIndex: -1 };
    });
  }, [selectedConversation]);

  const getAssistantTurnIndex = (messageIndex: number) => {
    return assistantTurns[messageIndex]?.turnIndex ?? -1;
  };

  const getErrorsForTurn = (turnIndex: number): TurnError[] => {
    return selectedConversation?.turn_errors[turnIndex] || [];
  };

  const handleRunJudge = () => {
    if (!selectedJudge || !selectedConvId) return;
    // In production, this would call the LLM API
    console.log(`Running judge ${selectedJudge} on conversation ${selectedConvId}`);
  };

  const updateEditedReason = (turnIndex: number, errorIndex: number, newReason: string) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id !== selectedConvId) return conv;
      const newTurnErrors = { ...conv.turn_errors };
      if (newTurnErrors[turnIndex]) {
        newTurnErrors[turnIndex] = newTurnErrors[turnIndex].map((err, idx) => 
          idx === errorIndex ? { ...err, edited_reason: newReason } : err
        );
      }
      return { ...conv, turn_errors: newTurnErrors };
    }));
  };

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  const currentTurnErrors = selectedTurnIndex !== null 
    ? getErrorsForTurn(selectedTurnIndex) 
    : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-foreground">{project.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedJudge} onValueChange={setSelectedJudge}>
            <SelectTrigger className="w-48 h-8 text-sm">
              <SelectValue placeholder="Select judge..." />
            </SelectTrigger>
            <SelectContent>
              {dummyJudgeAgents.map(judge => (
                <SelectItem key={judge.id} value={judge.id}>
                  {judge.label_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={handleRunJudge} disabled={!selectedJudge}>
            <Play className="w-3 h-3 mr-1" />
            Run
          </Button>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Conversation List */}
        <div className="w-48 border-r border-border overflow-y-auto">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => {
                setSelectedConvId(conv.id);
                setSelectedTurnIndex(null);
              }}
              className={cn(
                "px-3 py-2 border-b border-border cursor-pointer text-sm",
                selectedConvId === conv.id 
                  ? "bg-muted" 
                  : "hover:bg-muted/50"
              )}
            >
              <span className="font-mono text-muted-foreground">{conv.id}</span>
            </div>
          ))}
        </div>

        {/* Center: Conversation View */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedConversation ? (
            <div className="space-y-3 max-w-2xl">
              {selectedConversation.messages.map((msg, idx) => {
                const turnIndex = getAssistantTurnIndex(idx);
                const hasErrors = turnIndex >= 0 && Object.keys(selectedConversation.turn_errors).includes(turnIndex.toString());
                const errors = turnIndex >= 0 ? getErrorsForTurn(turnIndex) : [];
                const isSelected = selectedTurnIndex === turnIndex && turnIndex >= 0;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (msg.role === 'assistant') {
                        setSelectedTurnIndex(turnIndex);
                      }
                    }}
                    className={cn(
                      "p-3 rounded border",
                      msg.role === 'user' 
                        ? "bg-muted/30 border-border ml-0 mr-12" 
                        : hasErrors
                          ? "bg-destructive/10 border-destructive/30 ml-12 mr-0 cursor-pointer"
                          : "bg-card border-border ml-12 mr-0 cursor-pointer",
                      isSelected && "ring-2 ring-primary"
                    )}
                  >
                    <div className="text-xs text-muted-foreground mb-1 font-mono">
                      {msg.role === 'assistant' ? `assistant [turn ${turnIndex}]` : 'user'}
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{msg.content}</p>
                    
                    {/* Error chips */}
                    {errors.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {errors.map((err, errIdx) => (
                          <span 
                            key={errIdx}
                            className="px-2 py-0.5 text-xs font-mono bg-destructive/20 text-destructive rounded"
                          >
                            {err.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              Select a conversation
            </div>
          )}
        </div>

        {/* Right: Error & Judge Panel */}
        <div className="w-80 border-l border-border overflow-y-auto p-4">
          {selectedTurnIndex !== null ? (
            <div className="space-y-6">
              {/* Open Codes Section */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">Open Codes</h3>
                {currentTurnErrors.length > 0 ? (
                  <div className="space-y-3">
                    {currentTurnErrors.map((error, idx) => (
                      <div key={idx} className="space-y-1">
                        <span className="text-xs font-mono text-muted-foreground">{error.label}</span>
                        <Textarea
                          value={error.edited_reason ?? error.original_reason}
                          onChange={(e) => updateEditedReason(selectedTurnIndex, idx, e.target.value)}
                          className="text-sm font-mono min-h-20"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No errors flagged for this turn</p>
                )}
              </div>

              {/* Axial Codes Section */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">Axial Codes (Labels)</h3>
                <div className="space-y-2">
                  {dummyJudgeAgents.map(judge => {
                    const isAssigned = currentTurnErrors.some(e => e.label === judge.label_name);
                    return (
                      <div 
                        key={judge.id}
                        className={cn(
                          "p-2 rounded border text-sm",
                          isAssigned 
                            ? "bg-destructive/10 border-destructive/30" 
                            : "bg-muted/30 border-border"
                        )}
                      >
                        <div className="font-mono text-foreground">{judge.label_name}</div>
                        <div className="text-xs text-muted-foreground">{judge.description}</div>
                        <div className="text-xs mt-1">
                          {isAssigned ? (
                            <span className="text-destructive">Assigned</span>
                          ) : (
                            <span className="text-muted-foreground">Not Assigned</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12 text-sm">
              Click an assistant turn to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;

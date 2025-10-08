import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { dummyProjects } from '@/data/dummyProjects';
import { Conversation } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ArrowLeft, ChevronLeft, ChevronRight, Save, Star, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const LabelingInterface = () => {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const order = searchParams.get('order') || 'sequential';
  const conversationParam = searchParams.get('conversation');
  const { toast } = useToast();

  const project = dummyProjects.find((p) => p.id === projectId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [openCodes, setOpenCodes] = useState('');
  const [selectedAxialCodes, setSelectedAxialCodes] = useState<string[]>([]);
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null);

  useEffect(() => {
    if (project) {
      let sorted = [...project.conversations];
      if (order === 'rating') {
        sorted = sorted.sort((a, b) => a.customer_rating - b.customer_rating);
      }
      setConversations(sorted);
      
      // If a specific conversation is requested, set it as current
      if (conversationParam !== null) {
        const conversationIndex = parseInt(conversationParam, 10);
        if (!isNaN(conversationIndex) && conversationIndex >= 0 && conversationIndex < sorted.length) {
          setCurrentIndex(conversationIndex);
        }
      }
    }
  }, [project, order, conversationParam]);

  // Load existing labels when conversation changes
  useEffect(() => {
    if (conversations.length > 0) {
      const currentConversation = conversations[currentIndex];
      setOpenCodes(currentConversation.open_codes || '');
      setSelectedAxialCodes(currentConversation.axial_codes || []);
      setSelectedMessageIndex(null); // Reset message selection when changing conversations
    }
  }, [currentIndex, conversations]);

  if (!project || conversations.length === 0) {
    return <div>Loading...</div>;
  }

  const currentConversation = conversations[currentIndex];

  const handleSave = () => {
    toast({
      title: 'Labels saved',
      description: 'Your annotations have been saved successfully.',
    });
  };

  const handleNext = () => {
    if (currentIndex < conversations.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedMessageIndex(null);
      // Clear the conversation parameter from URL when navigating
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('conversation');
      window.history.replaceState({}, '', `${window.location.pathname}?${newSearchParams.toString()}`);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setSelectedMessageIndex(null);
      // Clear the conversation parameter from URL when navigating
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('conversation');
      window.history.replaceState({}, '', `${window.location.pathname}?${newSearchParams.toString()}`);
    }
  };

  const toggleAxialCode = (codeName: string) => {
    setSelectedAxialCodes((prev) =>
      prev.includes(codeName) ? prev.filter((c) => c !== codeName) : [...prev, codeName]
    );
  };

  const getMessageBackgroundStyle = (messageIndex: number) => {
    const message = currentConversation.messages[messageIndex];
    if (message.role !== 'llm') return {};

    // Check if this message has any axial codes assigned
    const hasLabels = currentConversation.axial_codes && currentConversation.axial_codes.length > 0;
    if (!hasLabels) return {};

    // Get the primary color from the first assigned axial code
    const primaryCode = currentConversation.axial_codes?.[0];
    const codeColor = project.axial_codes?.find(code => code.name === primaryCode)?.color;
    
    if (codeColor) {
      return {
        backgroundColor: `${codeColor}10`, // Very light tint
        borderColor: `${codeColor}30`, // Slightly more visible border
      };
    }
    
    return {};
  };

  const hasAIAssignedLabels = (messageIndex: number) => {
    const message = currentConversation.messages[messageIndex];
    if (message.role !== 'llm') return false;

    return currentConversation.ai_assigned_codes && currentConversation.ai_assigned_codes.length > 0;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to={`/project/${projectId}`}>
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-lg font-semibold">{project.project_name}</h1>
                <p className="text-sm text-muted-foreground">
                  Conversation {currentIndex + 1} of {conversations.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrevious} disabled={currentIndex === 0}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[100px] text-center">
                {currentIndex + 1} / {conversations.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={currentIndex === conversations.length - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            <Card className="p-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Customer Rating:</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-warning text-warning" />
                    <span className="font-semibold">{currentConversation.customer_rating}/5</span>
                  </div>
                </div>
                <Badge variant={currentConversation.status === 'completed' ? 'success' : 'secondary'}>
                  {currentConversation.status === 'completed' ? 'Completed' : 'Not Labeled'}
                </Badge>
              </div>
            </Card>

            {currentConversation.messages.map((message, idx) => {
              const backgroundStyle = getMessageBackgroundStyle(idx);
              const isAILabeled = hasAIAssignedLabels(idx);
              
              return (
                <Card
                  key={idx}
                  className={`p-4 cursor-pointer transition-all ${
                    message.role === 'llm'
                      ? 'hover:border-primary/50 hover:shadow-md'
                      : 'cursor-default'
                  } ${selectedMessageIndex === idx ? 'border-primary shadow-md' : ''}`}
                  style={backgroundStyle}
                  onClick={() => message.role === 'llm' && setSelectedMessageIndex(idx)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={message.role === 'customer' ? 'info' : 'secondary'}>
                        {message.role === 'customer' ? 'Customer' : 'LLM'}
                      </Badge>
                      {isAILabeled && (
                        <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          <Bot className="w-3 h-3" />
                          <span>AI Labeled</span>
                        </div>
                      )}
                    </div>
                    <p className="flex-1 text-sm leading-relaxed">{message.text}</p>
                  </div>
                  {message.role === 'llm' && currentConversation.axial_codes && currentConversation.axial_codes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3 pt-2 border-t border-border/50">
                      {currentConversation.axial_codes.map((codeName, codeIdx) => {
                        const code = project.axial_codes?.find((c) => c.name === codeName);
                        const isAIAssigned = currentConversation.ai_assigned_codes?.includes(codeName);
                        
                        return (
                          <div key={codeIdx} className="flex items-center gap-1">
                            <span
                              className="px-2 py-1 rounded text-xs font-medium"
                              style={{
                                backgroundColor: code ? `${code.color}20` : '#e5e7eb',
                                color: code?.color || '#6b7280',
                              }}
                            >
                              {codeName}
                            </span>
                            {isAIAssigned && (
                              <Bot className="w-3 h-3 text-blue-600" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </main>

        {selectedMessageIndex !== null && (
          <aside className="w-96 border-l border-border bg-card overflow-y-auto">
            <div className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Labeling Response</h3>
                <p className="text-sm text-muted-foreground">
                  Message {selectedMessageIndex + 1} selected
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Open Codes</label>
                <Textarea
                  placeholder="Enter your qualitative observations about this response..."
                  value={openCodes}
                  onChange={(e) => setOpenCodes(e.target.value)}
                  className="min-h-[150px]"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Free-text notes for qualitative analysis
                </p>
              </div>

              {project.axial_codes && project.axial_codes.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Axial Codes</label>
                  <div className="space-y-2">
                    {project.axial_codes.map((code) => {
                      const isCurrentlyAssigned = currentConversation.axial_codes?.includes(code.name);
                      const isAIAssigned = currentConversation.ai_assigned_codes?.includes(code.name);
                      
                      return (
                        <div
                          key={code.id}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedAxialCodes.includes(code.name)
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          } ${isCurrentlyAssigned ? 'bg-green-50 border-green-200' : ''}`}
                          onClick={() => toggleAxialCode(code.name)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: code.color }}
                              />
                              <span className="font-medium text-sm">{code.name}</span>
                            </div>
                            {isCurrentlyAssigned && (
                              <div className="flex items-center gap-1">
                                {isAIAssigned && (
                                  <div className="flex items-center gap-1 text-xs text-blue-600">
                                    <Bot className="w-3 h-3" />
                                    <span>AI</span>
                                  </div>
                                )}
                                <span className="text-xs text-green-600 font-medium">
                                  Assigned
                                </span>
                              </div>
                            )}
                          </div>
                          {code.description && (
                            <p className="text-xs text-muted-foreground mt-1 ml-5">
                              {code.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Select one or more categories
                  </p>
                </div>
              )}

              <div className="space-y-2 pt-4 border-t border-border">
                <Button className="w-full" onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Labels
                </Button>
                <Button variant="outline" className="w-full" onClick={handleNext}>
                  Next Conversation
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default LabelingInterface;

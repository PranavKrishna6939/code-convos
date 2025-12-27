// Judge Agent types
export interface JudgeAgent {
  id: string;
  label_name: string;
  description: string;
  prompt: string;
  model?: string;
  temperature?: number;
  provider?: string;
  judge_type?: 'single' | 'multi'; // single-label or multi-label judge
  category?: 'conversation' | 'analysis'; // conversation judge or analysis judge
  labels_schema?: Record<string, { type: string; description: string; enum?: string[] }>; // for multi-label judges
}

export interface JudgeResult {
  label: string;
  error_detected: boolean;
  error_turns: {
    turn_index: number;
    reason: string;
  }[];
}

export interface TurnError {
  label: string;
  original_reason: string;
  edited_reason?: string;
}

// Conversation types from API
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Conversation {
  id: string;
  messages: ConversationMessage[];
  outcome?: string;
  results?: any;
  turn_errors: Record<number, TurnError[]>; // turn_index -> errors
  manual_labels?: Record<number, string[]>; // turn_index -> manual labels
  manually_labelled?: boolean; // flag to indicate if conversation has been manually labelled
  analysis_verification?: Record<string, any>; // judgeId -> result
  analysis?: any; // Analysis output
}

export interface OptimizationExample {
  conversationId: string;
  turnIndex: number;
  reason: string;
  suggestion: string;
  context?: {
    user_before: string;
    assistant: string;
    user_after: string;
  };
}

export interface OptimizationBucket {
  title: string;
  description: string;
  examples: OptimizationExample[];
  fixed?: boolean;
}

export interface OptimizationResult {
  timestamp: number;
  buckets: OptimizationBucket[];
}

export interface Project {
  id: string;
  name: string;
  conversations: Conversation[];
  api_key: string;
  conversationCount?: number;
  optimizations?: Record<string, OptimizationResult>; // judgeId -> result
  agentPrompt?: string;
  agent?: string;
  tool_prompts?: Record<string, string>;
}

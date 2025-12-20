// Judge Agent types
export interface JudgeAgent {
  id: string;
  label_name: string;
  description: string;
  prompt: string;
  model?: string;
  temperature?: number;
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
  turn_errors: Record<number, TurnError[]>; // turn_index -> errors
  manual_labels?: Record<number, string[]>; // turn_index -> manual labels
  manually_labelled?: boolean; // flag to indicate if conversation has been manually labelled
}

export interface Project {
  id: string;
  name: string;
  conversations: Conversation[];
  api_key: string;
  conversationCount?: number;
}

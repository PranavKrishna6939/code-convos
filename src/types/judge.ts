// Judge Agent types
export interface JudgeAgent {
  id: string;
  label_name: string;
  description: string;
  prompt: string;
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
  turn_errors: Record<number, TurnError[]>; // turn_index -> errors
}

export interface Project {
  id: string;
  name: string;
  conversations: Conversation[];
  api_key: string;
}

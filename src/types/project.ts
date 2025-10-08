export interface Message {
  role: 'customer' | 'llm';
  text: string;
}

export interface Conversation {
  conversation_id: number;
  messages: Message[];
  customer_rating: number;
  status?: 'not_labeled' | 'in_progress' | 'completed';
  open_codes?: string;
  axial_codes?: string[];
  ai_assigned_codes?: string[]; // Codes that were assigned by AI/LLM
}

export interface AxialCode {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface Project {
  id: string;
  project_name: string;
  conversations: Conversation[];
  axial_codes?: AxialCode[];
  date_imported: string;
  labeled_count: number;
}

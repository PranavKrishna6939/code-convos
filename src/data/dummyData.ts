import { Project, JudgeAgent, Conversation } from '@/types/judge';

export const dummyJudgeAgents: JudgeAgent[] = [
  {
    id: '1',
    label_name: 'context_loss',
    description: 'Detects when the assistant loses track of conversation context',
    prompt: `You are an evaluation judge. Analyze the conversation and determine if the assistant lost context at any point.

For each assistant turn, check if:
- The assistant forgot previously mentioned information
- The assistant contradicted earlier statements
- The assistant asked for information already provided

Return your analysis in the specified JSON format.`
  },
  {
    id: '2',
    label_name: 'hallucination',
    description: 'Detects when the assistant makes up facts or information',
    prompt: `You are an evaluation judge. Analyze the conversation and determine if the assistant hallucinated information.

For each assistant turn, check if:
- The assistant stated facts not grounded in the conversation
- The assistant made up details that weren't provided
- The assistant claimed capabilities or knowledge it shouldn't have

Return your analysis in the specified JSON format.`
  },
  {
    id: '3',
    label_name: 'wrong_language',
    description: 'Detects when the assistant responds in the wrong language',
    prompt: `You are an evaluation judge. Analyze the conversation and determine if the assistant responded in the wrong language.

For each assistant turn, check if:
- The assistant switched to a different language unexpectedly
- The assistant used inappropriate language mixing

Return your analysis in the specified JSON format.`
  }
];

export const dummyConversations: Conversation[] = [
  {
    id: 'conv-001',
    messages: [
      { role: 'user', content: 'Hi, I need help with my order #12345' },
      { role: 'assistant', content: 'Hello! I\'d be happy to help you with order #12345. Could you please tell me what issue you\'re experiencing?' },
      { role: 'user', content: 'It hasn\'t arrived yet. I ordered it 2 weeks ago.' },
      { role: 'assistant', content: 'I understand your concern. Let me check the status of your order. According to our records, order #12345 was shipped on the 5th and should arrive within 3-5 business days.' },
      { role: 'user', content: 'But you just said it\'s been 2 weeks!' },
      { role: 'assistant', content: 'You\'re right, I apologize for the confusion. If it\'s been 2 weeks since you placed the order, there may be a delay. Let me escalate this to our shipping department for investigation.' }
    ],
    turn_errors: {
      1: [
        {
          label: 'context_loss',
          original_reason: 'The assistant acknowledged the 2-week timeframe but then stated the order should arrive in 3-5 days, ignoring the elapsed time.'
        }
      ]
    }
  },
  {
    id: 'conv-002',
    messages: [
      { role: 'user', content: 'What\'s the weather like in Paris today?' },
      { role: 'assistant', content: 'Currently in Paris, it\'s 22°C with partly cloudy skies. There\'s a 30% chance of rain this afternoon.' },
      { role: 'user', content: 'Thanks! And what about tomorrow?' },
      { role: 'assistant', content: 'Tomorrow in Paris, expect temperatures around 24°C with sunny skies throughout the day. Perfect weather for sightseeing!' }
    ],
    turn_errors: {
      0: [
        {
          label: 'hallucination',
          original_reason: 'The assistant provided specific weather data (22°C, 30% rain chance) without access to real-time weather information.'
        }
      ],
      1: [
        {
          label: 'hallucination',
          original_reason: 'The assistant continued to provide fabricated weather forecasts for the next day.'
        }
      ]
    }
  },
  {
    id: 'conv-003',
    messages: [
      { role: 'user', content: 'Can you explain how photosynthesis works?' },
      { role: 'assistant', content: 'Photosynthesis is the process by which plants convert sunlight into energy. Here\'s how it works:\n\n1. Light absorption: Chlorophyll in leaves absorbs sunlight\n2. Water splitting: Water molecules are split into hydrogen and oxygen\n3. Carbon fixation: CO2 is converted into glucose\n4. Energy storage: Glucose is stored for the plant\'s energy needs' },
      { role: 'user', content: 'That\'s helpful, thanks!' },
      { role: 'assistant', content: 'You\'re welcome! If you have any more questions about biology or any other topic, feel free to ask.' }
    ],
    turn_errors: {}
  },
  {
    id: 'conv-004',
    messages: [
      { role: 'user', content: 'Hola, necesito ayuda con mi cuenta' },
      { role: 'assistant', content: 'Hello! I\'d be happy to help you with your account. What seems to be the issue?' },
      { role: 'user', content: 'No hablo inglés muy bien. ¿Puedes hablar en español?' },
      { role: 'assistant', content: 'Of course! I can help you in English. Please describe your account problem and I\'ll do my best to assist.' }
    ],
    turn_errors: {
      1: [
        {
          label: 'wrong_language',
          original_reason: 'User explicitly requested Spanish but the assistant continued responding in English, ignoring the language preference.'
        }
      ]
    }
  },
  {
    id: 'conv-005',
    messages: [
      { role: 'user', content: 'I want to cancel my subscription' },
      { role: 'assistant', content: 'I can help you cancel your subscription. Before I proceed, may I ask why you\'re considering cancellation? We might be able to address any concerns.' },
      { role: 'user', content: 'It\'s too expensive for me right now' },
      { role: 'assistant', content: 'I understand budget constraints can be challenging. We do have a discounted plan at $9.99/month that includes core features. Would you like to hear more about it?' },
      { role: 'user', content: 'No, just cancel please' },
      { role: 'assistant', content: 'I\'ve processed your cancellation request. Your subscription will remain active until the end of your current billing period. Is there anything else I can help you with?' }
    ],
    turn_errors: {}
  }
];

export const dummyProjects: Project[] = [
  {
    id: '1',
    name: 'Customer Support Calls - Q4',
    conversations: dummyConversations,
    api_key: 'hm_test_key_123'
  },
  {
    id: '2',
    name: 'Sales Outbound - November',
    conversations: dummyConversations.slice(0, 3),
    api_key: 'hm_test_key_456'
  }
];

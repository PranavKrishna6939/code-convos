import { Project } from '@/types/project';

export const dummyProjects: Project[] = [
  {
    id: '1',
    project_name: 'Customer Support Q1 2024',
    date_imported: '2024-03-15',
    labeled_count: 12,
    axial_codes: [
      { id: '1', name: 'Reasoning Error', color: '#ef4444', description: 'LLM made logical mistakes' },
      { id: '2', name: 'Hallucination', color: '#f97316', description: 'Fabricated information' },
      { id: '3', name: 'Irrelevant Response', color: '#eab308', description: 'Off-topic or unhelpful' },
      { id: '4', name: 'Good Response', color: '#22c55e', description: 'Appropriate and helpful' },
    ],
    conversations: [
      {
        conversation_id: 1,
        customer_rating: 2,
        status: 'completed',
        open_codes: 'LLM ignored context about previous order. Failed to acknowledge customer frustration.',
        axial_codes: ['Reasoning Error', 'Irrelevant Response'],
        messages: [
          { role: 'customer', text: 'I ordered a laptop 2 weeks ago and it still hasn\'t arrived. This is unacceptable!' },
          { role: 'llm', text: 'I\'d be happy to help you place a new order for a laptop. What specifications are you looking for?' },
          { role: 'customer', text: 'No! I already ordered one. I need to know where it is!' },
          { role: 'llm', text: 'Our laptops come with a 1-year warranty and free shipping on orders over $500.' },
        ],
      },
      {
        conversation_id: 2,
        customer_rating: 4,
        status: 'completed',
        open_codes: 'Good empathy, provided clear solution steps.',
        axial_codes: ['Good Response'],
        messages: [
          { role: 'customer', text: 'My password reset email isn\'t coming through.' },
          { role: 'llm', text: 'I understand how frustrating that must be. Let me help you with that. First, please check your spam folder. If it\'s not there, I can send it to a different email address or reset it manually for you.' },
          { role: 'customer', text: 'Found it in spam, thank you!' },
          { role: 'llm', text: 'Great! For future reference, you may want to add our email to your contacts to avoid this. Is there anything else I can help you with?' },
        ],
      },
      {
        conversation_id: 3,
        customer_rating: 1,
        status: 'in_progress',
        open_codes: 'Potential hallucination about refund policy.',
        axial_codes: ['Hallucination'],
        messages: [
          { role: 'customer', text: 'What\'s your refund policy?' },
          { role: 'llm', text: 'We offer a 90-day money-back guarantee on all products, no questions asked. You can return items for a full refund including original shipping costs.' },
          { role: 'customer', text: 'That\'s not what your website says. It says 30 days and no shipping refund.' },
          { role: 'llm', text: 'You\'re absolutely right, I apologize for the confusion. Our policy is 30 days for returns, and original shipping costs are not refunded.' },
        ],
      },
      {
        conversation_id: 4,
        customer_rating: 3,
        status: 'not_labeled',
        messages: [
          { role: 'customer', text: 'Can I upgrade my subscription to the premium plan?' },
          { role: 'llm', text: 'Yes, you can upgrade anytime. The premium plan includes unlimited storage, priority support, and advanced analytics.' },
          { role: 'customer', text: 'How much does it cost?' },
          { role: 'llm', text: 'Let me check that for you...' },
        ],
      },
      {
        conversation_id: 5,
        customer_rating: 5,
        status: 'not_labeled',
        messages: [
          { role: 'customer', text: 'Just wanted to say your service is amazing!' },
          { role: 'llm', text: 'Thank you so much for the kind words! We\'re thrilled to hear you\'re happy with our service. If you ever need anything, we\'re here to help 24/7.' },
        ],
      },
    ],
  },
  {
    id: '2',
    project_name: 'Product Inquiry Analysis',
    date_imported: '2024-03-10',
    labeled_count: 0,
    conversations: [
      {
        conversation_id: 6,
        customer_rating: 3,
        status: 'not_labeled',
        messages: [
          { role: 'customer', text: 'Do you have this item in blue?' },
          { role: 'llm', text: 'Let me check our inventory for you.' },
        ],
      },
      {
        conversation_id: 7,
        customer_rating: 2,
        status: 'not_labeled',
        messages: [
          { role: 'customer', text: 'The product description is confusing. Can you clarify?' },
          { role: 'llm', text: 'I\'d be happy to clarify. Which specific aspect are you curious about?' },
          { role: 'customer', text: 'The dimensions and weight.' },
          { role: 'llm', text: 'The product weighs approximately 2.5 pounds.' },
        ],
      },
    ],
  },
  {
    id: '3',
    project_name: 'Technical Support Eval',
    date_imported: '2024-03-01',
    labeled_count: 8,
    axial_codes: [
      { id: '5', name: 'Technical Accuracy', color: '#3b82f6', description: 'Correct technical information' },
      { id: '6', name: 'Missing Steps', color: '#ec4899', description: 'Incomplete instructions' },
    ],
    conversations: [
      {
        conversation_id: 8,
        customer_rating: 4,
        status: 'completed',
        open_codes: 'Clear step-by-step guidance.',
        axial_codes: ['Technical Accuracy'],
        messages: [
          { role: 'customer', text: 'How do I configure my router?' },
          { role: 'llm', text: 'I\'ll guide you through the setup. First, connect the router to your modem using an ethernet cable. Then, plug in the power adapter.' },
        ],
      },
    ],
  },
];

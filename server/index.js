const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = 4001;

app.use(cors());
app.use(bodyParser.json());

const DB_FILE = path.join(__dirname, 'db.json');

// Initialize DB
let db = {
  projects: [],
  judges: []
};

if (fs.existsSync(DB_FILE)) {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    db = JSON.parse(data);
  } catch (err) {
    console.error('Error reading DB file:', err);
  }
} else {
  saveDb();
}

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const META_PROMPTS_FILE = path.join(__dirname, 'meta_prompts.json');

const DEFAULT_META_PROMPTS = {
  bucketing: `You are an expert prompt engineer and data analyst.
Your task is to analyze a set of errors detected by an LLM judge and categorize them into 2-3 distinct "buckets" or categories based on the root cause or type of failure.

Judge Information:
Name: \${judge.label_name}
Description: \${judge.description}
Prompt: \${judge.prompt}

I will provide a list of errors. Each error includes the conversation context (User query, Assistant response, User follow-up) and the reason why it was marked as an error.

CRITICAL INSTRUCTIONS:
1. You must strictly use the 'reason' field provided in the input for each example. Do not paraphrase, invent, or hallucinate new reasons.
2. Do not combine multiple distinct errors into a single example unless they are identical.
3. Ensure that the 'conversationId' and 'turnIndex' in your output exactly match the input.

For each bucket, you must provide:
1. Title: A short, descriptive title for the category.
2. Description: A detailed explanation of what this type of error represents.
3. Examples: Select 1-2 representative examples from the provided list. For each example, provide:
    - The original error reason (verbatim from input).

Use the provided tool to submit your analysis.`,
  suggestions: `You are an expert prompt engineer and compliance officer.
Your task is to generate "Corrected Responses" for a set of error examples.

CRITICAL INSTRUCTIONS:
1. The corrected response must satisfy the rules and guidelines of ALL the following judges simultaneously.
2. The corrected response must specifically resolve the error described in the "reason" field of the example.
3. If there is a conflict between judges, prioritize the most restrictive rule, but aim to satisfy both.
4. The response must be natural and conversational while strictly adhering to the constraints.
5. OUTPUT COMPLETENESS: You must generate a suggestion for EVERY single example provided in the input JSON. Do not skip any examples. If a bucket has 3 examples, you must return 3 suggestions for that bucket.

Judges Information:
\${judgesInfo}

I will provide a list of error buckets with examples. Each example includes the conversation context and the original error reason.

For each example in the buckets, provide a "suggestion" (Corrected Response).
The suggestion must:
- Fix the specific error identified in the example.
- Strictly adhere to ALL rules from ALL provided judges.
- Be a complete, valid response that could replace the original assistant response.
- NOT explain the correction, just provide the corrected response text.

Use the provided tool to submit the updated buckets with suggestions.`,
  optimization: `You are an expert prompt engineer.
Your task is to optimize a system prompt to address specific failure cases while preserving the original behavior for correct cases.

I will provide:
1. The Current System Prompt.
2. A list of "Trajectories" (Conversation History + Feedback).

Each trajectory represents a case where the current prompt failed. The feedback explains the error and provides a suggestion.

Your Goal:
Rewrite the system prompt to fix the errors described in the feedback.

Guidelines:
- The new prompt must be clear, concise, and instruction-following.
- Do NOT remove existing instructions unless they directly conflict with the fix.
- Integrate the new rules naturally into the prompt structure.
- If the current prompt uses variable placeholders like \${variable}, you MUST preserve them exactly.
- IMPORTANT: The system prompt may contain multiple sections separated by headers (e.g. ### TITLE: ...). You must PRESERVE these headers and the overall structure. Only modify the content within the sections to address the errors.

Output ONLY the optimized system prompt text. Do not include explanations or markdown formatting.`
};

let metaPrompts = { ...DEFAULT_META_PROMPTS };

function loadMetaPrompts() {
  if (fs.existsSync(META_PROMPTS_FILE)) {
    try {
      const data = fs.readFileSync(META_PROMPTS_FILE, 'utf8');
      const loaded = JSON.parse(data);
      metaPrompts = { ...DEFAULT_META_PROMPTS, ...loaded };
    } catch (err) {
      console.error('Error reading Meta Prompts file:', err);
    }
  } else {
    saveMetaPrompts();
  }
}

function saveMetaPrompts() {
  fs.writeFileSync(META_PROMPTS_FILE, JSON.stringify(metaPrompts, null, 2));
}

loadMetaPrompts();

// --- Routes ---

// Meta Prompts
app.get('/api/meta-prompts', (req, res) => {
  res.json(metaPrompts);
});

app.post('/api/meta-prompts', (req, res) => {
  const { bucketing, suggestions, optimization } = req.body;
  if (bucketing) metaPrompts.bucketing = bucketing;
  if (suggestions) metaPrompts.suggestions = suggestions;
  if (optimization) metaPrompts.optimization = optimization;
  saveMetaPrompts();
  res.json({ success: true });
});

// Projects
app.get('/api/projects', (req, res) => {
  const projectList = db.projects.map(p => ({
    id: p.id,
    name: p.name,
    conversationCount: p.conversations.length
  }));
  res.json(projectList);
});

app.get('/api/projects/:id', (req, res) => {
  const project = db.projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

app.get('/api/projects/:id/tools', async (req, res) => {
  const project = db.projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (!project.api_key) {
    return res.status(400).json({ error: 'Project does not have an API key' });
  }

  const { agent } = req.query;
  const agentToUse = agent || project.agent;

  try {
    let url = 'https://api.hoomanlabs.com/routes/v1/tools/';
    if (agentToUse) {
      url += `?agent=${encodeURIComponent(agentToUse)}`;
    }

    const response = await axios.get(url, {
      headers: {
        'Authorization': project.api_key
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching tools:', error.message);
    res.status(500).json({ error: 'Failed to fetch tools', details: error.message });
  }
});

app.put('/api/projects/:id', (req, res) => {
  const idx = db.projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Project not found' });

  const { agent, tool_prompts } = req.body;
  
  if (agent !== undefined) db.projects[idx].agent = agent;
  if (tool_prompts !== undefined) db.projects[idx].tool_prompts = tool_prompts;

  saveDb();
  res.json(db.projects[idx]);
});

app.post('/api/projects', async (req, res) => {
  const { apiKey, name, limit, outcomes, agent } = req.body;

  if (!apiKey || !name || !limit) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    console.log(`Fetching ${limit} conversations...`);
    let url = `https://api.hoomanlabs.com/routes/v1/conversations/?limit=${limit}`;
    
    if (outcomes && Array.isArray(outcomes) && outcomes.length > 0) {
      const outcomeQuery = outcomes.map(o => `outcome=${encodeURIComponent(o)}`).join('&');
      url += `&${outcomeQuery}`;
    }

    if (agent) {
      url += `&agent=${encodeURIComponent(agent)}`;
    }
    
    console.log('API URL:', url);

    const response = await axios.get(url, {
      headers: {
        'Authorization': apiKey
      }
    });

    console.log('API Response Status:', response.status);
    console.log('API Response Data Type:', typeof response.data);
    
    if (response.data) {
        try {
            const preview = JSON.stringify(response.data).substring(0, 200);
            console.log('API Response Preview:', preview);
        } catch (e) {
            console.log('Could not stringify response data');
        }
    }

    let rawConversations = [];
    
    if (Array.isArray(response.data)) {
        console.log('Format: Root Array');
        rawConversations = response.data;
    } else if (typeof response.data === 'object') {
        const keys = Object.keys(response.data);
        console.log('Format: Object with keys:', keys);

        if (Array.isArray(response.data.data)) {
            console.log('Format: .data Array');
            rawConversations = response.data.data;
        } else if (Array.isArray(response.data.conversations)) {
            console.log('Format: .conversations Array');
            rawConversations = response.data.conversations;
        } else if (Array.isArray(response.data.items)) {
            console.log('Format: .items Array');
            rawConversations = response.data.items;
        } else if (Array.isArray(response.data.results)) {
            console.log('Format: .results Array');
            rawConversations = response.data.results;
        } else {
            console.log('No standard array property found. Searching all keys...');
            // Fallback: Search for any array in the object
            for (const key of keys) {
                if (Array.isArray(response.data[key])) {
                    console.log(`Found array in key: '${key}' with length ${response.data[key].length}`);
                    rawConversations = response.data[key];
                    break;
                }
            }
            
            if (rawConversations.length === 0 && response.data.data) {
                console.log('response.data.data exists but was not accepted.');
                console.log('Type:', typeof response.data.data);
                console.log('Is Array?', Array.isArray(response.data.data));
                console.log('Value preview:', JSON.stringify(response.data.data).substring(0, 100));
            }
        }
    }

    console.log(`Found ${rawConversations.length} conversations`);
    
    const conversations = rawConversations.map((c, idx) => {
      let messages = [];

      // Priority 1: llmHistory
      if (c.llmHistory && Array.isArray(c.llmHistory)) {
        messages = c.llmHistory
          .filter(m => m.role === 'user' || m.role === 'assistant') // Filter out tool-call/tool-response
          .map(m => ({
            role: m.role,
            content: m.content || (m.args ? JSON.stringify(m.args) : '') // Handle tool calls
          }));
      } 
      // Priority 2: messages
      else if (c.messages && Array.isArray(c.messages)) {
        messages = c.messages;
      }
      // Priority 3: transactions (Fallback)
      else if (c.transactions && Array.isArray(c.transactions)) {
        messages = c.transactions.flatMap(t => {
          const msgs = [];
          if (t.query) {
            msgs.push({ role: 'user', content: t.query });
          }
          if (t.response) {
            msgs.push({ role: 'assistant', content: t.response });
          }
          // Fallback for other transaction types
          if (msgs.length === 0) {
             if (t.role && t.content) {
               msgs.push({ role: t.role, content: t.content });
             } else if (t.type === 'agent' && t.text) {
               msgs.push({ role: 'assistant', content: t.text });
             } else if (t.type === 'user' && t.text) {
               msgs.push({ role: 'user', content: t.text });
             }
          }
          return msgs;
        });
      }

      return {
        id: c.id || `conv-${Date.now()}-${idx}`,
        messages: messages,
        outcome: c.outcome || (c.callInfo && c.callInfo.endReason) || 'unknown',
        results: c.results || c.analysis?.results || {},
        turn_errors: {}, // Initialize empty errors
        raw_data: c
      };
    });

    const newProject = {
      id: Date.now().toString(),
      name,
      api_key: apiKey, // Storing API key might be needed for future calls?
      agent: agent || null,
      tool_prompts: {},
      conversations
    };

    db.projects.push(newProject);
    saveDb();

    res.json(newProject);
  } catch (error) {
    console.error('Import error:', error.message);
    // For MVP, if fetch fails, maybe we can just create a project with dummy data if the API key is "dummy"?
    // Or just return error.
    res.status(500).json({ error: 'Failed to fetch conversations', details: error.message });
  }
});

app.delete('/api/projects/:id', (req, res) => {
  const idx = db.projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Project not found' });
  
  db.projects.splice(idx, 1);
  saveDb();
  res.json({ success: true });
});

// Update Project (e.g. for agentPrompt)
app.put('/api/projects/:id', (req, res) => {
  const project = db.projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { agentPrompt } = req.body;
  
  if (agentPrompt !== undefined) {
    project.agentPrompt = agentPrompt;
  }

  saveDb();
  res.json(project);
});

// Duplicate Project
app.post('/api/projects/:id/duplicate', (req, res) => {
  const project = db.projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Create new project with conversations, reset LLM labels but keep manual labels
  const duplicatedConversations = project.conversations.map(conv => ({
    ...conv,
    turn_errors: {}, // Reset LLM labels
    manual_labels: conv.manual_labels ? { ...conv.manual_labels } : undefined, // Copy manual labels
    manually_labelled: conv.manually_labelled || false
  }));

  const newProject = {
    id: Date.now().toString(),
    name: `${project.name} (Copy)`,
    api_key: project.api_key,
    conversations: duplicatedConversations
  };

  db.projects.push(newProject);
  saveDb();
  res.json(newProject);
});

// Delete all labels in a project
app.delete('/api/projects/:id/labels', (req, res) => {
  const project = db.projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Reset turn_errors for all conversations
  project.conversations.forEach(conv => {
    conv.turn_errors = {};
    conv.analysis_verification = {};
  });

  saveDb();
  res.json({ success: true, message: 'All labels deleted' });
});

// Delete individual label from a specific turn
app.delete('/api/projects/:projectId/conversations/:convId/turns/:turnIndex/labels/:label', (req, res) => {
  const { projectId, convId, turnIndex, label } = req.params;

  const project = db.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const conversation = project.conversations.find(c => c.id === convId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const turn = parseInt(turnIndex);
  if (conversation.turn_errors[turn]) {
    const errorIdx = conversation.turn_errors[turn].findIndex(e => e.label === label);
    if (errorIdx >= 0) {
      conversation.turn_errors[turn].splice(errorIdx, 1);
      
      // Clean up empty turn_errors
      if (conversation.turn_errors[turn].length === 0) {
        delete conversation.turn_errors[turn];
      }
    }
  }

  saveDb();
  res.json({ success: true, message: 'Label deleted' });
});

// Judges
app.get('/api/judges', (req, res) => {
  res.json(db.judges);
});

app.get('/api/judges/:id', (req, res) => {
  const judge = db.judges.find(j => j.id === req.params.id);
  if (!judge) return res.status(404).json({ error: 'Judge not found' });
  res.json(judge);
});

app.post('/api/judges', (req, res) => {
  const { label_name, description, prompt, model, temperature, provider, judge_type, labels_schema, category } = req.body;
  const newJudge = {
    id: Date.now().toString(),
    label_name,
    description,
    prompt,
    model: model || 'gpt-4.1-mini',
    temperature: temperature !== undefined ? temperature : 0.5,
    provider: provider || 'openai',
    judge_type: judge_type || 'single',
    category: category || 'conversation',
    labels_schema: labels_schema || undefined
  };
  db.judges.push(newJudge);
  saveDb();
  res.json(newJudge);
});

app.put('/api/judges/:id', (req, res) => {
  const { label_name, description, prompt, model, temperature, provider, judge_type, labels_schema, category } = req.body;
  const idx = db.judges.findIndex(j => j.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Judge not found' });

  db.judges[idx] = { 
    ...db.judges[idx], 
    label_name, 
    description, 
    prompt,
    model: model || db.judges[idx].model || 'gpt-4.1-mini',
    temperature: temperature !== undefined ? temperature : (db.judges[idx].temperature !== undefined ? db.judges[idx].temperature : 0.5),
    provider: provider || db.judges[idx].provider || 'openai',
    judge_type: judge_type || db.judges[idx].judge_type || 'single',
    category: category || db.judges[idx].category || 'conversation',
    labels_schema: labels_schema !== undefined ? labels_schema : db.judges[idx].labels_schema
  };
  saveDb();
  res.json(db.judges[idx]);
});

app.delete('/api/judges/:id', (req, res) => {
  const idx = db.judges.findIndex(j => j.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Judge not found' });
  
  db.judges.splice(idx, 1);
  saveDb();
  res.json({ success: true });
});

// Run Judge
app.post('/api/run-judge', async (req, res) => {
  const { projectId, conversationId, judgeId, progress } = req.body;
  
  const project = db.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const conversation = project.conversations.find(c => c.id === conversationId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const judge = db.judges.find(j => j.id === judgeId);
  if (!judge) return res.status(404).json({ error: 'Judge not found' });

  try {
    if (progress) {
        console.log(`Processing ${progress.current}/${progress.total} - ConvID: ${conversationId}`);
    } else {
        console.log(`Processing single conversation - ConvID: ${conversationId}`);
    }

    // Prepare payload for LLM
    // The user wants to wrap the conversation in a single user message with JSON stringified content
    // And use specific config
    
    // Filter out the default "Introduce yourself" message if present at the start
    let messagesToProcess = conversation.messages;
    if (messagesToProcess.length > 0 && messagesToProcess[0].role === 'user' && messagesToProcess[0].content.includes('Introduce yourself')) {
        messagesToProcess = messagesToProcess.slice(1);
    }

    let assistantTurnCounter = 0;
    const formattedHistory = messagesToProcess.map(m => {
        if (m.role === 'assistant') {
            const msg = { role: m.role, content: `[TURN ${assistantTurnCounter}] ${m.content}` };
            assistantTurnCounter++;
            return msg;
        }
        return { role: m.role, content: m.content };
    });

    // Build tool schema based on judge type
    let tool;
    if (judge.judge_type === 'multi' && judge.labels_schema) {
      // Multi-label judge: each label is a top-level property
      const properties = {};
      const required = [];
      
      for (const [labelKey, labelDef] of Object.entries(judge.labels_schema)) {
        properties[labelKey] = {
          type: "array",
          items: {
            type: "object",
            properties: {
              turn_index: { type: "number" },
              value: { 
                type: labelDef.type,
                ...(labelDef.enum ? { enum: labelDef.enum } : {})
              },
              reason: { type: "string" }
            },
            required: ["turn_index", "value", "reason"]
          },
          description: labelDef.description
        };
        required.push(labelKey);
      }
      
      tool = {
        name: "multi_label_extraction",
        description: "Extract multiple labels from assistant turns.",
        properties,
        required
      };
    } else {
      // Single-label judge: traditional format
      tool = {
        name: "judge_evaluation",
        description: "Judge assistant turns for the specified error label.",
        properties: {
          label: { type: "string" },
          error_detected: { type: "boolean" },
          error_turns: {
            type: "array",
            items: {
              type: "object",
              properties: {
                turn_index: { type: "number" },
                reason: { type: "string" }
              },
              required: ["turn_index", "reason"]
            }
          }
        },
        required: ["label", "error_detected", "error_turns"]
      };
    }

    const payload = {
      config: {
        provider: judge.provider || "openai",
        model: judge.model || "gpt-4.1-mini", 
        temperature: judge.temperature !== undefined ? judge.temperature : 0.5
      },
      prompt: judge.prompt,
      messages: [
        {
          role: "user",
          content: JSON.stringify({ 
            llmHistory: formattedHistory
          })
        }
      ],
      tool
    };

    const response = await axios.post('https://core.hoomanlabs.com/routes/utils/llm/generate', payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = response.data; 
    
    // Let's handle the case where it might be a string or object.
    let evaluation = result;
    if (typeof result === 'string') {
        try {
            // Sometimes the result is a stringified JSON inside a string, or just the JSON string.
            // Clean up markdown code blocks if present
            const cleanResult = result.replace(/```json\n?|\n?```/g, '');
            evaluation = JSON.parse(cleanResult);
        } catch (e) {
            console.error('Failed to parse LLM result:', e);
            console.log('Raw result was:', result);
        }
    }

    // Handle nested message property if present (common in some API responses)
    if (evaluation && evaluation.message) {
        evaluation = evaluation.message;
    }
    
    // Update conversation errors based on judge type
    if (judge.judge_type === 'multi' && judge.labels_schema) {
      // Multi-label judge: iterate through each label in the schema
      for (const labelKey of Object.keys(judge.labels_schema)) {
        const labelResults = evaluation[labelKey];
        if (labelResults && Array.isArray(labelResults)) {
          labelResults.forEach(result => {
            const turnIndex = result.turn_index;
            
            if (!conversation.turn_errors[turnIndex]) {
              conversation.turn_errors[turnIndex] = [];
            }
            
            // For multi-label, use labelKey as the label name
            const existingErrorIdx = conversation.turn_errors[turnIndex].findIndex(e => e.label === labelKey);
            
            const newError = {
              label: labelKey,
              original_reason: result.reason,
              edited_reason: null,
              value: result.value // Store the extracted value for multi-label
            };
            
            if (existingErrorIdx >= 0) {
              conversation.turn_errors[turnIndex][existingErrorIdx] = newError;
            } else {
              conversation.turn_errors[turnIndex].push(newError);
            }
          });
        }
      }
    } else if (evaluation && evaluation.error_detected && evaluation.error_turns) {
      // Single-label judge: traditional format
      evaluation.error_turns.forEach(error => {
        const turnIndex = error.turn_index;

        if (!conversation.turn_errors[turnIndex]) {
          conversation.turn_errors[turnIndex] = [];
        }
        
        const existingErrorIdx = conversation.turn_errors[turnIndex].findIndex(e => e.label === judge.label_name);
        
        const newError = {
          label: judge.label_name,
          original_reason: error.reason,
          edited_reason: null
        };

        if (existingErrorIdx >= 0) {
          conversation.turn_errors[turnIndex][existingErrorIdx] = newError;
        } else {
          conversation.turn_errors[turnIndex].push(newError);
        }
      });
    }

    saveDb();
    res.json({ success: true, evaluation });

  } catch (error) {
    console.error('LLM execution error:', error.message);
    if (error.response) {
        console.error('LLM response data:', error.response.data);
    }
    res.status(500).json({ error: 'LLM execution failed', details: error.message });
  }
});

// Update Evaluation (Manual Override)
app.post('/api/evaluations', (req, res) => {
  const { projectId, conversationId, turnIndex, label, editedReason } = req.body;

  const project = db.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const conversation = project.conversations.find(c => c.id === conversationId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  if (!conversation.turn_errors[turnIndex]) {
    return res.status(404).json({ error: 'Turn not found or no errors' });
  }

  const error = conversation.turn_errors[turnIndex].find(e => e.label === label);
  if (!error) return res.status(404).json({ error: 'Error label not found on this turn' });

  error.edited_reason = editedReason;
  saveDb();
  res.json({ success: true });
});

// Manual Labeling Routes
app.post('/api/projects/:projectId/conversations/:convId/manual-labels', (req, res) => {
  const { projectId, convId } = req.params;
  const { turnIndex, labels } = req.body;

  const project = db.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const conversation = project.conversations.find(c => c.id === convId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  // Initialize manual_labels if it doesn't exist
  if (!conversation.manual_labels) {
    conversation.manual_labels = {};
  }

  conversation.manual_labels[turnIndex] = labels;
  saveDb();
  res.json({ success: true });
});

app.post('/api/projects/:projectId/conversations/:convId/mark-labelled', (req, res) => {
  const { projectId, convId } = req.params;
  const { labelled } = req.body;

  const project = db.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const conversation = project.conversations.find(c => c.id === convId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  conversation.manually_labelled = labelled;
  saveDb();
  res.json({ success: true });
});

// Prompt Optimization
app.post('/api/optimize-prompt', async (req, res) => {
  console.log('Received optimize-prompt request:', req.body);
  const { projectId, judgeId, provider, model, temperature } = req.body;

  const project = db.projects.find(p => p.id === projectId);
  if (!project) {
    console.log('Project not found:', projectId);
    return res.status(404).json({ error: 'Project not found' });
  }

  const judge = db.judges.find(j => j.id === judgeId);
  if (!judge) {
    console.log('Judge not found:', judgeId);
    return res.status(404).json({ error: 'Judge not found' });
  }

  // Collect errors
  const errorsToAnalyze = [];
  const MAX_ERRORS = 20; // Limit context size

  for (const conversation of project.conversations) {
    if (errorsToAnalyze.length >= MAX_ERRORS) break;
    if (!conversation.turn_errors) continue;

    // Map turn index to message index
    let assistantTurnCount = 0;
    const turnIndexToMessageIndex = {};
    conversation.messages.forEach((msg, idx) => {
      if (msg.role === 'assistant') {
        turnIndexToMessageIndex[assistantTurnCount] = idx;
        assistantTurnCount++;
      }
    });

    for (const [turnIdxStr, errors] of Object.entries(conversation.turn_errors)) {
      const turnIdx = parseInt(turnIdxStr);
      // Filter errors for this judge
      // For single label, check label_name. For multi, check if label exists in schema keys
      const relevantErrors = errors.filter(e => {
        if (judge.judge_type === 'multi' && judge.labels_schema) {
          return Object.keys(judge.labels_schema).includes(e.label);
        }
        return e.label === judge.label_name;
      });

      if (relevantErrors.length === 0 && errors.length > 0) {
         // console.log(`Skipping errors for turn ${turnIdx} - Label mismatch. Found: ${errors.map(e => e.label).join(', ')}, Expected: ${judge.label_name}`);
      }

      for (const error of relevantErrors) {
        if (errorsToAnalyze.length >= MAX_ERRORS) break;

        const msgIdx = turnIndexToMessageIndex[turnIdx];
        if (msgIdx === undefined) continue;

        const userBefore = conversation.messages[msgIdx - 1]?.content || "[No user message before]";
        const assistantMsg = conversation.messages[msgIdx]?.content || "[No assistant message]";
        const userAfter = conversation.messages[msgIdx + 1]?.content || "[No user message after]";

        errorsToAnalyze.push({
          conversationId: conversation.id,
          turnIndex: turnIdx,
          context: {
            user_before: userBefore,
            assistant: assistantMsg,
            user_after: userAfter
          },
          error_label: error.label,
          reason: error.edited_reason || error.original_reason
        });
      }
    }
  }

  console.log(`Found ${errorsToAnalyze.length} errors to analyze for judge ${judge.label_name}`);

  if (errorsToAnalyze.length === 0) {
    return res.json({ success: true, buckets: [] });
  }

  try {


    const tool = {
      name: "prompt_optimization_result",
      description: "Submit the categorized error buckets and suggestions.",
      properties: {
        buckets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              examples: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    conversationId: { type: "string" },
                    turnIndex: { type: "number" },
                    reason: { type: "string" }
                  },
                  required: ["conversationId", "turnIndex", "reason"]
                }
              }
            },
            required: ["title", "description", "examples"]
          }
        }
      },
      required: ["buckets"]
    };

    const payload = {
      config: {
        provider: provider || judge.provider || "openai",
        model: model || judge.model || "gpt-4.1-mini",
        temperature: temperature !== undefined ? parseFloat(temperature) : 0.4
      },
      prompt: metaPrompts.bucketing
        .replace(/\$\{judge\.label_name\}/g, judge.label_name)
        .replace(/\$\{judge\.description\}/g, judge.description)
        .replace(/\$\{judge\.prompt\}/g, judge.prompt),
      messages: [
        {
          role: "user",
          content: JSON.stringify(errorsToAnalyze, null, 2)
        }
      ],
      tool: tool
    };

    const response = await axios.post('https://core.hoomanlabs.com/routes/utils/llm/generate', payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('LLM Response status:', response.status);
    console.log('LLM Response data:', JSON.stringify(response.data, null, 2));

    let result = response.data;
    
    // If result is string, try to parse it (sometimes API returns stringified JSON)
    if (typeof result === 'string') {
        try {
            const cleanResult = result.replace(/```json\n?|\n?```/g, '');
            result = JSON.parse(cleanResult);
        } catch (e) {
            console.error('Failed to parse Optimization result:', e);
        }
    }

    // Handle nested message property if present
    if (result && result.message) {
        result = result.message;
    }

    // If result is still a string after extracting message, parse it again
    if (typeof result === 'string') {
        try {
            const cleanResult = result.replace(/```json\n?|\n?```/g, '');
            result = JSON.parse(cleanResult);
        } catch (e) {
            console.error('Failed to parse inner result:', e);
        }
    }

    console.log('Parsed result keys:', result ? Object.keys(result) : 'null');
    console.log('Parsed buckets:', result && result.buckets ? result.buckets.length : 'undefined');

    // Enrich buckets with full context
    if (result && result.buckets) {
      result.buckets.forEach(bucket => {
        if (bucket.examples) {
          bucket.examples.forEach(example => {
            // Find the original error context
            const originalError = errorsToAnalyze.find(e => 
              e.conversationId === example.conversationId && 
              e.turnIndex === example.turnIndex
            );
            
            if (originalError) {
              example.context = originalError.context;
            }
          });
        }
      });
    }

    // Save to project
    if (!project.optimizations) {
      project.optimizations = {};
    }
    project.optimizations[judgeId] = {
      timestamp: Date.now(),
      buckets: result.buckets || []
    };
    saveDb();

    res.json({ success: true, buckets: result.buckets });

  } catch (error) {
    console.error('Optimization error:', error.message);
    if (error.response) {
        console.error('LLM response data:', error.response.data);
    }
    res.status(500).json({ error: 'Optimization failed', details: error.message });
  }
});

// Generate Global Suggestions
app.post('/api/generate-global-suggestions', async (req, res) => {
  const { projectId, judgeIds, provider, model, temperature } = req.body;

  const project = db.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const judges = db.judges.filter(j => judgeIds.includes(j.id));
  if (judges.length === 0) return res.status(404).json({ error: 'No judges found' });

  try {
    const tool = {
      name: "global_suggestion_result",
      description: "Submit the updated buckets with global suggestions.",
      properties: {
        buckets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              examples: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    conversationId: { type: "string" },
                    turnIndex: { type: "number" },
                    suggestion: { type: "string" }
                  },
                  required: ["conversationId", "turnIndex", "suggestion"]
                }
              }
            },
            required: ["title", "examples"]
          }
        }
      },
      required: ["buckets"]
    };

    const judgesInfo = judges.map(j => `
Judge Name: ${j.label_name}
Description: ${j.description}
Prompt: ${j.prompt}
---`).join('\n');

    // Process each judge that has buckets
    const processingPromises = judgeIds.map(async (targetJudgeId) => {
        const judgeOptimizations = project.optimizations ? project.optimizations[targetJudgeId] : null;
        if (!judgeOptimizations || !judgeOptimizations.buckets || judgeOptimizations.buckets.length === 0) {
            return null; // Skip if no buckets
        }

        const buckets = judgeOptimizations.buckets;

        const payload = {
            config: {
                provider: provider || "openai",
                model: model || "gpt-4o",
                temperature: temperature || 0.4
            },
            prompt: metaPrompts.suggestions.replace(/\$\{judgesInfo\}/g, judgesInfo),
            messages: [
                {
                    role: "user",
                    content: JSON.stringify(buckets, null, 2)
                }
            ],
            tool: tool
        };

        try {
            const response = await axios.post('https://core.hoomanlabs.com/routes/utils/llm/generate', payload, {
                headers: { 'Content-Type': 'application/json' }
            });

            let result = response.data;
            if (typeof result === 'string') {
                try {
                    const cleanResult = result.replace(/```json\n?|\n?```/g, '');
                    result = JSON.parse(cleanResult);
                } catch (e) { console.error('Failed to parse result:', e); }
            }
            if (result && result.message) result = result.message;
            if (typeof result === 'string') {
                try {
                    const cleanResult = result.replace(/```json\n?|\n?```/g, '');
                    result = JSON.parse(cleanResult);
                } catch (e) { console.error('Failed to parse inner result:', e); }
            }

            // Merge suggestions
            const updatedBuckets = buckets.map(bucket => {
                const resultBucket = result.buckets ? result.buckets.find(b => b.title === bucket.title) : null;
                if (resultBucket) {
                    return {
                        ...bucket,
                        examples: bucket.examples.map(ex => {
                            const resultEx = resultBucket.examples.find(e => e.conversationId === ex.conversationId && e.turnIndex === ex.turnIndex);
                            return {
                                ...ex,
                                suggestion: resultEx ? resultEx.suggestion : ex.suggestion
                            };
                        })
                    };
                }
                return bucket;
            });

            // Update project in memory (will be saved after all promises resolve)
            if (!project.optimizations) project.optimizations = {};
            if (!project.optimizations[targetJudgeId]) project.optimizations[targetJudgeId] = {};
            project.optimizations[targetJudgeId].buckets = updatedBuckets;
            
            return { judgeId: targetJudgeId, success: true };

        } catch (err) {
            console.error(`Failed to generate suggestions for judge ${targetJudgeId}:`, err.message);
            return { judgeId: targetJudgeId, success: false, error: err.message };
        }
    });

    await Promise.all(processingPromises);
    saveDb();

    res.json({ success: true });

  } catch (error) {
    console.error('Global Suggestion error:', error.message);
    res.status(500).json({ error: 'Global Suggestion failed', details: error.message });
  }
});

// Optimize Judge Prompt (Meta-Prompting)
app.post('/api/optimize-judge-prompt', async (req, res) => {
  const { judgeId, bucket, agentPrompt, provider, model, temperature } = req.body;

  const judge = db.judges.find(j => j.id === judgeId);
  if (!judge) return res.status(404).json({ error: 'Judge not found' });

  try {
    const pythonScript = path.join(__dirname, 'optimize_prompt.py');
    
    // Robust Python detection for Windows/Linux and different venv locations
    const possiblePaths = [
      path.join(__dirname, '../.venv/bin/python3.11'), // Linux/Mac Root (Specific)
      path.join(__dirname, '../.venv/bin/python3.10'), // Linux/Mac Root (Specific)
      path.join(__dirname, '../.venv/bin/python3'),    // Linux/Mac Root (Generic)
      path.join(__dirname, '../.venv/bin/python'),     // Linux/Mac Root (Fallback)
      
      path.join(__dirname, '.venv/bin/python3.11'),    // Linux/Mac Server dir (Specific)
      path.join(__dirname, '.venv/bin/python3.10'),    // Linux/Mac Server dir (Specific)
      path.join(__dirname, '.venv/bin/python3'),       // Linux/Mac Server dir (Generic)
      path.join(__dirname, '.venv/bin/python'),        // Linux/Mac Server dir (Fallback)

      path.join(__dirname, '../.venv/Scripts/python.exe'), // Windows Root
      path.join(__dirname, '.venv/Scripts/python.exe'),  // Windows Server dir
    ];
    
    let pythonExecutable = 'python'; // Default fallback
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        pythonExecutable = p;
        break;
      }
    }
    
    console.log(`[Optimize] Using Python executable: ${pythonExecutable}`);
    console.log(`[Optimize] Script path: ${pythonScript}`);

    const pythonProcess = spawn(pythonExecutable, [pythonScript]);

    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('[Optimize] Python script exited with code:', code);
        console.error('[Optimize] Stderr:', errorData);
        console.log('[Optimize] Stdout:', outputData);
        
        // Try to parse error from stdout if stderr is empty (since our script prints JSON error to stdout)
        let errorMsg = errorData;
        try {
            if (outputData.trim()) {
                const result = JSON.parse(outputData);
                if (result.error) errorMsg = result.error;
            }
        } catch (e) {
            // ignore parse error
        }
        
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Prompt optimization failed', details: errorMsg || 'Unknown error' });
        }
        return;
      }

      try {
        const result = JSON.parse(outputData);
        if (result.error) {
             if (!res.headersSent) return res.status(500).json({ error: result.error });
        }
        if (!res.headersSent) res.json({ success: true, optimizedPrompt: result.optimizedPrompt });
      } catch (e) {
        console.error('[Optimize] Failed to parse python output:', outputData);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to parse optimization result', details: outputData });
      }
    });

    // Prepare input data
    // Use provided settings or fallback to judge settings (or defaults)
    const selectedProvider = provider || judge.provider || 'openai';
    const selectedModel = model || judge.model || 'gpt-4o';
    const selectedTemperature = temperature !== undefined ? parseFloat(temperature) : 0;
    
    // Use the provided agentPrompt if available, otherwise fallback to judge.prompt
    const promptToOptimize = agentPrompt || judge.prompt;
    
    // Get the correct API key based on the SELECTED provider
    const apiKeyEnvVar = `${selectedProvider.toUpperCase()}_API_KEY`;
    const apiKey = process.env[apiKeyEnvVar];

    if (!apiKey) {
        console.warn(`[Optimize] Warning: No API key found for provider ${selectedProvider} (checked ${apiKeyEnvVar})`);
    }

    const inputData = {
      current_prompt: promptToOptimize,
      examples: bucket.examples,
      provider: selectedProvider,
      model: selectedModel,
      temperature: selectedTemperature,
      api_key: apiKey,
      meta_prompt: metaPrompts.optimization
    };

    pythonProcess.stdin.write(JSON.stringify(inputData));
    pythonProcess.stdin.end();

  } catch (error) {
    console.error('Prompt optimization error:', error.message);
    if (!res.headersSent) res.status(500).json({ error: 'Prompt optimization failed', details: error.message });
  }
});

// Optimize Judge Prompt (All Buckets)
app.post('/api/optimize-judge-prompt/all', async (req, res) => {
  const { projectId, judgeId, agentPrompt, provider, model, temperature } = req.body;

  const project = db.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const judge = db.judges.find(j => j.id === judgeId);
  if (!judge) return res.status(404).json({ error: 'Judge not found' });

  if (!project.optimizations || !project.optimizations[judgeId]) {
    return res.status(404).json({ error: 'No optimizations found for this judge' });
  }

  // Collect all examples from all non-fixed buckets
  const allExamples = [];
  project.optimizations[judgeId].buckets.forEach(bucket => {
    if (!bucket.fixed) {
      allExamples.push(...bucket.examples);
    }
  });

  if (allExamples.length === 0) {
    return res.status(400).json({ error: 'No pending issues to fix' });
  }

  try {
    const pythonScript = path.join(__dirname, 'optimize_prompt.py');
    
    // Robust Python detection
    const possiblePaths = [
      path.join(__dirname, '../.venv/bin/python3.11'),
      path.join(__dirname, '../.venv/bin/python3.10'),
      path.join(__dirname, '../.venv/bin/python3'),
      path.join(__dirname, '../.venv/bin/python'),
      path.join(__dirname, '.venv/bin/python3.11'),
      path.join(__dirname, '.venv/bin/python3.10'),
      path.join(__dirname, '.venv/bin/python3'),
      path.join(__dirname, '.venv/bin/python'),
      path.join(__dirname, '../.venv/Scripts/python.exe'),
      path.join(__dirname, '.venv/Scripts/python.exe'),
    ];
    
    let pythonExecutable = 'python';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        pythonExecutable = p;
        break;
      }
    }
    
    const pythonProcess = spawn(pythonExecutable, [pythonScript]);

    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => { outputData += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { errorData += data.toString(); });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('[Optimize All] Python script exited with code:', code);
        console.error('[Optimize All] Stderr:', errorData);
        console.log('[Optimize All] Stdout:', outputData);
        
        let errorMsg = errorData;
        try {
            if (outputData.trim()) {
                const result = JSON.parse(outputData);
                if (result.error) errorMsg = result.error;
            }
        } catch (e) {}
        
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Prompt optimization failed', details: errorMsg || 'Unknown error' });
        }
        return;
      }

      try {
        const result = JSON.parse(outputData);
        if (result.error) {
             if (!res.headersSent) return res.status(500).json({ error: result.error });
        }
        if (!res.headersSent) res.json({ success: true, optimizedPrompt: result.optimizedPrompt });
      } catch (e) {
        if (!res.headersSent) res.status(500).json({ error: 'Failed to parse optimization result', details: outputData });
      }
    });

    const selectedProvider = provider || judge.provider || 'openai';
    const selectedModel = model || judge.model || 'gpt-4o';
    const selectedTemperature = temperature !== undefined ? parseFloat(temperature) : 0;
    const promptToOptimize = agentPrompt || judge.prompt;
    const apiKeyEnvVar = `${selectedProvider.toUpperCase()}_API_KEY`;
    const apiKey = process.env[apiKeyEnvVar];

    const inputData = {
      current_prompt: promptToOptimize,
      examples: allExamples,
      provider: selectedProvider,
      model: selectedModel,
      temperature: selectedTemperature,
      api_key: apiKey,
      meta_prompt: metaPrompts.optimization
    };

    pythonProcess.stdin.write(JSON.stringify(inputData));
    pythonProcess.stdin.end();

  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: 'Prompt optimization failed', details: error.message });
  }
});

// Optimize Global Prompt (Multiple Judges)
app.post('/api/optimize-global-prompt', async (req, res) => {
  const { projectId, judgeIds, agentPrompt, provider, model, temperature } = req.body;

  const project = db.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (!project.optimizations) {
    return res.status(400).json({ error: 'No optimizations found' });
  }

  // Collect all examples from all non-fixed buckets of selected judges
  const allExamples = [];
  
  for (const judgeId of judgeIds) {
    if (project.optimizations[judgeId]) {
      project.optimizations[judgeId].buckets.forEach(bucket => {
        if (!bucket.fixed) {
          // Add judge info to the reason to help the optimizer distinguish sources
          const judge = db.judges.find(j => j.id === judgeId);
          const judgeName = judge ? judge.label_name : 'Unknown Judge';
          
          const enrichedExamples = bucket.examples.map(ex => ({
            ...ex,
            reason: `[${judgeName}] ${ex.reason}`
          }));
          
          allExamples.push(...enrichedExamples);
        }
      });
    }
  }

  if (allExamples.length === 0) {
    return res.status(400).json({ error: 'No pending issues to fix for selected judges' });
  }

  try {
    const pythonScript = path.join(__dirname, 'optimize_prompt.py');
    
    // Robust Python detection
    const possiblePaths = [
      path.join(__dirname, '../.venv/bin/python3.11'),
      path.join(__dirname, '../.venv/bin/python3.10'),
      path.join(__dirname, '../.venv/bin/python3'),
      path.join(__dirname, '../.venv/bin/python'),
      path.join(__dirname, '.venv/bin/python3.11'),
      path.join(__dirname, '.venv/bin/python3.10'),
      path.join(__dirname, '.venv/bin/python3'),
      path.join(__dirname, '.venv/bin/python'),
      path.join(__dirname, '../.venv/Scripts/python.exe'),
      path.join(__dirname, '.venv/Scripts/python.exe'),
    ];
    
    let pythonExecutable = 'python';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        pythonExecutable = p;
        break;
      }
    }
    
    const pythonProcess = spawn(pythonExecutable, [pythonScript]);

    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => { outputData += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { errorData += data.toString(); });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('[Global Optimize] Python script exited with code:', code);
        console.error('[Global Optimize] Stderr:', errorData);
        
        let errorMsg = errorData;
        try {
            if (outputData.trim()) {
                const result = JSON.parse(outputData);
                if (result.error) errorMsg = result.error;
            }
        } catch (e) {}
        
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Prompt optimization failed', details: errorMsg || 'Unknown error' });
        }
        return;
      }

      try {
        const result = JSON.parse(outputData);
        if (result.error) {
             if (!res.headersSent) return res.status(500).json({ error: result.error });
        }
        if (!res.headersSent) res.json({ success: true, optimizedPrompt: result.optimizedPrompt });
      } catch (e) {
        if (!res.headersSent) res.status(500).json({ error: 'Failed to parse optimization result', details: outputData });
      }
    });

    const selectedProvider = provider || 'openai';
    const selectedModel = model || 'gpt-4o';
    const selectedTemperature = temperature !== undefined ? parseFloat(temperature) : 0;
    const apiKeyEnvVar = `${selectedProvider.toUpperCase()}_API_KEY`;
    const apiKey = process.env[apiKeyEnvVar];

    const inputData = {
      current_prompt: agentPrompt,
      examples: allExamples,
      provider: selectedProvider,
      model: selectedModel,
      temperature: selectedTemperature,
      api_key: apiKey,
      meta_prompt: metaPrompts.optimization
    };

    pythonProcess.stdin.write(JSON.stringify(inputData));
    pythonProcess.stdin.end();

  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: 'Prompt optimization failed', details: error.message });
  }
});

// Mark Bucket as Fixed
app.post('/api/projects/:projectId/optimizations/:judgeId/buckets/:bucketIndex/fix', (req, res) => {
  const { projectId, judgeId, bucketIndex } = req.params;

  const project = db.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (!project.optimizations || !project.optimizations[judgeId]) {
    return res.status(404).json({ error: 'Optimization not found' });
  }

  const bucket = project.optimizations[judgeId].buckets[bucketIndex];
  if (!bucket) return res.status(404).json({ error: 'Bucket not found' });

  bucket.fixed = true;
  saveDb();
  res.json({ success: true });
});

// Recall Analytics
app.get('/api/projects/:projectId/analytics/recall', (req, res) => {
  const { projectId } = req.params;

  const project = db.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Calculate recall for each label
  // Recall = True Positives / (True Positives + False Negatives)
  // TP = LLM detected and manual label exists
  // FN = Manual label exists but LLM didn't detect

  const labelRecall = {};

  project.conversations.forEach(conv => {
    if (!conv.manually_labelled || !conv.manual_labels) return;

    // Get all assistant turns
    let turnIndex = 0;
    conv.messages.forEach((msg, idx) => {
      if (msg.role === 'assistant') {
        const manualLabels = conv.manual_labels[turnIndex] || [];
        const llmErrors = conv.turn_errors[turnIndex] || [];

        manualLabels.forEach(label => {
          if (!labelRecall[label]) {
            labelRecall[label] = { tp: 0, fn: 0, total: 0 };
          }

          labelRecall[label].total++;

          // Check if LLM detected this label
          const llmDetected = llmErrors.some(e => e.label === label);
          if (llmDetected) {
            labelRecall[label].tp++;
          } else {
            labelRecall[label].fn++;
          }
        });

        turnIndex++;
      }
    });
  });

  // Calculate recall percentages
  const analytics = Object.entries(labelRecall).map(([label, stats]) => ({
    label,
    recall: stats.total > 0 ? (stats.tp / stats.total) * 100 : 0,
    truePositives: stats.tp,
    falseNegatives: stats.fn,
    totalManualLabels: stats.total
  }));

  res.json({ analytics });
});

// Run Analysis Judge
app.post('/api/run-analysis-judge', async (req, res) => {
  const { projectId, conversationId, judgeId } = req.body;
  
  const project = db.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const conversation = project.conversations.find(c => c.id === conversationId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const judge = db.judges.find(j => j.id === judgeId);
  if (!judge) return res.status(404).json({ error: 'Judge not found' });

  try {
    console.log(`Running Analysis Judge for ConvID: ${conversationId}`);

    // 1. Fetch Tools to find info_extraction
    let infoExtractionParams = "Not found";
    try {
        const toolsUrl = `https://api.hoomanlabs.com/routes/v1/tools/?agent=${encodeURIComponent(project.agent)}`;
        const toolsResponse = await axios.get(toolsUrl, { headers: { 'Authorization': project.api_key } });
        let tools = toolsResponse.data;
        
        // Handle different response structures
        if (!Array.isArray(tools)) {
            if (tools.data && Array.isArray(tools.data)) {
                tools = tools.data;
            } else if (typeof tools === 'object') {
                tools = [tools];
            } else {
                tools = [];
            }
        }

        if (tools.length > 0) {
            console.log('First tool structure:', JSON.stringify(tools[0], null, 2));
        }

        const expectedToolName = `${project.agent}_info_extraction`;
        console.log(`Looking for tool named: ${expectedToolName}`);

        const infoExtractionTool = tools.find(t => {
            const toolName = t.name || t.id || (t.function && t.function.name);
            // Strict check: Must match expected name OR start with agent name and end with _info_extraction
            return toolName === expectedToolName || (toolName && toolName.startsWith(project.agent) && toolName.endsWith('_info_extraction'));
        });

        if (infoExtractionTool) {
            console.log('Found info_extraction tool:', JSON.stringify(infoExtractionTool, null, 2));
            
            // Handle different parameter locations
            if (infoExtractionTool.parameters) {
                infoExtractionParams = infoExtractionTool.parameters;
            } else if (infoExtractionTool.function && infoExtractionTool.function.parameters) {
                infoExtractionParams = infoExtractionTool.function.parameters;
            } else if (infoExtractionTool.data && infoExtractionTool.data.function && infoExtractionTool.data.function.parameters) {
                infoExtractionParams = infoExtractionTool.data.function.parameters;
            } else if (infoExtractionTool.input_schema) {
                infoExtractionParams = infoExtractionTool.input_schema;
            }
            
            console.log('Extracted Params:', JSON.stringify(infoExtractionParams, null, 2));
        } else {
            console.log('info_extraction tool not found. Available tools:', tools.map(t => t.name || t.id || (t.function && t.function.name)));
        }
    } catch (e) {
        console.log('Failed to fetch tools:', e.message);
        if (e.response) console.log('Tools API Response:', JSON.stringify(e.response.data));
    }

    // 2. Fetch Agent to get Master Prompt
    let masterPrompt = "System Prompt not available.";
    try {
        const agentUrl = `https://api.hoomanlabs.com/routes/v1/agents/?name=${encodeURIComponent(project.agent)}`;
        const agentResponse = await axios.get(agentUrl, { headers: { 'Authorization': project.api_key } });
        const agentData = Array.isArray(agentResponse.data) ? agentResponse.data[0] : agentResponse.data;
        if (agentData) {
             if (agentData.system_prompt) masterPrompt = agentData.system_prompt;
             else if (agentData.prompt) masterPrompt = agentData.prompt;
        }
    } catch (e) {
        console.log('Failed to fetch agent master prompt:', e.message);
    }

    // 3. Construct Context
    let messagesToProcess = conversation.messages;
    if (messagesToProcess.length > 0 && messagesToProcess[0].role === 'user' && messagesToProcess[0].content.includes('Introduce yourself')) {
        messagesToProcess = messagesToProcess.slice(1);
    }

    // Determine the correct analysis output to use (matching frontend logic)
     let analysisOutput = conversation.results && Object.keys(conversation.results).length > 0 
        ? { ...conversation.results }
        : { ...(conversation.raw_data?.analysis?.results || conversation.raw_data?.results || conversation.analysis || {}) };

    // Remove outcome and summary parameters if present
    if (analysisOutput && typeof analysisOutput === 'object') {
        delete analysisOutput.outcome;
        delete analysisOutput.summary;
    }

    const context = {
        master_prompt: masterPrompt,
        info_extraction_parameters: infoExtractionParams,
        transcript: messagesToProcess,
        analysis_output: analysisOutput
    };

    console.log('Analysis Output for Judge:', JSON.stringify(analysisOutput, null, 2));

    // 4. Define Tool Schema & Prompt Context
    let propertiesContext = "\n\nProperties\nThese are the outputted properties. [DO NOT STRICTLY MAKE CHANGES TO THESE PROPERTIES. THEY ARE ONLY FOR REFERENCE]\n\n";

    if (infoExtractionParams && infoExtractionParams.properties) {
        let i = 1;
        for (const key of Object.keys(infoExtractionParams.properties)) {
            const originalParam = infoExtractionParams.properties[key];
            const originalDesc = originalParam.description || "";

            // Add to prompt context
            propertiesContext += `${i}. Name: ${key}\n   Type: ${originalParam.type}\n   Description: ${originalDesc}\n\n`;
            i++;
        }
    }

    const tool = {
        name: "analysis_verification",
        description: "Analyze the extracted parameters. Evaluate against the Judge Prompt and transcript. If any parameter violates the instructions, flag it.",
        properties: {
            error_detected: { 
                type: "boolean",
                description: "Set to true if any parameter is incorrect or should be flagged based on the instructions."
            },
            flagged_parameters: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        parameter_name: { 
                            type: "string",
                            description: "The name of the parameter being flagged."
                        },
                        reason: { 
                            type: "string",
                            description: "Detailed explanation for why this parameter is flagged."
                        }
                    },
                    required: ["parameter_name", "reason"]
                }
            }
        },
        required: ["error_detected", "flagged_parameters"]
    };

    const finalPrompt = judge.prompt + propertiesContext;
    console.log('--- FINAL PROMPT START ---');
    console.log(finalPrompt);
    console.log('--- FINAL PROMPT END ---');
    console.log('--- TOOL DEFINITION START ---');
    console.log(JSON.stringify(tool, null, 2));
    console.log('--- TOOL DEFINITION END ---');

    // 5. Call LLM
    const payload = {
      config: {
        provider: judge.provider || "openai",
        model: judge.model || "gpt-4.1-mini", 
        temperature: judge.temperature !== undefined ? judge.temperature : 0.1
      },
      prompt: finalPrompt,
      messages: [
        {
          role: "user",
          content: JSON.stringify(context)
        }
      ],
      tool
    };

    const response = await axios.post('https://core.hoomanlabs.com/routes/utils/llm/generate', payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    let result = response.data;
    if (typeof result === 'string') {
        try {
            const cleanResult = result.replace(/```json\n?|\n?```/g, '');
            result = JSON.parse(cleanResult);
        } catch (e) {
            console.error('Failed to parse LLM result:', e);
        }
    }
    if (result && result.message) {
        result = result.message;
    }

    // 6. Save Result
    if (!conversation.analysis_verification) {
        conversation.analysis_verification = {};
    }
    conversation.analysis_verification[judgeId] = result;
    
    saveDb();
    res.json({ success: true, result });

  } catch (error) {
    console.error('Analysis Judge Error:', error.message);
    if (error.response) {
        console.error('LLM response data:', error.response.data);
    }
    res.status(500).json({ error: 'Analysis Judge execution failed', details: error.message });
  }
});


// Analyze Tool Errors (Bucketing for Analysis Judges)
app.post('/api/tools/analyze-errors', async (req, res) => {
  const { projectId, judgeId, provider, model, temperature } = req.body;

  const project = db.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const judge = db.judges.find(j => j.id === judgeId);
  if (!judge) return res.status(404).json({ error: 'Judge not found' });

  // Collect errors from all conversations
  const errorsToAnalyze = [];
  const MAX_ERRORS = 50; // Limit context window usage

  for (const conversation of db.conversations) {
    if (conversation.projectId !== projectId) continue;
    if (errorsToAnalyze.length >= MAX_ERRORS) break;
    
    // Check for analysis verification results
    if (!conversation.analysis_verification || !conversation.analysis_verification[judgeId]) continue;

    const verification = conversation.analysis_verification[judgeId];
    
    // Only process if error detected
    if (!verification.error_detected || !verification.flagged_parameters || verification.flagged_parameters.length === 0) continue;

    // Get conversation transcript for context
    const transcript = conversation.messages.map(m => `${m.role}: ${m.content}`).join('\n');

    for (const param of verification.flagged_parameters) {
      if (errorsToAnalyze.length >= MAX_ERRORS) break;

      // Try to get extracted value from conversation.analysis
      let extractedValue = "N/A";
      if (conversation.analysis && conversation.analysis[param.parameter_name]) {
          extractedValue = conversation.analysis[param.parameter_name];
      }

      errorsToAnalyze.push({
        conversationId: conversation.id,
        parameter: param.parameter_name,
        reason: param.reason,
        extracted_value: extractedValue,
        transcript: transcript
      });
    }
  }

  console.log(`Found ${errorsToAnalyze.length} analysis errors to analyze for judge ${judge.label_name}`);

  if (errorsToAnalyze.length === 0) {
    return res.json({ success: true, buckets: [] });
  }

  try {
    const tool = {
      name: "analysis_error_bucketing",
      description: "Submit the categorized analysis error buckets.",
      properties: {
        buckets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              examples: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    parameter: { type: "string" },
                    reason: { type: "string" }
                  },
                  required: ["parameter", "reason"]
                }
              }
            },
            required: ["title", "description", "examples"]
          }
        }
      },
      required: ["buckets"]
    };

    const payload = {
      config: {
        provider: provider || judge.provider || "openai",
        model: model || judge.model || "gpt-4o-mini",
        temperature: temperature !== undefined ? parseFloat(temperature) : 0.2
      },
      prompt: metaPrompts.tool_bucketing
        .replace(/\$\{judge\.label_name\}/g, judge.label_name)
        .replace(/\$\{judge\.description\}/g, judge.description)
        .replace(/\$\{judge\.prompt\}/g, judge.prompt),
      messages: [
        {
          role: "user",
          content: JSON.stringify(errorsToAnalyze, null, 2)
        }
      ],
      tool: tool
    };

    const response = await axios.post('https://core.hoomanlabs.com/routes/utils/llm/generate', payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('LLM Response status:', response.status);
    
    let result = response.data;
    
    // If result is string, try to parse it
    if (typeof result === 'string') {
        try {
            const cleanResult = result.replace(/```json\n?|\n?```/g, '');
            result = JSON.parse(cleanResult);
        } catch (e) {
            console.error('Failed to parse Analysis result:', e);
        }
    }

    // Handle nested message property if present
    if (result && result.message) {
        result = result.message;
    }

    // If result is still a string after extracting message, parse it again
    if (typeof result === 'string') {
        try {
            const cleanResult = result.replace(/```json\n?|\n?```/g, '');
            result = JSON.parse(cleanResult);
        } catch (e) {
            console.error('Failed to parse inner result:', e);
        }
    }

    // Save to project
    if (!project.tool_optimizations) {
      project.tool_optimizations = {};
    }
    project.tool_optimizations[judgeId] = {
      timestamp: Date.now(),
      buckets: result.buckets || []
    };
    saveDb();

    res.json({ success: true, buckets: result.buckets });

  } catch (error) {
    console.error('Analysis Optimization error:', error.message);
    if (error.response) {
        console.error('LLM response data:', error.response.data);
    }
    res.status(500).json({ error: 'Analysis Optimization failed', details: error.message });
  }
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

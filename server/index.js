require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
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

// --- Routes ---

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

app.post('/api/projects', async (req, res) => {
  const { apiKey, name, limit, outcomes } = req.body;

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
        turn_errors: {}, // Initialize empty errors
        raw_data: c
      };
    });

    const newProject = {
      id: Date.now().toString(),
      name,
      api_key: apiKey, // Storing API key might be needed for future calls?
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
  const { label_name, description, prompt, model, temperature, provider, judge_type, labels_schema } = req.body;
  const newJudge = {
    id: Date.now().toString(),
    label_name,
    description,
    prompt,
    model: model || 'gpt-4.1-mini',
    temperature: temperature !== undefined ? temperature : 0.5,
    provider: provider || 'openai',
    judge_type: judge_type || 'single',
    labels_schema: labels_schema || undefined
  };
  db.judges.push(newJudge);
  saveDb();
  res.json(newJudge);
});

app.put('/api/judges/:id', (req, res) => {
  const { label_name, description, prompt, model, temperature, provider, judge_type, labels_schema } = req.body;
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
  const { projectId, judgeId } = req.body;

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
                    reason: { type: "string" },
                    suggestion: { type: "string" }
                  },
                  required: ["conversationId", "turnIndex", "reason", "suggestion"]
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
        provider: judge.provider || "openai",
        model: judge.model || "gpt-4.1-mini",
        temperature: 0.4
      },
      prompt: `You are an expert prompt engineer and data analyst.
Your task is to analyze a set of errors detected by an LLM judge and categorize them into 2-3 distinct "buckets" or categories based on the root cause or type of failure.

Judge Information:
Name: ${judge.label_name}
Description: ${judge.description}
Prompt: ${judge.prompt}

I will provide a list of errors. Each error includes the conversation context (User query, Assistant response, User follow-up) and the reason why it was marked as an error.

For each bucket, you must provide:
1. Title: A short, descriptive title for the category.
2. Description: A detailed explanation of what this type of error represents.
3. Examples: Select 1-2 representative examples from the provided list. For each example, provide:
    - The original error reason.
    - A "Corrected Response": Rewrite the assistant's response to fix the error.
      CRITICAL: The corrected response MUST strictly adhere to ALL rules and guidelines defined in the "Judge Information" prompt provided above. It must fix the specific error while remaining compliant with all other constraints (e.g., language, tone, length, formatting).

Use the provided tool to submit your analysis.`,
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

// Optimize Judge Prompt (Meta-Prompting)
app.post('/api/optimize-judge-prompt', async (req, res) => {
  const { judgeId, bucket, agentPrompt } = req.body;

  const judge = db.judges.find(j => j.id === judgeId);
  if (!judge) return res.status(404).json({ error: 'Judge not found' });

  try {
    const pythonScript = path.join(__dirname, 'optimize_prompt.py');
    
    // Robust Python detection for Windows/Linux and different venv locations
    const possiblePaths = [
      path.join(__dirname, '../.venv/bin/python'),       // Linux/Mac Root
      path.join(__dirname, '../.venv/Scripts/python.exe'), // Windows Root
      path.join(__dirname, '.venv/bin/python'),          // Linux/Mac Server dir
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
    const provider = judge.provider || 'openai';
    
    // Use the provided agentPrompt if available, otherwise fallback to judge.prompt (though user requested agent prompt)
    const promptToOptimize = agentPrompt || judge.prompt;
    
    const inputData = {
      current_prompt: promptToOptimize,
      examples: bucket.examples,
      provider: provider,
      model: judge.model || 'gpt-4o',
      api_key: process.env[`${provider.toUpperCase()}_API_KEY`]
    };

    pythonProcess.stdin.write(JSON.stringify(inputData));
    pythonProcess.stdin.end();

  } catch (error) {
    console.error('Prompt optimization error:', error.message);
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

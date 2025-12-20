const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

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
  const { label_name, description, prompt, model, temperature } = req.body;
  const newJudge = {
    id: Date.now().toString(),
    label_name,
    description,
    prompt,
    model: model || 'gpt-4.1-mini',
    temperature: temperature !== undefined ? temperature : 0.5
  };
  db.judges.push(newJudge);
  saveDb();
  res.json(newJudge);
});

app.put('/api/judges/:id', (req, res) => {
  const { label_name, description, prompt, model, temperature } = req.body;
  const idx = db.judges.findIndex(j => j.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Judge not found' });

  db.judges[idx] = { 
    ...db.judges[idx], 
    label_name, 
    description, 
    prompt,
    model: model || db.judges[idx].model || 'gpt-4.1-mini',
    temperature: temperature !== undefined ? temperature : (db.judges[idx].temperature !== undefined ? db.judges[idx].temperature : 0.5)
  };
  saveDb();
  res.json(db.judges[idx]);
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

    const payload = {
      config: {
        provider: "openai",
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
      tool: {
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
      }
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
    
    // Update conversation errors
    if (evaluation && evaluation.error_detected && evaluation.error_turns) {
      evaluation.error_turns.forEach(error => {
        // We trust the LLM to return the correct turn index because we explicitly numbered them in the input.
        const turnIndex = error.turn_index;

        if (!conversation.turn_errors[turnIndex]) {
          conversation.turn_errors[turnIndex] = [];
        }
        // Check if error already exists for this label
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

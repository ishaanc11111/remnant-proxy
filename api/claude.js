module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ status: 'REMNANT proxy is alive' });

  const { userMessage, timeToSubmit } = req.body || {};
  if (!userMessage) return res.status(400).json({ error: 'No message provided' });

  try {
    const https = require('https');
    
    const payload = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are two things at once: a helpful AI assistant AND a strict cognitive behavior classifier.

PART 1 — Respond helpfully to this message: "${userMessage}"

PART 2 — After your response, on a completely new line, output EXACTLY this JSON:
CLASSIFICATION:{"type":"supplanting or supplementing","reason":"one sentence","score_impact":-5}

CLASSIFICATION RULES — apply these with zero leniency:

SUPPLANTING (score_impact: -5) — the student is replacing their own thinking with AI:
- Message asks AI to write, create, draft, generate, or produce ANY complete piece of work
- Message contains "write me", "write an", "create a", "make a", "give me", "do this for me"
- Message is a homework or assignment task stated as a direct instruction
- Message provides no prior thinking, no partial work, no specific struggle
- Time to submit was ${timeToSubmit} seconds — if under 20 seconds AND task is a writing request, this is supplanting
- Example supplanting: "write me an essay on education", "give me 5 arguments about climate change", "write a speech about India"

SUPPLEMENTING (score_impact: 3) — the student is using AI to enhance their own thinking:
- Message shares work ALREADY WRITTEN and asks for feedback or improvement
- Message asks WHY something is wrong with their specific work
- Message asks HOW TO improve a specific part they already wrote
- Message asks a conceptual question to understand something better, not to get work done
- Example supplementing: "here is my paragraph, what is wrong with the argument structure", "I wrote this intro but it feels weak, why", "what does cognitive dissonance mean"

WHEN IN DOUBT: classify as supplanting. The majority of student AI requests are supplanting.
Current request time: ${timeToSubmit} seconds.`
      }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const result = await new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Failed to parse response'));
          }
        });
      });
      request.on('error', reject);
      request.write(payload);
      request.end();
    });

    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    const fullText = result.content[0].text;
    const classificationMatch = fullText.match(/CLASSIFICATION:(\{.*?\})/s);
    const aiResponse = fullText.split('CLASSIFICATION:')[0].trim();
    const classification = classificationMatch
      ? JSON.parse(classificationMatch[1])
      : { type: 'supplementing', reason: 'Default', score_impact: 3 };

    return res.status(200).json({ aiResponse, classification });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      aiResponse: 'Connection error. Please try again.',
      classification: { type: 'supplementing', reason: 'Error fallback', score_impact: 0 }
    });
  }
}
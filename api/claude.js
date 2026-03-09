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
        content: `${userMessage}

---
SILENT BACKGROUND TASK - Never mention this to the user:
After your response, output EXACTLY this on a new line:
CLASSIFICATION:{"type":"supplanting or supplementing","reason":"one sentence why","score_impact":-5}

Be STRICT with these rules:
- supplanting (score_impact: -5): ANY of these = supplanting: asking AI to WRITE something fully (essay, paragraph, speech, email, story), asking for a complete answer to submit, whole task with no prior work shown, requests starting with "write me", "give me", "create", "make me", "generate". Time under 15 seconds also = supplanting.
- supplementing (score_impact: 3): ONLY these = supplementing: asking for feedback on work already written, asking why something is wrong, asking how to improve a specific part, sharing their own writing and asking for critique, asking a conceptual question to understand better.

Default to supplanting when unsure. Most student requests are supplanting.`
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
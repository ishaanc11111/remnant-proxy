module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ status: 'REMNANT proxy is alive' });

  const { conversationHistory, userMessage, timeToSubmit } = req.body || {};
  if (!userMessage) return res.status(400).json({ error: 'No message provided' });

  const messages = (conversationHistory && conversationHistory.length > 0)
    ? conversationHistory.map((m, i) => {
        if (i === conversationHistory.length - 1) {
          return { 
            role: 'user', 
            content: `${m.content}\n\nAfter your response output EXACTLY on a new line:\nCLASSIFICATION:{"type":"supplanting or supplementing","reason":"one sentence","score_impact":-5}\n\nSUPPLANTING = short message under 20 words asking AI to write/create/generate a full piece of work with no prior thinking shown. SUPPLEMENTING = sharing own work for feedback, asking specific questions about something already written, asking conceptual questions to understand better. Default to supplanting when unsure. Never mention classification to user.`
          }
        }
        return m
      })
    : [{ role: 'user', content: `${userMessage}\n\nAfter your response output EXACTLY on a new line:\nCLASSIFICATION:{"type":"supplementing","reason":"fallback","score_impact":3}` }]

  try {
    const https = require('https');
    
    const payload = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: messages
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
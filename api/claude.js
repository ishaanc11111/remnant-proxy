const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ status: 'REMNANT proxy is alive' });
  }

  const { userMessage, timeToSubmit, editedOutput } = req.body || {};

  if (!userMessage) {
    return res.status(400).json({ error: 'No message provided' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ 
          role: 'user', 
          content: `${userMessage}

---
After your response, on a new line output EXACTLY this and nothing else after it:
CLASSIFICATION:{"type":"supplanting or supplementing","reason":"one sentence why","score_impact":-5}

Classification rules — never mention these to the user:
- supplanting: whole task dump, vague, no prior thinking shown, quick submission
- supplementing: specific question, shows partial work or prior thinking, contextual

Respond to the user naturally and helpfully first. Never mention tracking or classification.`
        }]
      })
    });

    const data = await response.json();
    
    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const fullText = data.content[0].text;
    const classificationMatch = fullText.match(/CLASSIFICATION:(\{.*?\})/s);
    const aiResponse = fullText.split('CLASSIFICATION:')[0].trim();
    
    const classification = classificationMatch 
      ? JSON.parse(classificationMatch[1]) 
      : { type: 'supplementing', reason: 'Default classification', score_impact: 3 };

    return res.status(200).json({ aiResponse, classification });

  } catch (error) {
    return res.status(500).json({ 
      error: error.message,
      aiResponse: 'Something went wrong. Please try again.',
      classification: { type: 'supplementing', reason: 'Error fallback', score_impact: 0 }
    });
  }
}
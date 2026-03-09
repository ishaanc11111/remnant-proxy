const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'REMNANT proxy is alive' });
  }

  const { userMessage, timeToSubmit, editedOutput } = req.body;

  const classificationPrompt = `You are an AI usage classifier for a cognitive health app called REMNANT.
The user sent this message to an AI assistant: "${userMessage}"
Time they took before submitting (seconds): ${timeToSubmit}
Did they edit the AI output afterwards: ${editedOutput}

First, respond helpfully to their message as a normal AI assistant would.

Then on a new line output EXACTLY this JSON and nothing else after it:
CLASSIFICATION:{"type":"supplanting or supplementing","reason":"one sentence why","score_impact":-5}

Rules:
- supplanting: full task dump, no prior thinking, vague whole-task request, under 10 seconds to submit. score_impact is -5
- supplementing: specific contextual question, shows prior thinking, took time before submitting. score_impact is 3`;

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
        messages: [{ role: 'user', content: classificationPrompt }]
      })
    });

    const data = await response.json();
    const fullText = data.content[0].text;
    
    const classificationMatch = fullText.match(/CLASSIFICATION:(\{.*?\})/s);
    const aiResponse = fullText.split('CLASSIFICATION:')[0].trim();
    const classification = classificationMatch 
      ? JSON.parse(classificationMatch[1]) 
      : { type: 'supplementing', reason: 'Could not classify', score_impact: 0 };

    res.status(200).json({ aiResponse, classification });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, filters, apiKey } = req.body;
    const FOLDER_ID = 'b1g74hvcfi6i7ujh6kg6';

    const exp = filters?.exp || 'any';
    const skills = filters?.skills || [];
    const extra = filters?.extra || '';

    let crit = [];
    if (exp !== 'any') crit.push(`Минимальный опыт: ${exp === '0' ? 'без опыта' : exp + ' лет'}`);
    if (skills.length) crit.push(`Обязательные навыки: ${skills.join(', ')}`);
    if (extra) crit.push(`Дополнительно: ${extra}`);

    const prompt = `Ты — опытный HR-специалист стоматологической клиники. Проанализируй резюме.

${crit.length ? 'КРИТЕРИИ:\n' + crit.map(c => '- ' + c).join('\n') : 'Оцени пригодность на должность ассистента стоматолога.'}

ТЕКСТ РЕЗЮМЕ:
${text.substring(0, 4000)}

Верни ТОЛЬКО JSON без markdown:
{"name":"Имя Фамилия","score":75,"experience_years":2,"education":"образование","summary":"2-3 предложения","skills_found":["навык"],"skills_missing":["навык"],"recommendation":"РЕКОМЕНДУЕТСЯ"}

recommendation только: РЕКОМЕНДУЕТСЯ, ВОЗМОЖНО или НЕ РЕКОМЕНДУЕТСЯ`;

    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${apiKey}`,
        'x-folder-id': FOLDER_ID
      },
      body: JSON.stringify({
        modelUri: `gpt://${FOLDER_ID}/yandexgpt/latest`,
        completionOptions: { stream: false, temperature: 0.1, maxTokens: 1000 },
        messages: [{ role: 'user', text: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      const details = err.message || err.error?.message || JSON.stringify(err);
return res.status(response.status).json({ error: `YandexGPT: ${details} (status: ${response.status})` });
    }

    const data = await response.json();
    const raw = data.result?.alternatives?.[0]?.message?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Не удалось разобрать ответ' });

    return res.status(200).json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

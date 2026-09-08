async function generateAIImage(prompt) {
  const cleanPrompt = (prompt || '').trim();
  if (!cleanPrompt || !process.env.GEMINI_API_KEY) return null;

  try {
    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const body = {
      contents: [{ parts: [{ text: `Generate an image: ${cleanPrompt}` }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('Gemini image generation failed with status', res.status, errText.slice(0, 300));
      return null;
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData && p.inlineData.data);
    if (!imagePart) return null;

    const mimeType = imagePart.inlineData.mimeType || 'image/png';
    return `data:${mimeType};base64,${imagePart.inlineData.data}`;
  } catch (err) {
    console.error('Gemini image generation failed:', err.message);
    return null;
  }
}

// NEW — lets Xyron actually "see" an uploaded photo: sends it to Gemini
// Vision and gets back a detailed text description (including any visible
// text in the image), which then flows into the chat as normal context.
async function describeImage(buffer, mimeType) {
  if (!process.env.GEMINI_API_KEY) {
    return '[An image was attached, but GEMINI_API_KEY is missing from backend/.env, so Xyron cannot see images yet.]';
  }

  try {
    const model = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const body = {
      contents: [{
        parts: [
          {
            text: 'Describe exactly what is in this image in detail: objects, people, layout, colors, and anything notable. If there is any visible text in the image, transcribe it exactly. Be thorough and factual, no guessing beyond what is visible.',
          },
          { inline_data: { mime_type: mimeType, data: buffer.toString('base64') } },
        ],
      }],
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('Gemini image description failed with status', res.status, errText.slice(0, 300));
      return '[Could not read this image — the vision request to Gemini failed.]';
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n');
    return (text && text.trim()) || '[The vision model returned no description for this image.]';
  } catch (err) {
    console.error('Gemini image description failed:', err.message);
    return `[Could not read this image: ${err.message}]`;
  }
}

module.exports = { generateAIImage, describeImage };
async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function sendChatMessage(sessionId, message, context) {
  return postJSON('/api/chat', { sessionId, message, ...(context ? { context } : {}) });
}

// images: array of base64 data URLs the person attached this turn (used for
// "add this photo to the ppt" style requests).
export async function streamChatMessage(sessionId, message, context, images, onDelta) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      message,
      ...(context ? { context } : {}),
      ...(images && images.length ? { images } : {}),
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json') || !res.body) {
    const data = await res.json();
    const reply = data.reply || '(empty response)';
    onDelta?.(reply, reply);
    return { reply, ppt: data.ppt, openUrl: data.openUrl };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalReply = '';
  let finalPpt;
  let finalOpenUrl;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;
      const payload = JSON.parse(line.slice(5).trim());
      if (payload.error) throw new Error(payload.error);
      if (payload.delta) {
        finalReply += payload.delta;
        onDelta?.(payload.delta, finalReply);
      }
      if (payload.done) {
        finalReply = payload.reply ?? finalReply;
        if (payload.ppt) finalPpt = payload.ppt;
        if (payload.openUrl) finalOpenUrl = payload.openUrl;
      }
    }
  }

  return { reply: finalReply, ppt: finalPpt, openUrl: finalOpenUrl };
}

export function loadHistory(sessionId) {
  return fetch(`/api/chat/${sessionId}`).then((r) => r.json());
}

export function clearHistory(sessionId) {
  return fetch(`/api/chat/${sessionId}`, { method: 'DELETE' }).then((r) => r.json());
}

export function generatePpt(topic, theme) {
  return postJSON('/api/create-ppt', { topic, theme });
}

export function generateImage(query) {
  return postJSON('/api/generate-image', { query });
}

export function findLink(query, site) {
  return postJSON('/api/find-link', { query, site });
}

export function securityScan() {
  return fetch('/api/security/scan').then((r) => r.json());
}

export function uploadContext(files) {
  const form = new FormData();
  Array.from(files).forEach((f) => form.append('files', f));
  return fetch('/api/upload-context', { method: 'POST', body: form }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Upload failed (${r.status})`);
    return data;
  });
}
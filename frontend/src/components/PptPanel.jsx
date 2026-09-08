import { useState } from 'react';
import { generatePpt } from '../api.js';

const THEMES = ['dark', 'ocean', 'sunset', 'forest'];

export default function PptPanel({ onLog }) {
  const [topic, setTopic] = useState('');
  const [theme, setTheme] = useState('dark');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    onLog('system', `Generating presentation on "${topic}"...`);
    try {
      const data = await generatePpt(topic.trim(), theme);
      onLog(
        'assistant',
        `Done! "${data.title}" — ${data.slideCount} slides. Download: ${window.location.origin}${data.downloadUrl}`
      );
    } catch (err) {
      onLog('system', `Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ppt-panel">
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Presentation topic..."
      />
      <select value={theme} onChange={(e) => setTheme(e.target.value)}>
        {THEMES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? 'Building...' : 'Create PPT'}
      </button>
    </div>
  );
}

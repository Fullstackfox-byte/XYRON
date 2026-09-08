import { useRef, useState } from 'react';

export default function InputBar({
  onSend,
  onToggleListen,
  isListening,
  voiceOn,
  onToggleVoice,
  onClear,
  status,
  onFilesSelected,
  attachedFiles,
  onRemoveFile,
  voices,
  voiceURI,
  onVoiceChange,
}) {
  const [text, setText] = useState('');
  const fileInputRef = useRef(null);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <div className="footer-controls">
      {attachedFiles?.length > 0 && (
        <div className="attachments-row">
          {attachedFiles.map((f, i) => (
            <span key={i} className="attachment-chip">
              {f.name}
              <button
                type="button"
                className="attachment-remove"
                onClick={() => onRemoveFile?.(i)}
                title="Remove file"
                aria-label={`Remove ${f.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="controls-bar">
        <button className="icon-btn" onClick={onToggleVoice} title={voiceOn ? 'Mute spoken replies' : 'Unmute spoken replies'}>
          {voiceOn ? '🔊' : '🔇'}
        </button>

        {voices?.length > 0 && (
          <select className="voice-select" value={voiceURI} onChange={(e) => onVoiceChange(e.target.value)} title="Voice">
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
            ))}
          </select>
        )}

        <button className="icon-btn" onClick={() => fileInputRef.current?.click()} title="Attach files or images">📎</button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.docx,.pptx,.txt,.csv,.md"
          style={{ display: 'none' }}
          onChange={(e) => { onFilesSelected(e.target.files); e.target.value = ''; }}
        />

        <button id="micButton" className={`icon-btn ${isListening ? 'active' : ''}`} onClick={onToggleListen} title="Tap to talk">🎙️</button>
        <button className="icon-btn" onClick={onClear} title="Clear conversation">🗑️</button>

        {status && <span className={`status ${status}`}>{status}</span>}
      </div>

      <form className="input-row" onSubmit={submit}>
        <span className="prompt-prefix">&gt;</span>
        <input
          id="typeInput"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          autoComplete="off"
        />
        <button id="sendBtn" type="submit">SEND</button>
      </form>
    </div>
  );
}
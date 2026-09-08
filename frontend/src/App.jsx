import { useEffect, useRef, useState } from 'react';
import Orb from './components/Orb.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import InputBar from './components/InputBar.jsx';
import { streamChatMessage, loadHistory, clearHistory, uploadContext } from './api.js';

const SESSION_KEY = 'xyron_session_id';

function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

// strip markdown/formatting junk so TTS doesn't read out symbols
function stripForSpeech(text) {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_~`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function App() {
  const [sessionId] = useState(getSessionId);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);

  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState('');

  const [attachedFiles, setAttachedFiles] = useState([]); // [{ name, file, contextText }]
  const [pendingContext, setPendingContext] = useState('');

  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const silenceTimerRef = useRef(null);

  useEffect(() => {
    loadHistory(sessionId).then((data) => {
      if (data.messages) setMessages(data.messages);
    });
  }, [sessionId]);

  // load available TTS voices, pick a natural-sounding default
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (!v.length) return;
      setVoices(v);
      setVoiceURI((prev) => prev || (
        v.find((x) => /Google UK English Female|Google US English|Microsoft Aria|Samantha|Zira/i.test(x.name))?.voiceURI
        || v.find((x) => x.lang?.startsWith('en'))?.voiceURI
        || v[0].voiceURI
      ));
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const nextMsgId = useRef(0);

  const addMessage = (role, content) => {
    setMessages((prev) => [...prev, { id: nextMsgId.current++, role, content }]);
  };

  // appends a message and returns a setter that updates that same message's
  // content (and optionally an attached `ppt` file card payload) in place,
  // used to stream tokens into it live
  const addStreamingMessage = (role) => {
    const id = nextMsgId.current++;
    setMessages((prev) => [...prev, { id, role, content: '', ppt: null }]);
    return (content, ppt) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content, ...(ppt ? { ppt } : {}) } : m)));
    };
  };

  const speak = (text) => {
    if (!voiceOn || !('speechSynthesis' in window)) {
      setStatus('');
      return;
    }
    window.speechSynthesis.cancel();
    const clean = stripForSpeech(text);
    const utter = new SpeechSynthesisUtterance(clean || text);
    const chosen = voices.find((v) => v.voiceURI === voiceURI);
    if (chosen) utter.voice = chosen;
    utter.onstart = () => setStatus('speaking');
    utter.onend = () => setStatus('');
    utter.onerror = () => setStatus('');
    window.speechSynthesis.speak(utter);
  };

  const sendMessage = async (text) => {
    addMessage('user', text);
    setStatus('thinking');
    const updateReply = addStreamingMessage('assistant');
    let sawFirstToken = false;
    try {
      const { reply, ppt, openUrl } = await streamChatMessage(sessionId, text, pendingContext || undefined, (_delta, soFar) => {
        if (!sawFirstToken) {
          sawFirstToken = true;
          setStatus('replying');
        }
        updateReply(soFar);
      });
      const finalReply = reply || '(empty response)';

      // "open youtube / play X on Y" style requests — actually navigate
      // there instead of just describing the link in text.
      if (openUrl) {
        window.open(openUrl, '_blank', 'noopener,noreferrer');
      }

      // TEMPORARY DEBUG LINE — open your browser's DevTools (F12) console,
      // generate a PPT, and check what this prints. Remove once confirmed.
      console.log('ppt data received from backend:', ppt);

      updateReply(finalReply, ppt);
      speak(finalReply);
      if (!voiceOn) setStatus('');
    } catch (err) {
      updateReply(`Error: ${err.message}`);
      setStatus('');
    } finally {
      setPendingContext('');
      setAttachedFiles([]);
    }
  };

  const rebuildPendingContext = (files) => {
    setPendingContext(files.map((f) => f.contextText).filter(Boolean).join('\n'));
  };

  const handleFilesSelected = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setStatus('uploading');
    try {
      const data = await uploadContext(files);
      setAttachedFiles((prev) => {
        const next = [...prev, { name: files.map((f) => f.name).join(', '), contextText: data.contextText }];
        rebuildPendingContext(next);
        return next;
      });
      addMessage('system', `Attached ${data.fileCount} file(s) — I'll use them for your next message.`);
    } catch (err) {
      addMessage('system', `Upload failed: ${err.message}`);
    } finally {
      setStatus('');
    }
  };

  const handleRemoveFile = (index) => {
    setAttachedFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      rebuildPendingContext(next);
      return next;
    });
  };

  const resetSilenceTimer = () => {
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      if (recognitionRef.current) recognitionRef.current.stop();
    }, 1800);
  };

  const initRecognition = () => {
    if (!SpeechRecognitionAPI) return null;
    const rec = new SpeechRecognitionAPI();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      resetSilenceTimer();
      let chunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) chunk += event.results[i][0].transcript;
      }
      if (chunk) finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + chunk.trim();
    };

    rec.onend = () => {
      clearTimeout(silenceTimerRef.current);
      setIsListening(false);
      setStatus('');
      const said = finalTranscriptRef.current.trim();
      finalTranscriptRef.current = '';
      if (said) sendMessage(said);
    };

    return rec;
  };

  const toggleListen = () => {
    if (!SpeechRecognitionAPI) {
      addMessage('system', 'Speech Recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    recognitionRef.current = recognitionRef.current || initRecognition();
    window.speechSynthesis.cancel();
    setIsListening(true);
    setStatus('listening');
    recognitionRef.current.start();
    resetSilenceTimer();
  };

  const handleClear = async () => {
    await clearHistory(sessionId);
    setMessages([]);
  };

  return (
    <div className="app-shell">
      <header>
        <div className="logo">
          <span className="dot" />
          XYRON <span className="sep">// AI ASSISTANT</span>
        </div>
      </header>

      {/* Aurora Glowing Particle Orb */}
      <Orb status={status} />

      <ChatWindow messages={messages} />

      <InputBar
        onSend={sendMessage}
        onToggleListen={toggleListen}
        isListening={isListening}
        voiceOn={voiceOn}
        onToggleVoice={() => {
          setVoiceOn((v) => !v);
          window.speechSynthesis.cancel();
        }}
        onClear={handleClear}
        status={status}
        onFilesSelected={handleFilesSelected}
        attachedFiles={attachedFiles}
        onRemoveFile={handleRemoveFile}
        voices={voices}
        voiceURI={voiceURI}
        onVoiceChange={setVoiceURI}
      />
    </div>
  );
}
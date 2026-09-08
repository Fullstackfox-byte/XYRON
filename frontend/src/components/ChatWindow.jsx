import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble.jsx';

export default function ChatWindow({ messages }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div id="transcript">
      {messages.length === 0 && (
        <div className="msg system">
          <div className="msg-body">Say something, or type below to start talking to Xyron.</div>
        </div>
      )}
      {messages.map((m) => (
        <MessageBubble key={m.id} role={m.role} content={m.content} ppt={m.ppt} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
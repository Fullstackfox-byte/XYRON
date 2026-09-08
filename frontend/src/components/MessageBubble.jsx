import React from 'react';

export default function MessageBubble({ role, content, ppt }) {
  const label = role === 'user' ? 'YOU' : role === 'assistant' ? 'XYRON' : 'SYSTEM';

  function renderContent(text) {
    if (typeof text !== 'string') return text;

    const URL_RE = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(URL_RE);

    return parts.map((part, i) => {
      const isUrl = i % 2 === 1;

      if (!isUrl) {
        return <span key={i}>{part}</span>;
      }

      const isDownloadable = /\.(pptx|pdf|docx|zip)(\?|$)/i.test(part);

      return React.createElement(
        'a',
        {
          key: i,
          href: part,
          target: '_blank',
          rel: 'noopener noreferrer',
          download: isDownloadable,
          className: 'msg-link',
        },
        isDownloadable ? 'Download file' : part
      );
    });
  }

  function renderPptCard() {
    if (!ppt || !ppt.downloadUrl) return null;

    const downloadLink = React.createElement(
      'a',
      {
        href: ppt.downloadUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
        download: true,
        className: 'file-card-btn',
      },
      'Download'
    );

    return (
      <div className="file-card">
        <div className="file-card-icon">📊</div>
        <div className="file-card-info">
          <div className="file-card-title">{ppt.title || 'Presentation'}.pptx</div>
          <div className="file-card-meta">{ppt.slideCount} slides · {ppt.theme || 'dark'} theme</div>
        </div>
        {downloadLink}
      </div>
    );
  }

  return (
    <div className={`msg ${role}`}>
      <div className="msg-label">{label}</div>
      <div className="msg-body">{renderContent(content)}</div>
      {renderPptCard()}
    </div>
  );
}
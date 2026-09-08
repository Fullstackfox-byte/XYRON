const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const conversationSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  messages: [messageSchema],
  // NEW — remembers the last presentation generated in this conversation
  // (its outline, theme, title image, and any photos already added), so a
  // later "add this photo to the ppt" message can rebuild it without
  // regenerating the whole outline from scratch.
  lastPpt: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);
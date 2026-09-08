const express = require('express');
const router = express.Router();
const multer = require('multer');
const { extractTextFromFile } = require('../utils/fileExtract');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // per file 25MB
});

router.post('/', upload.array('files', 100), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: 'No files received' });
    }

    let combined = '';
    for (const file of files) {
      const text = await extractTextFromFile(file);
      combined += `\n\n--- FILE: ${file.originalname} ---\n${text}`;
    }

    const MAX_CHARS = 60000;
    const trimmed = combined.length > MAX_CHARS
      ? combined.slice(0, MAX_CHARS) + '\n\n[...truncated, too large...]'
      : combined;

    res.json({ contextText: trimmed, fileCount: files.length });
  } catch (err) {
    console.error('Upload Context Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

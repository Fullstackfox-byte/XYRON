require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const chatRoutes = require('./routes/chat');
const pptRoutes = require('./routes/ppt');
const imageRoutes = require('./routes/image');
const uploadRoutes = require('./routes/upload');
const searchRoutes = require('./routes/search');
const securityRoutes = require('./routes/security');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '16mb' }));

const GENERATED_DIR = path.join(__dirname, 'generated');
if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR);
app.use('/generated', express.static(GENERATED_DIR));

app.use('/api/chat', chatRoutes);
app.use('/api/create-ppt', pptRoutes);
app.use('/api/generate-image', imageRoutes);
app.use('/api/upload-context', uploadRoutes);
app.use('/api/find-link', searchRoutes);
app.use('/api/security/scan', securityRoutes);

// Start the HTTP server immediately, independent of Mongo. Previously
// app.listen() only ran inside mongoose.connect().then(), so if Mongo
// failed to connect the whole server silently never bound to the port —
// every frontend request then hit a dead connection, and the Vite dev
// proxy returned its own generic "500" (not JSON), which is why the UI
// showed a bare "Error: Request failed (500)" with no real error text.
// Now the API is reachable even if Mongo is down, and routes that touch
// the DB will surface a real, specific error instead.
app.listen(PORT, () => console.log(`Xyron backend running at http://localhost:${PORT}`));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    console.error('Make sure MongoDB is running locally, or set MONGO_URI to your Atlas connection string in .env');
    console.error('The server is still running, but chat history (save/load) will fail until this is fixed.');
  });
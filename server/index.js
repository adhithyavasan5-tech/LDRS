require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { configureCloudinary } = require('./src/config/cloudinary');
const connectDB = require('./src/config/db');
const { rateLimiter } = require('./src/middleware/rateLimiter');
const userRoutes = require('./src/routes/userRoutes');
const roomRoutes = require('./src/routes/roomRoutes');
const coupleRoutes = require('./src/routes/coupleRoutes');
const historyRoutes = require('./src/routes/historyRoutes');
const initSocketHandlers = require('./src/sockets/roomSocket');
const { startUploadCleanupInterval } = require('./src/controllers/uploadController');

// Configure Cloudinary before handling uploads
configureCloudinary();

// ─── App Setup ────────────────────────────────────────────────────────────────
const app = express();
const httpServer = http.createServer(app);

// Increase timeouts for large video uploads (15 minutes / 900,000ms >= 10 mins)
httpServer.timeout = 15 * 60 * 1000;
httpServer.keepAliveTimeout = 15 * 60 * 1000;
httpServer.headersTimeout = 15 * 60 * 1000 + 5000;

const clientUrls = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((url) => url.trim())
  : [];

const allowedOrigins = Array.from(new Set([
  ...clientUrls,
  'http://localhost:5174',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean)));

// ─── Socket.io ───────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 1e7, // 10MB max message size
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2gb' }));
app.use(express.urlencoded({ limit: '2gb', extended: true }));
app.use(rateLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'LDRS Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/couple', coupleRoutes);
app.use('/api/history', historyRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── Socket.io Handlers ───────────────────────────────────────────────────────
initSocketHandlers(io);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  connectDB(); // connect DB asynchronously without blocking server start
  startUploadCleanupInterval();
  httpServer.listen(PORT, () => {
    console.log(`\n🚀 LDRS Server running on port ${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`   Client URL  : ${process.env.CLIENT_URL || 'http://localhost:5173'}\n`);
  });
};

startServer();

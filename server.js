const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Global variables for tracking
global.pingCount = 0;
global.lastPing = null;
global.startTime = Date.now();

// ==================== COMPLETE CORS FIX ====================
// Allow all origins for now (for testing)
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://restaurant-backend-7lyz.onrender.com',
  'https://your-frontend.vercel.app',
  'https://your-admin.vercel.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      console.log('Origin not allowed:', origin);
      callback(null, true); // Allow all for now
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Methods'
  ],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
  preflightContinue: false,
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Additional CORS headers middleware
app.use((req, res, next) => {
  // Allow all origins in development
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }
  
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'unknown'}`);
  
  // Track keep-alive pings
  if (req.path === '/api/keep-alive' || req.path === '/keep-alive' || req.path === '/ping') {
    global.pingCount++;
    global.lastPing = timestamp;
  }
  
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// ==================== ROUTES ====================

// Import route files
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const categoryRoutes = require('./routes/categoryRoutes');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/categories', categoryRoutes);

// ==================== KEEP-ALIVE ENDPOINTS ====================

// Simple ping endpoint (lightweight)
app.get('/ping', (req, res) => {
  res.status(200).json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    message: 'pong'
  });
});

// Detailed keep-alive endpoint with server stats
app.get('/api/keep-alive', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  const currentTime = new Date().toISOString();
  
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  const uptimeFormatted = `${days}d ${hours}h ${minutes}m ${seconds}s`;
  
  res.json({
    status: 'alive',
    message: 'Server is awake and running',
    timestamp: currentTime,
    uptime: {
      seconds: uptime,
      formatted: uptimeFormatted
    },
    ping: {
      count: global.pingCount || 0,
      lastPing: global.lastPing || 'Never',
      since: new Date(global.startTime).toISOString()
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
      }
    },
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';
    const memoryUsage = process.memoryUsage();
    const memoryHealthy = memoryUsage.heapUsed / memoryUsage.heapTotal < 0.9;
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbStatus,
        memory: memoryHealthy ? 'healthy' : 'warning',
        uptime: process.uptime()
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// ==================== STATUS PAGE ====================

// Serve status HTML page
app.get('/status', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'status.html'));
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    server: 'running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      orders: '/api/orders',
      expenses: '/api/expenses',
      notifications: '/api/notifications',
      categories: '/api/categories',
      keepAlive: '/api/keep-alive',
      health: '/health',
      status: '/status'
    }
  });
});

// ==================== ROOT ENDPOINT ====================

app.get('/', (req, res) => {
  res.json({ 
    message: '🍽️ Restaurant E-commerce API is running',
    version: '1.0.0',
    documentation: {
      status: '/status',
      health: '/health',
      api: '/api/status',
      keepAlive: '/api/keep-alive'
    },
    serverTime: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime() / 60)} minutes`
  });
});

// ==================== 404 HANDLER ====================

app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    availableEndpoints: {
      root: 'GET /',
      status: 'GET /status',
      health: 'GET /health',
      api: 'GET /api/status',
      keepAlive: 'GET /api/keep-alive',
      auth: 'POST /api/auth/login, POST /api/auth/register',
      products: 'GET /api/products, POST /api/products (admin)',
      categories: 'GET /api/categories'
    }
  });
});

// ==================== ERROR HANDLING MIDDLEWARE ====================

app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    message: message,
    error: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('\n=================================');
  console.log(`✅ Server started successfully`);
  console.log(`=================================`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚀 Port: ${PORT}`);
  console.log(`📡 API URL: http://localhost:${PORT}`);
  console.log(`📊 Status Page: http://localhost:${PORT}/status`);
  console.log(`💓 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔄 Keep Alive: http://localhost:${PORT}/api/keep-alive`);
  console.log(`=================================\n`);
});

// ==================== GRACEFUL SHUTDOWN ====================

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import configurations and routes
const connectDB = require('../config/db');
const fileRoutes = require('./routes/fileRoutes');

// Import services to initialize them
const ipfsService = require('./services/ipfsService');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] // Add your production domains
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting - global
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks in development
    return process.env.NODE_ENV === 'development' && req.path.includes('/health');
  }
});

app.use(globalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    ipfsConnected: ipfsService.getConnectionStatus()
  });
});

// API Documentation endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Decentralized File Metadata Manager API',
    version: '1.0.0',
    documentation: {
      endpoints: [
        {
          method: 'POST',
          path: '/api/files/upload',
          description: 'Upload a new file',
          body: 'multipart/form-data with file and owner',
          example: 'curl -X POST -F "file=@example.txt" -F "owner=user123" http://localhost:3000/api/files/upload'
        },
        {
          method: 'GET',
          path: '/api/files/:fileId',
          description: 'Get file metadata by fileId'
        },
        {
          method: 'GET',
          path: '/api/files/download/:fileId/:versionIndex?',
          description: 'Download file from IPFS'
        },
        {
          method: 'POST',
          path: '/api/files/update/:fileId',
          description: 'Add new version to existing file',
          body: 'multipart/form-data with file and uploadedBy'
        },
        {
          method: 'GET',
          path: '/api/files/verify/:fileId/:versionIndex',
          description: 'Verify file integrity'
        },
        {
          method: 'GET',
          path: '/api/files/owner/:owner',
          description: 'Get files by owner'
        },
        {
          method: 'DELETE',
          path: '/api/files/:fileId',
          description: 'Delete file (soft delete)',
          body: 'JSON with owner field'
        },
        {
          method: 'GET',
          path: '/api/files/system/status',
          description: 'Get IPFS node status'
        },
        {
          method: 'GET',
          path: '/api/files/system/search',
          description: 'Search files',
          query: 'query, owner, tags, page, limit'
        }
      ]
    },
    links: {
      health: '/health',
      ipfsStatus: '/api/files/system/status'
    }
  });
});

// API routes
app.use('/api/files', fileRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: {
      documentation: 'GET /',
      health: 'GET /health',
      files: 'GET|POST|DELETE /api/files/*'
    }
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }))
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  // MongoDB duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `Duplicate value for field: ${field}`
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  // Default error
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      error: error
    })
  });
});

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('HTTP server closed');
    
    // Close database connection
    require('mongoose').connection.close(() => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Start server
const server = app.listen(PORT, () => {
  console.log('=================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  MongoDB: ${process.env.MONGODB_URI}`);
  console.log(`📡 IPFS: ${process.env.IPFS_PROTOCOL}://${process.env.IPFS_HOST}:${process.env.IPFS_PORT}`);
  console.log(`🔗 API Documentation: http://localhost:${PORT}/`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
  console.log('=================================');
});

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;
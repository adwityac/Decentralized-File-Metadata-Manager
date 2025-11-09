const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const {
  uploadFile,
  getFileMetadata,
  downloadFile,
  addNewVersion,
  verifyFileIntegrity,
  getFilesByOwner,
  deleteFile,
  getIPFSStatus,
  searchFiles
} = require('../controllers/fileController');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 1 // Only one file per request
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types, but you can add restrictions here
    cb(null, true);
  }
});

// Rate limiting middleware
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 uploads per windowMs
  message: {
    success: false,
    message: 'Too many upload requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 downloads per windowMs
  message: {
    success: false,
    message: 'Too many download requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware to handle multer errors
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 100MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Only one file per request is allowed'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${error.message}`
    });
  }
  next(error);
};

// Routes

/**
 * @route   POST /api/files/upload
 * @desc    Upload a new file
 * @access  Public
 * @body    {owner, description?, tags?}
 * @file    file (required)
 */
router.post('/upload', 
  uploadLimiter,
  upload.single('file'),
  handleMulterError,
  uploadFile
);

/**
 * @route   GET /api/files/:fileId
 * @desc    Get file metadata by fileId
 * @access  Public
 */
router.get('/:fileId', getFileMetadata);

/**
 * @route   GET /api/files/download/:fileId/:versionIndex?
 * @desc    Download file from IPFS by fileId and optional version
 * @access  Public
 */
router.get('/download/:fileId/:versionIndex?', 
  downloadLimiter,
  downloadFile
);

/**
 * @route   POST /api/files/update/:fileId
 * @desc    Add new version to existing file
 * @access  Public
 * @body    {uploadedBy}
 * @file    file (required)
 */
router.post('/update/:fileId',
  uploadLimiter,
  upload.single('file'),
  handleMulterError,
  addNewVersion
);

/**
 * @route   GET /api/files/verify/:fileId/:versionIndex
 * @desc    Verify file integrity by comparing IPFS content with stored hash
 * @access  Public
 */
router.get('/verify/:fileId/:versionIndex', verifyFileIntegrity);

/**
 * @route   GET /api/files/owner/:owner
 * @desc    Get all files by owner
 * @access  Public
 * @query   {page?, limit?, sortBy?, sortOrder?}
 */
router.get('/owner/:owner', getFilesByOwner);

/**
 * @route   DELETE /api/files/:fileId
 * @desc    Delete file (soft delete)
 * @access  Public
 * @body    {owner}
 */
router.delete('/:fileId', deleteFile);

/**
 * @route   GET /api/files/system/status
 * @desc    Get IPFS node status and information
 * @access  Public
 */
router.get('/system/status', getIPFSStatus);

/**
 * @route   GET /api/files/system/search
 * @desc    Search files by query, owner, or tags
 * @access  Public
 * @query   {query?, owner?, tags?, page?, limit?}
 */
router.get('/system/search', searchFiles);

// Health check endpoint
router.get('/system/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'File service is healthy',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// Error handling middleware for this router
router.use((error, req, res, next) => {
  console.error('File route error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: Object.values(error.errors).map(err => err.message)
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;
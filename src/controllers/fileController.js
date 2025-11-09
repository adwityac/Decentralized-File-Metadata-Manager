const FileMetadata = require('../models/fileMetadata');
const ipfsService = require('../services/ipfsService');
const { 
  generateSHA256FromBuffer, 
  generateFileId, 
  verifyHash, 
  isValidSHA256 
} = require('../utils/hashUtils');

/**
 * Upload a new file
 * POST /api/files/upload
 */
const uploadFile = async (req, res) => {
  try {
    // Validate request
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const { owner, description, tags } = req.body;
    
    if (!owner) {
      return res.status(400).json({
        success: false,
        message: 'Owner ID is required'
      });
    }

    const fileBuffer = req.file.buffer;
    const originalFileName = req.file.originalname;
    const mimeType = req.file.mimetype;
    const fileSize = req.file.size;

    // Generate SHA256 hash
    const sha256Hash = generateSHA256FromBuffer(fileBuffer);
    console.log(`Generated SHA256 hash: ${sha256Hash}`);

    // Check if file with same hash already exists
    const existingFile = await FileMetadata.findByHash(sha256Hash);
    if (existingFile) {
      return res.status(409).json({
        success: false,
        message: 'File with identical content already exists',
        data: {
          existingFileId: existingFile.fileId,
          existingHash: sha256Hash
        }
      });
    }

    // Upload to IPFS
    const ipfsResult = await ipfsService.uploadFile(fileBuffer);
    const ipfsHash = ipfsResult.hash;
    console.log(`File uploaded to IPFS: ${ipfsHash}`);

    // Generate unique file ID
    const fileId = generateFileId(originalFileName, owner);

    // Create file metadata
    const fileMetadata = new FileMetadata({
      fileId,
      originalFileName,
      owner,
      description: description || '',
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      versions: [{
        versionNumber: 1,
        sha256Hash,
        ipfsHash,
        fileSize,
        mimeType,
        uploadedBy: owner
      }]
    });

    await fileMetadata.save();

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        fileId,
        originalFileName,
        owner,
        sha256Hash,
        ipfsHash,
        fileSize,
        mimeType,
        versionNumber: 1,
        uploadedAt: fileMetadata.versions[0].uploadedAt
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload file',
      error: error.message
    });
  }
};

/**
 * Get file metadata
 * GET /api/files/:fileId
 */
const getFileMetadata = async (req, res) => {
  try {
    const { fileId } = req.params;

    const fileMetadata = await FileMetadata.findOne({ 
      fileId, 
      isActive: true 
    });

    if (!fileMetadata) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        fileId: fileMetadata.fileId,
        originalFileName: fileMetadata.originalFileName,
        owner: fileMetadata.owner,
        description: fileMetadata.description,
        tags: fileMetadata.tags,
        versionCount: fileMetadata.versionCount,
        currentVersion: fileMetadata.currentVersion,
        versions: fileMetadata.versions,
        createdAt: fileMetadata.createdAt,
        updatedAt: fileMetadata.updatedAt
      }
    });

  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve file metadata',
      error: error.message
    });
  }
};

/**
 * Download file from IPFS
 * GET /api/files/download/:fileId/:versionIndex?
 */
const downloadFile = async (req, res) => {
  try {
    const { fileId, versionIndex } = req.params;

    const fileMetadata = await FileMetadata.findOne({ 
      fileId, 
      isActive: true 
    });

    if (!fileMetadata) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Get specific version or latest
    let version;
    if (versionIndex) {
      const versionNumber = parseInt(versionIndex);
      version = fileMetadata.getVersion(versionNumber);
      if (!version) {
        return res.status(404).json({
          success: false,
          message: `Version ${versionNumber} not found`
        });
      }
    } else {
      version = fileMetadata.getLatestVersion();
    }

    if (!version) {
      return res.status(404).json({
        success: false,
        message: 'No versions available'
      });
    }

    // Download from IPFS
    const fileBuffer = await ipfsService.downloadFile(version.ipfsHash);

    // Verify integrity
    const isValid = verifyHash(fileBuffer, version.sha256Hash);
    if (!isValid) {
      return res.status(500).json({
        success: false,
        message: 'File integrity verification failed'
      });
    }

    // Set response headers
    res.set({
      'Content-Type': version.mimeType,
      'Content-Length': fileBuffer.length,
      'Content-Disposition': `attachment; filename="${fileMetadata.originalFileName}"`,
      'X-File-Hash': version.sha256Hash,
      'X-IPFS-Hash': version.ipfsHash,
      'X-Version': version.versionNumber
    });

    res.send(fileBuffer);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file',
      error: error.message
    });
  }
};

/**
 * Add new version of existing file
 * POST /api/files/update/:fileId
 */
const addNewVersion = async (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const { uploadedBy } = req.body;
    
    if (!uploadedBy) {
      return res.status(400).json({
        success: false,
        message: 'uploadedBy is required'
      });
    }

    const fileMetadata = await FileMetadata.findOne({ 
      fileId, 
      isActive: true 
    });

    if (!fileMetadata) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const fileBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;
    const fileSize = req.file.size;

    // Generate SHA256 hash
    const sha256Hash = generateSHA256FromBuffer(fileBuffer);

    // Check if this version already exists
    const existingVersion = fileMetadata.versions.find(v => v.sha256Hash === sha256Hash);
    if (existingVersion) {
      return res.status(409).json({
        success: false,
        message: 'This version already exists',
        data: {
          existingVersion: existingVersion.versionNumber
        }
      });
    }

    // Upload to IPFS
    const ipfsResult = await ipfsService.uploadFile(fileBuffer);
    const ipfsHash = ipfsResult.hash;

    // Add new version
    const newVersion = fileMetadata.addVersion({
      sha256Hash,
      ipfsHash,
      fileSize,
      mimeType,
      uploadedBy
    });

    await fileMetadata.save();

    res.status(201).json({
      success: true,
      message: 'New version added successfully',
      data: {
        fileId: fileMetadata.fileId,
        versionNumber: newVersion.versionNumber,
        sha256Hash: newVersion.sha256Hash,
        ipfsHash: newVersion.ipfsHash,
        fileSize: newVersion.fileSize,
        mimeType: newVersion.mimeType,
        uploadedAt: newVersion.uploadedAt,
        uploadedBy: newVersion.uploadedBy
      }
    });

  } catch (error) {
    console.error('Add version error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add new version',
      error: error.message
    });
  }
};

/**
 * Verify file integrity
 * GET /api/files/verify/:fileId/:versionIndex
 */
const verifyFileIntegrity = async (req, res) => {
  try {
    const { fileId, versionIndex } = req.params;

    const fileMetadata = await FileMetadata.findOne({ 
      fileId, 
      isActive: true 
    });

    if (!fileMetadata) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Get specific version
    const versionNumber = parseInt(versionIndex);
    const version = fileMetadata.getVersion(versionNumber);
    
    if (!version) {
      return res.status(404).json({
        success: false,
        message: `Version ${versionNumber} not found`
      });
    }

    try {
      // Download file from IPFS
      const fileBuffer = await ipfsService.downloadFile(version.ipfsHash);

      // Verify hash
      const isValid = verifyHash(fileBuffer, version.sha256Hash);
      
      const verificationResult = {
        fileId,
        versionNumber,
        ipfsHash: version.ipfsHash,
        expectedHash: version.sha256Hash,
        actualHash: generateSHA256FromBuffer(fileBuffer),
        isValid,
        fileSize: fileBuffer.length,
        expectedFileSize: version.fileSize,
        sizesMatch: fileBuffer.length === version.fileSize,
        verifiedAt: new Date()
      };

      res.status(200).json({
        success: true,
        message: isValid ? 'File integrity verified' : 'File integrity verification failed',
        data: verificationResult
      });

    } catch (ipfsError) {
      res.status(500).json({
        success: false,
        message: 'Failed to download file from IPFS for verification',
        error: ipfsError.message,
        data: {
          fileId,
          versionNumber,
          ipfsHash: version.ipfsHash
        }
      });
    }

  } catch (error) {
    console.error('Verify integrity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify file integrity',
      error: error.message
    });
  }
};

/**
 * List files by owner
 * GET /api/files/owner/:owner
 */
const getFilesByOwner = async (req, res) => {
  try {
    const { owner } = req.params;
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder: sortOrder === 'asc' ? 1 : -1
    };

    const files = await FileMetadata.findByOwner(owner, options);
    const totalCount = await FileMetadata.countDocuments({ owner, isActive: true });

    res.status(200).json({
      success: true,
      data: {
        files: files.map(file => ({
          fileId: file.fileId,
          originalFileName: file.originalFileName,
          owner: file.owner,
          description: file.description,
          tags: file.tags,
          versionCount: file.versionCount,
          currentVersion: file.currentVersion,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt
        })),
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(totalCount / options.limit),
          totalCount,
          hasNext: options.page < Math.ceil(totalCount / options.limit),
          hasPrev: options.page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get files by owner error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve files',
      error: error.message
    });
  }
};

/**
 * Delete file (soft delete)
 * DELETE /api/files/:fileId
 */
const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { owner } = req.body;

    if (!owner) {
      return res.status(400).json({
        success: false,
        message: 'Owner verification required'
      });
    }

    const fileMetadata = await FileMetadata.findOne({ 
      fileId, 
      owner, 
      isActive: true 
    });

    if (!fileMetadata) {
      return res.status(404).json({
        success: false,
        message: 'File not found or access denied'
      });
    }

    // Soft delete
    fileMetadata.isActive = false;
    await fileMetadata.save();

    res.status(200).json({
      success: true,
      message: 'File deleted successfully',
      data: {
        fileId,
        deletedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error.message
    });
  }
};

/**
 * Get IPFS node status
 * GET /api/files/status
 */
const getIPFSStatus = async (req, res) => {
  try {
    const isConnected = ipfsService.getConnectionStatus();
    
    if (!isConnected) {
      return res.status(503).json({
        success: false,
        message: 'IPFS service is not connected',
        data: { connected: false }
      });
    }

    const nodeInfo = await ipfsService.getNodeInfo();

    res.status(200).json({
      success: true,
      message: 'IPFS service is running',
      data: {
        connected: true,
        ...nodeInfo
      }
    });

  } catch (error) {
    console.error('IPFS status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get IPFS status',
      error: error.message
    });
  }
};

/**
 * Search files
 * GET /api/files/search
 */
const searchFiles = async (req, res) => {
  try {
    const { query, owner, tags, page = 1, limit = 10 } = req.query;

    if (!query && !owner && !tags) {
      return res.status(400).json({
        success: false,
        message: 'At least one search parameter is required'
      });
    }

    let searchConditions = { isActive: true };

    // Text search in filename and description
    if (query) {
      searchConditions.$or = [
        { originalFileName: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ];
    }

    // Filter by owner
    if (owner) {
      searchConditions.owner = owner;
    }

    // Filter by tags
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      searchConditions.tags = { $in: tagArray };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [files, totalCount] = await Promise.all([
      FileMetadata.find(searchConditions)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      FileMetadata.countDocuments(searchConditions)
    ]);

    res.status(200).json({
      success: true,
      data: {
        files: files.map(file => ({
          fileId: file.fileId,
          originalFileName: file.originalFileName,
          owner: file.owner,
          description: file.description,
          tags: file.tags,
          versionCount: file.versionCount,
          currentVersion: file.currentVersion,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
          hasPrev: parseInt(page) > 1
        },
        searchCriteria: { query, owner, tags }
      }
    });

  } catch (error) {
    console.error('Search files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search files',
      error: error.message
    });
  }
};

module.exports = {
  uploadFile,
  getFileMetadata,
  downloadFile,
  addNewVersion,
  verifyFileIntegrity,
  getFilesByOwner,
  deleteFile,
  getIPFSStatus,
  searchFiles
};
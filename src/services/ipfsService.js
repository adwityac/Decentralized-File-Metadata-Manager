// Patch global fetch for Node 18+ duplex requirement
if (typeof fetch === 'function') {
  const originalFetch = fetch;
  global.fetch = (url, options = {}) => {
    if (options.body && !options.duplex) {
      options.duplex = 'half';
    }
    return originalFetch(url, options);
  };
}


const { create } = require('ipfs-http-client');
require('dotenv').config();

class IPFSService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.init();
  }

  /**
   * Initialize IPFS client connection
   */
  async init() {
  try {
    const ipfsConfig = {
      host: process.env.IPFS_HOST || '127.0.0.1',
      port: process.env.IPFS_PORT || 5001,
      protocol: process.env.IPFS_PROTOCOL || 'http'
    };

    // Use 127.0.0.1 instead of localhost for Windows IPFS Desktop
    const ipfsUrl = process.env.IPFS_API_URL || `${ipfsConfig.protocol}://${ipfsConfig.host}:${ipfsConfig.port}`;

    console.log(`Connecting to IPFS at ${ipfsUrl}`);

    // Connect to local IPFS node (no auth required)
    this.client = create({ url: ipfsUrl });

    // Test connection
    await this.testConnection();
    this.isConnected = true;
    console.log('✅ IPFS client initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize IPFS client:', error.message);
    this.isConnected = false;
  }
}


  /**
   * Test IPFS connection
   */
  async testConnection() {
    try {
      const version = await this.client.version();
      console.log(`Connected to IPFS node version: ${version.version}`);
      return true;
    } catch (error) {
      throw new Error(`IPFS connection test failed: ${error.message}`);
    }
  }

  /**
   * Upload file to IPFS
   * @param {Buffer} fileBuffer - File buffer to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} - Upload result with hash and size
   */
  async uploadFile(fileBuffer, options = {}) {
    if (!this.isConnected) {
      throw new Error('IPFS client is not connected');
    }

    try {
      const uploadOptions = {
        pin: true, // Pin the file to prevent garbage collection
        wrapWithDirectory: false,
        timeout: 60000, // 60 second timeout
        ...options
      };

      console.log(`Uploading file to IPFS (size: ${fileBuffer.length} bytes)`);
      
      const result = await this.client.add(fileBuffer, uploadOptions);
    
      const uploadResult = {
        hash: result.cid.toString(),
        size: result.size,
        path: result.path
      };

      console.log(`File uploaded to IPFS successfully: ${uploadResult.hash}`);
      return uploadResult;

    } catch (error) {
      console.error('IPFS upload error:', error);
      throw new Error(`Failed to upload file to IPFS: ${error.message}`);
    }
  }

  /**
   * Download file from IPFS
   * @param {string} hash - IPFS hash (CID)
   * @param {Object} options - Download options
   * @returns {Promise<Buffer>} - File buffer
   */
  async downloadFile(hash, options = {}) {
    if (!this.isConnected) {
      throw new Error('IPFS client is not connected');
    }

    try {
      const downloadOptions = {
        timeout: 60000, // 60 second timeout
        ...options
      };

      console.log(`Downloading file from IPFS: ${hash}`);
      
      const chunks = [];
      
      for await (const chunk of this.client.cat(hash, downloadOptions)) {
        chunks.push(chunk);
      }
      
      const fileBuffer = Buffer.concat(chunks);
      console.log(`File downloaded from IPFS successfully (size: ${fileBuffer.length} bytes)`);
      
      return fileBuffer;

    } catch (error) {
      console.error('IPFS download error:', error);
      throw new Error(`Failed to download file from IPFS: ${error.message}`);
    }
  }

  /**
   * Get file stats from IPFS
   * @param {string} hash - IPFS hash (CID)
   * @returns {Promise<Object>} - File stats
   */
  async getFileStats(hash) {
    if (!this.isConnected) {
      throw new Error('IPFS client is not connected');
    }

    try {
      const stats = await this.client.files.stat(`/ipfs/${hash}`);
      return {
        hash: stats.cid.toString(),
        size: stats.size,
        blocks: stats.blocks,
        type: stats.type
      };
    } catch (error) {
      console.error('IPFS stats error:', error);
      throw new Error(`Failed to get file stats from IPFS: ${error.message}`);
    }
  }

  /**
   * Check if file exists on IPFS
   * @param {string} hash - IPFS hash (CID)
   * @returns {Promise<boolean>} - True if file exists
   */
  async fileExists(hash) {
    try {
      await this.getFileStats(hash);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Pin file to IPFS node
   * @param {string} hash - IPFS hash (CID)
   * @returns {Promise<Object>} - Pin result
   */
  async pinFile(hash) {
    if (!this.isConnected) {
      throw new Error('IPFS client is not connected');
    }

    try {
      console.log(`Pinning file to IPFS: ${hash}`);
      const result = await this.client.pin.add(hash);
      console.log(`File pinned successfully: ${hash}`);
      return { hash: result.toString() };
    } catch (error) {
      console.error('IPFS pin error:', error);
      throw new Error(`Failed to pin file to IPFS: ${error.message}`);
    }
  }

  /**
   * Unpin file from IPFS node
   * @param {string} hash - IPFS hash (CID)
   * @returns {Promise<Object>} - Unpin result
   */
  async unpinFile(hash) {
    if (!this.isConnected) {
      throw new Error('IPFS client is not connected');
    }

    try {
      console.log(`Unpinning file from IPFS: ${hash}`);
      const result = await this.client.pin.rm(hash);
      console.log(`File unpinned successfully: ${hash}`);
      return { hash: result.toString() };
    } catch (error) {
      console.error('IPFS unpin error:', error);
      throw new Error(`Failed to unpin file from IPFS: ${error.message}`);
    }
  }

/**
 * Get IPFS node info (BigInt-safe)
 */
async getNodeInfo() {
  if (!this.isConnected) {
    throw new Error('IPFS client is not connected');
  }

  try {
    const [version, repo] = await Promise.all([
      this.client.version(),
      this.client.repo.stat()
    ]);

    let nodeId = null;
    let addresses = [];

    // Try normal client.id()
    try {
      const id = await this.client.id();
      nodeId = id.id;
      addresses = id.addresses || [];
    } catch (err) {
      console.warn('⚠️ Standard client.id() failed, falling back to manual fetch:', err.message);

      const response = await fetch('http://127.0.0.1:5001/api/v0/id');
      const text = await response.text();

      const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('{') && !l.startsWith('}'));
      let parsed = {};

      for (const line of lines) {
        if (line.startsWith('ID:')) parsed.ID = line.replace('ID:', '').trim().replace(/,$/, '');
        if (line.startsWith('Addresses:')) {
          const addrBlock = [];
          let i = lines.indexOf(line) + 1;
          while (i < lines.length && lines[i].startsWith('/')) {
            addrBlock.push(lines[i].replace(/,$/, ''));
            i++;
          }
          parsed.Addresses = addrBlock;
        }
      }

      nodeId = parsed.ID || 'unknown';
      addresses = parsed.Addresses || [];
    }

    // Convert any BigInt → Number safely
    const safeRepo = Object.fromEntries(
      Object.entries(repo).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])
    );

    // Filter out quic-v1 addresses
    const safeAddresses = (addresses || []).filter(addr => !addr.includes('quic-v1'));

    const repoSizeNum = Number(safeRepo.repoSize);
    const storageMaxNum = Number(safeRepo.storageMax);
    const repoUsagePercent = ((repoSizeNum / storageMaxNum) * 100).toFixed(2);

    return {
      version: version.version,
      nodeId,
      addresses: safeAddresses,
      repoSize: repoSizeNum,
      storageMax: storageMaxNum,
      repoUsagePercent: `${repoUsagePercent}%`,
      numObjects: Number(safeRepo.numObjects) || 0
    };

  } catch (error) {
    throw new Error(`Failed to get IPFS node info: ${error.message}`);
  }
}




  /**
   * Get connection status
   * @returns {boolean} - Connection status
   */
  getConnectionStatus() {
    return this.isConnected;
  }
}

// Create and export singleton instance
const ipfsService = new IPFSService();
module.exports = ipfsService;
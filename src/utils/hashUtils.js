const crypto = require('crypto');
const fs = require('fs');
const { promisify } = require('util');

/**
 * Generate SHA256 hash from a buffer
 * @param {Buffer} buffer - File buffer
 * @returns {string} - SHA256 hash in hexadecimal
 */
const generateSHA256FromBuffer = (buffer) => {
  try {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  } catch (error) {
    throw new Error(`Failed to generate SHA256 hash: ${error.message}`);
  }
};

/**
 * Generate SHA256 hash from a file path
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - SHA256 hash in hexadecimal
 */
const generateSHA256FromFile = async (filePath) => {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => {
        hash.update(data);
      });
      
      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });
      
      stream.on('error', (error) => {
        reject(new Error(`Failed to read file for hashing: ${error.message}`));
      });
      
    } catch (error) {
      reject(new Error(`Failed to generate SHA256 hash from file: ${error.message}`));
    }
  });
};

/**
 * Verify if a buffer matches the expected hash
 * @param {Buffer} buffer - File buffer
 * @param {string} expectedHash - Expected SHA256 hash
 * @returns {boolean} - True if hashes match
 */
const verifyHash = (buffer, expectedHash) => {
  try {
    const actualHash = generateSHA256FromBuffer(buffer);
    return actualHash.toLowerCase() === expectedHash.toLowerCase();
  } catch (error) {
    console.error('Hash verification error:', error);
    return false;
  }
};

/**
 * Verify if a file matches the expected hash
 * @param {string} filePath - Path to the file
 * @param {string} expectedHash - Expected SHA256 hash
 * @returns {Promise<boolean>} - True if hashes match
 */
const verifyFileHash = async (filePath, expectedHash) => {
  try {
    const actualHash = await generateSHA256FromFile(filePath);
    return actualHash.toLowerCase() === expectedHash.toLowerCase();
  } catch (error) {
    console.error('File hash verification error:', error);
    return false;
  }
};

/**
 * Generate a unique file ID based on original name and timestamp
 * @param {string} originalName - Original filename
 * @param {string} owner - File owner
 * @returns {string} - Unique file ID
 */
const generateFileId = (originalName, owner) => {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(4).toString('hex');
  const input = `${originalName}_${owner}_${timestamp}_${randomBytes}`;
  return crypto.createHash('md5').update(input).digest('hex');
};

/**
 * Validate SHA256 hash format
 * @param {string} hash - Hash to validate
 * @returns {boolean} - True if valid SHA256 format
 */
const isValidSHA256 = (hash) => {
  if (!hash || typeof hash !== 'string') {
    return false;
  }
  return /^[a-f0-9]{64}$/i.test(hash);
};

/**
 * Generate checksum for data integrity verification
 * @param {Buffer|string} data - Data to checksum
 * @returns {string} - MD5 checksum
 */
const generateChecksum = (data) => {
  return crypto.createHash('md5').update(data).digest('hex');
};

/**
 * Compare two hashes securely (constant-time comparison)
 * @param {string} hash1 - First hash
 * @param {string} hash2 - Second hash
 * @returns {boolean} - True if hashes match
 */
const secureCompare = (hash1, hash2) => {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) {
    return false;
  }
  
  try {
    const buf1 = Buffer.from(hash1, 'hex');
    const buf2 = Buffer.from(hash2, 'hex');
    return crypto.timingSafeEqual(buf1, buf2);
  } catch (error) {
    console.error('Secure compare error:', error);
    return false;
  }
};

module.exports = {
  generateSHA256FromBuffer,
  generateSHA256FromFile,
  verifyHash,
  verifyFileHash,
  generateFileId,
  isValidSHA256,
  generateChecksum,
  secureCompare
};
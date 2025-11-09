const mongoose = require('mongoose');

const fileVersionSchema = new mongoose.Schema({
  versionNumber: {
    type: Number,
    required: true,
    min: 1
  },
  sha256Hash: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^[a-f0-9]{64}$/i.test(v);
      },
      message: 'Invalid SHA256 hash format'
    }
  },
  ipfsHash: {
    type: String,
    required: true,
    trim: true
  },
  fileSize: {
    type: Number,
    required: true,
    min: 0
  },
  mimeType: {
    type: String,
    required: true,
    trim: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  uploadedBy: {
    type: String,
    required: true,
    trim: true
  }
});

const fileMetadataSchema = new mongoose.Schema({
  fileId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  originalFileName: {
    type: String,
    required: true,
    trim: true
  },
  owner: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  versions: [fileVersionSchema],
  tags: [{
    type: String,
    trim: true
  }],
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
fileMetadataSchema.index({ owner: 1, createdAt: -1 });
fileMetadataSchema.index({ 'versions.sha256Hash': 1 });
fileMetadataSchema.index({ 'versions.ipfsHash': 1 });

// Virtual for current version
fileMetadataSchema.virtual('currentVersion').get(function() {
  if (this.versions && this.versions.length > 0) {
    return this.versions[this.versions.length - 1];
  }
  return null;
});

// Virtual for version count
fileMetadataSchema.virtual('versionCount').get(function() {
  return this.versions ? this.versions.length : 0;
});

// Method to add new version
fileMetadataSchema.methods.addVersion = function(versionData) {
  const nextVersionNumber = this.versions.length + 1;
  const newVersion = {
    versionNumber: nextVersionNumber,
    ...versionData
  };
  
  this.versions.push(newVersion);
  this.updatedAt = new Date();
  
  return newVersion;
};

// Method to get version by number
fileMetadataSchema.methods.getVersion = function(versionNumber) {
  return this.versions.find(v => v.versionNumber === parseInt(versionNumber));
};

// Method to get latest version
fileMetadataSchema.methods.getLatestVersion = function() {
  if (this.versions.length === 0) return null;
  return this.versions[this.versions.length - 1];
};

// Pre-save middleware
fileMetadataSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to find by owner
fileMetadataSchema.statics.findByOwner = function(owner, options = {}) {
  const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = -1 } = options;
  const skip = (page - 1) * limit;
  
  return this.find({ owner, isActive: true })
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit);
};

// Static method to find by hash
fileMetadataSchema.statics.findByHash = function(hash) {
  return this.findOne({
    'versions.sha256Hash': hash,
    isActive: true
  });
};

module.exports = mongoose.model('FileMetadata', fileMetadataSchema);
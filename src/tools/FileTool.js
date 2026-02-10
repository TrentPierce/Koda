/**
 * Koda - Intelligent Browser Automation Library
 * This project uses Koda by Trent Pierce
 * https://github.com/TrentPierce/Koda
 * Licensed under the Koda Non-Commercial License
 *
 * Copyright (c) 2026 Trent Pierce. All rights reserved.
 * See LICENSE file for full terms.
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class FileTool extends EventEmitter {
  /**
     * Create file tool
     * @param {Object} config - Configuration
     */
  constructor(config = {}) {
    super();
        
    this.config = {
      baseDir: path.resolve(config.baseDir || process.cwd()),
      allowedExtensions: config.allowedExtensions || null,
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
      ...config
    };
  }
    
  /**
     * Execute file operation
     * @param {string} operation - Operation type
     * @param {Object} options - Operation options
     * @returns {Promise<any>} Result
     */
  async execute(operation, options = {}) {
    this.emit('executing', { operation, options });
        
    try {
      let result;
            
      switch (operation) {
        case 'read':
          result = await this.read(options.path, options.encoding);
          break;
                
        case 'write':
          result = await this.write(options.path, options.content, options.encoding);
          break;
                
        case 'append':
          result = await this.append(options.path, options.content, options.encoding);
          break;
                
        case 'delete':
          result = await this.delete(options.path);
          break;
                
        case 'list':
          result = await this.list(options.path);
          break;
                
        case 'exists':
          result = await this.exists(options.path);
          break;
                
        case 'stat':
          result = await this.stat(options.path);
          break;
                
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
            
      this.emit('executed', { operation, result });
            
      return result;
    } catch (error) {
      this.emit('executionFailed', { operation, error: error.message });
      throw error;
    }
  }
    
  /**
     * Read file
     * @private
     */
  async read(filePath, encoding = 'utf8') {
    const fullPath = this.resolvePath(filePath);
    this.validatePath(fullPath);
    await this.rejectSymlinkPath(fullPath);

    return await fs.readFile(fullPath, encoding);
  }
    
  /**
     * Write file
     * @private
     */
  async write(filePath, content, encoding = 'utf8') {
    const fullPath = this.resolvePath(filePath);
    this.validatePath(fullPath);
    await this.rejectSymlinkPath(fullPath, true);

    await fs.writeFile(fullPath, content, encoding);
    return { success: true, path: fullPath };
  }
    
  /**
     * Append to file
     * @private
     */
  async append(filePath, content, encoding = 'utf8') {
    const fullPath = this.resolvePath(filePath);
    this.validatePath(fullPath);
    await this.rejectSymlinkPath(fullPath, true);

    await fs.appendFile(fullPath, content, encoding);
    return { success: true, path: fullPath };
  }
    
  /**
     * Delete file
     * @private
     */
  async delete(filePath) {
    const fullPath = this.resolvePath(filePath);
    this.validatePath(fullPath);
    await this.rejectSymlinkPath(fullPath);

    await fs.unlink(fullPath);
    return { success: true, path: fullPath };
  }
    
  /**
     * List directory
     * @private
     */
  async list(dirPath) {
    const fullPath = this.resolvePath(dirPath);
    this.validatePath(fullPath);
    await this.rejectSymlinkPath(fullPath);

    const entries = await fs.readdir(fullPath, { withFileTypes: true });
        
    return entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile()
    }));
  }
    
  /**
     * Check if path exists
     * @private
     */
  async exists(filePath) {
    const fullPath = this.resolvePath(filePath);
        
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
    
  /**
     * Get file stats
     * @private
     */
  async stat(filePath) {
    const fullPath = this.resolvePath(filePath);
    this.validatePath(fullPath);
    await this.rejectSymlinkPath(fullPath);

    const stats = await fs.stat(fullPath);
        
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile()
    };
  }
    

  /**
     * Reject symlink paths to prevent traversal via links
     * @private
     */
  async rejectSymlinkPath(fullPath, allowMissing = false) {
    try {
      const stats = await fs.lstat(fullPath);
      if (stats.isSymbolicLink()) {
        throw new Error('Symlink paths are not allowed');
      }
    } catch (error) {
      if (allowMissing && error.code === 'ENOENT') {
        return;
      }
      if (error.code === 'ENOENT') {
        throw error;
      }
      throw error;
    }
  }

  /**
     * Resolve path relative to base directory
     * @private
     */
  resolvePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('A valid file path is required');
    }

    return path.resolve(this.config.baseDir, filePath);
  }
    
  /**
     * Validate path
     * @private
     */
  validatePath(fullPath) {
    const relativePath = path.relative(this.config.baseDir, fullPath);

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error('Path is outside allowed base directory');
    }

    if (this.config.allowedExtensions) {
      const ext = path.extname(fullPath);
      if (!this.config.allowedExtensions.includes(ext)) {
        throw new Error(`File extension '${ext}' not allowed`);
      }
    }
  }
}

module.exports = { FileTool };
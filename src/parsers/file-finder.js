const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

class FileFinder {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.targetFiles = ['controller.js', 'validator.js', 'authenticator.js', 'router.js'];
  }

  /**
   * Find target files in the specified search paths
   * Searches in: /app, /app/*, and root /
   */
  async findMicroserviceFiles() {
    const searchPaths = [
      path.join(this.projectRoot, 'app'),           // /app
      path.join(this.projectRoot, 'app', '*'),      // /app/*
      this.projectRoot                              // root /
    ];

    const foundFiles = {
      controller: null,
      validator: null,
      authenticator: null,
      router: null
    };

    for (const searchPath of searchPaths) {
      console.log(`Searching in: ${searchPath}`);
      
      for (const targetFile of this.targetFiles) {
        const fileType = path.basename(targetFile, '.js');
        
        // Skip if already found
        if (foundFiles[fileType]) continue;

        const pattern = path.join(searchPath, targetFile);
        const matches = glob.sync(pattern);

        if (matches.length > 0) {
          foundFiles[fileType] = matches[0];
          console.log(`Found ${fileType}: ${matches[0]}`);
        }
      }
    }

    return foundFiles;
  }

  /**
   * Validate that essential files exist
   */
  validateFiles(files) {
    const required = ['router'];
    const missing = required.filter(type => !files[type]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required files: ${missing.join(', ')}`);
    }

    return true;
  }
}

module.exports = FileFinder;

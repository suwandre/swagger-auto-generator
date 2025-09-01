import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export class FileUtils {
  static async findFiles(pattern: string, basePath: string): Promise<string[]> {
    try {
      const files = await glob(pattern, { cwd: basePath });
      return files.map(file => path.resolve(basePath, file));
    } catch (error) {
      console.warn(`Failed to find files with pattern ${pattern}:`, error);
      return [];
    }
  }

  static readFileContent(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  static async findMicroserviceFiles(
    basePath: string, 
    includePatterns?: string[], 
    excludePatterns?: string[]
  ): Promise<{ [key: string]: string[] }> {
    console.log(`🔎 Scanning directory: ${basePath}`);

    if (!fs.existsSync(basePath)) {
      throw new Error(`Input directory does not exist: ${basePath}`);
    }

    const patterns = includePatterns || [
      '**/controller.js',
      '**/router.js',
      '**/validator.js',
      '**/authenticator.js'
    ];

    console.log('🔍 Include patterns:', patterns);

    const allFiles: { [key: string]: string[] } = {};
    const processedFiles = new Set<string>(); // Prevent duplicates

    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, { 
          cwd: basePath,
          ignore: excludePatterns || []
        });

        console.log(`✅ Pattern '${pattern}' found ${files.length} file(s)`);

        const category = this.categorizeFile(pattern);

        for (const file of files) {
          if (!file) continue; // Skip undefined/empty files
          
          const resolvedPath = path.resolve(basePath, file);
          
          if (!processedFiles.has(resolvedPath)) {
            processedFiles.add(resolvedPath);
            if (!allFiles[category]) {
              allFiles[category] = [];
            }
            allFiles[category].push(resolvedPath);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing pattern '${pattern}':`, error);
      }
    }

    // Log final results
    Object.keys(allFiles).forEach(category => {
      console.log(`📁 ${category}: ${allFiles[category].length} files`);
    });

    return allFiles;
  }

  private static categorizeFile(pattern: string): string {
    if (pattern.includes('controller')) return 'controllers';
    if (pattern.includes('router') || pattern.includes('routes')) return 'routers';
    if (pattern.includes('validator')) return 'validators';
    if (pattern.includes('auth')) return 'authenticators';
    return 'unknown';
  }
}

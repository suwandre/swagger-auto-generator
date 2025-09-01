import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export class FileUtils {
  static async findFiles(pattern: string, basePath: string): Promise<string[]> {
    const files = await glob(pattern, { cwd: basePath });
    return files.map(file => path.resolve(basePath, file));
  }

  static readFileContent(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
  }

  static async findMicroserviceFiles(basePath: string) {
    const patterns = [
      '**/controller.js',
      '**/controllers/*.js',
      '**/router.js',
      '**/routes/*.js',
      '**/validator.js',
      '**/validators/*.js',
      '**/auth*.js'
    ];

    const allFiles: { [key: string]: string[] } = {};
    
    for (const pattern of patterns) {
      const files = await this.findFiles(pattern, basePath);
      const category = this.categorizeFile(pattern);
      allFiles[category] = [...(allFiles[category] || []), ...files];
    }

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

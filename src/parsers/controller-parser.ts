import { ASTParser } from '../utils/ast-utils';
import { FileUtils } from '../utils/file-utils';
import { ParsedFunction, SwaggerEndpoint } from '../types';

export class ControllerParser {
  static async parseControllers(filePaths: string[]): Promise<SwaggerEndpoint[]> {
    const endpoints: SwaggerEndpoint[] = [];
    
    for (const filePath of filePaths) {
      const content = FileUtils.readFileContent(filePath);
      const functions = ASTParser.parseFile(content);
      
      for (const func of functions) {
        const endpoint = this.convertToSwaggerEndpoint(func, filePath);
        if (endpoint) {
          endpoints.push(endpoint);
        }
      }
    }
    
    return endpoints;
  }

  private static convertToSwaggerEndpoint(func: ParsedFunction, filePath: string): SwaggerEndpoint | null {
    // Skip private functions (starting with _)
    if (func.name.startsWith('_')) return null;

    const basePath = this.extractBasePathFromFile(filePath);
    const route = func.route || this.generateRouteFromFunction(func.name, basePath);

    return {
      path: route,
      method: func.httpMethod || 'GET',
      summary: this.generateSummary(func),
      parameters: this.convertParameters(func.parameters),
      responses: this.generateResponses(),
      tags: [this.extractTagFromFile(filePath)]
    };
  }

  private static extractBasePathFromFile(filePath: string): string {
    const pathParts = filePath.split('/');
    const controllerFile = pathParts[pathParts.length - 1];
    const baseName = controllerFile.replace(/controller\.js$|\.js$/, '');
    return `/${baseName.toLowerCase()}`;
  }

  private static generateRouteFromFunction(funcName: string, basePath: string): string {
    // Convert function names like 'getUserById' to '/user/{id}'
    const cleanName = funcName.replace(/^(get|post|put|delete|patch)/i, '');
    
    if (cleanName.toLowerCase().includes('byid')) {
      return `${basePath}/{id}`;
    }
    
    if (cleanName) {
      return `${basePath}/${cleanName.toLowerCase()}`;
    }
    
    return basePath;
  }

  private static generateSummary(func: ParsedFunction): string {
    // Extract from comments or generate from function name
    const commentSummary = func.comments.find(c => 
      c.includes('@summary') || c.includes('@description')
    );
    
    if (commentSummary) {
      return commentSummary.replace(/[@*\/]/g, '').replace(/summary|description/i, '').trim();
    }
    
    // Generate from function name
    return func.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }

  private static convertParameters(params: any[]): any[] {
    return params.map(param => ({
      name: param.name,
      in: param.name === 'id' ? 'path' : 'query',
      required: param.required,
      type: param.type,
      description: param.description || `${param.name} parameter`
    }));
  }

  private static generateResponses(): any[] {
    return [
      {
        status: 200,
        description: 'Success',
        schema: { type: 'object' }
      },
      {
        status: 400,
        description: 'Bad Request'
      },
      {
        status: 500,
        description: 'Internal Server Error'
      }
    ];
  }

  private static extractTagFromFile(filePath: string): string {
    const pathParts = filePath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    return fileName.replace(/controller\.js$|\.js$/, '').toLowerCase();
  }
}

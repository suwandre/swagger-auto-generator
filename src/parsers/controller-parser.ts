import { ASTParser } from '../utils/ast-utils';
import { FileUtils } from '../utils/file-utils';
import { ParsedFunction, SwaggerEndpoint } from '../types';

export class ControllerParser {
  static async parseControllers(filePaths: string[]): Promise<SwaggerEndpoint[]> {
    const endpoints: SwaggerEndpoint[] = [];

    console.log(`🔍 Parsing ${filePaths.length} controller files...`);

    for (const filePath of filePaths) {
      if (!filePath || typeof filePath !== 'string') {
        console.warn('⚠️  Skipping invalid file path:', filePath);
        continue;
      }

      console.log(`📄 Processing file: ${filePath}`);

      try {
        const content = FileUtils.readFileContent(filePath);
        const functions = ASTParser.parseFile(content);

        console.log(`   Found ${functions.length} exported functions`);

        for (const func of functions) {
          if (!func || !func.name) {
            console.warn(`⚠️  Skipping invalid function in ${filePath}`);
            continue;
          }

          console.log(`   Processing function: ${func.name}`);
          const endpoint = this.convertToSwaggerEndpoint(func, filePath);
          if (endpoint) {
            endpoints.push(endpoint);
            console.log(`   ✅ Added endpoint: ${endpoint.method} ${endpoint.path}`);
          }
        }
      } catch (error: any) {
        console.error(`❌ Error processing file ${filePath}:`, error.message);
      }
    }

    console.log(`📊 Total endpoints generated: ${endpoints.length}`);
    return endpoints;
  }

  private static convertToSwaggerEndpoint(func: ParsedFunction, filePath: string): SwaggerEndpoint | null {
    // Skip private functions (starting with _)
    if (func.name.startsWith('_')) {
      console.log(`   Skipping private function: ${func.name}`);
      return null;
    }

    console.log(`   Generating endpoint for: ${func.name}`);

    const basePath = this.extractBasePathFromFile(filePath);
    console.log(`   Base path: "${basePath}"`);

    let route = func.route || this.generateRouteFromFunction(func.name, basePath);
    console.log(`   Generated route: "${route}"`);

    // Safety check for undefined routes
    if (!route || typeof route !== 'string') {
      console.warn(`   ⚠️  Invalid route for function ${func.name}. Using fallback.`);
      route = `/api/${func.name.toLowerCase()}`;
    }

    // Ensure route starts with /
    if (!route.startsWith('/')) {
      route = '/' + route;
    }

    console.log(`   Final route: "${route}"`);

    return {
      path: route,
      method: func.httpMethod || 'GET',
      summary: this.generateSummary(func),
      parameters: this.extractRealParameters(func),
      responses: this.generateResponses(),
      tags: [this.extractTagFromFile(filePath)]
    };
  }


  private static extractBasePathFromFile(filePath: string): string {
    if (!filePath || typeof filePath !== 'string') {
      console.warn('Invalid filePath provided to extractBasePathFromFile');
      return '/api';
    }

    const pathParts = filePath.split(/[/\\]/);
    const fileName = pathParts[pathParts.length - 1];

    console.log(`   File name: "${fileName}"`);

    // Handle different file naming patterns
    if (fileName === 'controller.js') {
      // If it's just "controller.js", use the parent directory name
      const parentDir = pathParts[pathParts.length - 2];
      const result = parentDir ? `/${parentDir.toLowerCase()}` : '/api';
      console.log(`   Using parent dir: "${result}"`);
      return result;
    }

    // For files like "user.controller.js"
    const baseName = fileName.replace(/\.?controller\.js$|\.js$/, '');
    if (!baseName) {
      console.warn(`Could not extract base name from ${fileName}, using fallback`);
      return '/api';
    }

    const result = `/${baseName.toLowerCase()}`;
    console.log(`   Extracted base name: "${result}"`);
    return result;
  }


  private static generateRouteFromFunction(funcName: string, basePath: string): string {
    if (!funcName || typeof funcName !== 'string') {
      console.warn('Invalid funcName provided to generateRouteFromFunction');
      return basePath || '/api';
    }

    if (!basePath || typeof basePath !== 'string') {
      console.warn('Invalid basePath provided to generateRouteFromFunction');
      basePath = '/api';
    }

    // Convert function names like 'getUserById' to appropriate routes
    const cleanName = funcName.replace(/^(get|post|put|delete|patch)/i, '');

    if (cleanName.toLowerCase().includes('byid') || cleanName.toLowerCase().includes('by_id')) {
      return `${basePath}/{id}`;
    }

    if (cleanName) {
      const routeName = cleanName
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '');
      return `${basePath}/${routeName}`;
    }

    return basePath;
  }


  private static generateSummary(func: ParsedFunction): string {
    // Extract from comments or generate from function name
    const commentSummary = func.comments.find(c =>
      c.includes('@summary') || c.includes('@description')
    );

    if (commentSummary) {
      return commentSummary
        .replace(/[@*\/]/g, '')
        .replace(/summary|description/i, '')
        .trim();
    }

    // Generate from function name
    return func.name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  private static extractRealParameters(func: ParsedFunction): any[] {
    const parameters: any[] = [];

    if (!func.body) return parameters;

    // Extract from req.params (path parameters)
    const pathParamMatches = func.body.match(/req\.params\.(\w+)/g) || [];
    pathParamMatches.forEach(match => {
      const paramName = match.split('.')[2];
      if (!parameters.find(p => p.name === paramName)) {
        parameters.push({
          name: paramName,
          in: 'path',
          required: true,
          type: 'string',
          description: `${paramName} path parameter`
        });
      }
    });

    // Extract from req.query (query parameters)  
    const queryParamMatches = func.body.match(/req\.query\.(\w+)/g) || [];
    queryParamMatches.forEach(match => {
      const paramName = match.split('.')[2];
      if (!parameters.find(p => p.name === paramName)) {
        parameters.push({
          name: paramName,
          in: 'query',
          required: false,
          type: 'string',
          description: `${paramName} query parameter`
        });
      }
    });

    // Extract from req.body (body parameters)
    const bodyParamMatches = func.body.match(/req\.body\.(\w+)/g) || [];
    if (bodyParamMatches.length > 0) {
      parameters.push({
        name: 'body',
        in: 'body',
        required: true,
        schema: { type: 'object' },
        description: 'Request body'
      });
    }

    return parameters;
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
    const pathParts = filePath.split(/[/\\]/);
    const fileName = pathParts[pathParts.length - 1];

    if (fileName === 'controller.js') {
      const parentDir = pathParts[pathParts.length - 2];
      return parentDir ? parentDir.toLowerCase() : 'api';
    }

    return fileName.replace(/\.?controller\.js$|\.js$/, '').toLowerCase();
  }
}

import { ASTParser } from '../utils/ast-utils';
import { FileUtils } from '../utils/file-utils';
import { ParsedFunction, SwaggerEndpoint } from '../types';
import path from 'path';

export class ControllerParser {
  static async parseControllers(
    filePaths: string[],
    routerRoutes: Array<{ method: string, path: string, functionName: string }> = []
  ): Promise<SwaggerEndpoint[]> {
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

          // Enhancement 2: Skip middleware functions
          if (this.isMiddlewareFunction(func, filePath)) {
            console.log(`   🔒 Skipping middleware function: ${func.name}`);
            continue;
          }

          console.log(`   Processing function: ${func.name}`);

          // Find corresponding route info from router
          const routeInfo = routerRoutes.find(r => r.functionName === func.name);

          // Enhancement 3: Pass routerRoutes for smart method detection
          const endpoint = this.convertToSwaggerEndpoint(func, filePath, routeInfo, routerRoutes);
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

  private static convertToSwaggerEndpoint(
    func: ParsedFunction,
    filePath: string,
    routeInfo?: { method: string, path: string, functionName: string },
    routerRoutes?: Array<{ method: string, path: string, functionName: string }>
  ): SwaggerEndpoint | null {
    // Skip private functions (starting with _)
    if (func.name.startsWith('_')) {
      console.log(`   Skipping private function: ${func.name}`);
      return null;
    }

    console.log(`   Generating endpoint for: ${func.name}`);

    this.debugFunctionParsing(func.name, func);

    // Use router info if available, otherwise generate
    let route: string;
    let method: string;

    if (routeInfo) {
      route = routeInfo.path;
      method = routeInfo.method;
      console.log(`   📍 Using router info: ${method} ${route}`);
    } else {
      const basePath = this.extractBasePathFromFile(filePath);
      route = func.route || this.generateRouteFromFunction(func.name, basePath);
      method = this.inferHttpMethod(func.name, func.comments, routerRoutes);
      console.log(`   🔧 Generated: ${method} ${route}`);
    }

    // Safety check for undefined routes
    if (!route || typeof route !== 'string') {
      console.warn(`   ⚠️  Invalid route for function ${func.name}. Using fallback.`);
      route = `/api/${func.name.toLowerCase()}`;
    }

    // Ensure route starts with /
    if (!route.startsWith('/')) {
      route = '/' + route;
    }

    console.log(`   ✅ Final endpoint: ${method} ${route}`);

    return {
      path: route,
      method: method,
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

    // 1. Direct access patterns: req.params.id, req.query.page
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

    // 2. NEW: Destructured path params: const { id, userId } = req.params;
    const destructuredPathMatches = func.body.match(/const\s*{\s*([^}]+)\s*}\s*=\s*req\.params/g) || [];
    destructuredPathMatches.forEach(match => {
      const varsMatch = match.match(/{\s*([^}]+)\s*}/);
      if (varsMatch) {
        const variables = varsMatch[1]
          .split(',')
          .map(v => v.trim())
          .map(v => v.split('=')[0].trim()) // Remove default values
          .filter(v => v && !v.includes('...'));

        variables.forEach(variable => {
          if (!parameters.find(p => p.name === variable)) {
            parameters.push({
              name: variable,
              in: 'path',
              required: true,
              type: 'string',
              description: `${variable} path parameter`
            });
          }
        });
      }
    });

    // 3. NEW: Destructured query params: const { page, limit } = req.query;
    const destructuredQueryMatches = func.body.match(/const\s*{\s*([^}]+)\s*}\s*=\s*req\.query/g) || [];
    destructuredQueryMatches.forEach(match => {
      const varsMatch = match.match(/{\s*([^}]+)\s*}/);
      if (varsMatch) {
        const variables = varsMatch[1]
          .split(',')
          .map(v => v.trim())
          .map(v => v.split('=')[0].trim()) // Remove default values
          .filter(v => v && !v.includes('...'));

        variables.forEach(variable => {
          if (!parameters.find(p => p.name === variable)) {
            parameters.push({
              name: variable,
              in: 'query',
              required: !func.body!.includes(`${variable} =`), // Check for default values
              type: 'string',
              description: `${variable} query parameter`
            });
          }
        });
      }
    });

    // 4. Body parameters (for POST/PUT endpoints)
    const httpMethod = func.httpMethod?.toLowerCase();
    if (httpMethod === 'post' || httpMethod === 'put' || httpMethod === 'patch') {
      const bodyFields = this.extractBodyFields(func.body);
      if (bodyFields.length > 0) {
        const properties: any = {};
        const required: string[] = [];

        bodyFields.forEach(field => {
          properties[field.name] = {
            type: field.type,
            description: field.description
          };
          if (field.required) {
            required.push(field.name);
          }
        });

        parameters.push({
          name: 'body',
          in: 'body',
          required: true,
          schema: {
            type: 'object',
            properties,
            required
          },
          description: 'Request body'
        });
      }

      // Also check for direct req.body usage
      if (func.body.includes('req.body') && bodyFields.length === 0) {
        parameters.push({
          name: 'body',
          in: 'body',
          required: true,
          schema: { type: 'object' },
          description: 'Request body'
        });
      }
    }

    return parameters;
  }

  private static debugFunctionParsing(functionName: string, parsedFunction: any): void {
    console.log(`🔍 DEBUG: Processing function ${functionName}`);
    console.log(`🔍 DEBUG: Function type: ${parsedFunction.type || 'undefined'}`);
    console.log(`🔍 DEBUG: Has body: ${!!parsedFunction.body}`);
    console.log(`🔍 DEBUG: Body type: ${parsedFunction.body ? (typeof parsedFunction.body) : 'undefined'}`);
    console.log(`🔍 DEBUG: Body length: ${parsedFunction.body ? parsedFunction.body.length : 'no body'}`);

    if (parsedFunction.body && typeof parsedFunction.body === 'string') {
      console.log(`🔍 DEBUG: Body preview: ${parsedFunction.body.substring(0, 100)}...`);
    }
  }

  private static extractBodyFields(functionBody: string): any[] {
    console.log('🔍 extractBodyFields called with function body length:', functionBody.length);
    console.log('🔍 Function body preview:', functionBody.substring(0, 200) + '...');

    const fields: any[] = [];

    // Extract from destructuring: const { name, email, role = 'user' } = req.body
    const destructuringMatches = functionBody.match(/const\s*{\s*([^}]+)\s*}\s*=\s*req\.body/g) || [];

    console.log('🔍 Destructuring matches found:', destructuringMatches.length);
    if (destructuringMatches.length > 0) {
      console.log('🔍 Matches:', destructuringMatches);
    }

    destructuringMatches.forEach((match, index) => {
      console.log(`🔍 Processing match ${index + 1}:`, match);
      const variablesMatch = match.match(/{\s*([^}]+)\s*}/);
      if (variablesMatch) {
        console.log('🔍 Variables found:', variablesMatch[1]);
        const variables = variablesMatch[1].split(',').map(v => v.trim());

        variables.forEach(variable => {
          let fieldName = variable;
          let hasDefault = false;

          // Check for default values: role = 'user'
          if (variable.includes('=')) {
            fieldName = variable.split('=')[0].trim();
            hasDefault = true;
          }

          if (fieldName && !fieldName.includes('...')) {
            console.log('✅ Adding body parameter:', fieldName);
            fields.push({
              name: fieldName,
              type: 'string',
              required: !hasDefault,
              description: `${fieldName} field`
            });
          }
        });
      }
    });

    console.log('📊 Total body parameters extracted:', fields.length);
    console.log('📊 Fields:', fields);
    return fields;
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

  /**
   * Detect if a function is middleware (should not be treated as API endpoint)
   */
  private static isMiddlewareFunction(func: ParsedFunction, filePath: string): boolean {
    const fileName = path.basename(filePath);

    // Skip known middleware files
    if (fileName === 'authenticator.js' || fileName === 'validator.js') {
      return true;
    }

    // Skip by function name patterns
    const middlewarePatterns = [
      /^validate/i,     // validateRequest, validateBody, etc.
      /^check/i,        // checkPermissions, checkAuth, etc.
      /^verify/i,       // verifyToken, verifyClient, etc.
      /^auth/i,         // authenticate, authorize, etc.
      /middleware$/i    // anyFunctionMiddleware
    ];

    if (middlewarePatterns.some(pattern => pattern.test(func.name))) {
      console.log(`   🔒 Detected middleware by name pattern: ${func.name}`);
      return true;
    }

    // Check function signature - middleware typically has (req, res, next)
    if (func.parameters && func.parameters.length === 3) {
      const paramNames = func.parameters.map(p => p.name.toLowerCase());
      if (paramNames.includes('req') && paramNames.includes('res') && paramNames.includes('next')) {
        // Additional check: if it calls next() it's definitely middleware
        if (func.body && func.body.includes('next()')) {
          console.log(`   🔒 Detected middleware by signature and next() call: ${func.name}`);
          return true;
        }
      }
    }

    return false;
  }

  /**
 * Smart HTTP method detection using multiple strategies
 */
  private static inferHttpMethod(
    functionName: string,
    comments: string[],
    routerRoutes?: Array<{ method: string, path: string, functionName: string }>
  ): string {
    // Priority 1: Use router.js information (most reliable)
    if (routerRoutes) {
      const routeInfo = routerRoutes.find(r => r.functionName === functionName);
      if (routeInfo) {
        console.log(`   🎯 HTTP method from router: ${routeInfo.method}`);
        return routeInfo.method;
      }
    }

    // Priority 2: Check for explicit @method JSDoc comments
    const commentText = comments.join(' ').toLowerCase();
    if (commentText.includes('@method')) {
      const methodMatch = commentText.match(/@method\s+(get|post|put|delete|patch)/i);
      if (methodMatch) {
        const method = methodMatch[1].toUpperCase();
        console.log(`   📝 HTTP method from @method comment: ${method}`);
        return method;
      }
    }

    // Priority 3: Enhanced function name pattern matching
    const method = this.inferMethodFromFunctionName(functionName);
    console.log(`   🔤 HTTP method inferred from name "${functionName}": ${method}`);
    return method;
  }

  /**
 * Enhanced function name pattern matching for HTTP methods
 */
  private static inferMethodFromFunctionName(functionName: string): string {
    const name = functionName.toLowerCase();

    // GET patterns (retrieve data)
    if (name.match(/^(get|fetch|find|search|list|show|display|retrieve|read)/)) return 'GET';
    if (name.includes('status') || name.includes('info') || name.includes('details')) return 'GET';

    // POST patterns (create new resources)
    if (name.match(/^(post|create|add|insert|register|submit|send)/)) return 'POST';
    if (name.includes('signup') || name.includes('login') || name.includes('auth')) return 'POST';

    // PUT patterns (update/replace entire resource)
    if (name.match(/^(put|update|replace|modify|edit|change)/)) return 'PUT';

    // PATCH patterns (partial updates)
    if (name.match(/^(patch)/)) return 'PATCH';

    // DELETE patterns (remove resources)
    if (name.match(/^(delete|remove|destroy|cancel|revoke)/)) return 'DELETE';

    // Webhook and notification patterns
    if (name.includes('notify') || name.includes('webhook') || name.includes('callback')) return 'POST';

    // Default fallback
    return 'GET';
  }
}

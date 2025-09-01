const ASTHelper = require('../utils/ast-helper');
const traverse = require('@babel/traverse').default;

class RouterParser {
  constructor() {
    this.routes = [];
  }

  parse(filePath) {
    if (!filePath) return { routes: [] };

    const ast = ASTHelper.parseFile(filePath);
    if (!ast) return { routes: [] };

    const routes = [];

    traverse(ast, {
      CallExpression(path) {
        // Look for router.method() calls
        if (
          path.node.callee.type === 'MemberExpression' &&
          path.node.callee.object.name === 'router'
        ) {
          const method = path.node.callee.property.name.toLowerCase();
          const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
          
          if (httpMethods.includes(method) && path.node.arguments.length >= 2) {
            const route = this.extractRouteInfo(path.node, method);
            if (route) {
              routes.push(route);
            }
          }
        }
      }
    });

    return { routes };
  }

  extractRouteInfo(node, method) {
    const args = node.arguments;
    
    // First argument should be the path
    if (args[0].type !== 'StringLiteral') return null;
    
    const path = args[0].value;
    const middleware = [];
    let controller = null;

    // Process remaining arguments (middleware and controller)
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.type === 'MemberExpression') {
        const objectName = arg.object.name;
        const methodName = arg.property.name;
        
        if (objectName === 'controller') {
          controller = methodName;
        } else if (objectName === 'validator') {
          middleware.push({
            type: 'validator',
            name: methodName
          });
        } else if (objectName === 'authenticator') {
          middleware.push({
            type: 'authenticator',
            name: methodName
          });
        } else {
          middleware.push({
            type: 'middleware',
            name: `${objectName}.${methodName}`
          });
        }
      } else if (arg.type === 'Identifier') {
        middleware.push({
          type: 'middleware',
          name: arg.name
        });
      }
    }

    return {
      method: method.toUpperCase(),
      path: this.normalizeSwaggerPath(path),
      originalPath: path,
      middleware,
      controller,
      parameters: this.extractPathParameters(path)
    };
  }

  normalizeSwaggerPath(path) {
    // Convert Express route params (:id) to OpenAPI format ({id})
    return path.replace(/:([^/]+)/g, '{$1}');
  }

  extractPathParameters(path) {
    const params = [];
    const matches = path.match(/:([^/]+)/g);
    
    if (matches) {
      matches.forEach(match => {
        const paramName = match.substring(1);
        params.push({
          name: paramName,
          in: 'path',
          required: true,
          schema: { type: 'string' }
        });
      });
    }

    return params;
  }
}

module.exports = RouterParser;

const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

class CodeAnalyzer {
  constructor() {
    this.functions = [];
  }

  analyzeFile(filePath) {
    try {
      const code = fs.readFileSync(filePath, 'utf8');
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['commonjs'],
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
      });

      const functions = [];

      traverse(ast, {
        // Handle exports.functionName = anything
        AssignmentExpression: (path) => {
          if (this.isExportsAssignment(path.node)) {
            const funcInfo = this.extractFunctionInfo(
              path.node,
              code,
              filePath
            );
            if (funcInfo) {
              console.log(`   📋 Found export: ${funcInfo.name}`);
              functions.push(funcInfo);
            }
          }

          // Handle module.exports = router
          if (this.isModuleExportsAssignment(path.node)) {
            const routerInfo = this.extractRouterInfo(
              path.node,
              code,
              filePath
            );
            if (routerInfo.length > 0) {
              console.log(
                `   📋 Found router with ${routerInfo.length} routes`
              );
              functions.push(...routerInfo);
            }
          }
        },

        // Handle router.method() calls in router files
        CallExpression: (path) => {
          if (this.isRouterMethodCall(path.node)) {
            const routeInfo = this.extractRouteInfo(path.node, code);
            if (routeInfo) {
              console.log(
                `   📋 Found route: ${routeInfo.method.toUpperCase()} ${
                  routeInfo.path
                }`
              );
              functions.push(routeInfo);
            }
          }
        },
      });

      return functions;
    } catch (error) {
      console.error(`❌ Error analyzing ${filePath}:`, error.message);
      return [];
    }
  }

  isExportsAssignment(node) {
    return (
      node.left &&
      node.left.type === 'MemberExpression' &&
      node.left.object &&
      node.left.object.name === 'exports'
    );
  }

  isModuleExportsAssignment(node) {
    return (
      node.left &&
      node.left.type === 'MemberExpression' &&
      node.left.object &&
      node.left.object.name === 'module' &&
      node.left.property &&
      node.left.property.name === 'exports'
    );
  }

  isRouterMethodCall(node) {
    if (node.type !== 'CallExpression') return false;
    if (!node.callee || node.callee.type !== 'MemberExpression') return false;

    const objectName = node.callee.object?.name;
    const methodName = node.callee.property?.name;

    const httpMethods = [
      'get',
      'post',
      'put',
      'delete',
      'patch',
      'options',
      'use',
    ];

    return objectName === 'router' && httpMethods.includes(methodName);
  }

  extractFunctionInfo(node, code, filePath) {
    const functionName = node.left.property.name;
    const rightSide = node.right;

    // Handle direct function assignments
    if (
      rightSide.type === 'FunctionExpression' ||
      rightSide.type === 'ArrowFunctionExpression'
    ) {
      return {
        name: functionName,
        type: 'function',
        parameters: this.extractParameters(rightSide.params),
        isAsync: rightSide.async || false,
        bodyContent: this.extractBodyContent(rightSide.body, code),
        sourceFile: path.basename(filePath),
      };
    }

    // Handle function call results (like validateRequestBody(...))
    if (rightSide.type === 'CallExpression') {
      const callInfo = this.extractCallExpression(rightSide, code);
      return {
        name: functionName,
        type: 'middleware',
        isMiddleware: true,
        callExpression: callInfo,
        bodyContent: this.analyzeMiddlewarePattern(callInfo),
        sourceFile: path.basename(filePath),
      };
    }

    return null;
  }

  extractRouterInfo(node, code, filePath) {
    const functions = [];

    // For router assignments, we need to find the router definition in the code
    // This is a simplified version - we'll create a generic router export
    functions.push({
      name: 'router',
      type: 'router',
      description: 'Express router with middleware and routes',
      bodyContent: {
        isRouter: true,
        usesMiddleware:
          code.includes('authenticator') || code.includes('validator'),
        responseTypes: ['application/json'],
      },
      sourceFile: path.basename(filePath),
    });

    return functions;
  }

  extractRouteInfo(node, code) {
    const method = node.callee.property.name;
    const args = node.arguments;

    if (args.length === 0) return null;

    // First argument should be the path
    const pathArg = args[0];
    let routePath = '/';

    if (pathArg.type === 'Literal') {
      routePath = pathArg.value;
    } else if (pathArg.type === 'TemplateLiteral') {
      routePath = pathArg.quasis[0]?.value?.cooked || '/';
    }

    // Analyze middleware and handlers
    const middleware = [];
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg.type === 'MemberExpression') {
        const obj = arg.object?.name;
        const prop = arg.property?.name;
        if (obj && prop) {
          middleware.push(`${obj}.${prop}`);
        }
      }
    }

    return {
      name: `${method}_${routePath.replace(/[^a-zA-Z0-9]/g, '_')}`,
      type: 'route',
      method: method,
      path: routePath,
      middleware: middleware,
      bodyContent: {
        isRoute: true,
        httpMethod: method,
        routePath: routePath,
        usesMiddleware: middleware.length > 0,
        responseTypes: ['application/json'],
      },
    };
  }

  extractCallExpression(node, code) {
    const callee = node.callee;
    let functionName = 'unknown';

    if (callee.type === 'Identifier') {
      functionName = callee.name;
    } else if (callee.type === 'MemberExpression') {
      functionName = `${callee.object?.name}.${callee.property?.name}`;
    }

    // Extract arguments for validation patterns
    const args = node.arguments.map((arg) => {
      if (arg.type === 'CallExpression' && arg.callee?.name === 'joi') {
        return this.extractJoiSchema(arg, code);
      }
      return { type: 'unknown' };
    });

    return {
      functionName,
      arguments: args,
    };
  }

  extractJoiSchema(node, code) {
    // Basic joi schema extraction
    const schemaStr = code.substring(node.start, node.end);
    const fields = [];

    // Simple regex to extract field names from joi schemas
    const fieldMatches = schemaStr.match(/(\w+):\s*joi\./g);
    if (fieldMatches) {
      fieldMatches.forEach((match) => {
        const field = match.replace(/:\s*joi\..*/, '').trim();
        fields.push(field);
      });
    }

    return {
      type: 'joi_schema',
      fields: fields,
    };
  }

  analyzeMiddlewarePattern(callInfo) {
    return {
      isMiddleware: true,
      usesValidation: callInfo.functionName.includes('validate'),
      usesJoi: callInfo.arguments.some((arg) => arg.type === 'joi_schema'),
      requiredFields: callInfo.arguments
        .filter((arg) => arg.type === 'joi_schema')
        .flatMap((arg) => arg.fields),
    };
  }

  extractParameters(params) {
    return params.map((param) => {
      if (param.type === 'Identifier') {
        return { name: param.name, type: 'unknown', required: true };
      } else if (param.type === 'ObjectPattern') {
        return {
          name: 'destructured',
          type: 'object',
          properties: param.properties.map((prop) => ({
            name: prop.key?.name || 'unknown',
            required: true,
          })),
        };
      }
      return { name: param.name || 'unknown', type: 'unknown' };
    });
  }

  extractBodyContent(body, code) {
    if (!body) {
      return {
        responseTypes: ['application/json'],
        statusCodes: [200],
        errorMessages: [],
        usesAuth: false,
        isMiddleware: false,
      };
    }

    const patterns = {
      responseTypes: [],
      statusCodes: [],
      errorMessages: [],
      usesAuth: false,
      isMiddleware: false,
      requiredBodyFields: [],
    };

    const bodyStr = code.substring(body.start, body.end);

    // Enhanced status code + error message detection
    const statusErrorMatches = bodyStr.match(
      /res\.status\((\d+)\)\.send\(([^)]+)\)/g
    );
    if (statusErrorMatches) {
      statusErrorMatches.forEach((match) => {
        const statusMatch = match.match(/(\d+)/);
        const messageMatch = match.match(/send\(([^)]+)\)/);

        if (statusMatch && messageMatch) {
          const code = parseInt(statusMatch[1]);
          patterns.statusCodes.push(code);

          let message = messageMatch[1].replace(/['"]/g, '');
          patterns.errorMessages.push({
            code,
            message: message.substring(0, 100),
          });
        }
      });
    }

    // Detect middleware pattern
    if (bodyStr.includes('next()')) {
      patterns.isMiddleware = true;
    }

    // Enhanced auth detection
    if (
      bodyStr.includes('req.user') ||
      bodyStr.includes('req.headers["userid"]') ||
      bodyStr.includes('authenticator')
    ) {
      patterns.usesAuth = true;
    }

    // Detect response patterns
    if (bodyStr.includes('res.json(')) {
      patterns.responseTypes.push('application/json');
    }
    if (bodyStr.includes('res.send(')) {
      patterns.responseTypes.push('text/plain');
    }

    return patterns;
  }
}

module.exports = CodeAnalyzer;

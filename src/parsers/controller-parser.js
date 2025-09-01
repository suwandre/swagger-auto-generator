const ASTHelper = require('../utils/ast-helper');
const traverse = require('@babel/traverse').default;

class ControllerParser {
  constructor() {
    this.controllers = {};
  }

  parse(filePath) {
    if (!filePath) return { controllers: {} };

    const ast = ASTHelper.parseFile(filePath);
    if (!ast) return { controllers: {} };

    const controllers = {};
    const { exports, functions } = ASTHelper.extractExports(ast);

    // Analyze each exported controller function
    Object.keys(exports).forEach(controllerName => {
      const controllerInfo = this.analyzeController(ast, controllerName);
      if (controllerInfo) {
        controllers[controllerName] = controllerInfo;
      }
    });

    return { controllers };
  }

  analyzeController(ast, controllerName) {
    const controller = {
      name: controllerName,
      responses: {},
      summary: this.generateSummary(controllerName),
      description: '',
      tags: [this.extractTag(controllerName)]
    };

    traverse(ast, {
      // Look for res.status().json() patterns
      CallExpression(path) {
        if (this.isResponseCall(path.node)) {
          const responseInfo = this.extractResponseInfo(path.node);
          if (responseInfo) {
            controller.responses[responseInfo.status] = responseInfo;
          }
        }
      },

      // Look for function comments
      Function(path) {
        if (path.node.id && path.node.id.name === controllerName) {
          const leadingComments = path.node.leadingComments;
          if (leadingComments && leadingComments.length > 0) {
            const comment = leadingComments[leadingComments.length - 1];
            const parsed = this.parseControllerComment(comment.value);
            if (parsed.description) controller.description = parsed.description;
            if (parsed.summary) controller.summary = parsed.summary;
          }
        }
      }
    });

    // Add default responses if none found
    if (Object.keys(controller.responses).length === 0) {
      controller.responses = this.getDefaultResponses(controllerName);
    }

    return controller;
  }

  isResponseCall(node) {
    // Check for res.status().json(), res.json(), res.send() patterns
    if (node.callee.type === 'MemberExpression') {
      const object = node.callee.object;
      const method = node.callee.property.name;
      
      // res.json(), res.send()
      if (object.name === 'res' && ['json', 'send', 'end'].includes(method)) {
        return true;
      }
      
      // res.status().json()
      if (
        object.type === 'CallExpression' &&
        object.callee.type === 'MemberExpression' &&
        object.callee.object.name === 'res' &&
        object.callee.property.name === 'status' &&
        ['json', 'send', 'end'].includes(method)
      ) {
        return true;
      }
    }
    
    return false;
  }

  extractResponseInfo(node) {
    let status = '200';
    let description = 'Success';
    let schema = null;

    // Extract status code
    if (
      node.callee.object.type === 'CallExpression' &&
      node.callee.object.arguments.length > 0 &&
      node.callee.object.arguments[0].type === 'NumericLiteral'
    ) {
      status = node.callee.object.arguments[0].value.toString();
    }

    // Extract response body structure
    if (node.arguments.length > 0) {
      const responseArg = node.arguments[0];
      schema = this.analyzeResponseStructure(responseArg);
    }

    // Set description based on status code
    description = this.getStatusDescription(status);

    return {
      status,
      description,
      content: {
        'application/json': {
          schema: schema || { type: 'object' }
        }
      }
    };
  }

  analyzeResponseStructure(node) {
    if (node.type === 'ObjectExpression') {
      return this.objectExpressionToSchema(node);
    } else if (node.type === 'ArrayExpression') {
      return {
        type: 'array',
        items: { type: 'object' }
      };
    } else if (node.type === 'StringLiteral') {
      return { type: 'string' };
    } else if (node.type === 'NumericLiteral') {
      return { type: 'number' };
    } else if (node.type === 'BooleanLiteral') {
      return { type: 'boolean' };
    }

    return { type: 'object' };
  }

  objectExpressionToSchema(node) {
    const schema = {
      type: 'object',
      properties: {}
    };

    node.properties.forEach(prop => {
      if (prop.key && prop.key.name) {
        const propName = prop.key.name;
        schema.properties[propName] = this.analyzeResponseStructure(prop.value);
      }
    });

    return schema;
  }

  getStatusDescription(status) {
    const descriptions = {
      '200': 'Success',
      '201': 'Created',
      '400': 'Bad Request',
      '401': 'Unauthorized',
      '403': 'Forbidden',
      '404': 'Not Found',
      '500': 'Internal Server Error'
    };

    return descriptions[status] || 'Response';
  }

  generateSummary(controllerName) {
    // Generate human-readable summary from function name
    return controllerName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  extractTag(controllerName) {
    // Extract tag from controller name (e.g., getUserById -> Users)
    const match = controllerName.match(/^(get|post|put|delete|patch|create|update|remove)?(.+?)(?:By.*)?$/i);
    if (match && match[2]) {
      return match[2].charAt(0).toUpperCase() + match[2].slice(1);
    }
    return 'API';
  }

  parseControllerComment(comment) {
    const result = { description: '', summary: '' };
    
    const lines = comment.split('\n').map(line => line.trim().replace(/^\*\s?/, ''));
    
    lines.forEach(line => {
      if (line.startsWith('@summary')) {
        result.summary = line.replace('@summary', '').trim();
      } else if (line.startsWith('@description')) {
        result.description = line.replace('@description', '').trim();
      } else if (line && !line.startsWith('@') && !result.description) {
        result.description = line;
      }
    });

    return result;
  }

  getDefaultResponses(controllerName) {
    const isGetMethod = controllerName.toLowerCase().startsWith('get');
    const isPostMethod = controllerName.toLowerCase().startsWith('create') || 
                         controllerName.toLowerCase().startsWith('post');

    const responses = {
      '200': {
        description: 'Success',
        content: {
          'application/json': {
            schema: { type: 'object' }
          }
        }
      }
    };

    if (isPostMethod) {
      responses['201'] = {
        description: 'Created',
        content: {
          'application/json': {
            schema: { type: 'object' }
          }
        }
      };
    }

    responses['400'] = {
      description: 'Bad Request',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    };

    responses['500'] = {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    };

    return responses;
  }
}

module.exports = ControllerParser;

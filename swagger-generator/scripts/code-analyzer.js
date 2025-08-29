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
        allowReturnOutsideFunction: true
      });

      const functions = [];

      traverse(ast, {
        // Analyze exports.functionName = function() {}
        AssignmentExpression: (path) => {
          if (this.isExportsAssignment(path.node)) {
            const funcInfo = this.extractFunctionInfo(path.node, code);
            if (funcInfo) functions.push(funcInfo);
          }
        },

        // Analyze module.exports = { functionName: function() {} }
        ObjectProperty: (path) => {
          if (this.isInModuleExports(path)) {
            const funcInfo = this.extractObjectFunctionInfo(path.node, code);
            if (funcInfo) functions.push(funcInfo);
          }
        }
      });

      return functions;
    } catch (error) {
      console.error(`Error analyzing ${filePath}:`, error.message);
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

  isInModuleExports(path) {
    let parent = path.parent;
    while (parent) {
      if (parent.type === 'AssignmentExpression' &&
          parent.left &&
          parent.left.type === 'MemberExpression' &&
          parent.left.object &&
          parent.left.object.name === 'module' &&
          parent.left.property &&
          parent.left.property.name === 'exports') {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  extractFunctionInfo(node, code) {
    const functionName = node.left.property.name;
    const functionNode = node.right;

    if (functionNode.type === 'FunctionExpression' || functionNode.type === 'ArrowFunctionExpression') {
      return {
        name: functionName,
        parameters: this.extractParameters(functionNode.params),
        isAsync: functionNode.async || false,
        bodyContent: this.extractBodyContent(functionNode.body, code)
      };
    }
    return null;
  }

  extractObjectFunctionInfo(node, code) {
    if (node.type === 'ObjectProperty' && 
        (node.value.type === 'FunctionExpression' || node.value.type === 'ArrowFunctionExpression')) {
      return {
        name: node.key.name,
        parameters: this.extractParameters(node.value.params),
        isAsync: node.value.async || false,
        bodyContent: this.extractBodyContent(node.value.body, code)
      };
    }
    return null;
  }

  extractParameters(params) {
    return params.map(param => {
      if (param.type === 'Identifier') {
        return { name: param.name, type: 'unknown', required: true };
      } else if (param.type === 'ObjectPattern') {
        return {
          name: 'body',
          type: 'object',
          properties: param.properties.map(prop => ({
            name: prop.key.name,
            required: true
          }))
        };
      }
      return { name: param.name || 'unknown', type: 'unknown' };
    });
  }

  extractBodyContent(body, code) {
    const patterns = {
      responseTypes: [],
      statusCodes: [],
      errorMessages: [],
      usesAuth: false,
      isMiddleware: false,
      requiredBodyFields: []
    };

    const bodyStr = code.substring(body.start, body.end);

    // Enhanced status code + error message detection
    const statusErrorMatches = bodyStr.match(/res\.status\((\d+)\)\.(?:send|json)\(([^)]+)\)/g);
    if (statusErrorMatches) {
      statusErrorMatches.forEach(match => {
        const statusMatch = match.match(/(\d+)/);
        const messageMatch = match.match(/(?:send|json)\(([^)]+)\)/);
        
        if (statusMatch && messageMatch) {
          const code = parseInt(statusMatch[1]);
          patterns.statusCodes.push(code);
          
          // Try to extract error message
          let message = messageMatch[1].replace(/['"]/g, '');
          if (message.includes('{')) {
            // JSON response
            try {
              const jsonMatch = message.match(/"error"\s*:\s*"([^"]+)"/);
              if (jsonMatch) message = jsonMatch[1];
            } catch (e) {
              // Keep original
            }
          }
          
          patterns.errorMessages.push({
            code,
            message: message.substring(0, 100) // Limit length
          });
        }
      });
    }

    // Detect middleware pattern
    if (bodyStr.includes('next()')) {
      patterns.isMiddleware = true;
    }

    // Enhanced auth detection
    if (bodyStr.includes('req.user') || 
        bodyStr.includes('checkHeader') || 
        bodyStr.includes('UserTypes') ||
        bodyStr.includes('req.headers["userid"]')) {
      patterns.usesAuth = true;
    }

    // Detect response patterns
    if (bodyStr.includes('res.json(')) {
      patterns.responseTypes.push('application/json');
    }
    if (bodyStr.includes('res.send(')) {
      patterns.responseTypes.push('text/plain');
    }

    // Extract required body fields
    const bodyFieldMatches = bodyStr.match(/const\s*{\s*([^}]+)\s*}\s*=\s*req\.body/g);
    if (bodyFieldMatches) {
      bodyFieldMatches.forEach(match => {
        const fieldsMatch = match.match(/{\s*([^}]+)\s*}/);
        if (fieldsMatch) {
          const fields = fieldsMatch[1]
            .split(',')
            .map(field => field.trim())
            .filter(field => field.length > 0);
          patterns.requiredBodyFields = patterns.requiredBodyFields.concat(fields);
        }
      });
    }

    return patterns;
  }
}

module.exports = CodeAnalyzer;

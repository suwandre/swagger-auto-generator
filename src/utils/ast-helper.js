const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const fs = require('fs-extra');

class ASTHelper {
  static parseFile(filePath) {
    try {
      const code = fs.readFileSync(filePath, 'utf8');
      return parser.parse(code, {
        sourceType: 'module',
        plugins: [
          'jsx',
          'typescript',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'asyncGenerators',
          'functionBind',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport'
        ]
      });
    } catch (error) {
      console.error(`Error parsing ${filePath}:`, error.message);
      return null;
    }
  }

  static extractExports(ast) {
    const exports = {};
    const functions = {};

    traverse(ast, {
      // Handle module.exports = { ... }
      AssignmentExpression(path) {
        if (
          path.node.left.type === 'MemberExpression' &&
          path.node.left.object.name === 'module' &&
          path.node.left.property.name === 'exports' &&
          path.node.right.type === 'ObjectExpression'
        ) {
          path.node.right.properties.forEach(prop => {
            if (prop.type === 'ObjectProperty' && prop.key.name) {
              exports[prop.key.name] = {
                type: 'export',
                name: prop.key.name
              };
            }
          });
        }
      },

      // Handle exports.functionName = ...
      AssignmentExpression(path) {
        if (
          path.node.left.type === 'MemberExpression' &&
          path.node.left.object.name === 'exports'
        ) {
          const funcName = path.node.left.property.name;
          exports[funcName] = {
            type: 'export',
            name: funcName
          };
        }
      },

      // Handle function declarations
      FunctionDeclaration(path) {
        if (path.node.id && path.node.id.name) {
          functions[path.node.id.name] = {
            type: 'function',
            name: path.node.id.name,
            params: path.node.params.map(param => ({
              name: param.name,
              type: param.type
            })),
            async: path.node.async
          };
        }
      },

      // Handle const functionName = (params) => { ... }
      VariableDeclarator(path) {
        if (
          path.node.id.name &&
          (path.node.init?.type === 'ArrowFunctionExpression' ||
           path.node.init?.type === 'FunctionExpression')
        ) {
          functions[path.node.id.name] = {
            type: 'function',
            name: path.node.id.name,
            params: path.node.init.params.map(param => ({
              name: param.name,
              type: param.type
            })),
            async: path.node.init.async
          };
        }
      }
    });

    return { exports, functions };
  }

  static extractComments(ast) {
    const comments = {};
    
    if (ast.comments) {
      ast.comments.forEach(comment => {
        if (comment.value.includes('@swagger') || comment.value.includes('@api')) {
          // Extract swagger documentation from comments
          comments[comment.loc.start.line] = comment.value;
        }
      });
    }

    return comments;
  }
}

module.exports = ASTHelper;

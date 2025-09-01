import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { ParsedFunction } from '../types';

export class ASTParser {
  static parseFile(content: string): ParsedFunction[] {
    const functions: ParsedFunction[] = [];

    // Define helper functions inside the method scope
    function extractFunctionInfo(node: any, content: string, exportName?: string): ParsedFunction {
      const functionName = exportName || node.id?.name || 'anonymous';
      const parameters = extractParameters(node);
      const comments = extractComments(node, content);

      return {
        name: functionName,
        parameters,
        comments,
        httpMethod: inferHttpMethod(functionName, comments),
        route: extractRoute(comments)
      };
    }

    function extractParameters(node: any): any[] {
      if (!node.params) return [];

      return node.params.map((param: any) => ({
        name: param.name || param.left?.name || 'unknown',
        type: inferParameterType(param),
        required: param.type !== 'AssignmentPattern' // has default value
      }));
    }

    function extractComments(node: any, content: string): string[] {
      // Extract JSDoc comments above the function
      const lines = content.split('\n');
      const comments: string[] = [];

      if (node.start) {
        const nodeLineStart = content.substring(0, node.start).split('\n').length - 1;

        // Look backwards for comments
        for (let i = nodeLineStart - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/**')) {
            comments.unshift(line);
          } else if (line === '') {
            continue;
          } else {
            break;
          }
        }
      }

      return comments;
    }

    function inferHttpMethod(functionName: string, comments: string[]): string {
      // Check comments first
      const commentText = comments.join(' ').toLowerCase();
      if (commentText.includes('@method')) {
        const methodMatch = commentText.match(/@method\s+(get|post|put|delete|patch)/i);
        if (methodMatch) return methodMatch[1].toUpperCase();
      }

      // Infer from function name
      const name = functionName.toLowerCase();
      if (name.startsWith('get') || name.includes('fetch') || name.includes('find')) return 'GET';
      if (name.startsWith('post') || name.includes('create') || name.includes('add')) return 'POST';
      if (name.startsWith('put') || name.includes('update') || name.includes('edit')) return 'PUT';
      if (name.startsWith('delete') || name.includes('remove')) return 'DELETE';
      if (name.startsWith('patch')) return 'PATCH';

      return 'GET'; // default
    }

    function extractRoute(comments: string[]): string | undefined {
      const commentText = comments.join(' ');
      const routeMatch = commentText.match(/@route\s+([^\s]+)/i);
      return routeMatch ? routeMatch[1] : undefined;
    }

    function inferParameterType(param: any): string {
      // Basic type inference - can be enhanced
      if (param.type === 'Identifier') return 'string';
      if (param.type === 'AssignmentPattern') {
        if (param.right?.type === 'Literal') {
          if (typeof param.right.value === 'number') return 'number';
          if (typeof param.right.value === 'boolean') return 'boolean';
        }
      }
      return 'string';
    }

    try {
      const ast = acorn.parse(content, {
        ecmaVersion: 2020,
        sourceType: 'module'
      });

      walk.simple(ast, {
        // Parse function declarations
        FunctionDeclaration(node: any) {
          if (node.id && node.id.name) {
            functions.push(extractFunctionInfo(node, content));
          }
        },
        // Parse exported functions
        AssignmentExpression(node: any) {
          if (node.left?.object?.name === 'exports' && 
              node.right?.type === 'FunctionExpression') {
            functions.push(extractFunctionInfo(node.right, content, node.left.property.name));
          }
        },
        // Parse arrow functions in exports
        Property(node: any) {
          if (node.value?.type === 'ArrowFunctionExpression') {
            functions.push(extractFunctionInfo(node.value, content, node.key.name));
          }
        }
      });
    } catch (error) {
      console.warn(`Failed to parse file: ${error}`);
    }

    return functions;
  }
}

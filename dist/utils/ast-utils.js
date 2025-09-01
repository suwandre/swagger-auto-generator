"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASTParser = void 0;
const acorn = __importStar(require("acorn"));
const walk = __importStar(require("acorn-walk"));
class ASTParser {
    static parseFile(content) {
        const functions = [];
        // Define helper functions inside the method scope
        function extractFunctionInfo(node, content, exportName) {
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
        function extractParameters(node) {
            if (!node.params)
                return [];
            return node.params.map((param) => ({
                name: param.name || param.left?.name || 'unknown',
                type: inferParameterType(param),
                required: param.type !== 'AssignmentPattern' // has default value
            }));
        }
        function extractComments(node, content) {
            // Extract JSDoc comments above the function
            const lines = content.split('\n');
            const comments = [];
            if (node.start) {
                const nodeLineStart = content.substring(0, node.start).split('\n').length - 1;
                // Look backwards for comments
                for (let i = nodeLineStart - 1; i >= 0; i--) {
                    const line = lines[i].trim();
                    if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/**')) {
                        comments.unshift(line);
                    }
                    else if (line === '') {
                        continue;
                    }
                    else {
                        break;
                    }
                }
            }
            return comments;
        }
        function inferHttpMethod(functionName, comments) {
            // Check comments first
            const commentText = comments.join(' ').toLowerCase();
            if (commentText.includes('@method')) {
                const methodMatch = commentText.match(/@method\s+(get|post|put|delete|patch)/i);
                if (methodMatch)
                    return methodMatch[1].toUpperCase();
            }
            // Infer from function name
            const name = functionName.toLowerCase();
            if (name.startsWith('get') || name.includes('fetch') || name.includes('find'))
                return 'GET';
            if (name.startsWith('post') || name.includes('create') || name.includes('add'))
                return 'POST';
            if (name.startsWith('put') || name.includes('update') || name.includes('edit'))
                return 'PUT';
            if (name.startsWith('delete') || name.includes('remove'))
                return 'DELETE';
            if (name.startsWith('patch'))
                return 'PATCH';
            return 'GET'; // default
        }
        function extractRoute(comments) {
            const commentText = comments.join(' ');
            const routeMatch = commentText.match(/@route\s+([^\s]+)/i);
            return routeMatch ? routeMatch[1] : undefined;
        }
        function inferParameterType(param) {
            // Basic type inference - can be enhanced
            if (param.type === 'Identifier')
                return 'string';
            if (param.type === 'AssignmentPattern') {
                if (param.right?.type === 'Literal') {
                    if (typeof param.right.value === 'number')
                        return 'number';
                    if (typeof param.right.value === 'boolean')
                        return 'boolean';
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
                FunctionDeclaration(node) {
                    if (node.id && node.id.name) {
                        functions.push(extractFunctionInfo(node, content));
                    }
                },
                // Parse exported functions
                AssignmentExpression(node) {
                    if (node.left?.object?.name === 'exports' &&
                        node.right?.type === 'FunctionExpression') {
                        functions.push(extractFunctionInfo(node.right, content, node.left.property.name));
                    }
                },
                // Parse arrow functions in exports
                Property(node) {
                    if (node.value?.type === 'ArrowFunctionExpression') {
                        functions.push(extractFunctionInfo(node.value, content, node.key.name));
                    }
                }
            });
        }
        catch (error) {
            console.warn(`Failed to parse file: ${error}`);
        }
        return functions;
    }
}
exports.ASTParser = ASTParser;
//# sourceMappingURL=ast-utils.js.map
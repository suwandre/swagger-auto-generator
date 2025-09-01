"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControllerParser = void 0;
const ast_utils_1 = require("../utils/ast-utils");
const file_utils_1 = require("../utils/file-utils");
class ControllerParser {
    static async parseControllers(filePaths) {
        const endpoints = [];
        for (const filePath of filePaths) {
            const content = file_utils_1.FileUtils.readFileContent(filePath);
            const functions = ast_utils_1.ASTParser.parseFile(content);
            for (const func of functions) {
                const endpoint = this.convertToSwaggerEndpoint(func, filePath);
                if (endpoint) {
                    endpoints.push(endpoint);
                }
            }
        }
        return endpoints;
    }
    static convertToSwaggerEndpoint(func, filePath) {
        // Skip private functions (starting with _)
        if (func.name.startsWith('_'))
            return null;
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
    static extractBasePathFromFile(filePath) {
        const pathParts = filePath.split('/');
        const controllerFile = pathParts[pathParts.length - 1];
        const baseName = controllerFile.replace(/controller\.js$|\.js$/, '');
        return `/${baseName.toLowerCase()}`;
    }
    static generateRouteFromFunction(funcName, basePath) {
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
    static generateSummary(func) {
        // Extract from comments or generate from function name
        const commentSummary = func.comments.find(c => c.includes('@summary') || c.includes('@description'));
        if (commentSummary) {
            return commentSummary.replace(/[@*\/]/g, '').replace(/summary|description/i, '').trim();
        }
        // Generate from function name
        return func.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }
    static convertParameters(params) {
        return params.map(param => ({
            name: param.name,
            in: param.name === 'id' ? 'path' : 'query',
            required: param.required,
            type: param.type,
            description: param.description || `${param.name} parameter`
        }));
    }
    static generateResponses() {
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
    static extractTagFromFile(filePath) {
        const pathParts = filePath.split('/');
        const fileName = pathParts[pathParts.length - 1];
        return fileName.replace(/controller\.js$|\.js$/, '').toLowerCase();
    }
}
exports.ControllerParser = ControllerParser;
//# sourceMappingURL=controller-parser.js.map
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
exports.FileUtils = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
class FileUtils {
    static async findFiles(pattern, basePath) {
        try {
            const files = await (0, glob_1.glob)(pattern, { cwd: basePath });
            return files.map(file => path.resolve(basePath, file));
        }
        catch (error) {
            console.warn(`Failed to find files with pattern ${pattern}:`, error);
            return [];
        }
    }
    static readFileContent(filePath) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File does not exist: ${filePath}`);
        }
        return fs.readFileSync(filePath, 'utf-8');
    }
    static async findMicroserviceFiles(basePath, includePatterns, excludePatterns) {
        console.log(`🔎 Scanning directory: ${basePath}`);
        if (!fs.existsSync(basePath)) {
            throw new Error(`Input directory does not exist: ${basePath}`);
        }
        const patterns = includePatterns || [
            '**/controller.js',
            '**/router.js',
            '**/validator.js',
            '**/authenticator.js'
        ];
        console.log('🔍 Include patterns:', patterns);
        const allFiles = {};
        const processedFiles = new Set(); // Prevent duplicates
        for (const pattern of patterns) {
            try {
                const files = await (0, glob_1.glob)(pattern, {
                    cwd: basePath,
                    ignore: excludePatterns || []
                });
                console.log(`✅ Pattern '${pattern}' found ${files.length} file(s)`);
                const category = this.categorizeFile(pattern);
                for (const file of files) {
                    if (!file)
                        continue; // Skip undefined/empty files
                    const resolvedPath = path.resolve(basePath, file);
                    if (!processedFiles.has(resolvedPath)) {
                        processedFiles.add(resolvedPath);
                        if (!allFiles[category]) {
                            allFiles[category] = [];
                        }
                        allFiles[category].push(resolvedPath);
                    }
                }
            }
            catch (error) {
                console.error(`❌ Error processing pattern '${pattern}':`, error);
            }
        }
        // Log final results
        Object.keys(allFiles).forEach(category => {
            console.log(`📁 ${category}: ${allFiles[category].length} files`);
        });
        return allFiles;
    }
    /**
    * Parse router.js file to extract route definitions
    * Matches patterns like: router.post("/create-invoice", ..., controller.createInvoice)
    */
    static parseRouterFile(filePath) {
        try {
            const content = this.readFileContent(filePath);
            const routes = [];
            // Regex to match router method calls with controller functions
            const routePattern = /router\.(get|post|put|delete|patch)\(\s*["']([^"']+)["'][^)]*controller\.(\w+)/g;
            let match;
            while ((match = routePattern.exec(content)) !== null) {
                routes.push({
                    method: match[1].toUpperCase(),
                    path: match[2],
                    functionName: match[3]
                });
            }
            console.log(`📍 Found ${routes.length} routes in router file:`);
            routes.forEach(route => {
                console.log(`   ${route.method} ${route.path} → ${route.functionName}`);
            });
            return routes;
        }
        catch (error) {
            console.warn(`⚠️  Could not parse router file: ${error.message}`);
            return [];
        }
    }
    static categorizeFile(pattern) {
        if (pattern.includes('controller'))
            return 'controllers';
        if (pattern.includes('router') || pattern.includes('routes'))
            return 'routers';
        if (pattern.includes('validator'))
            return 'validators';
        if (pattern.includes('auth'))
            return 'authenticators';
        return 'unknown';
    }
}
exports.FileUtils = FileUtils;
//# sourceMappingURL=file-utils.js.map
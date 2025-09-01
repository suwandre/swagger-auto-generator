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
        const files = await (0, glob_1.glob)(pattern, { cwd: basePath });
        return files.map(file => path.resolve(basePath, file));
    }
    static readFileContent(filePath) {
        return fs.readFileSync(filePath, 'utf-8');
    }
    static async findMicroserviceFiles(basePath) {
        const patterns = [
            '**/controller.js',
            '**/controllers/*.js',
            '**/router.js',
            '**/routes/*.js',
            '**/validator.js',
            '**/validators/*.js',
            '**/auth*.js'
        ];
        const allFiles = {};
        for (const pattern of patterns) {
            const files = await this.findFiles(pattern, basePath);
            const category = this.categorizeFile(pattern);
            allFiles[category] = [...(allFiles[category] || []), ...files];
        }
        return allFiles;
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
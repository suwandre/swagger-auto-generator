'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.SwaggerGenerator = void 0;
const controller_parser_1 = require('../parsers/controller-parser');
const file_utils_1 = require('../utils/file-utils');
const fs = __importStar(require('fs'));
const path = __importStar(require('path'));
class SwaggerGenerator {
  constructor(config) {
    this.config = config;
  }
  async generate() {
    console.log('🔍 Scanning for microservice files...');
    const files = await file_utils_1.FileUtils.findMicroserviceFiles(
      this.config.inputPath,
      this.config.include,
      this.config.exclude
    );
    // Filter out any undefined paths and add debugging
    const controllers = (files.controllers || []).filter(Boolean);
    const routers = (files.routers || []).filter(Boolean);
    console.log(`📝 Processing ${controllers.length} controller files...`);
    if (controllers.length === 0) {
      console.warn('⚠️  No controller files found to parse!');
      return;
    }
    // NEW: Parse router file for route information
    let routerRoutes = [];
    if (routers.length > 0) {
      console.log('📍 Parsing router file for route definitions...');
      routerRoutes = file_utils_1.FileUtils.parseRouterFile(routers[0]);
    }
    // Pass router routes to controller parser
    const endpoints =
      await controller_parser_1.ControllerParser.parseControllers(
        controllers,
        routerRoutes
      );
    if (endpoints.length === 0) {
      console.warn('⚠️  No endpoints found. Check your exported functions.');
    }
    console.log('🏗️  Generating Swagger specification...');
    const swaggerSpec = this.buildSwaggerSpec(endpoints);
    console.log('💾 Writing Swagger documentation...');
    await this.writeSwaggerFile(swaggerSpec);
    console.log(
      `✅ Generated documentation for ${endpoints.length} endpoints!`
    );
  }
  buildSwaggerSpec(endpoints) {
    // Parse baseUrl into host and basePath
    let host = 'localhost:3000';
    let basePath = '/';
    let schemes = ['http'];

    if (this.config.apiInfo.baseUrl) {
      const baseUrl = this.config.apiInfo.baseUrl;

      // Remove protocol if present
      let cleanUrl = baseUrl;
      if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
        schemes = baseUrl.startsWith('https://')
          ? ['https', 'http']
          : ['http', 'https'];
        cleanUrl = baseUrl.replace(/^https?:\/\//, '');
      } else {
        schemes = ['https', 'http']; // Default for production
      }

      // Split domain and path
      const parts = cleanUrl.split('/');
      host = parts[0]; // Domain only

      if (parts.length > 1) {
        basePath = '/' + parts.slice(1).join('/'); // Path only
      }

      console.log(`🔧 Parsed baseUrl "${baseUrl}" into:`);
      console.log(`   Host: ${host}`);
      console.log(`   BasePath: ${basePath}`);
    }

    const spec = {
      swagger: '2.0',
      info: {
        title: this.config.apiInfo.title,
        version: this.config.apiInfo.version,
        description:
          this.config.apiInfo.description || 'Auto-generated API documentation',
      },
      host: host, // Fixed: Now only domain
      basePath: basePath, // Fixed: Now only path
      schemes: schemes, // Dynamic based on protocol
      consumes: ['application/json'],
      produces: ['application/json'],
      paths: {},
      definitions: {},
    };

    // Group endpoints by path and method (unchanged)
    const pathsMap = {};
    endpoints.forEach((endpoint) => {
      if (!pathsMap[endpoint.path]) {
        pathsMap[endpoint.path] = {};
      }
      pathsMap[endpoint.path][endpoint.method.toLowerCase()] = {
        summary: endpoint.summary,
        description: endpoint.summary,
        tags: endpoint.tags,
        parameters: endpoint.parameters,
        responses: this.formatResponses(endpoint.responses),
      };
    });
    spec.paths = pathsMap;
    return spec;
  }

  formatResponses(responses) {
    const formattedResponses = {};
    responses.forEach((response) => {
      formattedResponses[response.status.toString()] = {
        description: response.description,
        schema: response.schema,
      };
    });
    return formattedResponses;
  }
  async writeSwaggerFile(spec) {
    const outputDir = path.dirname(this.config.outputPath);
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    // Write JSON file
    fs.writeFileSync(this.config.outputPath, JSON.stringify(spec, null, 2));
    // Also write YAML file
    const yamlPath = this.config.outputPath.replace('.json', '.yaml');
    const yaml = require('js-yaml');
    fs.writeFileSync(yamlPath, yaml.dump(spec));
  }
}
exports.SwaggerGenerator = SwaggerGenerator;
//# sourceMappingURL=swagger-generator.js.map

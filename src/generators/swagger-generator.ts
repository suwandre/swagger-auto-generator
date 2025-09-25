import { SwaggerConfig, SwaggerEndpoint } from '../types';
import { ControllerParser } from '../parsers/controller-parser';
import { FileUtils } from '../utils/file-utils';
import * as fs from 'fs';
import * as path from 'path';

export class SwaggerGenerator {
  private config: SwaggerConfig;

  constructor(config: SwaggerConfig) {
    this.config = config;
  }

  async generate(): Promise<void> {
    console.log('🔍 Scanning for microservice files...');

    const files = await FileUtils.findMicroserviceFiles(
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
    let routerRoutes: Array<{ method: string, path: string, functionName: string }> = [];
    if (routers.length > 0) {
      console.log('📍 Parsing router file for route definitions...');
      routerRoutes = FileUtils.parseRouterFile(routers[0]);
    }

    // Pass router routes to controller parser
    const endpoints = await ControllerParser.parseControllers(controllers, routerRoutes);

    if (endpoints.length === 0) {
      console.warn('⚠️  No endpoints found. Check your exported functions.');
    }

    console.log('🏗️  Generating Swagger specification...');
    const swaggerSpec = this.buildSwaggerSpec(endpoints);

    console.log('💾 Writing Swagger documentation...');
    await this.writeSwaggerFile(swaggerSpec);

    console.log(`✅ Generated documentation for ${endpoints.length} endpoints!`);
  }


  private buildSwaggerSpec(endpoints: SwaggerEndpoint[]): any {
    // Parse baseUrl into host and basePath
    let host = 'localhost:3000';
    let basePath = '/';
    let schemes = ['http'];

    if (this.config.apiInfo.baseUrl) {
      const baseUrl = this.config.apiInfo.baseUrl;

      // Remove protocol if present
      let cleanUrl = baseUrl;
      if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
        schemes = baseUrl.startsWith('https://') ? ['https', 'http'] : ['http', 'https'];
        cleanUrl = baseUrl.replace(/^https?:\/\//, '');
      } else {
        schemes = ['https', 'http']; // Default for production
      }

      // Split domain and path
      const parts = cleanUrl.split('/');
      host = parts[0];  // Domain only

      if (parts.length > 1) {
        basePath = '/' + parts.slice(1).join('/');  // Path only
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
        description: this.config.apiInfo.description || 'Auto-generated API documentation'
      },
      host: host,         // Fixed: Now only domain
      basePath: basePath, // Fixed: Now only path
      schemes: schemes,   // Dynamic based on protocol
      consumes: ['application/json'],
      produces: ['application/json'],
      paths: {},
      definitions: {}
    };

    // Group endpoints by path and method (unchanged)
    const pathsMap: { [key: string]: any } = {};

    endpoints.forEach(endpoint => {
      if (!pathsMap[endpoint.path]) {
        pathsMap[endpoint.path] = {};
      }

      pathsMap[endpoint.path][endpoint.method.toLowerCase()] = {
        summary: endpoint.summary,
        description: endpoint.summary,
        tags: endpoint.tags,
        parameters: endpoint.parameters,
        responses: this.formatResponses(endpoint.responses)
      };
    });

    spec.paths = pathsMap;
    return spec;
  }


  private formatResponses(responses: any[]): any {
    const formattedResponses: any = {};

    responses.forEach(response => {
      formattedResponses[response.status.toString()] = {
        description: response.description,
        schema: response.schema
      };
    });

    return formattedResponses;
  }

  private async writeSwaggerFile(spec: any): Promise<void> {
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

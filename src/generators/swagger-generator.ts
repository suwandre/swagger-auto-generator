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
    const files = await FileUtils.findMicroserviceFiles(this.config.inputPath);
    
    console.log('📝 Parsing controllers...');
    const endpoints = await ControllerParser.parseControllers(files.controllers || []);
    
    console.log('🏗️  Generating Swagger specification...');
    const swaggerSpec = this.buildSwaggerSpec(endpoints);
    
    console.log('💾 Writing Swagger documentation...');
    await this.writeSwaggerFile(swaggerSpec);
    
    console.log('✅ Swagger documentation generated successfully!');
  }

  private buildSwaggerSpec(endpoints: SwaggerEndpoint[]): any {
    const spec = {
      swagger: '2.0',
      info: {
        title: this.config.apiInfo.title,
        version: this.config.apiInfo.version,
        description: this.config.apiInfo.description || 'Auto-generated API documentation'
      },
      host: this.config.apiInfo.baseUrl || 'localhost:3000',
      basePath: '/',
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      paths: {},
      definitions: {}
    };

    // Group endpoints by path and method
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

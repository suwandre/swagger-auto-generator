const CodeAnalyzer = require('./code-analyzer');
const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

class AutoSwaggerGenerator {
  constructor(config) {
    this.config = config;
    this.analyzer = new CodeAnalyzer();
  }

  async generateAutoSwagger() {
    console.log('🔍 Intelligently detecting microservice directories...');
    
    const serviceDirs = this.autoDetectServiceDirectories();
    
    console.log(`📁 Auto-detected ${serviceDirs.length} microservice directories:`);
    serviceDirs.forEach(dir => console.log(`   - ${path.basename(dir)}`));
    
    if (serviceDirs.length === 0) {
      console.log('⚠️  No microservice directories found. Make sure your services contain controller.js, router.js, validator.js, or authenticator.js files.');
      return;
    }
    
    for (const serviceDir of serviceDirs) {
      await this.generateServiceSwagger(serviceDir);
    }
    
    await this.generateIndexFile(serviceDirs);
    console.log('✅ Auto-generation completed!');
  }

  autoDetectServiceDirectories() {
    const allDirs = glob.sync(path.join(this.config.servicesDir, '*'), { 
      onlyDirectories: true 
    });
    
    return allDirs.filter(dir => {
      const dirName = path.basename(dir);
      
      // Skip obvious non-service directories
      const excludePatterns = [
        /^node_modules$/,
        /^\.git$/,
        /^docs?$/,
        /^tests?$/,
        /^scripts?$/,
        /^config$/,
        /^build$/,
        /^dist$/,
        /^coverage$/,
        /^swagger-docs-generator$/,
        /^\./  // Hidden directories
      ];
      
      if (excludePatterns.some(pattern => pattern.test(dirName))) {
        console.log(`   ⏭️  Skipping ${dirName} (excluded directory)`);
        return false;
      }
      
      // Check if directory contains microservice indicator files
      const serviceIndicators = [
        'controller.js',
        'router.js', 
        'validator.js',
        'authenticator.js',
        'routes.js',
        'middleware.js'
      ];
      
      const foundFiles = serviceIndicators.filter(file => 
        fs.existsSync(path.join(dir, file))
      );
      
      if (foundFiles.length > 0) {
        console.log(`   ✅ ${dirName} - Found: ${foundFiles.join(', ')}`);
        return true;
      }
      
      // Additional checks for microservice characteristics
      const hasPackageJson = fs.existsSync(path.join(dir, 'package.json'));
      const hasIndexJs = fs.existsSync(path.join(dir, 'index.js'));
      
      // Consider it a microservice if directory name suggests it's a service
      const looksLikeService = 
        /-service$/.test(dirName) ||
        /-api$/.test(dirName) ||
        /^service-/.test(dirName) ||
        /^stokr-/.test(dirName) ||
        /^sumsub-/.test(dirName) ||
        /-microservice$/.test(dirName);
      
      if ((hasPackageJson && hasIndexJs) || looksLikeService) {
        console.log(`   ❓ ${dirName} - Looks like service but no standard files found`);
        return false; // Could return true if you want to include these
      }
      
      return false;
    });
  }

  async generateServiceSwagger(serviceDir) {
    const serviceName = path.basename(serviceDir);
    console.log(`📝 Auto-analyzing ${serviceName}...`);

    const fileTypes = ['controller', 'router', 'validator', 'authenticator', 'routes', 'middleware'];
    let hasGeneratedFiles = false;
    
    for (const fileType of fileTypes) {
      const filePath = path.join(serviceDir, `${fileType}.js`);
      
      if (fs.existsSync(filePath)) {
        await this.generateFileSwagger(serviceName, fileType, filePath);
        hasGeneratedFiles = true;
      }
    }
    
    if (!hasGeneratedFiles) {
      console.log(`   ⚠️  No analyzable files found in ${serviceName}`);
    }
  }

  async generateFileSwagger(serviceName, fileType, filePath) {
    const functions = this.analyzer.analyzeFile(filePath);
    
    if (functions.length === 0) {
      console.log(`   ⚠️  No exported functions found in ${fileType}.js`);
      return;
    }

    const swaggerDoc = this.buildSwaggerDoc(serviceName, fileType, functions);
    
    const outputPath = path.join(
      this.config.outputDir,
      serviceName,
      `${fileType}.auto-swagger.json`
    );

    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeJson(outputPath, swaggerDoc, { spaces: 2 });
    
    console.log(`   ✅ Generated ${serviceName}/${fileType}.auto-swagger.json (${functions.length} functions)`);
  }

  buildSwaggerDoc(serviceName, fileType, functions) {
    const paths = {};
    const components = {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        userIdHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'userid'
        }
      }
    };
    
    functions.forEach(func => {
      if (fileType === 'authenticator' && func.bodyContent.isMiddleware) {
        // Document middleware as security scheme
        components.securitySchemes[func.name] = {
          type: 'http',
          scheme: 'bearer',
          description: `Middleware: ${func.name} - ${func.bodyContent.errorMessages.map(e => e.message).join(', ') || 'Authentication required'}`
        };
      } else {
        // Regular endpoint documentation
        const endpoint = this.inferEndpoint(func, fileType, serviceName);
        const method = this.inferHttpMethod(func);
        
        if (!paths[endpoint]) {
          paths[endpoint] = {};
        }
        
        paths[endpoint][method] = {
          summary: `${func.name}`,
          description: this.buildDescription(func, fileType),
          tags: [fileType],
          operationId: `${serviceName}_${fileType}_${func.name}`,
          parameters: this.buildParameters(func),
          responses: this.buildResponses(func)
        };

        // Add request body for POST/PUT methods
        if (['post', 'put', 'patch'].includes(method) && func.bodyContent.requiredBodyFields.length > 0) {
          paths[endpoint][method].requestBody = this.buildRequestBody(func);
        }

        // Add authentication if detected
        if (func.bodyContent.usesAuth) {
          paths[endpoint][method].security = [
            { bearerAuth: [] },
            { userIdHeader: [] }
          ];
        }
      }
    });

    return {
      openapi: '3.0.0',
      info: {
        title: `${serviceName} - ${fileType} (Auto-Generated)`,
        description: `Automatically generated API documentation for ${fileType}.js`,
        version: '1.0.0',
        'x-generated-at': new Date().toISOString(),
        'x-functions-analyzed': functions.length,
        'x-source-file': `${serviceName}/${fileType}.js`
      },
      components,
      paths
    };
  }

  buildDescription(func, fileType) {
    let description = `Automatically analyzed function: **${func.name}**`;
    
    if (func.isAsync) {
      description += ' *(async)*';
    }
    
    if (func.bodyContent.isMiddleware) {
      description += '\n\n*This is middleware function - it processes requests and calls next()*';
    }
    
    if (func.bodyContent.requiredBodyFields.length > 0) {
      description += `\n\n**Required body fields:** ${func.bodyContent.requiredBodyFields.join(', ')}`;
    }
    
    if (func.bodyContent.errorMessages.length > 0) {
      description += `\n\n**Error responses:**\n${func.bodyContent.errorMessages.map(e => `- ${e.code}: ${e.message}`).join('\n')}`;
    }
    
    return description;
  }

  inferEndpoint(func, fileType, serviceName) {
    const name = func.name.toLowerCase();
    
    // Smart endpoint inference based on function name
    if (name.includes('create')) {
      const resource = name.replace('create', '').replace('applicant', 'applicants').replace('payment', 'payments');
      return `/${resource || 'items'}`;
    }
    
    if (name.includes('get') && !name.includes('token')) {
      const resource = name.replace('get', '').replace('applicant', 'applicants').replace('payment', 'payments');
      return `/${resource || 'items'}/{id}`;
    }
    
    if (name.includes('update') || name.includes('edit')) {
      const resource = name.replace(/update|edit/, '').replace('applicant', 'applicants').replace('payment', 'payments');
      return `/${resource || 'items'}/{id}`;
    }
    
    if (name.includes('delete') || name.includes('remove')) {
      const resource = name.replace(/delete|remove/, '').replace('applicant', 'applicants').replace('payment', 'payments');
      return `/${resource || 'items'}/{id}`;
    }
    
    // Specific patterns
    if (name.includes('login') || name.includes('authenticate')) return '/auth/login';
    if (name.includes('logout')) return '/auth/logout';
    if (name.includes('token')) return '/auth/token';
    if (name.includes('refund')) return '/payments/{id}/refund';
    
    if (fileType === 'authenticator') {
      return `/middleware/${func.name}`;
    }
    
    // Default endpoint
    return `/${name}`;
  }

  inferHttpMethod(func) {
    const name = func.name.toLowerCase();
    
    if (name.includes('create') || name.includes('authenticate') || name.includes('login') || name.includes('refund')) {
      return 'post';
    }
    if (name.includes('get') || name.includes('find') || name.includes('fetch')) {
      return 'get';
    }
    if (name.includes('update') || name.includes('edit') || name.includes('modify')) {
      return 'put';
    }
    if (name.includes('delete') || name.includes('remove')) {
      return 'delete';
    }
    
    // Default based on body fields
    return func.bodyContent.requiredBodyFields.length > 0 ? 'post' : 'get';
  }

  buildParameters(func) {
    const parameters = [];
    
    // Add path parameters for endpoints with {id}
    const endpoint = this.inferEndpoint(func, '', '');
    if (endpoint.includes('{id}')) {
      parameters.push({
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: 'Resource identifier'
      });
    }
    
    return parameters;
  }

  buildRequestBody(func) {
    if (func.bodyContent.requiredBodyFields.length === 0) {
      return undefined;
    }
    
    const properties = {};
    const required = [];
    
    func.bodyContent.requiredBodyFields.forEach(field => {
      properties[field] = {
        type: 'string',
        description: `${field} field`
      };
      required.push(field);
    });
    
    return {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties,
            required
          }
        }
      }
    };
  }

  buildResponses(func) {
    const responses = {};
    
    // Default success response
    if (func.bodyContent.isMiddleware) {
      responses['200'] = {
        description: 'Middleware passed - continues to next handler'
      };
    } else {
      responses['200'] = {
        description: 'Success',
        content: {
          'application/json': {
            schema: { 
              type: 'object',
              properties: {
                message: { type: 'string' }
              }
            }
          }
        }
      };
    }
    
    // Add detected error responses
    func.bodyContent.errorMessages.forEach(error => {
      responses[error.code.toString()] = {
        description: `Error: ${error.message}`,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                code: { type: 'string' }
              }
            }
          }
        }
      };
    });
    
    return responses;
  }

  async generateIndexFile(serviceDirs) {
    const indexData = {
      generatedAt: new Date().toISOString(),
      totalServices: serviceDirs.length,
      services: serviceDirs.map(dir => {
        const serviceName = path.basename(dir);
        const serviceFiles = [];
        
        ['controller', 'router', 'validator', 'authenticator', 'routes', 'middleware'].forEach(fileType => {
          const swaggerPath = path.join(this.config.outputDir, serviceName, `${fileType}.auto-swagger.json`);
          if (fs.existsSync(swaggerPath)) {
            serviceFiles.push({
              type: fileType,
              path: `${serviceName}/${fileType}.auto-swagger.json`,
              url: `/docs/${serviceName}/${fileType}`
            });
          }
        });

        return {
          name: serviceName,
          files: serviceFiles,
          totalEndpoints: serviceFiles.length
        };
      }).filter(service => service.files.length > 0)
    };

    await fs.writeJson(
      path.join(this.config.outputDir, 'index.json'), 
      indexData, 
      { spaces: 2 }
    );
    
    console.log('📋 Generated documentation index');
  }
}

module.exports = AutoSwaggerGenerator;

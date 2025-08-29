const CodeAnalyzer = require('./code-analyzer');
const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

class AutoSwaggerGenerator {
  constructor(config) {
    this.config = config;
    this.analyzer = new CodeAnalyzer();
    this.swaggerDoc = {};
  }

  async generateAutoSwagger() {
    console.log('🔍 Analyzing code automatically...');
    
    const serviceDirs = glob.sync(path.join(this.config.servicesDir, 'service-*'));
    
    for (const serviceDir of serviceDirs) {
      await this.generateServiceSwagger(serviceDir);
    }
  }

  async generateServiceSwagger(serviceDir) {
    const serviceName = path.basename(serviceDir);
    console.log(`📝 Auto-analyzing ${serviceName}...`);

    const fileTypes = ['controller', 'router', 'validator', 'authenticator'];
    
    for (const fileType of fileTypes) {
      const filePath = path.join(serviceDir, `${fileType}.js`);
      
      if (fs.existsSync(filePath)) {
        await this.generateFileSwagger(serviceName, fileType, filePath);
      }
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
    
    console.log(`   ✅ Auto-generated ${serviceName}/${fileType}.auto-swagger.json`);
  }

  buildSwaggerDoc(serviceName, fileType, functions) {
    const paths = {};
    const components = {
      securitySchemes: {}
    };
    
    functions.forEach(func => {
      if (fileType === 'authenticator' && func.bodyContent.isMiddleware) {
        // Document as middleware component
        components.securitySchemes[func.name] = {
          type: 'http',
          scheme: 'bearer',
          description: `Middleware: ${func.name} - ${func.bodyContent.errorMessages.map(e => e.message).join(', ') || 'Authentication required'}`
        };
      } else {
        // Regular endpoint documentation
        const endpoint = this.inferEndpoint(func, fileType);
        const method = this.inferHttpMethod(func);
        
        if (!paths[endpoint]) {
          paths[endpoint] = {};
        }
        
        paths[endpoint][method] = {
          summary: `${func.name} - Auto-generated from ${fileType}.js`,
          description: this.buildDescription(func, fileType),
          tags: [fileType],
          parameters: this.buildParameters(func),
          responses: this.buildResponses(func)
        };

        // Add authentication if detected
        if (func.bodyContent.usesAuth) {
          paths[endpoint][method].security = [{ bearerAuth: [] }];
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
        'x-functions-found': functions.length
      },
      components,
      paths
    };
  }

  buildDescription(func, fileType) {
    let description = `Automatically analyzed function: ${func.name}`;
    
    if (func.bodyContent.isMiddleware) {
      description += ' (Middleware)';
    }
    
    if (func.bodyContent.errorMessages.length > 0) {
      description += `\n\nError responses: ${func.bodyContent.errorMessages.map(e => `${e.code} - ${e.message}`).join(', ')}`;
    }
    
    return description;
  }

  inferEndpoint(func, fileType) {
    const name = func.name;
    
    if (fileType === 'controller') {
      if (name.includes('login')) return '/auth/login';
      if (name.includes('logout')) return '/auth/logout';
      if (name.includes('create')) return `/${name.replace('create', '').toLowerCase()}`;
      if (name.includes('get')) return `/${name.replace('get', '').toLowerCase()}/{id}`;
      if (name.includes('update')) return `/${name.replace('update', '').toLowerCase()}/{id}`;
      if (name.includes('delete')) return `/${name.replace('delete', '').toLowerCase()}/{id}`;
    }
    
    if (fileType === 'authenticator') {
      return `/middleware/${name}`;
    }
    
    return `/${name}`;
  }

  inferHttpMethod(func) {
    const name = func.name.toLowerCase();
    
    if (name.includes('create') || name.includes('login')) return 'post';
    if (name.includes('get') || name.includes('find')) return 'get';
    if (name.includes('update') || name.includes('edit')) return 'put';
    if (name.includes('delete') || name.includes('remove')) return 'delete';
    
    // Default based on parameters - if it takes req.body, probably POST
    const hasBodyParams = func.parameters.some(p => p.type === 'object');
    return hasBodyParams ? 'post' : 'get';
  }

  buildParameters(func) {
    const parameters = [];
    
    func.parameters.forEach(param => {
      if (param.name === 'req' || param.name === 'res' || param.name === 'next') {
        return; // Skip Express framework parameters
      }
      
      if (param.type === 'object' && param.properties) {
        // Handle body parameters
        parameters.push({
          name: 'body',
          in: 'body',
          required: true,
          schema: {
            type: 'object',
            properties: this.buildObjectProperties(param.properties)
          }
        });
      }
    });
    
    return parameters;
  }

  buildResponses(func) {
    const responses = {};
    
    // Handle middleware functions
    if (func.bodyContent.isMiddleware) {
      responses['200'] = {
        description: 'Middleware passed - continues to next handler'
      };
    } else {
      responses['200'] = {
        description: 'Success',
        content: {
          'application/json': {
            schema: { type: 'object' }
          }
        }
      };
    }
    
    // Add specific error responses with messages
    func.bodyContent.errorMessages.forEach(error => {
      responses[error.code.toString()] = {
        description: `Error: ${error.message}`,
        content: {
          'text/plain': {
            schema: {
              type: 'string',
              example: error.message
            }
          }
        }
      };
    });
    
    return responses;
  }

  buildObjectProperties(properties) {
    const props = {};
    properties.forEach(prop => {
      props[prop.name] = { 
        type: 'string',
        required: prop.required
      };
    });
    return props;
  }
}

module.exports = AutoSwaggerGenerator;

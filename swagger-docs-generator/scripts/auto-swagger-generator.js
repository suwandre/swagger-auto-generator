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

    console.log(
      `📁 Auto-detected ${serviceDirs.length} microservice directories:`
    );
    serviceDirs.forEach((dir) => console.log(`   - ${path.basename(dir)}`));

    if (serviceDirs.length === 0) {
      console.log(
        '⚠️  No microservice directories found. Make sure your services contain controller.js, router.js, validator.js, or authenticator.js files.'
      );
      return;
    }

    for (const serviceDir of serviceDirs) {
      await this.generateServiceSwagger(serviceDir);
    }

    await this.generateIndexFile(serviceDirs);
    console.log('✅ Auto-generation completed!');
  }

  autoDetectServiceDirectories() {
    console.log(`🔍 DEBUG: Scanning ${this.config.servicesDir}`);
    console.log(`🔍 DEBUG: Full path ${path.resolve(this.config.servicesDir)}`);

    // Fix for Windows: Convert backslashes to forward slashes for glob
    const globPattern = path
      .join(this.config.servicesDir, '*')
      .replace(/\\/g, '/');
    console.log(`🔍 DEBUG: Glob pattern: ${globPattern}`);

    const allDirs = glob.sync(globPattern, {
      onlyDirectories: true,
      windowsPathsNoEscape: true,
    });

    console.log(`🔍 DEBUG: Found directories:`, allDirs);

    return allDirs.filter((dir) => {
      const dirName = path.basename(dir);

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
        /^\./,
      ];

      if (excludePatterns.some((pattern) => pattern.test(dirName))) {
        console.log(`   ⏭️  Skipping ${dirName} (excluded directory)`);
        return false;
      }

      const serviceIndicators = [
        'controller.js',
        'router.js',
        'validator.js',
        'authenticator.js',
        'routes.js',
        'middleware.js',
      ];

      const foundFilesRoot = serviceIndicators.filter((file) =>
        fs.existsSync(path.join(dir, file))
      );

      const appDir = path.join(dir, 'app');
      const foundFilesApp = serviceIndicators.filter((file) =>
        fs.existsSync(path.join(appDir, file))
      );

      if (foundFilesRoot.length > 0) {
        console.log(
          `   ✅ ${dirName} - Found in root: ${foundFilesRoot.join(', ')}`
        );
        return true;
      } else if (foundFilesApp.length > 0) {
        console.log(
          `   ✅ ${dirName} - Found in app/: ${foundFilesApp.join(', ')}`
        );
        return true;
      }

      console.log(`   ❌ ${dirName} - No service files found`);
      return false;
    });
  }

  async generateServiceSwagger(serviceDir) {
    const serviceName = path.basename(serviceDir);
    console.log(`📝 Auto-analyzing ${serviceName}...`);

    const fileTypes = [
      'controller',
      'router',
      'validator',
      'authenticator',
      'routes',
      'middleware',
    ];
    let hasGeneratedFiles = false;

    for (const fileType of fileTypes) {
      let filePath = path.join(serviceDir, `${fileType}.js`);
      let fileLocation = 'root';

      if (!fs.existsSync(filePath)) {
        filePath = path.join(serviceDir, 'app', `${fileType}.js`);
        fileLocation = 'app/';
      }

      if (fs.existsSync(filePath)) {
        console.log(`   📄 Found ${fileType}.js in ${fileLocation}`);
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

    console.log(
      `   ✅ Generated ${serviceName}/${fileType}.auto-swagger.json (${functions.length} functions)`
    );
  }

  buildSwaggerDoc(serviceName, fileType, functions) {
    const paths = {};
    const components = {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        userIdHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'userid',
        },
      },
    };

    functions.forEach((func) => {
      if (!func || !func.name) {
        console.warn('   ⚠️  Skipping invalid function object');
        return;
      }

      if (func.type === 'router') {
        components.routers = components.routers || {};
        components.routers[func.name] = {
          description: func.description || `Express router from ${fileType}.js`,
          middleware: func.bodyContent?.usesMiddleware || false,
        };
        return;
      }

      if (fileType === 'authenticator' && func.bodyContent?.isMiddleware) {
        components.securitySchemes[func.name] = {
          type: 'http',
          scheme: 'bearer',
          description: `Middleware: ${func.name} - ${
            func.bodyContent.errorMessages?.map((e) => e.message).join(', ') ||
            'Authentication required'
          }`,
        };
        return;
      }

      const endpoint = this.inferEndpoint(func, fileType, serviceName);
      const method = this.inferHttpMethod(func);

      if (!paths[endpoint]) {
        paths[endpoint] = {};
      }

      paths[endpoint][method] = {
        summary: func.name,
        description: this.buildDescription(func, fileType),
        tags: [fileType],
        operationId: `${serviceName}_${fileType}_${func.name}`,
        parameters: this.buildParameters(func),
        responses: this.buildResponses(func),
      };

      if (['post', 'put', 'patch'].includes(method)) {
        const requestBody = this.buildRequestBody(func);
        if (requestBody) {
          paths[endpoint][method].requestBody = requestBody;
        }
      }

      if (func.bodyContent?.usesAuth) {
        paths[endpoint][method].security = [
          { bearerAuth: [] },
          { userIdHeader: [] },
        ];
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
        'x-source-file': `${serviceName}/${fileType}.js`,
      },
      // ADD THIS SERVERS SECTION
      servers: [
        {
          url: 'http://localhost:8080',
          description: 'Mock API Server',
        },
      ],
      components,
      paths,
    };
  }

  buildDescription(func, fileType) {
    let description = `Automatically analyzed function: **${func.name}**`;

    if (func.isAsync) {
      description += ' *(async)*';
    }

    if (func.bodyContent?.isMiddleware) {
      description +=
        '\n\n*This is middleware function - it processes requests and calls next()*';
    }

    if (func.bodyContent?.requiredFields?.length > 0) {
      description += `\n\n**Required fields:** ${func.bodyContent.requiredFields.join(
        ', '
      )}`;
    }

    if (func.bodyContent?.errorMessages?.length > 0) {
      description += `\n\n**Error responses:**\n${func.bodyContent.errorMessages
        .map((e) => `- ${e.code}: ${e.message}`)
        .join('\n')}`;
    }

    return description;
  }

  inferEndpoint(func, fileType, serviceName) {
    if (func.type === 'route' && func.path) {
      return func.path;
    }

    const name = func.name ? func.name.toLowerCase() : '';

    if (name.includes('create')) {
      const resource = name
        .replace('create', '')
        .replace('invoice', 'invoices');
      return `/${resource || 'items'}`;
    }

    if (name.includes('get') && !name.includes('token')) {
      const resource = name.replace('get', '').replace('invoice', 'invoices');
      return `/${resource || 'items'}/{id}`;
    }

    if (name.includes('update') || name.includes('edit')) {
      const resource = name
        .replace(/update|edit/, '')
        .replace('invoice', 'invoices');
      return `/${resource || 'items'}/{id}`;
    }

    if (name.includes('delete') || name.includes('remove')) {
      const resource = name
        .replace(/delete|remove/, '')
        .replace('invoice', 'invoices');
      return `/${resource || 'items'}/{id}`;
    }

    if (name.includes('login') || name.includes('authenticate'))
      return '/auth/login';
    if (name.includes('logout')) return '/auth/logout';
    if (name.includes('token')) return '/auth/token';
    if (name.includes('notify')) return '/notify';

    if (fileType === 'authenticator') {
      return `/middleware/${func.name}`;
    }

    return `/${name}`;
  }

  inferHttpMethod(func) {
    if (!func) return 'get';

    if (func.type === 'route' && func.method) {
      return func.method.toLowerCase();
    }

    if (func.type === 'router') {
      return 'get';
    }

    const name = func.name ? func.name.toLowerCase() : '';

    if (
      name.includes('create') ||
      name.includes('authenticate') ||
      name.includes('login')
    ) {
      return 'post';
    }
    if (
      name.includes('get') ||
      name.includes('find') ||
      name.includes('fetch')
    ) {
      return 'get';
    }
    if (
      name.includes('update') ||
      name.includes('edit') ||
      name.includes('modify')
    ) {
      return 'put';
    }
    if (name.includes('delete') || name.includes('remove')) {
      return 'delete';
    }

    if (func.type === 'middleware' || func.isMiddleware) {
      return 'post';
    }

    if (func.bodyContent?.requiredFields?.length > 0) {
      return 'post';
    }

    return 'post'; // Default for most functions
  }

  buildParameters(func) {
    const parameters = [];

    if (func.parameters && Array.isArray(func.parameters)) {
      func.parameters.forEach((param) => {
        if (!param) return;

        if (
          param.name === 'req' ||
          param.name === 'res' ||
          param.name === 'next'
        ) {
          return;
        }

        if (param.type === 'object' && param.properties) {
          parameters.push({
            name: 'body',
            in: 'body',
            required: true,
            schema: {
              type: 'object',
              properties: this.buildObjectProperties(param.properties),
            },
          });
        }
      });
    }

    const endpoint = this.inferEndpoint(func, '', '');
    if (endpoint.includes('{id}')) {
      parameters.push({
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: 'Resource identifier',
      });
    }

    return parameters;
  }

  buildRequestBody(func) {
    if (!func.bodyContent?.requiredFields?.length) {
      return undefined;
    }

    const properties = {};
    const required = [];

    func.bodyContent.requiredFields.forEach((field) => {
      properties[field] = {
        type: 'string',
        description: `${field} field`,
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
            required,
          },
        },
      },
    };
  }

  buildResponses(func) {
    const responses = {};

    if (func.bodyContent?.isMiddleware) {
      responses['200'] = {
        description: 'Middleware passed - continues to next handler',
      };
    } else {
      responses['200'] = {
        description: 'Success',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string' },
              },
            },
          },
        },
      };
    }

    if (func.bodyContent?.errorMessages?.length > 0) {
      func.bodyContent.errorMessages.forEach((error) => {
        responses[error.code.toString()] = {
          description: `Error: ${error.message}`,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                  code: { type: 'string' },
                },
              },
            },
          },
        };
      });
    }

    return responses;
  }

  buildObjectProperties(properties) {
    const props = {};
    properties.forEach((prop) => {
      props[prop.name] = {
        type: 'string',
        required: prop.required,
      };
    });
    return props;
  }

  async generateIndexFile(serviceDirs) {
    const indexData = {
      generatedAt: new Date().toISOString(),
      totalServices: serviceDirs.length,
      services: serviceDirs
        .map((dir) => {
          const serviceName = path.basename(dir);
          const serviceFiles = [];

          [
            'controller',
            'router',
            'validator',
            'authenticator',
            'routes',
            'middleware',
          ].forEach((fileType) => {
            const swaggerPath = path.join(
              this.config.outputDir,
              serviceName,
              `${fileType}.auto-swagger.json`
            );
            if (fs.existsSync(swaggerPath)) {
              serviceFiles.push({
                type: fileType,
                path: `${serviceName}/${fileType}.auto-swagger.json`,
                url: `/docs/${serviceName}/${fileType}`,
              });
            }
          });

          return {
            name: serviceName,
            files: serviceFiles,
            totalEndpoints: serviceFiles.length,
          };
        })
        .filter((service) => service.files.length > 0),
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

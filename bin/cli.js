#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const { generateSwaggerDocs } = require('../dist/index');

program
  .name('swagger-gen')
  .description('Automated Swagger documentation generator')
  .version('1.0.0');  // Use built-in version method

// Add storeOptionsAsProperties(false) to avoid conflicts
program.storeOptionsAsProperties(false);

program
  .option('-i, --input <path>', 'Input directory path', './src')
  .option('-o, --output <path>', 'Output file path', './docs/swagger.json')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--title <title>', 'API title', 'Microservice API')
  .option('--api-version <version>', 'API version', '1.0.0')  // Changed from --version
  .option('--description <desc>', 'API description')
  .option('--base-url <url>', 'Base URL')
  .action(async (options) => {
    try {
      let config;
      
      if (options.config && fs.existsSync(options.config)) {
        config = JSON.parse(fs.readFileSync(options.config, 'utf-8'));
      } else {
        config = {
          inputPath: path.resolve(options.input),
          outputPath: path.resolve(options.output),
          apiInfo: {
            title: options.title,
            version: options.apiVersion,  // Use apiVersion instead of version
            description: options.description,
            baseUrl: options.baseUrl
          }
        };
      }
      
      console.log('🚀 Starting Swagger documentation generation...');
      await generateSwaggerDocs(config);
      console.log('🎉 Documentation generation completed!');
      
    } catch (error) {
      console.error('❌ Error generating documentation:', error.message);
      process.exit(1);
    }
  });

program.parse();

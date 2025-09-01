#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');

// Use storeOptionsAsProperties(true) to avoid property clashes
program.storeOptionsAsProperties(true);

program
  .name('swagger-gen')
  .description('Automated Swagger documentation generator')
  .version('1.0.0');

program
  .option('-i, --input <path>', 'Input directory path', './src')
  .option('-o, --output <path>', 'Output file path', './docs/swagger.json')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--title <title>', 'API title', 'Microservice API')
  .option('--api-version <version>', 'API version', '1.0.0')
  .option('--api-description <desc>', 'API description')  // Renamed to avoid conflict
  .option('--base-url <url>', 'Base URL')
  .action(async () => {
    try {
      console.log('🔧 CLI options received:', program.opts());
      
      let config;
      
      if (program.config) {
        const configPath = path.resolve(process.cwd(), program.config);
        console.log('📄 Loading config from:', configPath);
        
        if (!fs.existsSync(configPath)) {
          throw new Error(`Config file not found: ${configPath}`);
        }
        
        const configContent = fs.readFileSync(configPath, 'utf-8');
        config = JSON.parse(configContent);
        console.log('📊 Parsed config inputPath:', config.inputPath);
        
        // Resolve paths relative to config file location
        const configDir = path.dirname(configPath);
        config.inputPath = path.resolve(configDir, config.inputPath);
        config.outputPath = path.resolve(configDir, config.outputPath);
        
      } else {
        console.log('⚠️  No config file provided, using CLI options');
        config = {
          inputPath: path.resolve(program.input || './src'),
          outputPath: path.resolve(program.output || './docs/swagger.json'),
          apiInfo: {
            title: program.title || 'Microservice API',
            version: program.apiVersion || '1.0.0',
            description: program.apiDescription || '',
            baseUrl: program.baseUrl || ''
          }
        };
      }
      
      console.log('🚀 Starting Swagger documentation generation...');
      console.log('📁 Input path:', config.inputPath);
      console.log('📄 Output path:', config.outputPath);
      
      const { generateSwaggerDocs } = require('../dist/index');
      await generateSwaggerDocs(config);
      
      console.log('🎉 Documentation generation completed!');
      
    } catch (error) {
      console.error('❌ Error generating documentation:', error.message);
      process.exit(1);
    }
  });

program.parse();

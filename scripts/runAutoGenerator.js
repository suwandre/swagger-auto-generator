const AutoSwaggerGenerator = require('./auto-swagger-generator');
const config = require('../config/generator.config');

async function main() {
  try {
    console.log('🚀 Starting intelligent swagger auto-generation...');
    console.log(`📂 Scanning directory: ${config.servicesDir}`);
    
    const generator = new AutoSwaggerGenerator(config);
    await generator.generateAutoSwagger();
    
    console.log('✅ Auto-generation completed successfully!');
    console.log(`📖 Documentation generated in: ${config.outputDir}`);
    console.log('🌐 Run "npm run serve" to view documentation');
  } catch (error) {
    console.error('❌ Auto-generation failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
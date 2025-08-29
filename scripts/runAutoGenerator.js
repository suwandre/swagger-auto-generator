const AutoSwaggerGenerator = require('./auto-swagger-generator');
const config = require('../config/generator.config');

async function main() {
  try {
    console.log('🚀 Starting automated swagger generation...');
    const generator = new AutoSwaggerGenerator(config);
    await generator.generateAutoSwagger();
    console.log('✅ Auto-generation completed successfully!');
  } catch (error) {
    console.error('❌ Auto-generation failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  servicesDir: process.env.SERVICES_DIR || '../mock-services',
  outputDir: process.env.OUTPUT_DIR || './output/docs',
  hostUrl: process.env.HOST_URL || 'localhost:8080',
  stagingUrl: process.env.STAGING_URL || 'swagger.stokr-staging.de',
  schemes: ['http', 'https']
};
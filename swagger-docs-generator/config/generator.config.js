module.exports = {
  // TEMPORARILY POINTING TO REAL FILES BECAUSE IMPORTS WON'T WORK IF COPIED TO MOCK ONES
  servicesDir: process.env.SERVICES_DIR || '../real-services',
  outputDir: process.env.OUTPUT_DIR || './output/docs',
  hostUrl: process.env.HOST_URL || 'localhost:8080',
  stagingUrl: process.env.STAGING_URL || 'validator.swagger.stokr-staging.de',
  schemes: ['http', 'https']
};
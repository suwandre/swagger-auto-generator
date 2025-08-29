const DocServer = require('./doc-server');
const config = require('../config/generator.config');

const serverConfig = {
  ...config,
  port: process.env.DOC_SERVER_PORT || 3001
};

const server = new DocServer(serverConfig);
server.start();

const ASTHelper = require('../utils/ast-helper');

class AuthenticatorParser {
  constructor() {
    this.authenticators = {};
  }

  parse(filePath) {
    if (!filePath) return { authenticators: {} };

    const ast = ASTHelper.parseFile(filePath);
    if (!ast) return { authenticators: {} };

    const authenticators = {};
    const { exports } = ASTHelper.extractExports(ast);

    // Analyze each exported authenticator function
    Object.keys(exports).forEach(authName => {
      const authInfo = this.analyzeAuthenticator(authName);
      if (authInfo) {
        authenticators[authName] = authInfo;
      }
    });

    return { authenticators };
  }

  analyzeAuthenticator(authName) {
    // Map common authenticator names to security schemes
    const authMappings = {
      'requireAuth': 'bearerAuth',
      'requireToken': 'bearerAuth',
      'authenticate': 'bearerAuth',
      'verifyToken': 'bearerAuth',
      'requireApiKey': 'apiKeyAuth',
      'basicAuth': 'basicAuth',
      'requireRole': 'bearerAuth',
      'adminOnly': 'bearerAuth'
    };

    const securityScheme = authMappings[authName] || 'bearerAuth';

    return {
      name: authName,
      securityScheme,
      description: this.getAuthDescription(authName),
      required: true
    };
  }

  getAuthDescription(authName) {
    const descriptions = {
      'requireAuth': 'Requires valid authentication token',
      'requireToken': 'Requires valid bearer token',
      'authenticate': 'Authentication required',
      'verifyToken': 'Token verification required',
      'requireApiKey': 'API key required',
      'basicAuth': 'Basic authentication required',
      'requireRole': 'Role-based access required',
      'adminOnly': 'Admin privileges required'
    };

    return descriptions[authName] || 'Authentication required';
  }

  getSecuritySchemes() {
    return {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key'
      },
      basicAuth: {
        type: 'http',
        scheme: 'basic'
      }
    };
  }
}

module.exports = AuthenticatorParser;

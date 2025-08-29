const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

// Import routers from detected services
const stokrBtcpayRouter = require('./mock-services/stokr-btcpay/router');

const app = express();
app.use(bodyParser.json());

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, userid, gatewaypassed');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Mock API routes - these would match your real service routing
app.use('/api/btcpay', stokrBtcpayRouter);
app.use('/api/sumsub', sumsubServiceRouter);

// Auth service (inline for simplicity)
app.post('/api/auth/login', require('./mock-services/auth-microservice/controller').authenticate);
app.post('/api/auth/validate', require('./mock-services/auth-microservice/controller').validateToken);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    services: ['stokr-btcpay', 'sumsub-service', 'auth-microservice']
  });
});

// Root endpoint with API overview
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Mock Microservices API',
    services: [
      {
        name: 'stokr-btcpay',
        endpoints: [
          'POST /api/btcpay/payments - Create payment',
          'GET /api/btcpay/payments/:id - Get payment',
          'POST /api/btcpay/payments/:id/refund - Refund payment'
        ]
      },
      {
        name: 'sumsub-service', 
        endpoints: [
          'POST /api/sumsub/applicants - Create applicant',
          'GET /api/sumsub/applicants/:id - Get applicant',
          'POST /api/sumsub/applicants/:id/token - Get access token'
        ]
      },
      {
        name: 'auth-microservice',
        endpoints: [
          'POST /api/auth/login - Authenticate user',
          'POST /api/auth/validate - Validate token'
        ]
      }
    ],
    meta: {
      'health-check': 'GET /health',
      'documentation': 'http://localhost:3001 (run swagger generator first)'
    }
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Mock API server running at http://localhost:${PORT}`);
  console.log(`📋 API overview: http://localhost:${PORT}/`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📖 Generate docs with: npm run generate-docs`);
});

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Add this

// Import routers
const stokrBtcpayRouter = require('./mock-services/stokr-btcpay/router');
const sumsubServiceRouter = require('./mock-services/sumsub-service/router');

const app = express();

// CORS Configuration - ADD THIS SECTION
const corsOptions = {
  origin: [
    'http://localhost:3001',  // Your Swagger UI server
    'http://localhost:3000',  // Alternative ports
    'http://127.0.0.1:3001'   // Alternative localhost format
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'userid', 
    'gatewaypassed',
    'client_signature',
    'Origin',
    'X-Requested-With',
    'Accept'
  ],
  credentials: true
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// Handle preflight requests
app.options('*', cors(corsOptions));

// Add CORS headers manually (backup)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3001');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, userid, gatewaypassed, client_signature');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Your existing routes
app.use('/api/btcpay', stokrBtcpayRouter);
app.use('/api/sumsub', sumsubServiceRouter);

// Auth service routes
app.post('/api/auth/login', require('./mock-services/auth-microservice/controller').authenticate);
app.post('/api/auth/validate', require('./mock-services/auth-microservice/controller').validateToken);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    services: ['stokr-btcpay', 'sumsub-service', 'auth-microservice'],
    cors: 'enabled'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Mock Microservices API',
    cors: 'enabled',
    services: [
      {
        name: 'stokr-btcpay',
        endpoints: [
          'POST /api/btcpay/payments - Create payment',
          'GET /api/btcpay/payments/:id - Get payment',
          'POST /api/btcpay/payments/:id/refund - Refund payment'
        ]
      }
    ]
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Mock API server running at http://localhost:${PORT}`);
  console.log(`🔄 CORS enabled for Swagger UI at http://localhost:3001`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

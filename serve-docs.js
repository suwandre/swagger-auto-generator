const express = require('express');
const swaggerUi = require('swagger-ui-express');
const app = express();

// Try to load the swagger document
let swaggerDocument;
try {
    swaggerDocument = require('./swagger-output.json');
    console.log('✅ Swagger document loaded successfully');
} catch (error) {
    console.error('❌ Could not load swagger-output.json');
    console.error('Run "npm run swagger" first to generate the documentation');
    process.exit(1);
}

// Serve the API docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Serve raw JSON
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerDocument);
});

const PORT = process.env.DOCS_PORT || 3001;
app.listen(PORT, () => {
    console.log(`📚 Documentation server running at: http://localhost:${PORT}/api-docs`);
    console.log(`📄 Raw JSON available at: http://localhost:${PORT}/api-docs.json`);
});

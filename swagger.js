const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' });

const doc = {
    info: {
        title: 'Test Microservice API',
        description: 'Auto-generated API documentation for testing',
        version: '1.0.0'
    },
    host: 'localhost:3000',
    schemes: ['http'],
    consumes: ['application/json'],
    produces: ['application/json'],
    tags: [
        {
            name: 'Users',
            description: 'User management endpoints'
        },
        {
            name: 'Authentication',
            description: 'Auth endpoints'
        }
    ]
};

const outputFile = './swagger-output.json';
const routes = ['./app.js', './router.js'];

// Generate the swagger documentation
swaggerAutogen(outputFile, routes, doc).then(() => {
    console.log('✅ Swagger documentation generated successfully!');
    console.log('📄 File created: swagger-output.json');
});

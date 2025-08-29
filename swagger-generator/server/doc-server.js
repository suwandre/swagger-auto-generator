const express = require('express');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');

class DocServer {
  constructor(config) {
    this.app = express();
    this.config = config;
    this.docsDir = config.outputDir || './output/docs';
    this.port = config.port || 3001;
  }

  setupRoutes() {
    // Serve static swagger files
    this.app.use('/static', express.static(this.docsDir));
    
    // Main documentation index
    this.app.get('/', (req, res) => {
      const indexPath = path.join(this.docsDir, 'index.json');
      if (fs.existsSync(indexPath)) {
        const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        res.send(this.generateIndexHTML(indexData));
      } else {
        res.status(404).send(`
          <h1>📖 Documentation Not Found</h1>
          <p>No documentation has been generated yet.</p>
          <p><strong>Run:</strong> <code>npm run generate-docs</code> first</p>
          <p><strong>Scanning directory:</strong> ${this.config.servicesDir}</p>
        `);
      }
    });

    // Dynamic swagger UI for each service/file combination
    this.app.get('/docs/:service/:fileType', (req, res, next) => {
      const { service, fileType } = req.params;
      const swaggerPath = path.join(this.docsDir, service, `${fileType}.auto-swagger.json`);
      
      if (fs.existsSync(swaggerPath)) {
        const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));
        const options = {
          customCss: `
            .swagger-ui .topbar { display: none }
            .swagger-ui .info { margin: 20px 0; }
            .swagger-ui .info .title { color: #3b4151; }
          `,
          customSiteTitle: `${service} - ${fileType} API Docs`,
          swaggerOptions: {
            displayRequestDuration: true,
            filter: true,
            showExtensions: true
          }
        };
        
        swaggerUi.setup(swaggerDocument, options)(req, res, next);
      } else {
        res.status(404).send(`
          <h1>❌ Documentation Not Found</h1>
          <p>Documentation for <strong>${service}/${fileType}</strong> not found</p>
          <p><a href="/">← Back to index</a></p>
        `);
      }
    });

    // Swagger UI assets
    this.app.use('/docs/:service/:fileType', swaggerUi.serve);
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        docsDir: this.docsDir
      });
    });
  }

  generateIndexHTML(indexData) {
    const servicesList = indexData.services.map(service => {
      const fileLinks = service.files.map(file => 
        `<li><a href="${file.url}" target="_blank">📄 ${file.type}</a></li>`
      ).join('');
      
      return `
        <div class="service-card">
          <h3>🚀 ${service.name}</h3>
          <p class="service-info">${service.files.length} file(s) analyzed</p>
          <ul>${fileLinks}</ul>
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>🚀 Microservices API Documentation</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            padding: 40px; 
            background-color: #f8f9fa; 
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 30px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .service-card { 
            background: white;
            border: 1px solid #e1e4e8; 
            padding: 25px; 
            margin: 20px 0; 
            border-radius: 10px; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            transition: transform 0.2s;
          }
          .service-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
          }
          .service-card h3 { 
            margin-top: 0; 
            color: #0366d6; 
            font-size: 1.4em;
          }
          .service-info {
            color: #586069;
            font-size: 0.9em;
            margin: 10px 0;
          }
          .service-card ul { 
            list-style-type: none; 
            padding: 0; 
            margin: 15px 0 0 0;
          }
          .service-card li { 
            margin: 8px 0; 
          }
          .service-card a { 
            text-decoration: none; 
            color: #0366d6; 
            padding: 8px 12px;
            border: 1px solid #e1e4e8;
            border-radius: 5px;
            display: inline-block;
            transition: all 0.2s;
          }
          .service-card a:hover { 
            background-color: #f1f8ff;
            border-color: #0366d6;
          }
          .stats {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin: 20px 0;
            flex-wrap: wrap;
          }
          .stat {
            text-align: center;
            padding: 15px;
            background: white;
            border-radius: 8px;
            border: 1px solid #e1e4e8;
          }
          .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #0366d6;
          }
          .stat-label {
            color: #586069;
            font-size: 0.9em;
          }
          .footer {
            text-align: center;
            margin-top: 40px;
            color: #586069;
            font-size: 0.9em;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🚀 Microservices API Documentation</h1>
          <p>Automatically generated documentation using intelligent code analysis</p>
        </div>
        
        <div class="stats">
          <div class="stat">
            <div class="stat-number">${indexData.totalServices}</div>
            <div class="stat-label">Services</div>
          </div>
          <div class="stat">
            <div class="stat-number">${indexData.services.reduce((sum, s) => sum + s.files.length, 0)}</div>
            <div class="stat-label">API Files</div>
          </div>
        </div>
        
        ${servicesList}
        
        <div class="footer">
          <p>📅 Generated on: ${new Date(indexData.generatedAt).toLocaleString()}</p>
          <p>🔄 To update: Run <code>npm run generate-docs</code></p>
        </div>
      </body>
      </html>
    `;
  }

  start() {
    this.setupRoutes();
    this.app.listen(this.port, () => {
      console.log(`📖 Documentation server running at http://localhost:${this.port}`);
      console.log(`📋 View all services at http://localhost:${this.port}`);
      console.log(`💡 Docs directory: ${this.docsDir}`);
    });
  }
}

module.exports = DocServer;

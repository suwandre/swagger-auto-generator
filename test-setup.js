const fs = require('fs');
const path = require('path');

console.log('🧪 Testing swagger setup...\n');

// Test 1: Check if swagger-output.json exists
const swaggerFile = './swagger-output.json';
if (fs.existsSync(swaggerFile)) {
    console.log('✅ swagger-output.json exists');
    
    // Test 2: Validate JSON structure
    try {
        const doc = require(swaggerFile);
        console.log('✅ JSON is valid');
        console.log(`📊 Found ${Object.keys(doc.paths || {}).length} endpoints`);
        console.log(`📋 API Title: ${doc.info?.title}`);
    } catch (error) {
        console.log('❌ JSON is invalid:', error.message);
    }
} else {
    console.log('❌ swagger-output.json not found');
    console.log('💡 Run: npm run swagger');
}

// Test 3: Check required files
const requiredFiles = ['app.js', 'router.js', 'controller.js', 'swagger.js'];
requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file} exists`);
    } else {
        console.log(`❌ ${file} missing`);
    }
});

console.log('\n🎯 Next steps:');
console.log('1. Run: npm run swagger');
console.log('2. Run: npm run docs');
console.log('3. Visit: http://localhost:3001/api-docs');

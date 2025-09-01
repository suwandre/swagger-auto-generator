#!/bin/bash
echo "🚀 Testing CI/CD pipeline..."

# Simulate CI/CD steps
echo "📦 Installing dependencies..."
npm install

echo "📚 Generating swagger docs..."
npm run swagger

echo "🧪 Validating documentation..."
npm run test:setup

echo "🌐 Testing documentation server..."
timeout 10s npm run docs &
sleep 5
curl -f http://localhost:3001/api-docs.json > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Documentation server is working!"
else
    echo "❌ Documentation server failed"
    exit 1
fi

echo "🎉 Pipeline test completed successfully!"

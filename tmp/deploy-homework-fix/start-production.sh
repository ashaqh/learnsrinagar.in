#!/bin/bash

# Production deployment script for VPS
echo "Starting production deployment..."

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Build the application
echo "Building application..."
npm run build

# Check if build was successful
if [ -d "build" ]; then
    echo "Build successful!"
    
    # Start the application
    echo "Starting application..."
    npm start
else
    echo "Build failed! Check for errors above."
    exit 1
fi
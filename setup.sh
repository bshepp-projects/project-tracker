#!/bin/bash

# Project Tracker Setup Script
echo "🚀 Setting up Project Tracker..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Navigate to server directory
cd server

# Install dependencies
echo "📦 Installing backend dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
    echo ""
    echo "🎉 Setup complete! To start the project tracker:"
    echo ""
    echo "1. Start the backend server:"
    echo "   cd server && npm start"
    echo ""
    echo "2. Open project-tracker.html in your browser"
    echo ""
    echo "The backend will run on http://localhost:3001"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi
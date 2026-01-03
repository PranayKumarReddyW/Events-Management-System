#!/bin/bash

# Event Management System - Docker Build and Deploy Script
# This script helps you build and deploy the application using Docker

set -e  # Exit on error

echo "🚀 Event Management System - Docker Deployment"
echo "=============================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    if [ -f .env.docker ]; then
        cp .env.docker .env
        echo "✅ Created .env file from template"
        echo "⚠️  IMPORTANT: Please edit .env file with your actual values before proceeding!"
        echo ""
        read -p "Press Enter after you've updated the .env file, or Ctrl+C to exit..."
    else
        echo "❌ .env.docker template not found!"
        exit 1
    fi
fi

echo ""
echo "📦 Building Docker images..."
echo "This may take several minutes on the first run..."
echo ""

# Use docker compose (new) or docker-compose (old)
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Build images
$COMPOSE_CMD build

echo ""
echo "✅ Docker images built successfully!"
echo ""
echo "🚀 Starting services..."
echo ""

# Start services
$COMPOSE_CMD up -d

echo ""
echo "⏳ Waiting for services to become healthy..."
echo "This may take up to 1 minute..."
echo ""

# Wait for services to be healthy
sleep 10

# Check service status
$COMPOSE_CMD ps

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📍 Access the application:"
echo "   Frontend: http://localhost"
echo "   Backend API: http://localhost:5000"
echo ""
echo "📊 View logs:"
echo "   All services: $COMPOSE_CMD logs -f"
echo "   Backend only: $COMPOSE_CMD logs -f backend"
echo "   Frontend only: $COMPOSE_CMD logs -f frontend"
echo ""
echo "🛑 Stop services:"
echo "   $COMPOSE_CMD stop"
echo ""
echo "🔄 Restart services:"
echo "   $COMPOSE_CMD restart"
echo ""
echo "📖 For more information, see DOCKER_DEPLOYMENT.md"
echo ""

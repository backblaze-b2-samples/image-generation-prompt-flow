#!/bin/bash

# Initialize database for new installation

set -e

echo "🗄️  Initializing database..."

# Create data directory if it doesn't exist
if [ ! -d "data" ]; then
  echo "📁 Creating data directory..."
  mkdir -p data
fi

# Check if database already exists
if [ -f "data/sqlite.db" ]; then
  echo "⚠️  Database already exists at data/sqlite.db"
  read -p "Do you want to reset it? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removing existing database..."
    rm -f data/sqlite.db data/sqlite.db-journal
  else
    echo "ℹ️  Keeping existing database"
    exit 0
  fi
fi

# Detect package manager
if command -v pnpm &> /dev/null; then
  PKG_MANAGER="pnpm"
elif command -v npm &> /dev/null; then
  PKG_MANAGER="npm"
else
  echo "❌ Error: Neither pnpm nor npm found. Please install Node.js first."
  exit 1
fi

# Push schema to create database
echo "📋 Creating database schema using $PKG_MANAGER..."
$PKG_MANAGER run db:push

echo "✅ Database initialized successfully at data/sqlite.db"
echo ""
echo "Next steps:"
echo "  1. Copy .env.example to .env (or create .env)"
echo "  2. Add your API keys to .env"
echo "  3. Run 'npm run dev' to start the development server"

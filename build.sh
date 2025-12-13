#!/bin/bash

# Build the project
npm run build

# Copy 404.html to dist for GitHub Pages SPA routing
cp public/404.html dist/404.html

echo "✅ Build complete with 404.html in dist/"
ls -lah dist/404.html

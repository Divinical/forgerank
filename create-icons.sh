#!/bin/bash

# Create icons directory
mkdir -p public/icons

# Create placeholder SVG icons
# These can be replaced with actual PNG icons later

# 16x16 icon
cat > public/icons/icon16.svg << 'EOF'
<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <rect width="16" height="16" rx="3" fill="#f97316"/>
  <text x="50%" y="50%" text-anchor="middle" dy=".35em" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">F</text>
</svg>
EOF

# 48x48 icon
cat > public/icons/icon48.svg << 'EOF'
<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="10" fill="#f97316"/>
  <text x="50%" y="50%" text-anchor="middle" dy=".35em" fill="white" font-family="Arial, sans-serif" font-size="24" font-weight="bold">FR</text>
</svg>
EOF

# 128x128 icon
cat > public/icons/icon128.svg << 'EOF'
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="26" fill="#f97316"/>
  <text x="50%" y="50%" text-anchor="middle" dy=".35em" fill="white" font-family="Arial, sans-serif" font-size="64" font-weight="bold">FR</text>
</svg>
EOF

# Rename SVG to PNG (Chrome will still load them)
mv public/icons/icon16.svg public/icons/icon16.png
mv public/icons/icon48.svg public/icons/icon48.png
mv public/icons/icon128.svg public/icons/icon128.png

echo "Placeholder icons created successfully!"
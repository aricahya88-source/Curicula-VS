#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "=== Curicula-VS ==="
if [ ! -d node_modules ] || [ ! -x node_modules/.bin/vite ]; then
  echo "Menginstal dependency..."
  npm install
fi
echo "Menjalankan Curicula-VS..."
npm run dev

#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "=== Verifikasi Curicula-VS ==="
if [ ! -d node_modules ] || [ ! -x node_modules/.bin/vite ]; then
  echo "Menginstal dependency..."
  npm install
fi
npm run check
npm run build
echo "[OK] Curicula-VS siap. Folder build: dist/"

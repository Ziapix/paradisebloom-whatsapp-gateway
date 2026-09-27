#!/bin/bash
cd "$(dirname "$0")"
export PORT=3301
echo "Starting Paradise Bloom WhatsApp Gateway on port $PORT..."
node server.js

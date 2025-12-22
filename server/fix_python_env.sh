#!/bin/bash

# Stop the server if running (optional, but good practice)
# pm2 stop code-convos-server

echo "Detected Python 3.9 which is incompatible with langmem (requires 3.10+)."
echo "Attempting to upgrade Python environment..."

# Try to install Python 3.11
if command -v yum &> /dev/null; then
    echo "Installing Python 3.11 via yum..."
    sudo yum install -y python3.11 python3.11-pip python3.11-devel
elif command -v apt-get &> /dev/null; then
    echo "Installing Python 3.11 via apt..."
    sudo add-apt-repository -y ppa:deadsnakes/ppa
    sudo apt-get update
    sudo apt-get install -y python3.11 python3.11-venv python3.11-dev
fi

# Verify installation
if ! command -v python3.11 &> /dev/null; then
    echo "Error: Python 3.11 could not be installed. Please install it manually."
    exit 1
fi

echo "Recreating virtual environment with Python 3.11..."

# Remove old venv
rm -rf .venv

# Create new venv
python3.11 -m venv .venv

# Install dependencies
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install -r requirements.txt

echo "---------------------------------------------------"
echo "Success! Python environment upgraded to 3.11."
echo "Please restart your server with: pm2 restart all"
echo "---------------------------------------------------"

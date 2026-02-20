#!/bin/bash
# Start the Python image analyzer service

# Set Gemini API key
export GEMINI_API_KEY="${GEMINI_API_KEY:-your-api-key-here}"

# Install dependencies if not already installed
if [ ! -d "venv" ]; then
  echo "Creating virtual environment..."
  python -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install/upgrade requirements
pip install -q -r requirements.txt

# Start the Flask app
echo "Starting Image Analyzer Service on http://0.0.0.0:5000"
python app.py

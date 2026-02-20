@echo off
REM Start the Python image analyzer service (Windows)

echo Setting up Image Analyzer Service...

REM Check if venv exists
if not exist "venv" (
  echo Creating virtual environment...
  python -m venv venv
)

REM Activate venv
call venv\Scripts\activate.bat

REM Install requirements
pip install -q -r requirements.txt

REM Start Flask app
echo Starting Image Analyzer Service on http://127.0.0.1:5000
python app.py

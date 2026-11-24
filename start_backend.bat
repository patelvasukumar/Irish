@echo off
REM Starts the Irish backend. Must run from the Irish folder so "backend.main" is found.
cd /d "%~dp0"
python -m uvicorn backend.main:app --reload --port 8000

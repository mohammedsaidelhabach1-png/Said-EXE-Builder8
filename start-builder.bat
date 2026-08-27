@echo off
setlocal
cd /d "%~dp0"
if not exist .builder-venv py -m venv .builder-venv
call .builder-venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements-builder.txt
python local_builder_server.py
pause

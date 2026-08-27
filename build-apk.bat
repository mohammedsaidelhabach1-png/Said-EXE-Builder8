@echo off
setlocal
cd /d "%~dp0"
call pnpm install
call npx expo prebuild --platform android
cd android
call gradlew.bat assembleRelease
copy app\build\outputs\apk\release\app-release.apk ..\SaidEXE-release.apk
cd ..
echo تم إنشاء SaidEXE-release.apk
pause

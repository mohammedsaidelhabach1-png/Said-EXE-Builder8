"""Said EXE builder: one-file helper for preparing a Python project as an EXE."""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

DEFAULT_PACKAGES = [
    "PySide6", "Pillow", "pytesseract", "SpeechRecognition",
    "PyAudio", "python-docx", "reportlab", "pypdf", "pydub", "pyinstaller",
]


def run(command: list[str]) -> None:
    print("تشغيل:", " ".join(command))
    subprocess.run(command, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a Python source file into a Windows EXE")
    parser.add_argument("source", nargs="?", default="app/main.py", help="Python entry file")
    parser.add_argument("--name", default="SaidEXE", help="Output application name")
    parser.add_argument("--skip-install", action="store_true", help="Skip dependency installation")
    args = parser.parse_args()
    source = Path(args.source).resolve()
    if not source.exists():
        print(f"لم يتم العثور على ملف الكود: {source}")
        return 2
    if not args.skip_install:
        run([sys.executable, "-m", "pip", "install", *DEFAULT_PACKAGES])
    pyinstaller = shutil.which("pyinstaller") or [sys.executable, "-m", "PyInstaller"]
    command = [pyinstaller] if isinstance(pyinstaller, str) else pyinstaller
    command += ["--noconfirm", "--clean", "--windowed", "--onefile", "--name", args.name, str(source)]
    run(command)
    print(f"اكتمل البناء. الملف الناتج داخل dist/{args.name}.exe")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

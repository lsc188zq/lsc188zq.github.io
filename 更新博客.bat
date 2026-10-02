@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Update blog
echo ============================================
echo.

echo [1/4] Sync from Obsidian vault ...
call npm run sync
if errorlevel 1 goto :fail

echo.
echo [2/4] Check math syntax ...
call npm run check:math
if errorlevel 1 goto :fail

echo.
echo [3/4] Build (about 30 seconds) ...
call npm run build
if errorlevel 1 goto :fail

echo.
echo [4/4] Commit and push ...
git add -A

git diff --cached --quiet
if not errorlevel 1 (
  echo     Nothing changed. Nothing to commit.
  goto :done
)

git commit -m "content: update notes %date%"
if errorlevel 1 goto :fail

git push
if errorlevel 1 goto :fail

:done
echo.
echo ============================================
echo   Done. Site updates in 1-2 minutes:
echo   https://lsc188zq.github.io
echo ============================================
echo.
pause
exit /b 0

:fail
echo.
echo ============================================
echo   *** FAILED - nothing was pushed ***
echo   Copy the error above and send it to Claude.
echo ============================================
echo.
pause
exit /b 1

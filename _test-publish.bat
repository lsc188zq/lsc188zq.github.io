@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ============================================
echo   更新博客
echo ============================================
echo.

echo [1/4] 从 Obsidian 同步...
echo.
call npm run sync
if errorlevel 1 goto :fail

echo.
echo [2/4] 检查公式写法...
echo.
call npm run check:math
if errorlevel 1 goto :fail

echo.
echo [3/4] 构建（约 30 秒，请稍等）...
echo.
call npm run build
if errorlevel 1 goto :fail

echo.
echo [4/4] 提交并推送...
echo.
git add -A

git diff --cached --quiet
if not errorlevel 1 (
  echo    没有检测到改动，无需提交。
  goto :done
)

git commit -m "content: 更新文章 %date%"
if errorlevel 1 goto :fail

git push
if errorlevel 1 goto :fail

:done
echo.
echo ============================================
echo   完成！
echo   站点会在一两分钟后自动更新：
echo   https://lsc188zq.github.io
echo ============================================
echo.
pause
exit /b 0

:fail
echo.
echo ============================================
echo   *** 出错了，已停下，没有推送 ***
echo   把上面的报错整段复制给 Claude 看。
echo ============================================
echo.
pause
exit /b 1

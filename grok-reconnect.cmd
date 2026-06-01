@echo off
REM Grok OAuth ワンクリック再接続（ダブルクリックで実行）
REM ブラウザが開いたら「承認」を押すだけ。完了したらこのウィンドウは閉じてOK。
cd /d "%~dp0"
call pnpm grok:auth
echo.
pause

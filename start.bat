@echo off
setlocal EnableExtensions
cd /d "%~dp0"

rem ============================================================
rem  声间 Shengjian 一键启动（Web + FastAPI + ComfyUI）
rem  注意: 本文件必须保存为 GBK/ANSI 编码 + CRLF 行尾（中文 cmd 兼容）。
rem
rem  用法:
rem    start.bat              以 comfyui 真实模式启动（默认）
rem    start.bat fake         以 CPU Fake 模式启动（测试素材，非真实音乐）
rem    可选参数:
rem      --yes                全部按默认确认（端口不可用时自动换口）
rem      --no-open            不自动打开浏览器
rem      --api-port N         默认 8000
rem      --web-port N         默认 5173
rem      --runtime-port N     默认 8188
rem
rem  - 启动前自动检查 node / pnpm / uv / 依赖 / 端口占用 / 系统保留端口
rem  - 端口不可用时默认自动改用相邻可用端口（可选保留原端口强试）
rem  - 全部控制台输出转录到 logs\dev-bat\ 便于日后排查
rem  - 在本窗口按 Ctrl+C: 由启动器优雅停止本次会话的服务
rem  - 直接关闭本窗口: 看门狗强制清理本次启动占用的服务端口
rem ============================================================

if /i "%~1"=="__watchdog__" goto watchdog_main

rem ---------- ANSI 颜色 ----------
set "ESC="
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "GRN=%ESC%[92m"
set "RED=%ESC%[91m"
set "YEL=%ESC%[93m"
set "CYN=%ESC%[96m"
set "DIM=%ESC%[90m"
set "RST=%ESC%[0m"

rem ---------- 参数解析 ----------
set "MODE=comfyui"
set "ASSUMEYES="
set "OPENFLAG=--open"
set "API_PORT=8000"
set "WEB_PORT=5173"
set "RT_PORT=8188"
:parse_args
if "%~1"=="" goto args_done
if /i "%~1"=="fake" set "MODE=fake"
if /i "%~1"=="comfyui" set "MODE=comfyui"
if /i "%~1"=="--yes" set "ASSUMEYES=1"
if /i "%~1"=="--no-open" set "OPENFLAG="
if /i "%~1"=="--api-port" ( set "API_PORT=%~2" & shift & shift & goto parse_args )
if /i "%~1"=="--web-port" ( set "WEB_PORT=%~2" & shift & shift & goto parse_args )
if /i "%~1"=="--runtime-port" ( set "RT_PORT=%~2" & shift & shift & goto parse_args )
shift
goto parse_args
:args_done

rem ---------- 本窗口 cmd 的 PID（供看门狗监控） ----------
set "MYPID="
powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \"ProcessId=$((Get-CimInstance Win32_Process -Filter \"ProcessId=$PID\").ParentProcessId)\").ParentProcessId" > "%TEMP%\sj_pid.txt" 2>nul
set /p MYPID=<"%TEMP%\sj_pid.txt" 2>nul
del "%TEMP%\sj_pid.txt" 2>nul

rem ---------- 横幅 ----------
echo %CYN%=============================================================%RST%
echo   声间 Shengjian · 一键启动
echo   模式: %MODE%    端口: API %API_PORT% / Web %WEB_PORT% / ComfyUI %RT_PORT%
if /i "%MODE%"=="fake" (
    echo   %YEL%说明: Fake 模式只输出测试素材 440 Hz，不生成真实音乐%RST%
) else (
    echo   %DIM%说明: ComfyUI 首次就绪可能需要数十秒到几分钟，请耐心等待%RST%
)
echo   就绪后地址: http://127.0.0.1:%WEB_PORT%
echo   %DIM%停止方式: 本窗口按 Ctrl+C 优雅停止；直接关窗口由看门狗强制清理%RST%
echo %CYN%=============================================================%RST%
echo.

rem ---------- 环境检查 ----------
echo %CYN%[1/3]%RST% 环境检查...
where node >nul 2>&1 || goto err_no_node
for /f "tokens=1 delims=v." %%v in ('node -v') do set "NODEMAJ=%%v"
echo   %GRN%[OK]%RST% Node.js %NODEMAJ%
if not "%NODEMAJ%"=="24" call :ask "%YEL%提示: 推荐 Node.js 24（当前 %NODEMAJ%）。继续吗？%RST%" N || goto aborted

where pnpm.cmd >nul 2>&1 || goto err_no_pnpm
for /f %%v in ('pnpm --version') do set "PNPMV=%%v"
echo   %GRN%[OK]%RST% pnpm %PNPMV%
if not "%PNPMV%"=="11.22.0" call :ask "%YEL%提示: 项目锁定 pnpm 11.22.0（当前 %PNPMV%）。继续吗？%RST%" N || goto aborted

where uv >nul 2>&1 || goto err_no_uv
for /f "delims=" %%v in ('uv --version') do set "UVV=%%v"
echo   %GRN%[OK]%RST% %UVV%

if not exist "node_modules\" (
    call :ask "%YEL%缺少 node_modules。现在执行 pnpm install --frozen-lockfile 吗？%RST%" Y || goto aborted
    echo   正在安装前端依赖，可能需要几分钟...
    call pnpm install --frozen-lockfile || goto err_install
)
echo   %GRN%[OK]%RST% 前端依赖 node_modules

if not exist "services\api\.venv\" (
    call :ask "%YEL%缺少 API 虚拟环境。现在执行 uv sync --project services/api --frozen 吗？%RST%" Y || goto aborted
    echo   正在同步 API 依赖，可能需要几分钟...
    call uv sync --project services/api --frozen || goto err_install
)
echo   %GRN%[OK]%RST% API 虚拟环境 services\api\.venv

if /i "%MODE%"=="comfyui" (
    if not exist "runtime\comfyui\.upstream\ComfyUI\" (
        call :ask "%YEL%未找到 ComfyUI Runtime（runtime\comfyui\.upstream）。仍要继续吗？%RST%" N || goto aborted
    ) else (
        echo   %GRN%[OK]%RST% ComfyUI Runtime 已就位
    )
    if not exist "data\models\" (
        call :ask "%YEL%data\models 不存在，模型权重可能未准备。仍要继续吗？%RST%" N || goto aborted
    ) else (
        echo   %GRN%[OK]%RST% 模型目录 data\models
    )
)
echo.

rem ---------- 端口占用检查 ----------
echo %CYN%[2/3]%RST% 端口检查 %API_PORT% / %WEB_PORT% / %RT_PORT%...
set "WD_API=%API_PORT%"
set "WD_WEB=%WEB_PORT%"
set "WD_RT=%RT_PORT%"
call :port_guard %API_PORT%
if defined PG_KEPT set "WD_API=0"
call :port_guard %WEB_PORT%
if defined PG_KEPT set "WD_WEB=0"
call :port_guard %RT_PORT%
if defined PG_KEPT set "WD_RT=0"
echo.

rem ---------- 可绑定探测（被系统保留或占用都会导致 bind 失败） ----------
powershell -NoProfile -Command "$bad=@(); foreach($p in @(%API_PORT%,%WEB_PORT%,%RT_PORT%)){ try{ $l=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,$p); $l.Start(); $l.Stop() }catch{ $bad+=$p } }; if($bad.Count){ Write-Output ($bad -join ' ') } else { Write-Output OK }" > "%TEMP%\sj_bind.txt" 2>nul
set "BINDRES="
set /p BINDRES=<"%TEMP%\sj_bind.txt" 2>nul
del "%TEMP%\sj_bind.txt" 2>nul
if "%BINDRES%"=="OK" goto ports_ready
echo   %YEL%[!]%RST% 以下端口不可用: %BINDRES% %DIM%（被占用或被 Hyper-V/WSL 系统保留）%RST%
call :ask "  自动改用相邻可用端口吗？（推荐）" Y || goto ask_continue_anyway
for %%p in (%BINDRES%) do call :switch_port %%p
goto ports_ready

:ask_continue_anyway
call :ask "  仍要按原端口继续吗？（对应服务可能启动失败，详情见日志）" N || goto aborted
for %%p in (%BINDRES%) do call :wd_disable %%p
goto ports_ready

:ports_ready
echo.

rem ---------- 日志与看门狗 ----------
echo %CYN%[3/3]%RST% 准备日志与看门狗...
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "TS=%%t"
set "LOGDIR=%~dp0logs\dev-bat"
mkdir "%LOGDIR%" 2>nul
set "LOG=%LOGDIR%\%TS%_%MODE%.log"
echo   控制台日志: %LOG%
>"%LOG%" echo ===== Shengjian start.bat session =====
>>"%LOG%" echo mode=%MODE% api=%API_PORT% web=%WEB_PORT% runtime=%RT_PORT% watchdog_pid=%MYPID%

if defined MYPID (
    start "sj-watchdog" /min cmd /c ""%~f0" __watchdog__ %MYPID% "%LOG%" %WD_API% %WD_WEB% %WD_RT%"
    echo   %GRN%[OK]%RST% 看门狗已挂上（监控窗口 PID %MYPID%）
) else (
    echo   %YEL%[警告]%RST% 未能取得窗口 PID，看门狗未启用；请务必用 Ctrl+C 停止服务
)
echo.

rem ---------- 启动 ----------
echo %CYN%^>^>^> 正在启动服务，本窗口请保持打开不要关闭...%RST%
if defined SWAPPED echo   %DIM%实际端口以日志头为准: API %API_PORT% / Web %WEB_PORT% / ComfyUI %RT_PORT%%RST%
echo   就绪后地址: http://127.0.0.1:%WEB_PORT%
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { & pnpm.cmd dev -- --mode %MODE% --api-port %API_PORT% --web-port %WEB_PORT% --runtime-port %RT_PORT% %OPENFLAG% 2>&1 | ForEach-Object { $l=[string]$_; Write-Host $l; Add-Content -LiteralPath '%LOG%' -Value $l -Encoding UTF8 } } catch { Write-Host $_; exit 1 }; exit $LASTEXITCODE"
set "RC=%errorlevel%"
echo.
if "%RC%"=="0" (
    echo %GRN%[完成]%RST% 本次会话已结束，服务已停止。
    echo     日志: %LOG%
    timeout /t 8
) else (
    echo %RED%[失败]%RST% 启动器退出码 %RC%
    echo.
    echo 排查提示:
    echo   1. 端口问题 -^> 重新运行本脚本并允许自动换口，或手动指定:
    echo      start.bat --api-port N --web-port N --runtime-port N
    echo   2. 依赖缺失 -^> pnpm install --frozen-lockfile 或 uv sync --project services/api --frozen
    if /i "%MODE%"=="comfyui" echo   3. Runtime 未准备 -^> 先按文档准备: https://caizongyuan.github.io/llm-music/zh-cn/quickstart/
    echo   4. 完整控制台日志: %LOG%
    echo   5. 启动器自身的会话收据与服务日志路径见上方输出
    echo.
    pause
)
exit /b %RC%

rem ============ 子过程 ============

:ask
rem %1=问题  %2=默认 Y|N  ; 返回 0=是 1=否
if defined ASSUMEYES (
    if /i not "%~3"=="safe" exit /b 0
)
set "ANS=%~2"
set "REPLY="
set /p "REPLY=%~1 [%ANS%] "
if /i "%REPLY%"=="y" set "ANS=Y"
if /i "%REPLY%"=="n" set "ANS=N"
if /i "%ANS%"=="Y" ( exit /b 0 ) else exit /b 1

:port_guard
set "PG_KEPT="
set "HOLDERS="
for /f "tokens=5" %%p in ('netstat -aon ^| findstr /r /c:":%1 .*LISTENING"') do call :add_holder %%p
if not defined HOLDERS (
    echo   %GRN%[OK]%RST% 端口 %1 空闲
    exit /b
)
echo   %YEL%[!]%RST% 端口 %1 被占用:
for %%h in (%HOLDERS%) do call :show_holder %%h
call :ask "  强制结束这些进程吗？（选否则保留占用，启动器会尝试复用或拒绝）" N safe
if errorlevel 1 (
    set "PG_KEPT=1"
    echo   %DIM%  保留占用进程，跳过强制清理，看门狗也不会动它%RST%
    exit /b
)
for %%h in (%HOLDERS%) do taskkill /f /t /pid %%h >nul 2>&1
echo   %GRN%[OK]%RST% 已强制结束，端口 %1 已释放
exit /b

:add_holder
for %%h in (%HOLDERS%) do if "%%h"=="%1" exit /b
set "HOLDERS=%HOLDERS% %1"
exit /b

:show_holder
set "PNAME=unknown"
for /f "tokens=1 delims=," %%n in ('tasklist /fi "PID eq %1" /fo csv /nh 2^>nul') do set "PNAME=%%~n"
echo       PID %1  %PNAME%
exit /b

:switch_port
rem %1=不可用端口: 找相邻可用端口并替换对应角色
set "NEWPORT="
set "SWAP_ROLE="
if "%~1"=="%API_PORT%" set "SWAP_ROLE=API"
if "%~1"=="%WEB_PORT%" set "SWAP_ROLE=Web"
if "%~1"=="%RT_PORT%" set "SWAP_ROLE=ComfyUI"
if not defined SWAP_ROLE exit /b
set "SWAPPED=1"
call :find_bindable %~1
if not defined NEWPORT (
    echo   %YEL%[自动]%RST% 未找到可用替代端口，保留 %~1
    exit /b
)
if "%SWAP_ROLE%"=="API" set "API_PORT=%NEWPORT%"
if "%SWAP_ROLE%"=="API" set "WD_API=%NEWPORT%"
if "%SWAP_ROLE%"=="Web" set "WEB_PORT=%NEWPORT%"
if "%SWAP_ROLE%"=="Web" set "WD_WEB=%NEWPORT%"
if "%SWAP_ROLE%"=="ComfyUI" set "RT_PORT=%NEWPORT%"
if "%SWAP_ROLE%"=="ComfyUI" set "WD_RT=%NEWPORT%"
echo   %GRN%[自动]%RST% %SWAP_ROLE% 端口 %~1 不可用，改用 %NEWPORT%
exit /b

:find_bindable
rem %1=起始端口, 输出 NEWPORT=第一个可绑定的端口
for /f %%p in ('powershell -NoProfile -Command "$b=%1; foreach($i in 1..400){ try{ $l=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,($b+$i)); $l.Start(); $l.Stop(); Write-Output ($b+$i); break }catch{} }"') do set "NEWPORT=%%p"
exit /b

:wd_disable
rem 强行按原端口继续时，看门狗不清理这些端口（它们不属于本次会话）
if "%~1"=="%API_PORT%" set "WD_API=0"
if "%~1"=="%WEB_PORT%" set "WD_WEB=0"
if "%~1"=="%RT_PORT%" set "WD_RT=0"
exit /b

:err_no_node
echo   %RED%[失败]%RST% 未检测到 Node.js。请先安装 Node.js 24: https://nodejs.org/
goto aborted
:err_no_pnpm
echo   %RED%[失败]%RST% 未检测到 pnpm。请先安装: npm install -g pnpm@11.22.0
goto aborted
:err_no_uv
echo   %RED%[失败]%RST% 未检测到 uv。请先安装: https://docs.astral.sh/uv/
goto aborted
:err_install
echo   %RED%[失败]%RST% 依赖安装失败，请检查网络或代理后重试。
goto aborted

:aborted
echo.
echo %RED%已中止，未启动任何服务。%RST%
pause
exit /b 1

rem ============ 看门狗（独立最小化窗口运行） ============

:watchdog_main
rem %2=被监控窗口 PID  %3=日志  %4/%5/%6=端口（0 表示启动时不可用而跳过）
set "WPID=%~2"
set "WLOG=%~3"
set "KILLED="
:wd_wait
set "ALIVE="
for /f "tokens=1 delims=," %%a in ('tasklist /fi "PID eq %WPID%" /fo csv /nh 2^>nul') do if /i "%%~a"=="cmd.exe" set "ALIVE=1"
if defined ALIVE (
    ping -n 4 127.0.0.1 >nul
    goto wd_wait
)
rem 窗口已关闭: 等 8 秒宽限（Ctrl+C 优雅路径先走完），再清理残留监听
ping -n 9 127.0.0.1 >nul
if not "%~4"=="0" call :wd_kill_port %~4
if not "%~5"=="0" call :wd_kill_port %~5
if not "%~6"=="0" call :wd_kill_port %~6
if defined KILLED (
    >>"%WLOG%" echo [%date% %time%] watchdog: window %WPID% closed, force-stopped leftover listeners on ports %~4/%~5/%~6.
) else (
    >>"%WLOG%" echo [%date% %time%] watchdog: window %WPID% closed, no leftover listeners on ports %~4/%~5/%~6.
)
exit

:wd_kill_port
for /f "tokens=5" %%p in ('netstat -aon ^| findstr /r /c:":%1 .*LISTENING"') do (
    taskkill /f /t /pid %%p >nul 2>&1
    set "KILLED=1"
)
exit /b

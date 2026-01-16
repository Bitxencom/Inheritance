@echo off
setlocal EnableDelayedExpansion

REM ==========================================
REM Inheritance - Windows Startup Script
REM ==========================================

echo.
echo ======================================================================
echo               Inheritance - Docker Setup ^& Start (Windows)
echo ======================================================================
echo.

REM Check Docker
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker not found. Please install Docker Desktop for Windows.
    echo.
    pause
    exit /b 1
)

REM Parse Arguments
set "MODE=dev"
set "ENV_FILE=.env.local"
set "DETACHED=false"
set "REBUILD=false"
set "NON_INTERACTIVE=false"
set "FORCE_ASK=false"

:parse_args
if "%~1"=="" goto end_parse_args
if /i "%~1"=="dev" (
    set "MODE=dev"
    set "ENV_FILE=.env.local"
)
if /i "%~1"=="development" (
    set "MODE=dev"
    set "ENV_FILE=.env.local"
)
if /i "%~1"=="prod" (
    set "MODE=prod"
    set "ENV_FILE=.env"
)
if /i "%~1"=="production" (
    set "MODE=prod"
    set "ENV_FILE=.env"
)
if /i "%~1"=="-d" set "DETACHED=true"
if /i "%~1"=="--detach" set "DETACHED=true"
if /i "%~1"=="-r" set "REBUILD=true"
if /i "%~1"=="--rebuild" set "REBUILD=true"
if /i "%~1"=="-y" set "NON_INTERACTIVE=true"
if /i "%~1"=="--yes" set "NON_INTERACTIVE=true"
if /i "%~1"=="--ask" set "FORCE_ASK=true"
shift
goto parse_args
:end_parse_args

echo [INFO] Mode selected: %MODE%

REM Setup Environment File
if not exist "%ENV_FILE%" (
    if exist ".env.example" (
        echo [INFO] Creating %ENV_FILE% from .env.example...
        copy ".env.example" "%ENV_FILE%" >nul
        echo [SUCCESS] %ENV_FILE% created.
    ) else (
        echo [WARNING] .env.example not found. Creating empty %ENV_FILE%.
        type nul > "%ENV_FILE%"
    )
) else (
    echo [INFO] Using existing %ENV_FILE%.
)

REM Check API Key
findstr /C:"DEEPSEEK_API_KEY=" "%ENV_FILE%" >nul
if %errorlevel% neq 0 (
    echo [WARNING] DEEPSEEK_API_KEY not found in %ENV_FILE%.
    goto check_api_continue
)

REM Check if empty
for /f "tokens=2 delims==" %%I in ('findstr /C:"DEEPSEEK_API_KEY=" "%ENV_FILE%"') do set "API_KEY_VAL=%%I"
if "%API_KEY_VAL%"=="" (
    echo [WARNING] DEEPSEEK_API_KEY is empty in %ENV_FILE%.
    goto check_api_continue
)
goto api_key_ok

:check_api_continue
if "%NON_INTERACTIVE%"=="false" (
    set /p "CONTINUE_CHOICE=Proceed without API Key? (y/N): "
    if /i "!CONTINUE_CHOICE!" neq "y" exit /b 0
)
:api_key_ok

REM Port Configuration
set "NGINX_PORT=7000"
set "FRONTEND_PORT=7001"
set "BACKEND_PORT=7002"

REM Read ports from env file
for /f "tokens=2 delims==" %%A in ('findstr "NGINX_PORT=" "%ENV_FILE%"') do set "NGINX_PORT=%%A"
for /f "tokens=2 delims==" %%A in ('findstr "FRONTEND_PORT=" "%ENV_FILE%"') do set "FRONTEND_PORT=%%A"
for /f "tokens=2 delims==" %%A in ('findstr "BACKEND_PORT=" "%ENV_FILE%"') do set "BACKEND_PORT=%%A"

REM Remove quotes
set "NGINX_PORT=%NGINX_PORT:"=%"
set "FRONTEND_PORT=%FRONTEND_PORT:"=%"
set "BACKEND_PORT=%BACKEND_PORT:"=%"

echo [INFO] Service Ports:
echo        Nginx:    %NGINX_PORT%
echo        Frontend: %FRONTEND_PORT%
echo        Backend:  %BACKEND_PORT%

REM Check ports availability (simple check)
REM Note: This check uses netstat to see if the port is listening locally.
REM Docker might bind to 0.0.0.0 or ::
netstat -ano | findstr ":%NGINX_PORT% " >nul
if %errorlevel% equ 0 echo [WARNING] Port %NGINX_PORT% appears to be in use.

netstat -ano | findstr ":%FRONTEND_PORT% " >nul
if %errorlevel% equ 0 echo [WARNING] Port %FRONTEND_PORT% appears to be in use.

netstat -ano | findstr ":%BACKEND_PORT% " >nul
if %errorlevel% equ 0 echo [WARNING] Port %BACKEND_PORT% appears to be in use.


REM Prepare Docker Compose
set "COMPOSE_ARGS=--env-file %ENV_FILE% -f docker-compose.yml"
if "%MODE%"=="dev" (
    set "COMPOSE_ARGS=%COMPOSE_ARGS% -f docker-compose.dev.yml"
)

echo.
echo [INFO] cleaning up existing containers...
docker compose %COMPOSE_ARGS% down 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Failed to clean up some containers. They might not exist or are locked.
)

REM Rebuild if requested
if "%REBUILD%"=="true" (
    echo [INFO] Rebuilding images...
    echo [INFO] Building backend image from root...
    
    pushd backend
    docker buildx build -t registry.gitlab.com/deinheritance/backend:latest -f Dockerfile .
    popd
    
    docker compose %COMPOSE_ARGS% build
)

echo.
echo [INFO] Starting Docker Compose...
if "%DETACHED%"=="true" (
    docker compose %COMPOSE_ARGS% up -d
    if %errorlevel% equ 0 (
        echo [SUCCESS] Application started in background.
        echo.
        echo Access URLs:
        echo   Nginx:    http://localhost:%NGINX_PORT%
        echo   Frontend: http://localhost:%FRONTEND_PORT%
        echo   Backend:  http://localhost:%BACKEND_PORT%
    ) else (
        echo [ERROR] Failed to start application.
    )
) else (
    echo [INFO] Running in attached mode. Press Ctrl+C to stop.
    docker compose %COMPOSE_ARGS% up
)

endlocal

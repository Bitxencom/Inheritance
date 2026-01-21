@echo off
setlocal EnableDelayedExpansion

REM ==========================================
REM Inheritance - Windows Startup Script
REM ==========================================

echo.
echo ======================================
echo   Inheritance - Docker Startup
echo ======================================
echo.

REM Check Docker
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker not found. Please install Docker Desktop.
    pause
    exit /b 1
)

REM Default values
set "MODE=prod"
set "ENV_FILE=.env"
set "MODE_NAME=Production"
set "DETACHED="
set "REBUILD="
set "DO_DOWN=false"

REM Parse Arguments
:parse_args
if "%~1"=="" goto end_parse_args

if /i "%~1"=="-h" goto show_help
if /i "%~1"=="--help" goto show_help
if /i "%~1"=="dev" (
    set "MODE=dev"
    set "ENV_FILE=.env.local"
    set "MODE_NAME=Development"
)
if /i "%~1"=="development" (
    set "MODE=dev"
    set "ENV_FILE=.env.local"
    set "MODE_NAME=Development"
)
if /i "%~1"=="prod" (
    set "MODE=prod"
    set "ENV_FILE=.env"
    set "MODE_NAME=Production"
)
if /i "%~1"=="production" (
    set "MODE=prod"
    set "ENV_FILE=.env"
    set "MODE_NAME=Production"
)
if /i "%~1"=="-d" set "DETACHED=-d"
if /i "%~1"=="--detach" set "DETACHED=-d"
if /i "%~1"=="-r" set "REBUILD=--build"
if /i "%~1"=="--rebuild" set "REBUILD=--build"
if /i "%~1"=="--down" set "DO_DOWN=true"

shift
goto parse_args
:end_parse_args

REM Handle --down
if "%DO_DOWN%"=="true" (
    echo [INFO] Stopping containers...
    docker compose --env-file "%ENV_FILE%" down
    echo [SUCCESS] Containers stopped
    exit /b 0
)

REM Check if env file exists, create from template if not
if not exist "%ENV_FILE%" (
    if exist ".env.example" (
        echo [INFO] Creating %ENV_FILE% from template...
        copy ".env.example" "%ENV_FILE%" >nul
        echo [WARNING] Please edit %ENV_FILE% and set your configuration
    ) else (
        echo [ERROR] Environment file %ENV_FILE% not found!
        exit /b 1
    )
)

REM Build compose arguments
set "COMPOSE_ARGS=--env-file %ENV_FILE% -f docker-compose.yml"
if "%MODE%"=="dev" (
    set "COMPOSE_ARGS=%COMPOSE_ARGS% -f docker-compose.dev.yml"
)

REM Stop existing containers first
echo [INFO] Stopping existing containers...
docker compose %COMPOSE_ARGS% down 2>nul

REM Start containers
echo.
echo [INFO] Starting Inheritance (%MODE_NAME% mode)
echo [INFO] Environment: %ENV_FILE%
echo.

if defined DETACHED (
    docker compose %COMPOSE_ARGS% up %REBUILD% %DETACHED%
    
    if %errorlevel% equ 0 (
        echo.
        echo [SUCCESS] Containers started in background
        
        REM Get port from env file
        set "NGINX_PORT=7000"
        for /f "tokens=2 delims==" %%A in ('findstr "NGINX_PORT=" "%ENV_FILE%"') do set "NGINX_PORT=%%A"
        set "NGINX_PORT=!NGINX_PORT:"=!"
        
        echo.
        echo Access: http://localhost:!NGINX_PORT!
        echo.
        echo [INFO] Use 'start.bat --down' to stop
    ) else (
        echo [ERROR] Failed to start containers
    )
) else (
    echo [INFO] Running in attached mode. Press Ctrl+C to stop.
    docker compose %COMPOSE_ARGS% up %REBUILD%
)

endlocal
exit /b 0

:show_help
echo.
echo Inheritance - Docker Startup
echo.
echo Usage: start.bat [MODE] [OPTIONS]
echo.
echo MODE:
echo   dev, development    Development mode (uses .env.local)
echo   prod, production    Production mode (uses .env)
echo.
echo OPTIONS:
echo   -h, --help     Show this help
echo   -d, --detach   Run in background (detached mode)
echo   -r, --rebuild  Force rebuild Docker images
echo   --down         Stop all containers
echo.
echo Examples:
echo   start.bat dev           # Development mode
echo   start.bat prod -d       # Production mode in background
echo   start.bat dev -r        # Rebuild and run
echo   start.bat --down        # Stop containers
echo.
exit /b 0

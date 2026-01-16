# Running the Project

## 🚀 Quick Start with Docker

### Using Helper Scripts (Recommended)

The helper scripts (`start.sh` for Linux/macOS, `start.bat` for Windows) are the easiest way to run the application. They automatically handle environment setup, port checks, and logging.

#### Preparing the environment

Copy the `.env.example` file to `.env` and fill in the `DEEPSEEK_API_KEY`.

#### Run the project

**Linux / macOS:**
```bash
./start.sh prod --detach
```

**Windows:**
```batch
.\start.bat prod --detach
```

You can access the application in your browser at: **http://localhost:7000**

## 🐳 Manual Docker Compose

If you prefer using Docker Compose directly:

### 1. Environment Setup

*   **Development**: Create `.env.local` (use `.env.example` as template)
*   **Production**: Create `.env` (use `.env.example` as template)

### 2. Run Commands

```bash
# Development
docker compose --env-file .env.local up

# Production
docker compose --env-file .env up

# With rebuild
docker compose --env-file .env.local up --build

# In background
docker compose --env-file .env.local up -d
```

## Application Port

*   **Nginx Proxy**: http://localhost:7000
*   **Frontend**: http://localhost:7001
*   **Backend**: http://localhost:7002
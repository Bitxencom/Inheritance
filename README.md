# Running the Project

## 🚀 Quick Start with Docker

### Using `start.sh` Script (Recommended)

The `start.sh` script is the easiest way to run the entire application with Docker Compose as it handles environment setup, port checking, and logging automatically.

#### Preparing the environment

Copy the `.env.example` file to `.env` and fill in the `DEEPSEEK_API_KEY`.

#### Run the project
```bash
./start.sh prod --detach
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
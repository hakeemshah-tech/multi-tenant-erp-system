# =============================================================================
# Enterprise ERP: developer control plane.
#
# Every routine task goes through this file so that no one has to remember the
# compose flags. `make help` lists what is available.
#
# Requires: Docker Engine with the Compose v2 plugin, GNU make, and a POSIX
# shell. On Windows, run these from Git Bash or WSL.
# =============================================================================

SHELL := /bin/sh

COMPOSE := docker compose
PROJECT := erp-platform

# Prefer a modern `docker compose`; fall back to legacy docker-compose.
ifeq (,$(shell docker compose version 2>/dev/null))
COMPOSE := docker-compose
endif

.DEFAULT_GOAL := help
.PHONY: help init build up down restart logs logs-server logs-client ps \
        health sh-server sh-client sh-mongo seed seed-contract-types \
        test lint typecheck clean nuke rebuild

# --- Meta --------------------------------------------------------------------

help: ## Show this help
	@echo ""
	@echo "  Enterprise ERP - available targets"
	@echo ""
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'
	@echo ""

# --- Environment -------------------------------------------------------------

init: ## Create .env from the template with freshly generated secrets
	@if [ -f .env ]; then \
		echo "  .env already exists, leaving it untouched."; \
		exit 0; \
	fi
	@if [ ! -f .env.template ]; then \
		echo "  ERROR: .env.template not found."; exit 1; \
	fi
	@cp .env.template .env
	@if command -v openssl >/dev/null 2>&1; then \
		sed -i.bak "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$$(openssl rand -hex 32)|"   .env; \
		sed -i.bak "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$$(openssl rand -hex 32)|" .env; \
		sed -i.bak "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$$(openssl rand -hex 16)|"         .env; \
		sed -i.bak "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$$(openssl rand -base64 18)|"      .env; \
		rm -f .env.bak; \
		echo "  .env created with generated secrets."; \
	else \
		echo "  .env created from template, but openssl was not found."; \
		echo "  Fill in JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, REDIS_PASSWORD and"; \
		echo "  ADMIN_PASSWORD by hand before running 'make up'."; \
	fi
	@echo "  Object storage (AWS_*) still needs real values for uploads to work."

# --- Lifecycle ---------------------------------------------------------------

# Compose resolves `env_file: .env` while parsing, so every target below needs
# the file to exist even when it is only building.
build: .env ## Build all images
	$(COMPOSE) build

rebuild: .env ## Rebuild all images from scratch, ignoring the layer cache
	$(COMPOSE) build --no-cache --pull

up: .env ## Start the full stack in the background
	$(COMPOSE) up -d
	@echo ""
	@echo "  Stack is starting. Application: http://localhost:$${EDGE_PORT:-8080}"
	@echo "  API docs:                       http://localhost:$${EDGE_PORT:-8080}/api-docs"
	@echo "  Follow startup with 'make logs'."

down: ## Stop the stack, keeping database volumes
	$(COMPOSE) down --remove-orphans

restart: ## Restart every service
	$(COMPOSE) restart

.env:
	@echo "  No .env found. Run 'make init' first."
	@exit 1

# --- Observability -----------------------------------------------------------

logs: ## Follow logs from all services
	$(COMPOSE) logs -f --tail=100

logs-server: ## Follow backend logs only
	$(COMPOSE) logs -f --tail=100 server

logs-client: ## Follow frontend logs only
	$(COMPOSE) logs -f --tail=100 client

ps: ## Show container status
	$(COMPOSE) ps

health: ## Print the health state of every container
	@$(COMPOSE) ps --format 'table {{.Service}}\t{{.Status}}'

# --- Shells ------------------------------------------------------------------

sh-server: ## Open a shell in the backend container
	$(COMPOSE) exec server sh

sh-client: ## Open a shell in the frontend container
	$(COMPOSE) exec client sh

sh-mongo: ## Open a mongosh session against the database
	$(COMPOSE) exec mongo mongosh $${MONGO_DB:-erp_platform}

# --- Application tasks -------------------------------------------------------

seed: ## Seed the platform admin account (needs ADMIN_PASSWORD in .env)
	$(COMPOSE) exec server node dist/database/seeders/seedAdmin.js

seed-contract-types: ## Seed the contract type reference data
	$(COMPOSE) exec server node dist/database/seeders/seedContractTypes.js

# --- Quality gates -----------------------------------------------------------

test: ## Run backend unit tests
	cd server && npm test

lint: ## Lint both codebases
	cd client && npm run lint
	cd server && npm run lint

typecheck: ## Type-check the backend
	cd server && npm run typecheck

# --- Cleanup -----------------------------------------------------------------

clean: ## Stop the stack and remove its volumes (DESTROYS local data)
	$(COMPOSE) down --volumes --remove-orphans

nuke: ## clean, plus remove built images
	$(COMPOSE) down --volumes --remove-orphans --rmi local

# Development commands
dev-up:
	docker-compose up -d

dev-down:
	docker-compose down

dev-logs:
	docker-compose logs -f

dev-build:
	docker-compose build --no-cache

# Production commands
prod-up:
	docker-compose -f docker-compose.prod.yml up -d

prod-down:
	docker-compose -f docker-compose.prod.yml down

prod-logs:
	docker-compose -f docker-compose.prod.yml logs -f

prod-build:
	docker-compose -f docker-compose.prod.yml build --no-cache

# Database commands
db-migrate:
	docker-compose exec api alembic upgrade head

db-reset:
	docker-compose down -v
	docker-compose up -d db
	sleep 10
	docker-compose exec api alembic upgrade head

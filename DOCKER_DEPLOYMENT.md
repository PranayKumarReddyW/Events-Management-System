# Event Management System - Docker Deployment Guide

This guide will help you deploy the Event Management System using Docker.

## Prerequisites

- Docker Engine 20.10 or higher
- Docker Compose 2.0 or higher
- At least 4GB of free RAM
- At least 10GB of free disk space

## Quick Start

### 1. Clone or Download the Project

```bash
# If using git
git clone <repository-url>
cd pranay

# Or extract the downloaded archive
```

### 2. Configure Environment Variables

Copy the environment template and edit it with your actual values:

```bash
cp .env.docker .env
nano .env  # or use your preferred editor
```

**Important:** Update at least the following variables:

- `JWT_SECRET` - Use a long random string (at least 32 characters)
- `JWT_REFRESH_SECRET` - Use another long random string
- `EMAIL_SERVICE` and email credentials for password reset functionality
- Other services as needed (Twilio, Stripe, etc.)

### 3. Build and Start the Application

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 4. Access the Application

Once all services are healthy:

- **Frontend:** http://localhost (port 80)
- **Backend API:** http://localhost:5000
- **MongoDB:** localhost:27017
- **Redis:** localhost:6379

### 5. Create Initial Admin User (Optional)

```bash
# Access the backend container
docker-compose exec backend sh

# Run the seed script to create mock data (if available)
npm run seed:mock

# Exit the container
exit
```

## Service Architecture

The application consists of four services:

1. **MongoDB** - Database for storing application data
2. **Redis** - Cache and session storage
3. **Backend** - Node.js/Express API server
4. **Frontend** - React application served by Nginx

## Managing the Application

### Start Services

```bash
docker-compose up -d
```

### Stop Services

```bash
docker-compose stop
```

### Restart Services

```bash
docker-compose restart
```

### Stop and Remove All Containers

```bash
docker-compose down
```

### Stop and Remove All Containers with Volumes (⚠️ This will delete all data!)

```bash
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Rebuild After Code Changes

```bash
# Rebuild and restart
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build backend
```

## Data Persistence

Data is persisted using Docker volumes:

- `mongodb_data` - MongoDB database files
- `redis_data` - Redis data
- `./backend/uploads` - Uploaded files (certificates, events, profiles)
- `./backend/logs` - Application logs

To backup your data:

```bash
# Backup MongoDB
docker-compose exec mongodb mongodump --out /data/backup
docker cp event-management-mongodb:/data/backup ./backup

# Backup uploads
cp -r ./backend/uploads ./backup/uploads
```

## Troubleshooting

### Services Not Starting

Check service health:

```bash
docker-compose ps
docker-compose logs <service-name>
```

### Port Conflicts

If ports 80, 5000, 27017, or 6379 are already in use, modify the ports in `docker-compose.yml`:

```yaml
services:
  frontend:
    ports:
      - "8080:80" # Change 80 to 8080
  backend:
    ports:
      - "5001:5000" # Change 5000 to 5001
```

### Database Connection Issues

Ensure MongoDB is healthy:

```bash
docker-compose logs mongodb
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"
```

### Frontend Can't Connect to Backend

Update the API URL in the frontend build:

1. Edit `docker-compose.yml` under frontend service:

```yaml
build:
  args:
    VITE_API_BASE_URL: http://your-backend-url:5000
```

2. Rebuild the frontend:

```bash
docker-compose up -d --build frontend
```

## Production Deployment Recommendations

### Security

1. **Change Default Secrets:**

   - Generate strong random values for JWT secrets
   - Use unique credentials for all services

2. **Use HTTPS:**

   - Configure SSL/TLS certificates in Nginx
   - Use a reverse proxy like Traefik or Nginx Proxy Manager

3. **Network Isolation:**

   - Don't expose MongoDB and Redis ports publicly
   - Use Docker networks for inter-service communication

4. **Environment Variables:**
   - Never commit `.env` files to version control
   - Use Docker secrets or external secret management

### Performance

1. **Resource Limits:**
   Add resource limits to services in `docker-compose.yml`:

   ```yaml
   services:
     backend:
       deploy:
         resources:
           limits:
             cpus: "1"
             memory: 1G
   ```

2. **Enable Caching:**
   - Configure Redis connection pooling
   - Enable Nginx caching for static assets

### Monitoring

1. **Health Checks:**
   All services have built-in health checks. Monitor them using:

   ```bash
   docker-compose ps
   ```

2. **Logs:**
   - Use log aggregation tools (ELK, Grafana Loki)
   - Configure log rotation

## Sharing the Application

### Share Docker Images

1. **Build and tag images:**

```bash
docker-compose build
docker tag pranay-backend your-dockerhub-username/event-management-backend:latest
docker tag pranay-frontend your-dockerhub-username/event-management-frontend:latest
```

2. **Push to Docker Hub:**

```bash
docker push your-dockerhub-username/event-management-backend:latest
docker push your-dockerhub-username/event-management-frontend:latest
```

3. **Others can pull and run:**

```bash
docker pull your-dockerhub-username/event-management-backend:latest
docker pull your-dockerhub-username/event-management-frontend:latest
docker-compose up -d
```

### Share as Archive

Create a distributable package:

```bash
# Save images to tar files
docker save pranay-backend > event-management-backend.tar
docker save pranay-frontend > event-management-frontend.tar
docker save mongo:7 > mongo.tar
docker save redis:7-alpine > redis.tar

# Share these files along with docker-compose.yml and .env.docker
```

Recipients can load and run:

```bash
# Load images
docker load < event-management-backend.tar
docker load < event-management-frontend.tar
docker load < mongo.tar
docker load < redis.tar

# Run
cp .env.docker .env
# Edit .env with actual values
docker-compose up -d
```

## Support

For issues and questions:

- Check the logs: `docker-compose logs -f`
- Review the backend API documentation: `backend/API.md`
- Ensure all environment variables are properly configured

## License

This project is licensed under the MIT License.

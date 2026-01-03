# 🎉 Event Management System - Quick Start with Docker

Get the complete Event Management System up and running in minutes!

## What You Get

✅ **Complete event management platform** with:

- User authentication (Login, Register, Password Reset)
- Event creation and management
- Team management and collaboration
- Registration and attendance tracking
- Payments integration (Stripe, Razorpay)
- Certificate generation
- Real-time notifications
- Analytics dashboard
- Admin panel

✅ **All infrastructure included**:

- MongoDB database
- Redis cache
- Backend API (Node.js/Express)
- Frontend (React/TypeScript)
- All pre-configured and ready to use!

## Prerequisites

You only need:

- **Docker** (version 20.10+)
- **Docker Compose** (version 2.0+)

[Install Docker](https://docs.docker.com/get-docker/)

## 🚀 Quick Start (3 Steps)

### Step 1: Get the Code

Download or clone this repository.

### Step 2: Configure

```bash
# Copy environment template
cp .env.docker .env

# Edit with your settings (use any text editor)
nano .env
```

**Minimum required changes:**

- `JWT_SECRET` - Set a long random string (at least 32 characters)
- `JWT_REFRESH_SECRET` - Set another random string
- `SENDGRID_API_KEY` - Your SendGrid key (for email functionality)

### Step 3: Deploy

**Option A - Using the script:**

```bash
./deploy.sh
```

**Option B - Manual:**

```bash
docker-compose up -d
```

That's it! 🎉

## 📍 Access Your Application

- **Frontend:** http://localhost
- **Backend API:** http://localhost:5000

## 🎬 First Time Setup

1. Open http://localhost in your browser
2. Click "Sign Up" to create an account
3. Start creating events!

## 📊 Useful Commands

```bash
# View logs
docker-compose logs -f

# Stop services
docker-compose stop

# Start services
docker-compose start

# Restart services
docker-compose restart

# Stop and remove everything
docker-compose down

# Rebuild after changes
docker-compose up -d --build
```

## 📚 Features Guide

### Password Reset Flow

The system now includes complete password management:

1. **Forgot Password:**

   - Click "Forgot password?" on login page
   - Enter your email
   - Receive reset link via email
   - Link valid for 1 hour

2. **Reset Password:**

   - Click link in email
   - Enter new password (must be 8+ chars with uppercase, lowercase, and number)
   - Get redirected to login

3. **Change Password:**
   - Go to Settings → Change Password (http://localhost/settings/change-password)
   - Enter current password and new password
   - Password updated immediately

### User Roles

- **Student** - Can browse and register for events
- **Department Organizer** - Can create and manage events
- **Faculty** - Can manage events and approvals
- **Admin** - Full system access
- **Super Admin** - Complete control

## 🔧 Troubleshooting

### Port Already in Use

Edit `docker-compose.yml` and change the ports:

```yaml
frontend:
  ports:
    - "8080:80" # Change from 80 to 8080

backend:
  ports:
    - "5001:5000" # Change from 5000 to 5001
```

### Services Not Starting

```bash
# Check service status
docker-compose ps

# View logs for specific service
docker-compose logs backend
docker-compose logs mongodb
```

### Reset Everything

```bash
# Stop and remove all containers and data
docker-compose down -v

# Start fresh
docker-compose up -d
```

## 📦 Sharing with Others

### Option 1: Share This Folder

Just zip and share the entire folder. Recipients can run:

```bash
cp .env.docker .env
# Edit .env with their values
docker-compose up -d
```

### Option 2: Share Docker Images

Build and push to Docker Hub:

```bash
# Tag images
docker tag pranay-backend yourusername/event-management-backend
docker tag pranay-frontend yourusername/event-management-frontend

# Push
docker push yourusername/event-management-backend
docker push yourusername/event-management-frontend
```

Share your Docker Hub username. Others can pull and run:

```bash
docker pull yourusername/event-management-backend
docker pull yourusername/event-management-frontend
docker-compose up -d
```

## 🛡️ Security Notes

For production use:

1. ✅ Change all secrets in `.env`
2. ✅ Use strong passwords
3. ✅ Enable HTTPS (use reverse proxy like Nginx Proxy Manager)
4. ✅ Don't expose database ports to public
5. ✅ Keep `.env` file secure (never commit to git)
6. ✅ Regular backups of data volumes

## 📖 More Documentation

- [Complete Docker Deployment Guide](DOCKER_DEPLOYMENT.md)
- [API Documentation](backend/API.md)

## 🆘 Support

If you encounter issues:

1. Check logs: `docker-compose logs -f`
2. Verify `.env` configuration
3. Ensure Docker is running
4. Check system resources (RAM, disk space)

## ⭐ Production Ready

This setup includes:

- Health checks for all services
- Automatic restart policies
- Data persistence with volumes
- Optimized builds with multi-stage Dockerfiles
- Security headers and best practices
- Gzip compression
- Static asset caching

Perfect for both development and production! 🚀

---

**Made with ❤️ using Docker, Node.js, React, MongoDB, and Redis**

# GitHub Actions CI/CD Pipeline Documentation

## Overview

This repository uses automated GitHub Actions workflows for continuous integration, deployment, security scanning, and release management. The pipeline ensures code quality, security, and reliable deployments.

## Workflows

### 1. **CI - Build & Test** (`ci.yml`)

**Triggers:** Push to `main`/`develop`, Pull Requests

Runs on every push and PR to validate code quality:

- **Backend Jobs:**

  - Runs linting with ESLint
  - Executes unit tests with Jest
  - Uses MongoDB and Redis services for integration tests

- **Frontend Jobs:**

  - Runs linting with ESLint
  - Builds the TypeScript/React application
  - Uploads build artifacts for 5 days

- **Docker Jobs:**
  - Builds Docker images for both services
  - Caches layers for faster subsequent builds

### 2. **Docker Build & Push** (`docker-build-push.yml`)

**Triggers:** Push to `main`/`develop`, Tags (`v*`), Manual trigger

Builds and pushes Docker images to GitHub Container Registry (GHCR):

- Supports semantic versioning tags
- Automatically tags images with:
  - Branch name (`develop`, `main`)
  - Semantic version (`v1.0.0` → `1.0.0` and `1.0`)
  - Commit SHA for traceability
- Requires: `GITHUB_TOKEN` (automatic)

### 3. **Deploy to Production** (`deploy.yml`)

**Triggers:** Push to `main`, Version tags, Manual trigger

Deploys application to production/staging environments:

**Required Secrets:**

- `DEPLOY_HOST` - Server IP/domain
- `DEPLOY_USER` - SSH user
- `DEPLOY_KEY` - SSH private key
- `PORT` - Application port
- `MONGODB_URI` - MongoDB connection string
- `REDIS_URL` - Redis connection URL
- `JWT_SECRET` - JWT signing secret
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE`

**Deployment Steps:**

1. SSH into production server
2. Pulls latest code
3. Creates `.env` file with secrets
4. Runs `docker compose up -d`
5. Performs health check on `/health` endpoint
6. Notifies on success/failure

### 4. **Security Checks** (`security.yml`)

**Triggers:** Push to `main`/`develop`, PRs, Weekly schedule (Sundays)

Comprehensive security scanning:

- **Dependency Auditing:** Scans npm packages for vulnerabilities
- **CodeQL Analysis:** Detects code vulnerabilities and patterns
- **Secret Scanning:** Uses TruffleHog to find exposed credentials
- **Container Scanning:** Trivy scans filesystem and reports SARIF results

Results appear in:

- GitHub Actions logs
- GitHub Security tab (for CodeQL and Trivy)
- Pull request checks

### 5. **Release** (`release.yml`)

**Triggers:** Push of version tags (`v*`)

Automated release management:

- Generates changelog from commits since last tag
- Creates GitHub Release with changelog
- Builds all artifacts
- Uploads distribution tarball
- Marks as pre-release if tag contains `-rc` or `-beta`

## Setup Instructions

### 1. Configure GitHub Repository Secrets

Go to **Settings → Secrets and variables → Actions** and add:

**For Docker Registry (Optional):**

```
REGISTRY_USERNAME: your-username
REGISTRY_PASSWORD: your-password
```

**For Production Deployment:**

```
DEPLOY_HOST: your-server.com
DEPLOY_USER: deployuser
DEPLOY_KEY: (paste your SSH private key)
PORT: 5000
MONGODB_URI: mongodb+srv://user:pass@cluster.mongodb.net/dbname
REDIS_URL: redis://:password@host:6379
JWT_SECRET: your-jwt-secret-key
JWT_EXPIRE: 7d
STRIPE_SECRET_KEY: sk_live_xxxxx
STRIPE_PUBLIC_KEY: pk_live_xxxxx
RAZORPAY_KEY_ID: rzp_live_xxxxx
RAZORPAY_KEY_SECRET: xxxxx
SMTP_HOST: smtp.gmail.com
SMTP_PORT: 587
SMTP_USER: your-email@gmail.com
SMTP_PASS: your-app-password
TWILIO_ACCOUNT_SID: ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN: your-token
TWILIO_PHONE: +1234567890
```

### 2. Configure GitHub Environments (Optional)

For better control over deployments, create environments:

1. Go to **Settings → Environments**
2. Create `production` and `staging` environments
3. Add required secrets to each environment
4. Set protection rules (require approvals, etc.)

### 3. Prepare Your Server

On your production server:

```bash
# Create deployment directory
mkdir -p /home/deployuser/event-management
cd /home/deployuser/event-management

# Initialize git repository
git init
git remote add origin https://github.com/yourusername/yourrepo.git

# Pull the latest code
git fetch origin main
git checkout main

# Docker and Docker Compose should be installed
docker --version
docker compose version
```

### 4. Add Health Check Endpoint (Backend)

Ensure your backend has a `/health` endpoint:

```javascript
// In backend/src/server.js or routes
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});
```

## Branch Strategy

- **main**: Production-ready code
  - Triggers: Docker push, Deploy to production
  - Requires: Passing CI checks
- **develop**: Development/staging code
  - Triggers: Docker push with `develop` tag
  - Allows integration testing

## GitHub Actions Best Practices Used

✅ **Caching** - Node modules and Docker layers cached for faster builds
✅ **Parallel Jobs** - Backend, frontend, and Docker builds run in parallel
✅ **Concurrency** - Deployment jobs prevent simultaneous deployments
✅ **Secrets Management** - All sensitive data uses GitHub Secrets
✅ **Security** - Multiple security scanning tools integrated
✅ **Health Checks** - Deployment verifies service health
✅ **Semantic Versioning** - Release automation with version tags
✅ **Artifacts** - Build outputs retained for debugging

## Troubleshooting

### Docker Push Fails

- Verify `GITHUB_TOKEN` has `packages:write` permission
- Ensure you're logged in: `echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u actor --password-stdin`

### Deployment Fails

- Check SSH key format (should be OpenSSH format)
- Verify server is reachable: `ssh -i key.pem deployuser@host`
- Check health endpoint returns 200: `curl http://localhost:5000/health`

### Tests Fail

- Ensure MongoDB and Redis are accessible during CI
- Check `.env` or environment variables are set correctly
- Review logs in Actions tab

### Secrets Not Found

- Verify secret names match exactly (case-sensitive)
- Ensure secrets are added to the correct repository/environment
- GitHub sometimes takes a few minutes to propagate secrets

## Monitoring

Monitor your workflows:

1. **Actions Tab**: View all workflow runs and logs
2. **Security Tab**: View CodeQL, Trivy, and secret scanning results
3. **Deployments**: View deployment history and rollback if needed

## Future Enhancements

Consider adding:

- Load testing
- Performance benchmarking
- Database migration automation
- Slack/email notifications
- Automated rollback on failed deployments
- Multi-environment promotion (dev → staging → prod)

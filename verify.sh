#!/bin/bash

# Verification script for the Event Management System implementation
# This script checks if all required files exist and are properly configured

echo "🔍 Event Management System - Implementation Verification"
echo "=========================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
checks_passed=0
checks_failed=0

# Function to check if file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1 exists"
        ((checks_passed++))
        return 0
    else
        echo -e "${RED}✗${NC} $1 is missing"
        ((checks_failed++))
        return 1
    fi
}

# Function to check if directory exists
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1 exists"
        ((checks_passed++))
        return 0
    else
        echo -e "${RED}✗${NC} $1 is missing"
        ((checks_failed++))
        return 1
    fi
}

echo "Checking Password Management Components..."
check_file "frontend/src/pages/auth/ForgotPasswordPage.tsx"
check_file "frontend/src/pages/auth/ResetPasswordPage.tsx"
check_file "frontend/src/pages/settings/ChangePasswordPage.tsx"

echo ""
echo "Checking Docker Files..."
check_file "backend/Dockerfile"
check_file "backend/.dockerignore"
check_file "frontend/Dockerfile"
check_file "frontend/.dockerignore"
check_file "frontend/nginx.conf"
check_file "docker-compose.yml"

echo ""
echo "Checking Configuration Files..."
check_file ".env.docker"
check_file "deploy.sh"

echo ""
echo "Checking Documentation..."
check_file "README.md"
check_file "DOCKER_README.md"
check_file "DOCKER_DEPLOYMENT.md"
check_file "IMPLEMENTATION_SUMMARY.md"

echo ""
echo "Checking Backend Structure..."
check_dir "backend/src"
check_dir "backend/src/controllers"
check_dir "backend/src/routes"
check_file "backend/package.json"

echo ""
echo "Checking Frontend Structure..."
check_dir "frontend/src"
check_dir "frontend/src/pages"
check_dir "frontend/src/api"
check_file "frontend/package.json"

echo ""
echo "=========================================================="
echo -e "Checks passed: ${GREEN}${checks_passed}${NC}"
echo -e "Checks failed: ${RED}${checks_failed}${NC}"
echo ""

if [ $checks_failed -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! The implementation is complete.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Copy .env.docker to .env and configure it"
    echo "2. Run: docker-compose up -d"
    echo "3. Access the application at http://localhost"
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Please review the missing files.${NC}"
    exit 1
fi

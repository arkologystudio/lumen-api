#!/usr/bin/env bash
set -e

# Go to your app directory
cd /opt/chl-embedding-service

# Fetch the latest code and reset
git fetch --all
git reset --hard origin/main

# Pull updated images (if you use images) and recreate containers
docker compose pull
docker compose up -d
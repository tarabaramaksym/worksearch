# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine AS base

# Install build dependencies
RUN apk add --no-cache libc6-compat python3 make g++ sqlite-dev

# Build frontend
FROM base AS frontend-builder
WORKDIR /app
COPY dashboard-fe/package*.json ./
RUN npm ci
COPY dashboard-fe/ ./
RUN npm run build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy server source and package files (including schema directory)
COPY --chown=root:root server/ ./server/

# Install server dependencies in the final stage (this rebuilds sqlite3 for Alpine)
RUN npm ci --prefix server

# Copy database file and create directory structure
COPY --chown=root:root server/data/job_dashboard.db ./server/data/

# Create temp directory
RUN mkdir -p /app/temp

# Now create the nodejs user and set permissions
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Change ownership of all app files to nodejs user
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Start the server
CMD ["node", "server/src/server.js"]
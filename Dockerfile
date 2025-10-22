# Dockerfile for Playwright e2e tests
FROM node:20-bullseye

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Install Playwright with dependencies
RUN npx playwright install --with-deps

# Copy project files
COPY . .

# Run tests by default
CMD ["npm", "run", "test:e2e"]

# Use Node.js LTS version as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY server.js ./
COPY public ./public

# Expose the port the app runs on
EXPOSE 3000

# Set environment variable for port
ENV PORT=3000

# Run the application
CMD ["node", "server.js"]


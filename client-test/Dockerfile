# Use Node.js LTS version
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install since we don't have package-lock.json)
RUN npm install --only=production

# Copy static files
COPY . .

# Expose port (Cloud Run will set PORT env var)
EXPOSE 8080

# Start HTTP server
CMD ["npm", "start"]

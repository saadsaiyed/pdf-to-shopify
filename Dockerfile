# Use Node 20+ because Polaris requires >=20.10.0
FROM node:20-alpine

# Expose port (Render expects your app to listen on $PORT, not 3000)
EXPOSE 3000

WORKDIR /app

COPY . .

# Set environment
ENV NODE_ENV=production

# Install dependencies
RUN npm install --omit=dev

# Remove CLI packages since we don't need them in production
RUN npm remove @shopify/app @shopify/cli || true

# Build the Remix app
RUN npm run build

# Remove dev SQLite (optional)
RUN rm -f prisma/dev.sqlite

# Start app (Render provides $PORT env variable automatically)
CMD ["npm", "run", "docker-start"]

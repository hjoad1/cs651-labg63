
# Build the React frontend.
FROM node:22-slim AS frontend-build

WORKDIR /app/frontend-react

COPY frontend-react/package*.json ./
RUN npm ci

COPY frontend-react/ ./
RUN npm run build

# Run the Express backend.
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend/server.js ./backend/server.js

COPY --from=frontend-build \
  /app/frontend-react/dist ./frontend-react/dist

EXPOSE 8080

CMD ["node", "backend/server.js"]

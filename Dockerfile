FROM mcr.microsoft.com/playwright:v1.56.1-noble
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
USER pwuser
CMD ["node", "src/server.js"]

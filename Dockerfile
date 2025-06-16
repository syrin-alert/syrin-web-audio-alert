FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

# Copia o código real para dentro da pasta app/
COPY app ./app

WORKDIR /app/app

EXPOSE 3000
CMD ["npm", "start"]

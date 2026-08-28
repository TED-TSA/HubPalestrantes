# Node 24: o app usa o módulo interno node:sqlite. A flag --disable-warning só
# silencia o aviso de "experimental", igual ao npm start.
FROM node:24-slim

WORKDIR /app

# Dependências primeiro, para aproveitar o cache de camada quando só o código muda.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Código da aplicação.
COPY . .

ENV NODE_ENV=production
# O Cloud Run injeta PORT (8080 por padrão); config.js já lê process.env.PORT.
EXPOSE 8080

CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]

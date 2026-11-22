FROM node:22-alpine
ARG RELEASE=1
ENV RELEASE=${RELEASE} PORT=3000
WORKDIR /app
COPY --chown=node:node *.js catalog.json package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=3s --timeout=2s --start-period=3s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

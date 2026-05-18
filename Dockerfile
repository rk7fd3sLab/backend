FROM public.ecr.aws/docker/library/node:24

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
RUN chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

USER node

CMD ["npm", "run", "start"]

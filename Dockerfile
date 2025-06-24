FROM docker.io/library/node:24-alpine3.21 AS builder

WORKDIR /root
COPY . .

RUN apk update && apk --no-cache add \
    make gcc g++ musl-dev python3 py3-setuptools

RUN npm install

FROM docker.io/library/node:24-alpine3.21

WORKDIR /home/node

COPY --chown=node:node . .
COPY --from=builder --chown=node:node /root/node_modules ./node_modules/

EXPOSE 8080
USER node
CMD ["node", "app.js"]

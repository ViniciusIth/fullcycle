FROM docker.io/node:22-alpine

WORKDIR /usr/src/fullcycle_app

COPY . .

RUN npm install

EXPOSE 3000

CMD [ "node", "index.js" ]

FROM node:latest

MAINTAINER Martin Betak <matobet@gmail.com>

COPY lib /src/lib/
COPY package.json /src/

WORKDIR /src

RUN npm install

ENTRYPOINT npm start

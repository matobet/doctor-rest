FROM iojs:onbuild

MAINTAINER Martin Betak <matobet@gmail.com>

COPY lib
COPY package.json

RUN npm install

CMD npm start

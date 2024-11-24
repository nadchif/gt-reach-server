FROM node:20-alpine
RUN mkdir -p /code
WORKDIR /code
ADD . /code
RUN  yarn install --ignore-optional  --frozen-lockfile && yarn cache clean && yarn build
CMD [ "yarn", "start" ]
EXPOSE 4000
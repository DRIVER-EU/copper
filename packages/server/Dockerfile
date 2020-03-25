FROM node:12-stretch-slim as builder
RUN mkdir -p ./code
COPY package.json /code/package.json
WORKDIR /code
RUN yarn
COPY . .
RUN yarn build

FROM node:12-stretch-slim
RUN mkdir -p /copper
COPY --from=builder /code/dist /copper/dist
COPY --from=builder /code/node_modules /copper/node_modules
EXPOSE 3008
CMD ["node", "/copper/dist/index.js"]

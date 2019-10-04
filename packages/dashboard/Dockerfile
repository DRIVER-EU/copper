FROM node:11 as builder
RUN mkdir -p ./code
COPY package.json /code/package.json
WORKDIR /code
RUN apt-get update && apt-get install git
RUN yarn
COPY . .
ARG VUE_APP_COPPER_LAYER_URL
ARG VUE_APP_COPPER_LOG_URL
ARG VUE_APP_COPPER_SOCKET_SERVER_URL
ENV VUE_APP_COPPER_LAYER_URL $VUE_APP_COPPER_LAYER_URL
ENV VUE_APP_COPPER_LOG_URL $VUE_APP_COPPER_LOG_URL
ENV VUE_APP_COPPER_SOCKET_SERVER_URL $VUE_APP_COPPER_SOCKET_SERVER_URL
RUN yarn build

FROM node:11-stretch-slim
RUN yarn global add http-server
RUN mkdir -p /copper
COPY --from=builder /code/dist /copper
EXPOSE 8080
# CMD ["http-server", "/copper"]
CMD ["sh", "-c", "echo \"var VUE_APP_COPPER_LAYER_URL=$$VUE_APP_COPPER_LAYER_URL;var VUE_APP_COPPER_LOG_URL=$$VUE_APP_COPPER_LOG_URL;var VUE_APP_COPPER_SOCKET_SERVER_URL=$$VUE_APP_COPPER_SOCKET_SERVER_URL\" > /copper/global-vars-copper.js && http-server /copper"]

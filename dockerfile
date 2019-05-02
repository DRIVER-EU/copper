FROM node:8 as builder
COPY . .
RUN yarn global add @vue/cli
WORKDIR /
RUN yarn
RUN yarn build
EXPOSE 8080 3007
CMD ["./run.sh"]

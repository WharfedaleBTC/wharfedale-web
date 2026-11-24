# wharfedale-web: the built app and its server.
# Build context: the directory holding wharfedale-web/ and wharfedale-sdk-ts/, e.g.
#   docker build -f wharfedale-web/Dockerfile -t wharfedale-web:dev .
# (`make run` in ../wharfedale does this for you; CI publishes ghcr.io/wharfedalebtc/wharfedale-web.)

FROM node:22.16-bookworm-slim AS build
WORKDIR /src
COPY wharfedale-sdk-ts /src/wharfedale-sdk-ts
COPY wharfedale-web /src/wharfedale-web
RUN cd wharfedale-sdk-ts && npm ci --ignore-scripts && npm run build \
 && cd ../wharfedale-web && npm ci --ignore-scripts && npm run build

FROM node:22.16-bookworm-slim
WORKDIR /src
COPY --from=build /src/wharfedale-sdk-ts /src/wharfedale-sdk-ts
COPY --from=build /src/wharfedale-web /src/wharfedale-web
WORKDIR /src/wharfedale-web
ENV WHARFEDALE_WEB_CONFIG=/config/config.json
EXPOSE 8080
CMD ["node", "dist/server/index.js"]

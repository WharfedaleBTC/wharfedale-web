# wharfedale-web: the built app and its server.
# Build context: the directory holding wharfedale-web/, wharfedale-sdk-ts/ and, for the DAMP
# signer, damp/ with the path dependencies of its workspace (wharfedale/, wharfedale-sdk-rs/,
# malachite/; Cargo resolves them even for the wasm build), e.g.
#   docker build -f wharfedale-web/Dockerfile -t wharfedale-web:dev .
# (`make run` in ../wharfedale does this for you; CI publishes ghcr.io/wharfedalebtc/wharfedale-web.)

# DAMP's signer (Rust → WebAssembly): regulated-asset transfers are built and signed in the browser.
# The output is the same on every platform, so it builds once, natively, for multi-platform images.
# `--target wasm-pkg --output type=local,dest=…` exports just the package (CI's build job, `npm run dev`).
FROM --platform=$BUILDPLATFORM rust:1-bookworm AS wasm
# Debian's clang targets WebAssembly (secp256k1-zkp and the Simplicity C library are compiled for it).
RUN apt-get update && apt-get install -y --no-install-recommends clang llvm \
 && rm -rf /var/lib/apt/lists/* \
 && rustup target add wasm32-unknown-unknown
# Same version as the `wasm-bindgen` crate in damp/Cargo.lock.
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    cargo install wasm-bindgen-cli --version 0.2.126 --locked
WORKDIR /src
COPY malachite /src/malachite
COPY wharfedale /src/wharfedale
COPY wharfedale-sdk-rs /src/wharfedale-sdk-rs
COPY damp/Cargo.toml damp/Cargo.lock /src/damp/
COPY damp/crates /src/damp/crates
WORKDIR /src/damp
ENV CC_wasm32_unknown_unknown=clang AR_wasm32_unknown_unknown=llvm-ar
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/src/damp/target \
    cargo build --release --locked --target wasm32-unknown-unknown -p simplicity-damp-signer --lib \
 && wasm-bindgen --target web --out-dir /pkg target/wasm32-unknown-unknown/release/simplicity_damp_signer.wasm

FROM scratch AS wasm-pkg
COPY --from=wasm /pkg /

FROM node:22.16-bookworm-slim AS build
WORKDIR /src
COPY wharfedale-sdk-ts /src/wharfedale-sdk-ts
# DAMP's browser modules (imported as @damp/*) and the signer built above, where they import it.
COPY damp/apps/web/src/lib /src/damp/apps/web/src/lib
COPY --from=wasm /pkg /src/damp/apps/web/src/generated/damp-signer
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

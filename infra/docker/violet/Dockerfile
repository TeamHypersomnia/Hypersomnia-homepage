# Violet (TURN) built with our libjuice fork: it refuses relaying to the unspecified, loopback, link-local and multicast
# addresses (the TURN credentials are public, in the game). Until upstream merges it - then back to paullouisageneau/violet.
# The commits come from the inventory (violet_commit, libjuice_commit).
FROM alpine:3.20 AS builder

ARG VIOLET_COMMIT
ARG LIBJUICE_COMMIT

RUN apk add --no-cache cmake make gcc musl-dev git

WORKDIR /usr/src/violet

RUN git init -q . && git fetch -q --depth 1 https://github.com/paullouisageneau/violet "$VIOLET_COMMIT" && git checkout -q FETCH_HEAD && \
    git init -q deps/libjuice && cd deps/libjuice && \
    git fetch -q --depth 1 https://github.com/TeamHypersomnia/libjuice "$LIBJUICE_COMMIT" && git checkout -q FETCH_HEAD && \
    cd /usr/src/violet && cmake -B build -DCMAKE_BUILD_TYPE=Release && make -C build -j2

FROM alpine:3.20

RUN apk add --no-cache musl

COPY --from=builder /usr/src/violet/build/violet /usr/local/bin/

ENTRYPOINT [ "/usr/local/bin/violet" ]

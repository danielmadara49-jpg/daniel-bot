FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ffmpeg python3 curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp
COPY --from=denoland/deno:bin /deno /usr/local/bin/deno
WORKDIR /app
COPY package*.json ./
RUN n
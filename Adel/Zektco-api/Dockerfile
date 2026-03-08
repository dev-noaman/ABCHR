# Stage 1: Build dependencies (pyzk needs gcc)
FROM python:3.12-slim AS builder
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt -t /build/deps

# Stage 2: Lean runtime image
FROM python:3.12-slim
WORKDIR /app

ENV TZ=Asia/Qatar
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Install only ping for network checks (no gcc)
RUN apt-get update && apt-get install -y --no-install-recommends iputils-ping && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/deps/. /usr/local/lib/python3.12/site-packages/
COPY main.py .

VOLUME /data

CMD ["python3", "-u", "main.py"]

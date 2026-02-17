# syntax=docker/dockerfile:1
FROM python:3.11-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app

# Use HTTPS mirrors, retries, and a trimmed dependency set (enough to build dlib)
RUN printf 'deb https://deb.debian.org/debian bookworm main\n\
deb https://deb.debian.org/debian-security bookworm-security main\n\
deb https://deb.debian.org/debian bookworm-updates main\n' > /etc/apt/sources.list \
 && printf 'Acquire::Retries "5";\nAcquire::http::No-Cache "true";\nAcquire::https::No-Cache "true";\n' > /etc/apt/apt.conf.d/99retries \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
   libx11-dev \
   libgl1 \
   libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

COPY ./requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "-m", "app.main"]

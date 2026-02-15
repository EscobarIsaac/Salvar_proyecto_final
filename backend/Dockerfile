# syntax=docker/dockerfile:1
FROM python:3.11-slim
WORKDIR /app
# Install system dependencies for dlib
RUN apt-get update && apt-get install -y \
	build-essential \
	cmake \
	libboost-all-dev \
	libopenblas-dev \
	liblapack-dev \
	libx11-dev \
	libgtk-3-dev \
	libjpeg-dev \
	libpng-dev \
	libtiff-dev \
	libavcodec-dev \
	libavformat-dev \
	libswscale-dev \
	libv4l-dev \
	&& rm -rf /var/lib/apt/lists/*
COPY ./requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "-m", "app.main"]

FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Dependencias nativas que pyzkfp / mono suelen requerir (libusb, compat 0.1, winforms, GL/X11)
RUN apt-get update \ 
	&& apt-get install -y --no-install-recommends \
		libusb-1.0-0 libusb-1.0-0-dev libusb-0.1-4 \
		mono-complete libgdiplus \
		libc6 libstdc++6 libgomp1 \
		libgl1 libx11-6 libxcursor1 libxext6 libxrandr2 libxrender1 libxi6 libxinerama1 \
	&& rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 9000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9000"]

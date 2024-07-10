# Use a lightweight base image with Node.js pre-installed
FROM node:19-alpine

# Install required dependencies and tools
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    gcc \
    musl-dev \
    python3-dev \
    libffi-dev \
    openssl-dev \
    cargo

# Install the latest version of yt-dlp
RUN pip3 install --upgrade yt-dlp

# Set the working directory in the container
WORKDIR /app

# Copy your Node.js application files into the container
COPY package*.json ./
COPY server.js ./
COPY lib/ /app/lib/
COPY middleware/ /app/middleware/
COPY models/ /app/models/
COPY routes/ /app/routes/
COPY const/ /app/const/
COPY controllers/ /app/controllers/

# Install Node.js dependencies
RUN npm install

# Expose the port on which your Node.js application will listen
EXPOSE 5001

# Define the default command to run your Node.js application
CMD ["node", "server.js"]
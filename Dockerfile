# Use a lightweight base image with Node.js pre-installed
FROM node:19-alpine

# Install youtube-dl and required dependencies
RUN apk add --no-cache youtube-dl ffmpeg python3

# Set the working directory in the container
WORKDIR /app

# Copy your Node.js application files into the container
COPY package*.json ./
COPY server.js ./
COPY lib/ /app/lib/

# Install Node.js dependencies
RUN npm install

# Expose the port on which your Node.js application will listen (e.g., 3000)
EXPOSE 5001

# Define the default command to run your Node.js application
CMD ["node", "server.js"]

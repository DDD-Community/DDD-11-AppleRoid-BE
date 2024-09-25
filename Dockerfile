# Base image
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install yarn
RUN apk add --no-cache yarn


# Copy package.json and yarn.lock
COPY package.json yarn.lock ./
COPY ./.env /usr/src/app/


# Install app dependencies
RUN yarn install --frozen-lockfile

# Bundle app source
COPY . .

# Build the application
RUN yarn build

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "dist/main.js"]
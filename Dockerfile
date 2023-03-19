FROM node:18-alpine
ENV TZ="Asia/Irkutsk"
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 4000
CMD ["npm", "start"]
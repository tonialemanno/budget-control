FROM nginx:1.27-alpine
COPY . /usr/share/nginx/html
RUN rm -rf /usr/share/nginx/html/.git /usr/share/nginx/html/.github /usr/share/nginx/html/payload
EXPOSE 80

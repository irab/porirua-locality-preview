FROM nginx:1.27-alpine
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html directory.html about.html directory.js format-description.mjs directory.css directory-data.js config-directory.js /usr/share/nginx/html/
COPY data/services.json /usr/share/nginx/html/data/services.json
EXPOSE 8080

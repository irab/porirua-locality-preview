FROM nginx:1.27-alpine
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html directory.html about.html directory.js group-services.mjs map-popup.mjs format-description.mjs directory.css directory-data.js config-directory.js /usr/share/nginx/html/
COPY scripts/org-grouping.mjs /usr/share/nginx/html/scripts/org-grouping.mjs
COPY scripts/lib/normalize.mjs /usr/share/nginx/html/scripts/lib/normalize.mjs
COPY scripts/lib/org-cluster.mjs /usr/share/nginx/html/scripts/lib/org-cluster.mjs
COPY data/services.json /usr/share/nginx/html/data/services.json
EXPOSE 8080

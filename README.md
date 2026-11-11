# Florida Sankranti Utsav (Angular)

Angular 19 rebuild of https://floridasankrantiutsav.com/ for https://dev.floridasankrantiutsav.com/.

Each page section lives in `src/app/sections/<name>` (header, hero, hero-mobile, about, activities, schedule, cta, scroll-top, whatsapp, footer). Images are in `public/images`.

## Develop

```bash
npm install
npm start          # http://localhost:4200
npm run build      # output in dist/floridasankrantiutsav/browser
```

## Deploy (VPS, Docker + Traefik)

```bash
docker compose up -d --build
```

The container serves the built site with Nginx on port 80; Traefik routes `dev.floridasankrantiutsav.com` to it with a Let's Encrypt certificate. Override the hostname with `SITE_HOST=...`.

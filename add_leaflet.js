const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');
if (html.includes('leaflet')) { console.log('Leaflet already added'); process.exit(0); }
html = html.replace(
  '</head>',
  '    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />\n    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>\n  </head>'
);
fs.writeFileSync('public/index.html', html, 'utf8');
console.log('Leaflet added to index.html');

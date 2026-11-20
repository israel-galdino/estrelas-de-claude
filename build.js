// Empacota o jogo em um único HTML: index.html (abrir localmente) e dist/orbita.html (artifact)
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const rd = f => fs.readFileSync(path.join(dir, f), 'utf8');
const js = ['util', 'data', 'audio', 'gfx', 'ships', 'game', 'ui'].map(n => rd(`js/${n}.js`)).join('\n');
const css = rd('style.css');
const body = rd('body.html');
const head = `<title>Órbita Mineradora</title>
<meta name="description" content="Idle de mineração espacial em pixel art">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=VT323&display=swap">
<style>
${css}
</style>`;
const inner = `${body}
<script>
${js}
</script>`;
fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
fs.writeFileSync(path.join(dir, 'dist', 'orbita.html'), `${head}\n${inner}\n`);
fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${head}
</head>
<body>
${inner}
</body>
</html>
`);
console.log('ok', (fs.statSync(path.join(dir, 'index.html')).size / 1024).toFixed(1) + 'KB');

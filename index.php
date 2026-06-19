<?php
$target = __DIR__ . '/frontend/out/index.html';

if (file_exists($target)) {
    header('Location: frontend/out/', true, 302);
    exit;
}

header('Content-Type: text/html; charset=UTF-8');
?>
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Obra VDS</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #020617; color: #e2e8f0; font-family: Arial, sans-serif; }
    main { max-width: 560px; padding: 32px; border: 1px solid #1e293b; border-radius: 16px; background: #0f172a; }
    h1 { margin: 0 0 12px; font-size: 22px; }
    p { margin: 8px 0; color: #94a3b8; line-height: 1.6; }
    code { color: #67e8f9; }
  </style>
</head>
<body>
  <main>
    <h1>Dashboard ainda não foi publicado</h1>
    <p>Execute <code>npm run build</code> dentro de <code>obra/frontend</code> e publique também a pasta gerada <code>obra/frontend/out</code>.</p>
    <p>Após o build, esta página redireciona automaticamente para o dashboard.</p>
  </main>
</body>
</html>

# Histórico de Alterações - Obra VDS

Este arquivo registra as modificações realizadas no projeto para manter o alinhamento com outras IDEs e agentes de IA.

## Padrões de Desenvolvimento Obrigatórios
1. **Respostas em português** (PT-BR).
2. **Sugestão de commit** em português ao finalizar cada ação.
3. **Property-Based Testing** com fast-check quando aplicável.
4. **Uso de Profilers** (Chrome DevTools / py-spy) e Heap Snapshots para monitoramento de recursos.
5. **Robustez ante falhas** (ex.: tratamento transacional se a conexão com o banco cair).
6. **Manter este arquivo MD** atualizado e com no máximo 70 linhas.

---

## 20/06/2026 - Correção do Erro 404 no Vercel (API Config)

### Problema
O frontend estava retornando "Erro 404 ao chamar /api/config/cards" no ambiente de produção do Vercel. 
Por ser um deploy estático sem Next.js, o Vercel não estava direcionando as requisições dinâmicas para o arquivo de rotas genéricas `/api/[...path].js`.

### Solução
1. **Configuração de Rotas no Vercel (`vercel.json`)**:
   - Adicionada regra de rewrite para mapear todas as chamadas de `/api/:path*` para o arquivo `/api/[...path].js`.
2. **Tratamento de Path no Handler (`api/[...path].js`)**:
   - Ajustada a decodificação da variável `path`. No Vercel com rewrite, `req.query.path` é recebido como string (ex.: `"config/cards"`).
   - Agora o handler detecta se é string e divide por barra (`/`), suportando tanto o rewrite de produção quanto o array local do `vercel dev`.

## 20/06/2026 - Diagnóstico do Erro 500 na Vercel (API Catalog)

### Problema
Ao acessar `/api/catalog`, o servidor retornava um "Erro 500 ao chamar /api/catalog" genérico sem detalhar a exceção raiz, dificultando saber se a causa é ausência de variáveis de ambiente (`DATABASE_URL`/`POSTGRES_URL`), falha de SSL ou tabelas ausentes.

### Solução
1. **Mensagens Detalhadas de Erro (`api/db.js`)**:
   - Atualizada a função `sendError` para expor a mensagem (`error.message`) e a stack trace (`error.stack`) no JSON de resposta. Isso permite visualizar a causa real do erro diretamente pelo toast no frontend ou pelo inspetor de rede do navegador.

## 12/09/2026 - Visualização Simplificada + Conciliação Mercado Livre

### Problema
Dashboard denso para financiador e compras do Mercado Livre (`compras-print/` 13 PNGs, 3 pedidos) divergentes da lista — `seed.ts` só tinha `cmp_0001`.

### Solução
1. **Dashboard Simplificado (`frontend/_frontend/src/app/components/DashboardSimples.tsx`)**: 3 KPIs (Orçado/Já investido/Falta) + barra única + últimos 3 cards, auto para `perfil=visualizador` (`page.tsx:4,672,796`).
2. **Conciliação obra/ferramenta**: 8 novos `CatalogItem`s (`mat_0009`..`0016`, Fogão como `Diversos`) + 2 `Purchase`s `cmp_0002` (`2000013652145111`) e `cmp_0003` (`2000013676528193`) com rateio proporcional frete/desconto; 5 não-obra descartados (Cilindro, Corretor, Cinto, Capacete, Case). `seed.ts:394` + `scripts/build-static.js` atualizado para Next `out`→`public`.

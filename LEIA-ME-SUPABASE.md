# ☠ MÖRK BORG Companion — Integração Supabase

Guia completo para conectar o projeto ao Supabase em ~15 minutos.

---

## Passo 1 — Criar conta no Supabase

1. Acesse **https://supabase.com**
2. Clique em **Start your project** → faça login com GitHub (gratuito)
3. Clique em **New project**
4. Preencha:
   - **Name:** `mork-borg-companion`
   - **Database Password:** crie uma senha forte (salve em algum lugar!)
   - **Region:** escolha `South America (São Paulo)` para menor latência
5. Aguarde ~2 minutos enquanto o projeto é criado

---

## Passo 2 — Criar o banco de dados

1. No painel do projeto, clique em **SQL Editor** (ícone de código, barra lateral)
2. Clique em **New query**
3. Abra o arquivo `supabase_setup.sql` deste projeto
4. Cole todo o conteúdo no editor
5. Clique em **Run** (ou Ctrl+Enter)
6. Você deve ver na parte inferior: `3 rows` — confirmando que tabela, RLS e bucket foram criados

---

## Passo 3 — Pegar as credenciais

1. Vá em **Settings** (ícone de engrenagem) → **API**
2. Copie:
   - **Project URL** — algo como `https://abcdefgh.supabase.co`
   - **anon public** key — chave longa começando com `eyJ...`

---

## Passo 4 — Configurar o projeto

Abra o arquivo `js/supabase.js` e substitua as duas linhas no topo:

```javascript
// ANTES (linhas 13-14):
const SUPABASE_URL  = 'COLE_AQUI_SUA_PROJECT_URL';
const SUPABASE_ANON = 'COLE_AQUI_SUA_ANON_KEY';

// DEPOIS (exemplo):
const SUPABASE_URL  = 'https://abcdefgh.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

> ⚠️ A chave `anon` é **pública** — pode ficar no código frontend.  
> NUNCA coloque a chave `service_role` no frontend!

---

## Passo 5 — Ativar confirmação de e-mail (opcional)

Por padrão o Supabase exige confirmar o e-mail para ativar a conta.  
Para desativar (mais fácil para testes):

1. Vá em **Authentication** → **Providers** → **Email**
2. Desative **Confirm email**
3. Salve

---

## Passo 6 — Testar

Abra o `index.html` em um servidor local (não diretamente como arquivo):

```bash
# Opção A: Python
python3 -m http.server 8080

# Opção B: Node.js
npx serve .

# Opção C: VS Code
# Instale a extensão "Live Server" e clique em "Go Live"
```

Acesse `http://localhost:8080` e:
1. Crie uma conta
2. Crie um personagem → clique em 💾 Salvar
3. Faça logout → faça login novamente
4. Clique em **↻ Atualizar** — o personagem deve aparecer!

---

## Estrutura de arquivos

```
mork-borg-companion/
├── index.html                 ← HTML principal (atualizado com tela de login)
├── supabase_setup.sql         ← Execute 1 vez no SQL Editor do Supabase
├── LEIA-ME-SUPABASE.md        ← Este arquivo
├── style/
│   ├── style.css              ← CSS original (não alterado)
│   └── auth.css               ← CSS novo para telas de login/nuvem
├── js/
│   ├── supabase.js            ← Módulo de integração (Auth + DB + Storage)
│   └── script.js              ← Lógica do app (atualizado para nuvem)
└── data/
    ├── classes.json
    ├── equipment.json
    ├── names.json
    ├── scrolls.json
    └── items.json
```

---

## O que mudou em relação à versão original

| Original | Versão Supabase |
|----------|----------------|
| `localStorage` | PostgreSQL na nuvem |
| Sem login | Auth por e-mail + senha |
| Dados só no navegador | Acesso de qualquer dispositivo |
| Retrato em base64 (pesado) | Imagem no Supabase Storage |
| `script.js` único | `supabase.js` + `script.js` |
| Sem segurança | RLS: cada user só vê seus dados |

---

## Plano gratuito do Supabase

Para um projeto de RPG como este, o plano gratuito é mais do que suficiente:

- 500 MB de banco de dados
- 1 GB de armazenamento (imagens de retratos)
- 50.000 usuários ativos por mês
- Sem limite de personagens por usuário

---

## Resolução de problemas

**"Failed to fetch" ao salvar**  
→ Verifique se `SUPABASE_URL` e `SUPABASE_ANON` estão corretos em `js/supabase.js`

**"new row violates row-level security policy"**  
→ Certifique-se de que rodou o SQL completo do `supabase_setup.sql`

**Imagem não aparece após recarregar**  
→ Verifique se o bucket `retratos` foi criado como público no Supabase Storage

**"Email not confirmed"**  
→ Confirme o e-mail na caixa de entrada, ou desative a confirmação (Passo 5)

**Arquivo abre como "arquivo://" no navegador**  
→ Use um servidor local (Passo 6) — módulos ES6 (`import/export`) exigem HTTP

# SGBD — Lei do Bem | Backend

API REST para acompanhamento de projetos de Pesquisa, Desenvolvimento e Inovação.

Centraliza autenticação, autorização por perfil, registros financeiros, dedicação de pessoas, evidências, governança e preparação de dossiês.

Projeto acadêmico desenvolvido no contexto da residência BBTS.

> Os relatórios auxiliam o preenchimento do FORMP&D. A API não realiza submissão automática ao MCTI nem certifica elegibilidade fiscal.

## Tecnologias

- Node.js 22.x.
- JavaScript e Express.
- PostgreSQL.
- Prisma ORM 6.x.
- JWT.
- bcryptjs.
- CORS e dotenv.
- Axios.
- Nodemailer.
- Render para a API.
- Neon para PostgreSQL.

O frontend consome a API por HTTPS. Credenciais do banco e chaves de autenticação permanecem no backend.

## Funcionalidades

- Autenticação e consulta de permissões.
- Atualização da própria conta e senha.
- Projetos com classificação, TRL, ano-base e revisão.
- Marcos experimentais.
- Evidências com hash SHA-256.
- Armazenamento dos arquivos de evidência no PostgreSQL.
- Timesheets com justificativa e aprovação.
- Reaprovação após edição de horas.
- Dispêndios com validação de valores e ano-base.
- Pareceres técnicos e alertas.
- Fechamento e reabertura de dossiês.
- Preparação técnica e anual FORMP&D.
- Controle de revisão dos complementos.
- Relatórios de apoio em CSV e impressão/HTML.
- Auditoria das operações implementadas.
- Consulta cadastral de CNPJ.

## Perfis e autorização

| Perfil | Permissões principais |
| --- | --- |
| Gestor | Gerencia registros, valida marcos/evidências, aprova horas, emite pareceres e fecha/reabre dossiês |
| Analista P&D | Cria e edita projetos e registros operacionais; prepara dados e consulta relatórios |
| Auditor | Consulta projetos, marcos, evidências e pessoas, sem edição ou custos |
| Consultoria especializada | Consulta projetos e edita somente enquadramento e complemento técnico |

A tela de auditoria e logs está reservada ao gestor.

Todos podem administrar a própria conta.

Recursos financeiros e dados restritos são filtrados conforme o perfil.

Rotas protegidas exigem:

```http
Authorization: Bearer TOKEN
```

Resultados esperados:

- `401`: ausência de autenticação ou sessão inválida.
- `403`: operação não permitida ao perfil.
- `409`: conflito, como uma revisão desatualizada, quando aplicável.

A autorização é aplicada no backend, independentemente dos controles apresentados pelo frontend.

## Requisitos

- Node.js 22.12 ou superior da linha 22.x.
- npm.
- Git.
- PostgreSQL local ou uma instância Neon.

As conexões da aplicação e da administração devem apontar para o mesmo banco.

O projeto utiliza Prisma 6.x. Mantenha as versões registradas no `package-lock.json`.

## Instalação

Clone este repositório e abra o terminal na raiz.

Instale as dependências:

```bash
npm ci
```

Crie um arquivo `.env` na raiz e substitua os placeholders localmente:

```env
NODE_ENV=development
PORT=3300

DATABASE_URL="postgresql://USUARIO:SENHA@HOST_POOLER:5432/BANCO?sslmode=require"
DIRECT_URL="postgresql://USUARIO:SENHA@HOST_DIRETO:5432/BANCO?sslmode=require"

JWT_SECRET="SUBSTITUIR_POR_UM_SEGREDO_ALEATORIO"

ALLOW_PUBLIC_REGISTRATION=false

CORS_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173
```

Para PostgreSQL local, ajuste as URLs às configurações do seu servidor.

No Neon, copie as URLs fornecidas pelo painel, preservando os parâmetros de conexão.

Senhas com caracteres especiais devem estar corretamente codificadas na URL.

### Gerar o segredo JWT

Execute no seu próprio terminal:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Substitua o placeholder de `JWT_SECRET` pelo resultado.

Não publique nem compartilhe esse segredo. Ele deve ter pelo menos 32 caracteres.

### Conexões

| Variável | Utilização |
| --- | --- |
| `DATABASE_URL` | Prisma Client e consultas da aplicação |
| `DIRECT_URL` | Comandos administrativos configurados em `prisma.config.ts` |

No Neon, utilize a conexão com pooling em `DATABASE_URL` e a conexão direta em `DIRECT_URL`.

## Preparar o banco

Com o `.env` configurado para o banco de destino:

```bash
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npx prisma migrate status
```

### Histórico de migrations

- `prisma/migrations-postgresql`: migrations atuais do PostgreSQL.
- `prisma/migrations`: histórico anterior do MySQL.
- `prisma/mysql`: schema anterior preservado.

As migrations MySQL não devem ser aplicadas ao PostgreSQL.

Ao clonar o projeto, aplique as migrations versionadas. Não gere novamente a migration inicial.

As migrations criam ou atualizam a estrutura; elas não transferem os dados do MySQL.

Não use `prisma migrate reset` em bancos compartilhados: esse comando remove dados.

## Criar usuários iniciais

O seed atual prepara os quatro perfis.

Defina localmente no `.env`:

```env
SEED_GESTOR_PASSWORD=""
SEED_ANALISTA_PASSWORD=""
SEED_AUDITOR_PASSWORD=""
SEED_CONSULTORIA_PASSWORD=""
```

Preencha cada valor com uma senha de pelo menos 10 caracteres e no máximo 72 bytes.

Depois execute:

```bash
npx prisma db seed
```

Comportamento:

- Cria as contas ausentes.
- Salva hashes bcrypt.
- Preserva senhas e perfis das contas existentes.
- Não redefine senhas.
- Não remove projetos ou usuários.

Os identificadores das contas estão definidos em `prisma/seed.js`.

Para utilizar um ambiente compartilhado, solicite acesso ao responsável. Não publique credenciais no README.

Não execute o seed automaticamente em cada inicialização do servidor.

## Executar

Desenvolvimento com reinicialização automática:

```bash
npm run dev
```

Execução normal:

```bash
npm start
```

Endereço local padrão:

```text
http://localhost:3300
```

### Health check

```http
GET /health
```

Resposta esperada:

```json
{
  "status": "ok",
  "servico": "Squad35 Backend"
}
```

Essa rota confirma que o servidor responde. Ela não comprova, sozinha, a conexão com o banco.

## Principais endpoints

Os caminhos são relativos à raiz da API. O backend não utiliza o prefixo `/api`.

| Método | Rota | Finalidade |
| --- | --- | --- |
| POST | `/auth/login` | Autenticar |
| GET | `/auth/me` | Consultar a própria conta |
| GET | `/auth/permissoes` | Consultar permissões |
| PUT | `/auth/me` | Atualizar a própria conta |
| PUT | `/auth/me/senha` | Alterar a própria senha |
| GET | `/elegibilidade/dashboard` | Consultar dashboard |
| GET / POST | `/iniciativas` | Listar/criar projetos |
| GET / PUT / DELETE | `/iniciativas/:id` | Consultar/editar/excluir projeto |
| GET / POST | `/iniciativas/:iniciativaId/marcos` | Consultar/criar marcos |
| GET | `/evidencias/:evidenciaId/arquivo` | Baixar evidência |
| GET / POST | `/iniciativas/:iniciativaId/timesheets` | Consultar/registrar horas |
| POST | `/timesheets/aprovar-lote` | Aprovar horas |
| GET / POST | `/iniciativas/:iniciativaId/dispendios` | Consultar/criar dispêndios |
| PUT / DELETE | `/iniciativas/:iniciativaId/dispendios/:dispendioId` | Editar/excluir dispêndio |
| GET | `/iniciativas/:iniciativaId/dossie` | Consultar dossiê |
| POST | `/iniciativas/:iniciativaId/dossie/fechar` | Fechar dossiê |
| POST | `/iniciativas/:iniciativaId/dossie/reabrir` | Reabrir dossiê |
| GET | `/relatorios/formpd` | Consultar/exportar apoio FORMP&D |
| GET / PUT | `/relatorios/formpd/:anoBase/preparacao` | Preparação anual |
| GET / PUT | `/iniciativas/:iniciativaId/formpd` | Preparação do projeto |
| GET | `/auditoria` | Consultar logs permitidos |
| GET | `/public/cnpj/:cnpj` | Consulta cadastral pública |

A disponibilidade das operações depende do perfil e das regras do recurso.

O cadastro público permanece desativado por padrão.

A consulta cadastral não avalia automaticamente a elegibilidade à Lei do Bem.

## Regras relevantes

- Datas financeiras devem pertencer ao ano-base do projeto.
- Valores monetários preservam precisão decimal.
- Somas são tratadas em centavos quando aplicável.
- O custo apropriado não recebe novamente o percentual de elegibilidade.
- Custos de pessoal e dispêndios são apresentados separadamente.
- Editar um timesheet aprovado exige nova aprovação.
- Aprovação completa exige justificativa, autor e data.
- Dossiê fechado bloqueia as alterações implementadas até reabertura autorizada.
- Revisões conflitantes da preparação podem retornar 409.
- Evidências devem ser arquivos não vazios de até 5 MiB.
- O servidor calcula o hash das evidências.
- O fechamento depende das pendências e do parecer da revisão atual.

## Testes

Quando as suítes e scripts de testes estiverem presentes no checkout:

```bash
npm test
npm run test:integration
```

### Testes com dependências simuladas

`npm test` executa as suítes configuradas com dependências simuladas.

Esses testes não comprovam a conexão com o PostgreSQL real.

### Integração com banco

`npm run test:integration` verifica a conexão e a estrutura do banco apontado pelo `.env`.

Essa verificação não substitui os fluxos completos pelo frontend nem testes de concorrência.

### Testes funcionais integrados

Utilize contas autorizadas e dados fictícios para conferir:

1. Criação e edição de projeto.
2. Soma exata de R$ 0,10 e R$ 0,20.
3. Rejeição de lançamento fora do ano-base.
4. Cadastro, aprovação, edição e reaprovação de horas.
5. Upload, download e validação de evidências.
6. Permissões dos quatro perfis.
7. Preparação e exportação do dossiê.
8. Fechamento e reabertura conforme as pendências.
9. Registros de auditoria.
10. Rejeição de chamadas diretas não autorizadas com status 403.

## Recuperação de senha

Endpoints:

```http
POST /auth/recuperar-senha
POST /auth/redefinir-senha
```

O envio real depende da configuração de um provedor.

Não considere a recuperação operacional apenas porque o backend está publicado.

### SMTP

Configure:

- `EMAIL_PROVIDER=smtp`.
- `SMTP_HOST`.
- `SMTP_PORT`.
- `SMTP_SECURE`.
- `SMTP_USER`.
- `SMTP_PASSWORD`.
- `SMTP_FROM`.

### Provedor HTTPS

Para a opção implementada:

- `EMAIL_PROVIDER=resend`.
- `RESEND_API_KEY`.
- `EMAIL_FROM`.

O remetente precisa estar autorizado no provedor.

Em produção, `FRONTEND_URL` deve utilizar HTTPS.

Nenhuma dessas credenciais deve ser versionada.

## Publicação no Render

| Configuração | Valor |
| --- | --- |
| Runtime | Node |
| Node.js | 22.x |
| Build | `npm ci --include=dev && npx prisma generate` |
| Start | `npx prisma migrate deploy && npm start` |
| Health check | `/health` |

O servidor utiliza a porta fornecida pelo ambiente e escuta em `0.0.0.0`.

Cadastre no painel:

- `NODE_ENV=production`.
- `DATABASE_URL`.
- `DIRECT_URL`.
- `JWT_SECRET`.
- `ALLOW_PUBLIC_REGISTRATION=false`.
- `CORS_ORIGINS`.
- `FRONTEND_URL`.

Cadastre as variáveis do provedor de e-mail somente ao configurar esse recurso.

`CORS_ORIGINS` aceita origens exatas separadas por vírgula. Use esquema e domínio, sem caminhos ou barra final.

Ao alterar o domínio do frontend:

1. Atualize `CORS_ORIGINS`.
2. Atualize `FRONTEND_URL`.
3. Aplique a nova configuração do serviço.
4. Teste o login pelo novo endereço.

Instâncias gratuitas podem dormir e apresentar demora na primeira requisição.

As portas SMTP usuais são bloqueadas no Render Free; nesse ambiente, utilize a opção HTTPS para o envio de e-mail.

Confira os limites e as condições dos provedores antes da publicação.

## Segurança

Não versione:

- `.env` e suas cópias.
- Dumps de banco.
- Senhas.
- Chaves privadas.
- Tokens.
- URLs reais de conexão.
- Evidências reais.
- Logs e capturas contendo dados sensíveis.

Arquivos `.env.example` devem conter apenas placeholders.

O `.gitignore` não remove segredos já versionados.

Em caso de exposição:

1. Revogue ou troque a credencial.
2. Atualize os serviços que a utilizam.
3. Revise o histórico e os locais onde ela foi publicada.

## Limitações

- O limite de recuperação de senha atual é por processo.
- Múltiplas instâncias exigem armazenamento compartilhado para um limite global.
- A configuração de proxy deve corresponder à infraestrutura antes de depender do IP do cliente para controles operacionais.
- Relatórios não equivalem a submissão oficial ou aprovação fiscal.
- Serviços gratuitos possuem limites e não garantem disponibilidade contínua.
- O projeto acadêmico não deve ser tratado como sistema certificado para obrigações fiscais.

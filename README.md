
```markdown
# SGA-LB Backend (Sistema de Gestão de Apuração - Lei do Bem)

Backend desenvolvido para a gestão de iniciativas de P&D (Pesquisa e Desenvolvimento), controle de dispêndios, timesheets e conformidade com os requisitos da **Lei do Bem**[cite: 2, 43].

---

## 🚀 Tecnologias Utilizadas

*   **Node.js** & **Express** (Framework para construção da API REST)
*   **Prisma ORM (v6.19.3)** (Mapeamento objeto-relacional e migrações)
*   **MySQL** (Banco de dados relacional)
*   **Bcrypt.js** (Criptografia e segurança de senhas)
*   **Nodemon** (Reinício automático do servidor em desenvolvimento)

---

## 📂 Estrutura do Projeto

```text
Squad35-Backend/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.js
├── src/
│   ├── controllers/
│   │   ├── authController.js
│   │   └── iniciativaController.js
│   ├── services/
│   │   └── prisma.js
│   ├── routes.js
│   └── server.js
├── .env
├── package.json
└── ...

```

---

## ⚙️ Passo a Passo para Instalação e Execução

### 1. Pré-requisitos

Certifica-te de que tens o **Node.js** e o **MySQL** instalados no teu computador.

### 2. Clonar o repositório e instalar dependências

No terminal, executa:

```bash
git clone <url-do-teu-repositorio>
cd Squad35-Backend
npm install
npm install prisma@6.19.3 --save-dev
npm install @prisma/client@6.19.3

```

### 3. Configurar a Base de Dados (.env)

Cria um ficheiro `.env` na raiz do projeto com a string de conexão do teu MySQL:

```env
DATABASE_URL="mysql://root:tua_senha@localhost:3306/sga_lb_db"

```

### 4. Executar Migrações e Seed

Gera as tabelas no banco de dados e popula o utilizador padrão inicial:

```bash
npx prisma migrate dev --name init_sgalb
npx prisma db seed

```

### 5. Iniciar o Servidor

Para iniciar a aplicação em modo de desenvolvimento:

```bash
npm run dev

```

O servidor estará ativo em: `http://localhost:3300`

---

## 🔌 Rotas da API

### Autenticação / Inscrição

* `POST /auth/register` — Registo público de novos utilizadores.


* `POST /auth/login` — Autenticação de utilizadores existentes.

### CRUD de Iniciativas (Lei do Bem)

* `POST /iniciativas` — Cadastra uma nova iniciativa de P&D.


* `GET /iniciativas` — Lista todas as iniciativas cadastradas.


* `GET /iniciativas/:id` — Retorna os detalhes de uma iniciativa específica.


* `PUT /iniciativas/:id` — Atualiza os dados de uma iniciativa.


* `DELETE /iniciativas/:id` — Remove uma iniciativa do sistema.



---

## 🛠️ Como Testar

Podes utilizar o **Thunder Client** (extensão do VS Code) ou o **Postman** para enviar requisições para os endpoints listados acima enviando corpos em formato `JSON`.

```


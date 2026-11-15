require("dotenv").config();

const express = require("express");
const cors = require("cors");

// Interrompe a inicialização se o segredo não estiver configurado.
if (
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET.length < 32
) {
  throw new Error(
    "Configure JWT_SECRET no .env com pelo menos 32 caracteres."
  );
}

const PORT = Number(process.env.PORT || 3300);

if (
  !Number.isInteger(PORT) ||
  PORT < 1 ||
  PORT > 65535
) {
  throw new Error(
    "Configure PORT com um número inteiro entre 1 e 65535."
  );
}

// Importar depois de carregar e validar as variáveis de ambiente.
const routes = require("./routes");

const app = express();

app.disable("x-powered-by");

const origensPermitidas = (
  process.env.CORS_ORIGINS || ""
)
  .split(",")
  .map((origem) => origem.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origem, callback) {
      // Requisições de terminal e Postman podem não ter Origin.
      const origemPermitida =
        !origem || origensPermitidas.includes(origem);

      callback(null, origemPermitida);
    },
    exposedHeaders: ["Content-Disposition"],
  })
);

app.use(express.json({ limit: "8mb" }));

// Confirma que o servidor está respondendo.
// A conexão com o banco deve ser verificada separadamente.
app.get("/health", (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  return res.status(200).json({
    status: "ok",
    servico: "Squad35 Backend",
  });
});

app.use(routes);

app.use((req, res) => {
  return res.status(404).json({
    error: "Rota não encontrada.",
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "O corpo da requisição contém um JSON inválido.",
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      error: "A requisição excede o limite de 8 MB.",
    });
  }

  // Evita expor detalhes internos na resposta.
  console.error("Erro não tratado:", error.name);

  return res.status(500).json({
    error: "Erro interno do servidor.",
  });
});

// Inicia o servidor apenas quando este arquivo é executado diretamente.
if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

// Permite importar a aplicação nos testes sem iniciar uma porta fixa.
module.exports = app;
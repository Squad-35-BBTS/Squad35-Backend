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

app.get("/health", (req, res) => {
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

  console.error("Erro não tratado:", error.name);

  return res.status(500).json({
    error: "Erro interno do servidor.",
  });
});

const PORT = process.env.PORT || 3300;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

// Permite importar a aplicação nos testes sem iniciar uma porta fixa.
module.exports = app;
const { Router } = require("express");

const iniciativaController = require("./controllers/iniciativaController");
const authController = require("./controllers/authController");
const marcoController = require("./controllers/marcoController");
const dispendioController = require("./controllers/dispendioController");
const timesheetController = require("./controllers/timesheetController");
const governancaController = require("./controllers/governancaController");

const authMiddleware = require("./Middleware/authMiddleware");

const routes = Router();

// ROTAS PÚBLICAS

routes.post("/auth/register", authController.register);
routes.post("/auth/login", authController.login);

routes.get(
  "/public/cnpj/:cnpj",
  iniciativaController.consultarCnpj
);

routes.get(
  "/public/github-evidencias",
  iniciativaController.consultarRepositorioGithub
);

// AUTENTICAÇÃO

routes.use(authMiddleware);

// DASHBOARD

routes.get(
  "/elegibilidade/dashboard",
  iniciativaController.getDashboardElegibilidade
);

// INICIATIVAS

routes.post("/iniciativas", iniciativaController.create);
routes.get("/iniciativas", iniciativaController.findAll);
routes.get("/iniciativas/:id", iniciativaController.findById);
routes.put("/iniciativas/:id", iniciativaController.update);
routes.delete("/iniciativas/:id", iniciativaController.delete);

// APURAÇÃO E RELATÓRIOS

routes.get(
  "/apuracao/financeira",
  iniciativaController.getApuraçãoFinanceira
);

routes.get(
  "/relatorios/mcti",
  iniciativaController.exportarMcti
);

// MARCOS

routes.get(
  "/iniciativas/:iniciativaId/marcos",
  marcoController.listarMarcos
);

routes.post(
  "/iniciativas/:iniciativaId/marcos",
  marcoController.criarMarco
);

routes.put(
  "/iniciativas/:iniciativaId/marcos/:marcoId",
  marcoController.atualizarMarco
);

routes.post(
  "/iniciativas/:iniciativaId/marcos/:marcoId/validar",
  marcoController.validarMarco
);

// EVIDÊNCIAS

routes.post(
  "/iniciativas/:iniciativaId/marcos/:marcoId/evidencias",
  marcoController.anexarEvidencia
);

routes.get(
  "/evidencias/:evidenciaId/arquivo",
  marcoController.baixarEvidencia
);

routes.post(
  "/evidencias/:evidenciaId/validar",
  marcoController.validarEvidencia
);

// DISPÊNDIOS

routes.get(
  "/iniciativas/:iniciativaId/dispendios",
  dispendioController.listarDispendios
);

routes.post(
  "/iniciativas/:iniciativaId/dispendios",
  dispendioController.criarDispendio
);

routes.put(
  "/iniciativas/:iniciativaId/dispendios/:dispendioId",
  dispendioController.atualizarDispendio
);

// TIMESHEETS

routes.get(
  "/iniciativas/:iniciativaId/timesheets",
  timesheetController.listarTimesheets
);

routes.post(
  "/iniciativas/:iniciativaId/timesheets",
  timesheetController.criarTimesheet
);

routes.put(
  "/iniciativas/:iniciativaId/timesheets/:timesheetId",
  timesheetController.atualizarTimesheet
);

routes.post(
  "/timesheets/aprovar-lote",
  timesheetController.aprovarLote
);

// PARECERES

routes.get(
  "/iniciativas/:iniciativaId/pareceres",
  governancaController.listarPareceres
);

routes.post(
  "/iniciativas/:iniciativaId/pareceres",
  governancaController.criarParecer
);

// ALERTAS

routes.get(
  "/alertas",
  governancaController.listarAlertas
);

routes.post(
  "/iniciativas/:iniciativaId/alertas",
  governancaController.criarAlerta
);

routes.post(
  "/alertas/:alertaId/resolver",
  governancaController.resolverAlerta
);

// DOSSIÊ

routes.get(
  "/iniciativas/:iniciativaId/dossie",
  governancaController.consultarDossie
);

routes.post(
  "/iniciativas/:iniciativaId/dossie/fechar",
  governancaController.fecharDossie
);

routes.post(
  "/iniciativas/:iniciativaId/dossie/reabrir",
  governancaController.reabrirDossie
);

module.exports = routes;
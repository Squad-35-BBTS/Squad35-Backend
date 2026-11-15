const { Router } = require("express");

const iniciativaController = require("./controllers/iniciativaController");
const authController = require("./controllers/authController");
const marcoController = require("./controllers/marcoController");
const dispendioController = require("./controllers/dispendioController");
const timesheetController = require("./controllers/timesheetController");
const governancaController = require("./controllers/governancaController");
const integracaoController = require("./controllers/integracaoController");
const perfilController = require("./controllers/perfilController");
const recuperacaoController = require("./controllers/recuperacaoController");
const formpdController = require("./controllers/formpdController");
const preparacaoFormpdController = require("./controllers/preparacaoFormpdController");

const authMiddleware = require("./Middleware/authMiddleware");
const limiteRecuperacao = require("./Middleware/limiteRecuperacao");

const {
  controleAcesso,
  permissoes,
} = require("./Middleware/controleAcesso");

const routes = Router();

// Rotas públicas.
routes.post("/auth/register", authController.register);
routes.post("/auth/login", authController.login);
routes.post("/auth/recuperar-senha", limiteRecuperacao(), recuperacaoController.solicitar);
routes.post("/auth/redefinir-senha", limiteRecuperacao(20), recuperacaoController.redefinir);
routes.get("/public/cnpj/:cnpj", iniciativaController.consultarCnpj);

// As rotas abaixo exigem autenticação e autorização.
routes.use(authMiddleware);
routes.use(controleAcesso);

// Conta e permissões.
routes.get("/auth/permissoes", (req, res) => res.json(permissoes(req)));
routes.get("/auth/me", integracaoController.me);
routes.put("/auth/me", perfilController.atualizar);
routes.put("/auth/me/senha", perfilController.alterarSenha);

// Usuários e auditoria.
routes.get("/usuarios", integracaoController.usuarios);
routes.get("/auditoria", integracaoController.auditoria);

// Dashboard e projetos.
routes.get("/elegibilidade/dashboard", iniciativaController.getDashboardElegibilidade);
routes.post("/iniciativas", iniciativaController.create);
routes.get("/iniciativas", iniciativaController.findAll);
routes.get("/iniciativas/:id", iniciativaController.findById);
routes.put("/iniciativas/:id", iniciativaController.update);
routes.delete("/iniciativas/:id", iniciativaController.delete);

// Apuração e relatórios.
routes.get("/apuracao/financeira", iniciativaController.getApuraçãoFinanceira);
routes.get("/relatorios/mcti", iniciativaController.exportarMcti);
routes.get("/relatorios/formpd", formpdController.consultar);

// Preparação anual do FORMP&D.
routes.get("/relatorios/formpd/:anoBase/preparacao", preparacaoFormpdController.consultarAno);
routes.put("/relatorios/formpd/:anoBase/preparacao", preparacaoFormpdController.salvarAno);

// Complementação do FORMP&D por projeto.
routes.get("/iniciativas/:iniciativaId/formpd", preparacaoFormpdController.consultarProjeto);
routes.put("/iniciativas/:iniciativaId/formpd", preparacaoFormpdController.salvarProjeto);

// Marcos e evidências.
routes.get("/iniciativas/:iniciativaId/marcos", marcoController.listarMarcos);
routes.post("/iniciativas/:iniciativaId/marcos", marcoController.criarMarco);
routes.put("/iniciativas/:iniciativaId/marcos/:marcoId", marcoController.atualizarMarco);
routes.post("/iniciativas/:iniciativaId/marcos/:marcoId/validar", marcoController.validarMarco);
routes.post("/iniciativas/:iniciativaId/marcos/:marcoId/evidencias", marcoController.anexarEvidencia);
routes.get("/evidencias/:evidenciaId/arquivo", marcoController.baixarEvidencia);
routes.post("/evidencias/:evidenciaId/validar", marcoController.validarEvidencia);

// Dispêndios.
routes.get("/iniciativas/:iniciativaId/dispendios", dispendioController.listarDispendios);
routes.post("/iniciativas/:iniciativaId/dispendios", dispendioController.criarDispendio);
routes.put("/iniciativas/:iniciativaId/dispendios/:dispendioId", dispendioController.atualizarDispendio);
routes.delete("/iniciativas/:iniciativaId/dispendios/:dispendioId", dispendioController.excluirDispendio);

// Timesheets.
routes.get("/iniciativas/:iniciativaId/timesheets", timesheetController.listarTimesheets);
routes.post("/iniciativas/:iniciativaId/timesheets", timesheetController.criarTimesheet);
routes.put("/iniciativas/:iniciativaId/timesheets/:timesheetId", timesheetController.atualizarTimesheet);
routes.post("/timesheets/aprovar-lote", timesheetController.aprovarLote);

// Pareceres.
routes.get("/iniciativas/:iniciativaId/pareceres", governancaController.listarPareceres);
routes.post("/iniciativas/:iniciativaId/pareceres", governancaController.criarParecer);

// Alertas.
routes.get("/alertas", governancaController.listarAlertas);
routes.post("/iniciativas/:iniciativaId/alertas", governancaController.criarAlerta);
routes.post("/alertas/:alertaId/resolver", governancaController.resolverAlerta);

// Dossiê do projeto.
routes.get("/iniciativas/:iniciativaId/dossie", governancaController.consultarDossie);
routes.post("/iniciativas/:iniciativaId/dossie/fechar", governancaController.fecharDossie);
routes.post("/iniciativas/:iniciativaId/dossie/reabrir", governancaController.reabrirDossie);

module.exports = routes;
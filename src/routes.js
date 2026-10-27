const { Router } = require('express');
const iniciativaController = require('./controllers/iniciativaController');
const authController = require('./controllers/authController');
const marcoController = require('./controllers/marcoController');
const dispendioController = require('./controllers/dispendioController');
const authMiddleware = require('./Middleware/authMiddleware');

const routes = Router();

// --- Rotas Públicas ---
routes.post('/auth/register', authController.register);
routes.post('/auth/login', authController.login);
routes.get('/public/cnpj/:cnpj', iniciativaController.consultarCnpj);
routes.get('/public/github-evidencias', iniciativaController.consultarRepositorioGithub);

// --- Rotas Protegidas (Exigem Token JWT) ---
routes.use(authMiddleware); // Tudo abaixo desta linha passa a exigir autenticação!

routes.get('/elegibilidade/dashboard', iniciativaController.getDashboardElegibilidade);
routes.post('/iniciativas', iniciativaController.create);
routes.get('/iniciativas', iniciativaController.findAll);
routes.get('/iniciativas/:id', iniciativaController.findById);
routes.put('/iniciativas/:id', iniciativaController.update);
routes.delete('/iniciativas/:id', iniciativaController.delete);
routes.get('/apuracao/financeira', iniciativaController.getApuraçãoFinanceira);
routes.get('/relatorios/mcti', iniciativaController.exportarMcti);
routes.get('/iniciativas/:iniciativaId/marcos', marcoController.listarMarcos);
routes.post('/iniciativas/:iniciativaId/marcos', marcoController.criarMarco);
routes.get('/iniciativas/:iniciativaId/dispendios', dispendioController.listarDispendios);
routes.post('/iniciativas/:iniciativaId/dispendios', dispendioController.criarDispendio);

module.exports = routes;
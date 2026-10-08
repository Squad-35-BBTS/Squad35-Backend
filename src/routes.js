const { Router } = require('express');
const iniciativaController = require('./controllers/iniciativaController');
const authController = require('./controllers/authController');

const routes = Router();

// Rotas de Autenticação / Inscrição pública
routes.post('/auth/register', authController.register);
routes.post('/auth/login', authController.login);

// Rotas CRUD de Iniciativas
routes.post('/iniciativas', iniciativaController.create);
routes.get('/iniciativas', iniciativaController.findAll);
routes.get('/iniciativas/:id', iniciativaController.findById);
routes.put('/iniciativas/:id', iniciativaController.update);
routes.delete('/iniciativas/:id', iniciativaController.delete);

module.exports = routes;
const { randomBytes, createHash } = require('node:crypto');
const { setTimeout: esperar } = require('node:timers/promises');
const bcrypt = require('bcryptjs');
const f = require('../utils/financeiro');
const emailService = require('../services/email');

const resposta = { message: 'Se houver uma conta com esse e-mail, enviaremos um link para redefinir a senha. Confira também o spam.' };
const invalido = () => f.erro(400, 'Link inválido ou expirado. Solicite uma nova recuperação.');
const hash = token => createHash('sha256').update(token).digest('hex');

module.exports = {
  solicitar: f.executar(async (req, res) => {
    f.campos(req.body, ['email']);
    const email = f.texto(req.body.email, 'email').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) f.erro(400, 'Informe um e-mail válido.');
    try { emailService.configuracao(); }
    catch { f.erro(503, 'A recuperação está temporariamente indisponível. Tente novamente mais tarde.'); }
    const inicio = Date.now();
    const usuario = await f.prisma.usuario.findUnique({ where: { email } });
    let envio;
    if (usuario) {
      const token = randomBytes(32).toString('hex');
      await f.prisma.recuperacaoSenha.create({ data: {
        token_hash: hash(token), usuario_id: usuario.id_usuario, email: usuario.email,
        versao_token: usuario.versao_token, expira_em: new Date(Date.now() + 15 * 60 * 1000),
      } });
      envio = { email: usuario.email, token };
    }
    // A resposta não revela a existência da conta nem espera a conexão SMTP.
    await esperar(Math.max(0, 250 - (Date.now() - inicio)));
    res.status(202).json(resposta);
    if (envio) setImmediate(() => {
      emailService.enviarRecuperacao(envio).catch(() => {
        // Não registrar endereço, senha, token ou resposta do provedor.
        console.error('Falha no envio da recuperação de senha. Confira o serviço SMTP.');
      });
    });
  }),

  redefinir: f.executar(async (req, res) => {
    f.campos(req.body, ['token', 'nova_senha']);
    const { token, nova_senha } = req.body;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) invalido();
    if (typeof nova_senha !== 'string' || nova_senha.length < 10 || Buffer.byteLength(nova_senha, 'utf8') > 72) {
      f.erro(400, 'A nova senha deve ter pelo menos 10 caracteres e até 72 bytes.');
    }
    const token_hash = hash(token);
    const registro = await f.prisma.recuperacaoSenha.findUnique({ where: { token_hash } });
    if (!registro || registro.utilizado_em || registro.expira_em <= new Date()) invalido();
    const senha = await bcrypt.hash(nova_senha, 12);
    await f.prisma.$transaction(async db => {
      const agora = new Date();
      const consumido = await db.recuperacaoSenha.updateMany({
        where: { token_hash, utilizado_em: null, expira_em: { gt: agora } },
        data: { utilizado_em: agora },
      });
      if (consumido.count !== 1) invalido();
      const alterado = await db.usuario.updateMany({
        where: { id_usuario: registro.usuario_id, email: registro.email, versao_token: registro.versao_token },
        data: { senha, versao_token: { increment: 1 } },
      });
      if (alterado.count !== 1) invalido();
      await db.auditoria.create({ data: {
        usuario_id: registro.usuario_id, acao: 'REDEFINIR_SENHA', entidade: 'Usuario', registro_id: String(registro.usuario_id),
      } });
    });
    return res.json({ message: 'Senha redefinida. Entre com sua nova senha.' });
  }),
};

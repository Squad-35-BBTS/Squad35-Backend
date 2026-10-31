const bcrypt = require('bcryptjs');
const f = require('../utils/financeiro');

const publico = { id_usuario: true, nome: true, email: true, perfil: true };

function senha(valor, campo, nova = false) {
  if (typeof valor !== 'string' || !valor || Buffer.byteLength(valor, 'utf8') > 72 || (nova && valor.length < 10)) {
    f.erro(400, `${campo}: informe ${nova ? 'ao menos 10 caracteres e ' : ''}até 72 bytes.`);
  }
  return valor;
}

async function conferirSenha(req) {
  senha(req.body.senha_atual, 'senha_atual');
  const usuario = await f.prisma.usuario.findUnique({ where: { id_usuario: req.usuarioId } });
  if (!usuario) f.erro(401, 'Usuário não encontrado.');
  if (!(await bcrypt.compare(req.body.senha_atual, usuario.senha))) {
    f.erro(403, 'Senha atual incorreta.');
  }
  return usuario;
}

async function salvar(req, anterior, dados, acao) {
  return f.prisma.$transaction(async db => {
    // Evita gravar usando uma senha que foi alterada por outra requisição.
    const resultado = await db.usuario.updateMany({
      where: {
        id_usuario: req.usuarioId,
        senha: anterior.senha,
        versao_token: anterior.versao_token,
      },
      data: dados,
    });
    if (resultado.count !== 1) f.erro(409, 'A conta mudou durante a operação. Entre novamente.');
    await db.auditoria.create({ data: {
      usuario_id: req.usuarioId, acao, entidade: 'Usuario', registro_id: String(req.usuarioId),
    } });
    return db.usuario.findUnique({ where: { id_usuario: req.usuarioId }, select: publico });
  });
}

module.exports = {
  atualizar: f.executar(async (req, res) => {
    f.campos(req.body, ['nome', 'email', 'senha_atual']);
    const dados = {};
    if (req.body.nome !== undefined) dados.nome = f.texto(req.body.nome, 'nome');
    if (req.body.email !== undefined) {
      dados.email = f.texto(req.body.email, 'email').toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) f.erro(400, 'Informe um e-mail válido.');
    }
    if (!Object.keys(dados).length) f.erro(400, 'Informe nome ou e-mail para atualizar.');
    const anterior = await conferirSenha(req);
    const usuario = await salvar(req, anterior, dados, 'ATUALIZAR_PERFIL');
    return res.json({ usuario });
  }),

  alterarSenha: f.executar(async (req, res) => {
    f.campos(req.body, ['senha_atual', 'nova_senha']);
    const nova = senha(req.body.nova_senha, 'nova_senha', true);
    const anterior = await conferirSenha(req);
    if (await bcrypt.compare(nova, anterior.senha)) f.erro(400, 'A nova senha deve ser diferente da atual.');
    await salvar(req, anterior, {
      senha: await bcrypt.hash(nova, 12),
      versao_token: { increment: 1 },
    }, 'ALTERAR_SENHA');
    return res.json({ message: 'Senha alterada. Entre novamente em todos os dispositivos.' });
  }),
};

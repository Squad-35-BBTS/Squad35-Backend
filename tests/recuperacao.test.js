const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const bcrypt = require('bcryptjs');
process.env.JWT_SECRET = 'segredo-exclusivo-teste-recuperacao-123456789';
const senhaAntiga = 'SenhaAntiga35!';
let usuario, registros, mails, logs, failAudit;
const select = (value, fields) => !value ? null : !fields ? { ...value } : Object.fromEntries(Object.keys(fields).map(key => [key, value[key]]));
const db = {
  usuario: {
    async findUnique({ where, select: fields }) {
      return select(Object.entries(where).every(([key, value]) => usuario[key] === value) ? usuario : null, fields);
    },
    async updateMany({ where, data }) {
      if (!Object.entries(where).every(([key, value]) => usuario[key] === value)) return { count: 0 };
      usuario.senha = data.senha; usuario.versao_token += data.versao_token.increment;
      return { count: 1 };
    },
  },
  recuperacaoSenha: {
    async create({ data }) { registros.push({ utilizado_em: null, ...data }); return data; },
    async findUnique({ where }) { return registros.find(r => r.token_hash === where.token_hash) || null; },
    async updateMany({ where, data }) {
      const r = registros.find(r => r.token_hash === where.token_hash && r.utilizado_em === null && r.expira_em > where.expira_em.gt);
      if (!r) return { count: 0 }; Object.assign(r, data); return { count: 1 };
    },
  },
  auditoria: { async create({ data }) { if (failAudit) throw new Error('Falha simulada'); logs.push(data); return data; } },
};
db.$transaction = async work => {
  const backup = structuredClone({ usuario, registros, logs });
  try { return await work(db); }
  catch (error) { usuario = backup.usuario; registros = backup.registros; logs = backup.logs; throw error; }
};
const prismaPath = require.resolve('../src/services/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: db };
const email = require('../src/services/email');
email.enviarRecuperacao = async data => { mails.push(data); };
const app = require('../src/server');
let server, base;
before(async () => {
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
beforeEach(async () => {
  Object.assign(process.env, { SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587', SMTP_SECURE: 'false', SMTP_USER: 'teste', SMTP_PASSWORD: 'senha-ficticia', SMTP_FROM: 'teste@example.com', FRONTEND_URL: 'http://localhost:5173' });
  usuario = { id_usuario: 1, nome: 'QA', email: 'qa@example.com', senha: await bcrypt.hash(senhaAntiga, 4), perfil: 'Analista P&D', versao_token: 0 };
  registros = []; mails = []; logs = []; failAudit = false;
});
async function post(path, body) {
  const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
}
async function solicitar() {
  const r = await post('/auth/recuperar-senha', { email: 'qa@example.com' }); assert.equal(r.status, 202);
  for (let i = 0; i < 20 && !mails.length; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(mails.length); return mails.at(-1).token;
}
const redefinir = token => post('/auth/redefinir-senha', { token, nova_senha: 'SenhaNovaTeste35!' });

test('solicitação não expõe conta ou token e armazena apenas hash', async () => {
  const existente = await post('/auth/recuperar-senha', { email: 'QA@example.com' });
  const ausente = await post('/auth/recuperar-senha', { email: 'ausente@example.com' });
  assert.equal(existente.status, 202); assert.deepEqual(existente, ausente);
  assert.equal(mails.length, 1); assert.equal(registros.length, 1);
  assert.match(mails[0].token, /^[a-f0-9]{64}$/);
  assert.equal(registros[0].token_hash, createHash('sha256').update(mails[0].token).digest('hex'));
  assert.equal(JSON.stringify(registros).includes(mails[0].token), false);
  assert.ok(registros[0].expira_em > new Date());
});
test('sem SMTP configurado responde indisponibilidade para qualquer e-mail', async () => {
  delete process.env.SMTP_PASSWORD;
  assert.equal((await post('/auth/recuperar-senha', { email: 'qa@example.com' })).status, 503);
  assert.equal((await post('/auth/recuperar-senha', { email: 'ausente@example.com' })).status, 503);
  assert.equal(mails.length, 0);
});
test('redefinição muda hash, invalida sessões e impede reutilização do link', async () => {
  const token = await solicitar();
  assert.equal((await redefinir(token)).status, 200);
  assert.equal(await bcrypt.compare('SenhaNovaTeste35!', usuario.senha), true);
  assert.equal(usuario.versao_token, 1);
  assert.equal(logs[0].acao, 'REDEFINIR_SENHA');
  assert.equal((await redefinir(token)).status, 400);
  assert.equal((await post('/auth/login', { email: usuario.email, senha: senhaAntiga })).status, 401);
  assert.equal((await post('/auth/login', { email: usuario.email, senha: 'SenhaNovaTeste35!' })).status, 200);
});
test('link expirado, desconhecido ou malformado é recusado', async () => {
  const token = await solicitar(); registros[0].expira_em = new Date(Date.now() - 1);
  assert.equal((await redefinir(token)).status, 400);
  assert.equal((await redefinir('a'.repeat(64))).status, 400);
  assert.equal((await redefinir('invalido')).status, 400);
  assert.equal(usuario.versao_token, 0);
});
test('troca prévia de e-mail ou senha invalida recuperação pendente', async () => {
  const token = await solicitar(); usuario.email = 'outro@example.com';
  assert.equal((await redefinir(token)).status, 400);
  usuario.email = 'qa@example.com'; usuario.versao_token = 1;
  assert.equal((await redefinir(token)).status, 400);
});
test('senha fraca ou campo inesperado não consome o link', async () => {
  const token = await solicitar();
  assert.equal((await post('/auth/redefinir-senha', { token, nova_senha: 'curta' })).status, 400);
  assert.equal((await post('/auth/redefinir-senha', { token, nova_senha: 'SenhaNovaTeste35!', perfil: 'Administrador' })).status, 400);
  assert.equal(registros[0].utilizado_em, null);
});
test('falha de auditoria reverte consumo do link e alteração da senha no dublê', async () => {
  const token = await solicitar(); failAudit = true;
  assert.equal((await redefinir(token)).status, 500);
  assert.equal(registros[0].utilizado_em, null);
  assert.equal(await bcrypt.compare(senhaAntiga, usuario.senha), true);
  assert.equal(usuario.versao_token, 0);
});
test('limite por IP retorna 429 e não chama a operação excedente', () => {
  const limit = require('../src/Middleware/limiteRecuperacao')(2);
  const req = { ip: '127.0.0.1' };
  let called = 0;
  const res = { statusCode: 200, setHeader() {}, status(n) { this.statusCode = n; return this; }, json() { return this; } };
  for (let i = 0; i < 3; i++) limit(req, res, () => called++);
  assert.equal(called, 2); assert.equal(res.statusCode, 429);
});

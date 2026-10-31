const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'segredo-exclusivo-dos-testes-perfil-123456789';
let usuarios, logs, falharAuditoria;
const senhaInicial = 'SenhaInicial35!';
const publico = (user, select) => !user ? null : !select ? { ...user } : Object.fromEntries(Object.keys(select).filter(key => select[key]).map(key => [key, user[key]]));
const db = {
  usuario: {
    async findUnique({ where, select }) {
      return publico(usuarios.find(user => Object.entries(where).every(([key, value]) => user[key] === value)), select);
    },
    async updateMany({ where, data }) {
      const user = usuarios.find(user => Object.entries(where).every(([key, value]) => user[key] === value));
      if (!user) return { count: 0 };
      if (data.email && usuarios.some(item => item.id_usuario !== user.id_usuario && item.email === data.email)) {
        throw Object.assign(new Error('Duplicado'), { code: 'P2002' });
      }
      for (const [key, value] of Object.entries(data)) user[key] = value && typeof value === 'object' ? user[key] + value.increment : value;
      return { count: 1 };
    },
  },
  auditoria: { async create({ data }) {
    if (falharAuditoria) throw new Error('Falha simulada');
    logs.push({ ...data }); return data;
  } },
};
db.$transaction = async callback => {
  const snapshot = structuredClone({ usuarios, logs });
  try { return await callback(db); }
  catch (error) { usuarios = snapshot.usuarios; logs = snapshot.logs; throw error; }
};
const prismaPath = require.resolve('../src/services/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: db };
const app = require('../src/server');
let server, base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
beforeEach(async () => {
  usuarios = [
    { id_usuario: 1, nome: 'Pessoa QA', email: 'qa@example.com', senha: await bcrypt.hash(senhaInicial, 4), perfil: 'Analista P&D', versao_token: 0 },
    { id_usuario: 2, nome: 'Outra pessoa', email: 'outro@example.com', senha: 'hash-ficticio', perfil: 'Administrador', versao_token: 0 },
  ]; logs = []; falharAuditoria = false;
});
const token = (version = 0) => jwt.sign({ id_usuario: 1, versao_token: version }, process.env.JWT_SECRET);
async function request(path, method = 'GET', body, credential = token()) {
  const result = await fetch(base + path, { method, headers: {
    'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: result.status, body: await result.json() };
}

test('perfil exige autenticação', async () => {
  assert.equal((await request('/auth/me', 'PUT', { nome: 'Outro' }, null)).status, 401);
});
test('perfil altera apenas a própria conta e normaliza e-mail sem expor hash', async () => {
  const result = await request('/auth/me', 'PUT', { nome: '  Nome novo  ', email: ' NOVO@example.com ', senha_atual: senhaInicial });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.usuario, { id_usuario: 1, nome: 'Nome novo', email: 'novo@example.com', perfil: 'Analista P&D' });
  assert.equal(usuarios[1].nome, 'Outra pessoa');
  assert.equal(logs[0].acao, 'ATUALIZAR_PERFIL');
  assert.equal(JSON.stringify(logs).includes(senhaInicial), false);
});
test('perfil recusa senha atual incorreta sem alterar dados', async () => {
  assert.equal((await request('/auth/me', 'PUT', { nome: 'Indevido', senha_atual: 'errada' })).status, 403);
  assert.equal(usuarios[0].nome, 'Pessoa QA'); assert.equal(logs.length, 0);
});
test('perfil recusa privilégio, ID, e-mail inválido e corpo sem alteração', async () => {
  for (const body of [{ perfil: 'Administrador' }, { id_usuario: 2 }, { nome: ' ' }, { email: 'invalido' }, { senha_atual: senhaInicial }]) {
    assert.equal((await request('/auth/me', 'PUT', { senha_atual: senhaInicial, ...body })).status, 400);
  }
  assert.equal(usuarios[0].perfil, 'Analista P&D');
});
test('perfil recusa e-mail já utilizado e preserva a conta', async () => {
  assert.equal((await request('/auth/me', 'PUT', { email: 'outro@example.com', senha_atual: senhaInicial })).status, 409);
  assert.equal(usuarios[0].email, 'qa@example.com');
});
test('troca de senha usa hash, audita e invalida tokens anteriores', async () => {
  const antiga = token();
  const result = await request('/auth/me/senha', 'PUT', { senha_atual: senhaInicial, nova_senha: 'SenhaNovaTeste35!' }, antiga);
  assert.equal(result.status, 200);
  assert.notEqual(usuarios[0].senha, 'SenhaNovaTeste35!');
  assert.equal(await bcrypt.compare('SenhaNovaTeste35!', usuarios[0].senha), true);
  assert.equal(usuarios[0].versao_token, 1);
  assert.equal(logs[0].acao, 'ALTERAR_SENHA');
  assert.equal((await request('/auth/me', 'GET', undefined, antiga)).status, 401);
  const legado = jwt.sign({ id_usuario: 1 }, process.env.JWT_SECRET);
  assert.equal((await request('/auth/me', 'GET', undefined, legado)).status, 401);
  const login = await request('/auth/login', 'POST', { email: 'qa@example.com', senha: 'SenhaNovaTeste35!' }, null);
  assert.equal(login.status, 200);
  assert.equal(jwt.verify(login.body.token, process.env.JWT_SECRET).versao_token, 1);
  assert.equal((await request('/auth/me', 'GET', undefined, login.body.token)).status, 200);
  assert.equal((await request('/auth/login', 'POST', { email: 'qa@example.com', senha: senhaInicial }, null)).status, 401);
});
test('troca de senha recusa senha errada, curta, igual e acima de 72 bytes', async () => {
  for (const [senha_atual, nova_senha, status] of [
    ['errada', 'SenhaNovaTeste35!', 403], [senhaInicial, 'curta', 400],
    [senhaInicial, senhaInicial, 400], [senhaInicial, 'á'.repeat(37), 400],
  ]) assert.equal((await request('/auth/me/senha', 'PUT', { senha_atual, nova_senha })).status, status);
  assert.equal(usuarios[0].versao_token, 0);
});
test('falha de auditoria reverte perfil no dublê', async () => {
  falharAuditoria = true;
  assert.equal((await request('/auth/me', 'PUT', { nome: 'Alterado', senha_atual: senhaInicial })).status, 500);
  assert.equal(usuarios[0].nome, 'Pessoa QA'); assert.equal(logs.length, 0);
});
test('falha de auditoria reverte senha e versão no dublê', async () => {
  falharAuditoria = true;
  assert.equal((await request('/auth/me/senha', 'PUT', { senha_atual: senhaInicial, nova_senha: 'SenhaNovaTeste35!' })).status, 500);
  assert.equal(await bcrypt.compare(senhaInicial, usuarios[0].senha), true);
  assert.equal(usuarios[0].versao_token, 0);
});
test('seed cria gestor com hash sem remover dados e preserva usuário existente', async () => {
  process.env.SEED_USER_NAME = 'Gestor inicial';
  process.env.SEED_USER_EMAIL = 'gestor@example.com';
  process.env.SEED_USER_PASSWORD = 'SenhaInicial35!';
  const seed = require('../prisma/seed');
  const dados = [];
  const fake = { usuario: {
    findUnique: async () => dados[0] || null,
    create: async ({ data }) => { dados.push(data); return data; },
  } };
  await seed(fake); await seed(fake);
  assert.equal(dados.length, 1);
  assert.equal(await bcrypt.compare('SenhaInicial35!', dados[0].senha), true);
  assert.equal(dados[0].perfil, 'Gestor P&D / Lei do Bem');
  process.env.SEED_USER_PASSWORD = '';
  await assert.rejects(() => seed(fake), /Configure SEED/);
});

const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'segredo-exclusivo-testes-consultas-123456789';
let result, failure, calls;
const axiosPath = require.resolve('axios');
require.cache[axiosPath] = { id: axiosPath, filename: axiosPath, loaded: true, exports: {
  isAxiosError: error => error?.isAxiosError === true,
  get: async (...args) => { calls.push(args); if (failure) throw failure; return { data: result }; },
} };
const prismaPath = require.resolve('../src/services/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: {} };
const app = require('../src/server');
let server, base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
beforeEach(() => { result = null; failure = null; calls = []; });
async function get(path) {
  const response = await fetch(base + path);
  return { status: response.status, body: await response.json() };
}
test('consulta cadastral pública não declara elegibilidade fiscal', async () => {
  result = { razao_social: 'Empresa QA', cnae_fiscal: 6201501, cnae_fiscal_descricao: 'Software' };
  const response = await get('/public/cnpj/00000000000191');
  assert.equal(response.status, 200);
  assert.equal(response.body.razao_social, 'Empresa QA');
  assert.equal(response.body.elegivel_lei_do_bem, null);
  assert.equal(calls[0][1].timeout, 8000);
});
test('consulta GitHub retorna somente os dados previstos e pede cinco commits', async () => {
  result = [{ sha: 'abc123', commit: { author: { name: 'QA', date: '2026-10-31T12:00:00Z' }, message: 'Teste' }, campo_privado: 'oculto' }];
  const response = await get('/public/github-evidencias?owner=squad&repo=projeto');
  assert.equal(response.status, 200);
  assert.equal(response.body.repositorio, 'squad/projeto');
  assert.equal(calls[0][1].params.per_page, 5);
  assert.equal(JSON.stringify(response.body).includes('oculto'), false);
});
test('consultas recusam parâmetros inválidos antes de chamar o serviço', async () => {
  assert.equal((await get('/public/cnpj/123')).status, 400);
  assert.equal((await get('/public/github-evidencias?owner=squad&repo=..')).status, 400);
  assert.equal(calls.length, 0);
});
test('falhas externas retornam status e mensagem sem expor resposta interna', async () => {
  for (const [status, expected] of [[404,404],[429,429],[500,502],[401,502]]) {
    failure = { isAxiosError: true, response: { status, data: 'detalhe-interno' }, message: 'segredo-interno' };
    const response = await get('/public/cnpj/00000000000191');
    assert.equal(response.status, expected);
    assert.equal(JSON.stringify(response.body).includes('interno'), false);
  }
});
test('timeout externo retorna 504 e indisponibilidade retorna 502', async () => {
  failure = { isAxiosError: true, code: 'ECONNABORTED' };
  assert.equal((await get('/public/cnpj/00000000000191')).status, 504);
  failure = { isAxiosError: true, code: 'ENOTFOUND' };
  assert.equal((await get('/public/cnpj/00000000000191')).status, 502);
});

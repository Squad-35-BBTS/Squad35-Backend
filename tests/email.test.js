const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let options, sent;
const caminho = require.resolve('nodemailer');
require.cache[caminho] = { id: caminho, filename: caminho, loaded: true, exports: {
  createTransport(value) { options = value; return { async sendMail(message) { sent = message; } }; },
} };

const email = require('../src/services/email');
beforeEach(() => {
  Object.assign(process.env, { SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587', SMTP_SECURE: 'false', SMTP_USER: 'qa', SMTP_PASSWORD: 'segredo-ficticio', SMTP_FROM: 'qa@example.com', FRONTEND_URL: 'http://localhost:5173' });
  options = null; sent = null;
});

test('SMTP exige STARTTLS na porta 587 e envia link pelo endereço configurado', async () => {
  const token = 'a'.repeat(64);
  await email.enviarRecuperacao({ email: 'destino@example.com', token });
  assert.equal(options.secure, false); assert.equal(options.requireTLS, true);
  assert.equal(sent.to, 'destino@example.com');
  assert.ok(sent.text.includes(`http://localhost:5173/#redefinir-senha=${token}`));
  assert.equal(sent.html, undefined);
});

test('SMTP com TLS direto utiliza configuração segura', () => {
  process.env.SMTP_PORT = '465'; process.env.SMTP_SECURE = 'true';
  assert.equal(email.configuracao().secure, true);
});

test('configuração recusa URL insegura externa, credencial ausente e remetente com quebra de linha', () => {
  process.env.FRONTEND_URL = 'http://example.com'; assert.throws(() => email.configuracao());
  process.env.FRONTEND_URL = 'http://localhost:5173'; process.env.SMTP_FROM = 'x@example.com\r\nBcc: y@example.com';
  assert.throws(() => email.configuracao());
  process.env.SMTP_FROM = 'x@example.com'; delete process.env.SMTP_PASSWORD;
  assert.throws(() => email.configuracao());
});

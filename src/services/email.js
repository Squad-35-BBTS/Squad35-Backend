const nodemailer = require('nodemailer');

function configuracao() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, FRONTEND_URL } = process.env;
  const port = Number(SMTP_PORT || 587);
  let base;
  try { base = new URL(FRONTEND_URL); } catch { throw new Error('EMAIL_CONFIG'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM || /[\r\n]/.test(SMTP_FROM) ||
      !Number.isInteger(port) || port < 1 || port > 65535 ||
      (base.protocol !== 'https:' && !(local && base.protocol === 'http:' && process.env.NODE_ENV !== 'production')) ||
      base.username || base.password || base.search || base.hash ||
      (SMTP_SECURE !== undefined && !['true', 'false'].includes(SMTP_SECURE))) {
    throw new Error('EMAIL_CONFIG');
  }
  const secure = SMTP_SECURE === undefined ? port === 465 : SMTP_SECURE === 'true';
  return { host: SMTP_HOST, port, secure, user: SMTP_USER, password: SMTP_PASSWORD, from: SMTP_FROM, base };
}

module.exports = {
  configuracao,
  async enviarRecuperacao({ email, token }) {
    const config = configuracao();
    const transport = nodemailer.createTransport({
      host: config.host, port: config.port, secure: config.secure,
      requireTLS: !config.secure,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      disableFileAccess: true, disableUrlAccess: true,
    });
    const link = new URL(config.base);
    link.hash = `redefinir-senha=${token}`;
    await transport.sendMail({
      from: config.from, to: email, subject: 'Redefinição de senha — SGA-LB',
      text: `Recebemos uma solicitação para redefinir a senha da sua conta SGA-LB.\n\nAcesse o link abaixo em até 15 minutos:\n${link.href}\n\nSe você não solicitou, ignore esta mensagem. Sua senha continua a mesma.\nNão compartilhe este link.`,
    });
  },
};

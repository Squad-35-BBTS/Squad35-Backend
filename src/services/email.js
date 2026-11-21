const nodemailer = require("nodemailer");

function configuracao() {
  const provider = (
    process.env.EMAIL_PROVIDER || "smtp"
  ).trim().toLowerCase();

  let base;

  try {
    base = new URL(process.env.FRONTEND_URL);
  } catch {
    throw new Error("EMAIL_CONFIG");
  }

  const local = [
    "localhost",
    "127.0.0.1",
    "[::1]",
  ].includes(base.hostname);

  const protocoloPermitido =
    base.protocol === "https:" ||
    (
      local &&
      base.protocol === "http:" &&
      process.env.NODE_ENV !== "production"
    );

  if (
    !protocoloPermitido ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  ) {
    throw new Error("EMAIL_CONFIG");
  }

  const from =
    process.env.EMAIL_FROM || process.env.SMTP_FROM;

  if (!from || /[\r\n]/.test(from)) {
    throw new Error("EMAIL_CONFIG");
  }

  if (provider === "brevo") {
    const key = process.env.BREVO_API_KEY?.trim();

    const match = from.trim().match(
      /^(?:([^<>]+)\s*<([^<>]+)>|([^<>]+))$/
    );

    const senderEmail = (
      match?.[2] || match?.[3] || ""
    ).trim();

    const senderName = (
      process.env.EMAIL_FROM_NAME ||
      match?.[1] ||
      "SGA — Lei do Bem"
    ).trim();

    const emailValido =
      /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(
        senderEmail
      );

    if (
      !key ||
      /\s/.test(key) ||
      !emailValido ||
      !senderName ||
      /[\r\n]/.test(senderName)
    ) {
      throw new Error("EMAIL_CONFIG");
    }

    return {
      provider,
      base,
      from,
      key,
      sender: {
        name: senderName,
        email: senderEmail,
      },
    };
  }

  if (provider === "resend") {
    const key = process.env.RESEND_API_KEY;

    if (!key || /\s/.test(key)) {
      throw new Error("EMAIL_CONFIG");
    }

    return {
      provider,
      base,
      from,
      key,
    };
  }

  if (provider !== "smtp") {
    throw new Error("EMAIL_CONFIG");
  }

  const {
    SMTP_HOST: host,
    SMTP_USER: user,
    SMTP_PASSWORD: password,
    SMTP_SECURE,
  } = process.env;

  const port = Number(process.env.SMTP_PORT || 587);

  if (
    !host ||
    !user ||
    !password ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    (
      SMTP_SECURE !== undefined &&
      !["true", "false"].includes(SMTP_SECURE)
    )
  ) {
    throw new Error("EMAIL_CONFIG");
  }

  return {
    provider,
    base,
    from,
    host,
    user,
    password,
    port,
    secure:
      SMTP_SECURE === undefined
        ? port === 465
        : SMTP_SECURE === "true",
  };
}

async function enviarRecuperacao({ email, token }) {
  const config = configuracao();

  const link = new URL(config.base);
  link.hash = `redefinir-senha=${token}`;

  const message = {
    from: config.from,
    to: email,
    subject: "Redefinição de senha — SGA-LB",
    text: [
      "Recebemos uma solicitação para redefinir a senha da sua conta SGA-LB.",
      "",
      "Acesse o link abaixo em até 15 minutos:",
      link.href,
      "",
      "Se você não solicitou, ignore esta mensagem. Sua senha continua a mesma.",
      "Não compartilhe este link.",
    ].join("\n"),
  };

  if (config.provider === "brevo") {
    try {
      const response = await fetch(
        "https://api.brevo.com/v3/smtp/email",
        {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: {
            "api-key": config.key,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            sender: config.sender,
            to: [{ email }],
            subject: message.subject,
            textContent: message.text,
          }),
        }
      );

      if (!response.ok) {
        // Registra somente o status, sem chave ou dados pessoais.
        console.error(
          "Falha na API de e-mail: Brevo, HTTP",
          response.status
        );

        throw new Error("EMAIL_SEND");
      }
    } catch {
      throw new Error("EMAIL_SEND");
    }

    return;
  }

  if (config.provider === "resend") {
    const response = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${config.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...message,
          to: [email],
        }),
      }
    );

    if (!response.ok) {
      throw new Error("EMAIL_SEND");
    }

    return;
  }

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });

  await transport.sendMail(message);
}

module.exports = {
  configuracao,
  enviarRecuperacao,
};
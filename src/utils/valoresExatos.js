function centesimos(valor) {
  const texto = String(valor ?? "0");

  if (!/^\d+(\.\d{1,2})?$/.test(texto)) {
    throw new Error(
      "Valor decimal inválido nos registros."
    );
  }

  const [inteiro, fracao = ""] = texto.split(".");

  return (
    BigInt(inteiro) * 100n +
    BigInt(fracao.padEnd(2, "0"))
  );
}

function formatar(valor) {
  const inteiro = valor / 100n;

  const fracao = String(
    valor % 100n
  ).padStart(2, "0");

  return `${inteiro}.${fracao}`;
}

function somar(registros, campo) {
  const total = registros.reduce(
    (acumulado, registro) =>
      acumulado + centesimos(registro[campo]),
    0n
  );

  return formatar(total);
}

function aprovado(timesheet) {
  return (
    timesheet.status === "Aprovado pelo Gestor" &&
    Boolean(
      timesheet.aprovado_em &&
      timesheet.aprovado_por_id &&
      timesheet.justificativa?.trim()
    )
  );
}

module.exports = {
  centesimos,
  formatar,
  somar,
  aprovado,
};
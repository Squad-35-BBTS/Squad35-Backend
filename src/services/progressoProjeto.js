// Mesmas cinco etapas exibidas em PortfolioProgress no frontend.
function etapasPendentes(projeto) {
  const marcos = projeto.marcos || [];
  const horas = projeto.timesheets || [];
  const etapas = [
    ["Mapeamento", Boolean(
      projeto.nome?.trim() && projeto.descricao?.trim() &&
      projeto.ano_base && projeto.barreira_incerteza?.trim()
    )],
    ["Marcos", marcos.length > 0 && marcos.every(marco =>
      marco.status_validacao === "Validado" &&
      marco.validado_em && marco.validado_por_id
    )],
    ["Evidências", marcos.length > 0 && marcos.every(marco =>
      marco.evidencias.length > 0 && marco.evidencias.every(evidencia =>
        evidencia.status === "Validado" &&
        evidencia.validado_em && evidencia.validado_por_id
      )
    )],
    ["Dedicação de pessoas", horas.length > 0 && horas.every(hora =>
      hora.status === "Aprovado pelo Gestor" &&
      hora.justificativa?.trim() && hora.aprovado_em && hora.aprovado_por_id &&
      new Date(hora.data).getUTCFullYear() === projeto.ano_base
    )],
    ["Dossiê", projeto.status_dossie === "Fechado"],
  ];
  return etapas.filter(([, concluida]) => !concluida).map(([nome]) => nome);
}

module.exports = { etapasPendentes };

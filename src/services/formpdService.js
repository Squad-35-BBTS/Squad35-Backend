const {
  centesimos: decimal,
  formatar,
  somar,
  aprovado,
} = require("../utils/valoresExatos");

const {
  TECNICOS,
  ANUAIS,
} = require("./preparacaoFormpd");

const REFERENCIA = {
  formulario: "FORMP&D — MCTI",
  guia: "Guia do Usuário v.1.1 — 2026",
  ano_base_documentado: 2025,
  url: "https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/lei-do-bem/paginas/materiais-e-orientacoes-da-lei-do-bem/guia_do_usuario_formpd_v1-1_2026-1.pdf/@@download/file",
};

function dataISO(valor) {
  return valor
    ? new Date(valor).toISOString().slice(0, 10)
    : null;
}

function doAno(registro, ano) {
  return (
    registro.data &&
    new Date(registro.data).getUTCFullYear() === ano
  );
}

function preenchido(valor) {
  return (
    valor !== null &&
    valor !== undefined &&
    valor !== ""
  );
}

function selecionar(objeto, campos) {
  return Object.fromEntries(
    campos.map((campo) => [
      campo,
      objeto[campo] ?? null,
    ])
  );
}

function atividade(projeto, ano) {
  const horas = (
    projeto.timesheets || []
  ).filter((item) => doAno(item, ano));

  const despesas = (
    projeto.dispendios || []
  ).filter((item) => doAno(item, ano));

  const complemento =
    projeto.preparacao_formpd?.ano_base === ano
      ? projeto.preparacao_formpd.dados
      : {};

  const pendencias = [];
  const acoes = [];

  const rotulos = {
    objetivos:
      "Informar os objetivos do projeto.",

    categoria_predominante_formpd:
      "Confirmar a categoria predominante no FORMP&D.",

    area_predominante_formpd:
      "Informar a área predominante do projeto.",

    palavras_chave:
      "Informar palavras-chave.",

    natureza_predominante:
      "Informar a natureza predominante.",

    elemento_inovador:
      "Informar o elemento tecnologicamente novo ou inovador.",

    metodologia:
      "Informar a metodologia e os métodos empregados.",

    justificativa_trl:
      "Justificar o TRL inicial e final.",

    trl_final_ano_base_confirmado:
      "Confirmar o TRL final do ano-base.",

    resultado_inovacao:
      "Informar os resultados de inovação do ano-base.",

    resultado_economico:
      "Informar os resultados econômicos do ano-base.",

    projeto_plurianual:
      "Avaliar se o projeto é plurianual.",

    atividades_desenvolvidas_no_ano_base:
      "Descrever as atividades desenvolvidas no exercício.",
  };

  for (
    const campo of Object.keys(TECNICOS)
  ) {
    if (
      !preenchido(complemento[campo])
    ) {
      pendencias.push(rotulos[campo]);

      acoes.push({
        mensagem: rotulos[campo],
        destino: "complemento",
        campo,
      });
    }
  }

  const rubricas =
    complemento.rubricas || [];

  const despesasSemClassificacao =
    despesas.some(
      (despesa) =>
        !rubricas.some(
          (rubrica) =>
            rubrica.id_dispendio ===
              despesa.id_dispendio &&
            rubrica.rubrica &&
            rubrica.fonte_financiamento
        )
    );

  if (despesasSemClassificacao) {
    pendencias.push(
      "Classificar as rubricas e fontes de financiamento dos dispêndios."
    );

    acoes.push({
      mensagem: pendencias.at(-1),
      destino: "complemento_financeiro",
    });
  }

  const profissionais =
    complemento.profissionais || [];

  const profissionaisIncompletos =
    horas.some(
      (timesheet) =>
        !profissionais.some(
          (profissional) =>
            profissional.colaborador_id ===
              timesheet.colaborador_id &&
            profissional.cpf &&
            profissional.sexo &&
            profissional.titulacao &&
            profissional.funcao_projeto_formpd &&
            profissional.dedicacao_formpd &&
            preenchido(
              profissional.horas_trabalhadas_ano_profissional
            ) &&
            preenchido(
              profissional.valor_total_pago_profissional
            )
        )
    );

  if (profissionaisIncompletos) {
    pendencias.push(
      "Completar a identificação funcional e os dados anuais dos profissionais."
    );

    acoes.push({
      mensagem: pendencias.at(-1),
      destino: "complemento_financeiro",
    });
  }

  if (!projeto.descricao?.trim()) {
    pendencias.push(
      "Preencher a descrição do projeto."
    );
  }

  if (
    !projeto.barreira_incerteza?.trim()
  ) {
    pendencias.push(
      "Descrever a barreira ou desafio tecnológico."
    );
  }

  if (projeto.nome.length > 150) {
    pendencias.push(
      "Revisar título: o guia de referência indica limite de 150 caracteres."
    );
  }

  if (
    (projeto.descricao || "").length > 3000
  ) {
    pendencias.push(
      "Revisar descrição: o guia de referência indica limite de 3000 caracteres."
    );
  }

  if (
    (projeto.barreira_incerteza || "").length >
    1500
  ) {
    pendencias.push(
      "Revisar barreira: o guia de referência indica limite de 1500 caracteres."
    );
  }

  if (
    projeto.score_trl <
    projeto.trl_inicial
  ) {
    pendencias.push(
      "TRL atual registrado é inferior ao inicial; revisar os dados."
    );
  }

  if (
    complemento.trl_final_ano_base_confirmado != null &&
    complemento.trl_final_ano_base_confirmado <
      projeto.trl_inicial
  ) {
    pendencias.push(
      "TRL final confirmado é inferior ao inicial; revisar a justificativa."
    );

    acoes.push({
      mensagem: pendencias.at(-1),
      destino: "complemento",
      campo: "justificativa_trl",
    });
  }

  if (
    complemento.projeto_plurianual === true &&
    (
      !projeto.data_inicio ||
      !projeto.data_fim
    )
  ) {
    pendencias.push(
      "Projeto plurianual: preencher início e previsão de término no cadastro do projeto."
    );
  }

  for (
    const profissional of profissionais
  ) {
    const registros = horas.filter(
      (item) =>
        item.colaborador_id ===
        profissional.colaborador_id
    );

    const jornadaAnual =
      profissional.horas_trabalhadas_ano_profissional;

    if (
      jornadaAnual != null &&
      decimal(jornadaAnual) <
        decimal(
          somar(registros, "horas_mes")
        )
    ) {
      pendencias.push(
        `Profissional ${profissional.colaborador_id}: jornada anual inferior às horas lançadas no projeto.`
      );

      acoes.push({
        mensagem: pendencias.at(-1),
        destino: "complemento_financeiro",
      });
    }

    const remuneracaoAnual =
      profissional.valor_total_pago_profissional;

    if (
      remuneracaoAnual != null &&
      decimal(remuneracaoAnual) <
        decimal(
          somar(
            registros,
            "custo_apropriado"
          )
        )
    ) {
      pendencias.push(
        `Profissional ${profissional.colaborador_id}: remuneração anual inferior ao custo apropriado no projeto.`
      );

      acoes.push({
        mensagem: pendencias.at(-1),
        destino: "complemento_financeiro",
      });
    }
  }

  if (
    horas.some(
      (item) => !aprovado(item)
    )
  ) {
    pendencias.push(
      "Existem horas sem aprovação completa ou justificativa."
    );
  }

  if (
    despesas.some(
      (item) =>
        !item.documento_comprobatorio?.trim()
    )
  ) {
    pendencias.push(
      "Existem dispêndios sem referência documental."
    );
  }

  const marcos = (
    projeto.marcos || []
  ).map((marco) => ({
    ...selecionar(marco, [
      "id_marco",
      "titulo",
      "periodo",
      "descricao",
      "status_validacao",
      "validado_em",
      "validado_por_id",
    ]),

    evidencias: (
      marco.evidencias || []
    ).map((item) =>
      selecionar(item, [
        "id_evidencia",
        "nome",
        "mime_type",
        "sha256",
        "tamanho_bytes",
        "status",
        "criado_em",
        "validado_em",
        "validado_por_id",
      ])
    ),
  }));

  if (!marcos.length) {
    pendencias.push(
      "Nenhum marco experimental cadastrado."
    );
  }

  const validacaoIncompleta =
    marcos.some(
      (marco) =>
        marco.status_validacao !== "Validado" ||
        !marco.validado_em ||
        !marco.validado_por_id ||
        !marco.evidencias.length ||
        marco.evidencias.some(
          (evidencia) =>
            evidencia.status !== "Validado" ||
            !evidencia.validado_em ||
            !evidencia.validado_por_id
        )
    );

  if (validacaoIncompleta) {
    pendencias.push(
      "Revisar marcos e evidências sem validação completa."
    );
  }

  const outrasAcoes =
    pendencias
      .filter(
        (mensagem) =>
          !acoes.some(
            (acao) =>
              acao.mensagem === mensagem
          )
      )
      .map((mensagem) => ({
        mensagem,

        destino:
          mensagem.includes("horas") ||
          mensagem.includes("dispêndios")
            ? "financeiro"
            : mensagem.includes("marco") ||
                mensagem.includes("evidência")
              ? "evidencias"
              : "projetos",
      }));

  return {
    id_iniciativa:
      projeto.id_iniciativa,

    codigo_interno:
      projeto.codigo,

    revisao:
      projeto.revisao,

    status_dossie:
      projeto.status_dossie,

    titulo:
      projeto.nome,

    descricao:
      projeto.descricao,

    objetivos:
      complemento.objetivos ?? null,

    classificacao_registrada:
      projeto.classificacao_pd,

    categoria_predominante_formpd:
      complemento.categoria_predominante_formpd ??
      null,

    area_predominante_formpd:
      complemento.area_predominante_formpd ??
      null,

    palavras_chave:
      complemento.palavras_chave ?? null,

    natureza_predominante:
      complemento.natureza_predominante ??
      null,

    trl_inicial_registrado:
      projeto.trl_inicial,

    trl_atual_registrado:
      projeto.score_trl,

    trl_final_ano_base_confirmado:
      complemento.trl_final_ano_base_confirmado ??
      null,

    justificativa_trl:
      complemento.justificativa_trl ?? null,

    elemento_inovador:
      complemento.elemento_inovador ?? null,

    barreira_tecnologica:
      projeto.barreira_incerteza,

    metodologia:
      complemento.metodologia ?? null,

    resultado_inovacao:
      complemento.resultado_inovacao ?? null,

    resultado_economico:
      complemento.resultado_economico ?? null,

    projeto_plurianual:
      complemento.projeto_plurianual ?? null,

    atividades_desenvolvidas_no_ano_base:
      complemento.atividades_desenvolvidas_no_ano_base ??
      null,

    data_inicio_registrada:
      dataISO(projeto.data_inicio),

    previsao_termino_registrada:
      dataISO(projeto.data_fim),

    responsavel_interno:
      projeto.usuario_responsavel
        ? selecionar(
            projeto.usuario_responsavel,
            ["id_usuario", "nome"]
          )
        : null,

    recursos_humanos:
      horas.map((item) => {
        const profissional =
          profissionais.find(
            (registro) =>
              registro.colaborador_id ===
              item.colaborador_id
          ) || {};

        return {
          ...selecionar(item, [
            "id_timesheet",
            "colaborador_id",
            "colaborador_nome",
            "cargo_regime",
            "justificativa",
            "status",
            "aprovado_em",
            "aprovado_por_id",
          ]),

          data: dataISO(item.data),

          horas: formatar(
            decimal(item.horas_mes)
          ),

          custo_apropriado_registrado:
            formatar(
              decimal(
                item.custo_apropriado
              )
            ),

          ...selecionar(profissional, [
            "cpf",
            "sexo",
            "titulacao",
            "funcao_projeto_formpd",
            "horas_trabalhadas_ano_profissional",
            "valor_total_pago_profissional",
            "dedicacao_formpd",
          ]),

          observacao:
            "Lançamento de timesheet; não equivale à declaração anual completa do profissional.",
        };
      }),

    dispendios:
      despesas.map((item) => {
        const rubrica =
          rubricas.find(
            (registro) =>
              registro.id_dispendio ===
              item.id_dispendio
          );

        return {
          ...selecionar(item, [
            "id_dispendio",
            "descricao",
            "categoria",
            "documento_comprobatorio",
          ]),

          data: dataISO(item.data),

          valor: formatar(
            decimal(item.valor)
          ),

          rubrica_formpd_confirmada:
            rubrica?.rubrica || null,

          fonte_financiamento:
            rubrica?.fonte_financiamento ||
            null,
        };
      }),

    resumo_interno: {
      horas_registradas:
        somar(horas, "horas_mes"),

      horas_com_aprovacao_completa:
        somar(
          horas.filter(aprovado),
          "horas_mes"
        ),

      custos_pessoal_registrados:
        somar(
          horas,
          "custo_apropriado"
        ),

      custos_pessoal_com_aprovacao_completa:
        somar(
          horas.filter(aprovado),
          "custo_apropriado"
        ),

      dispendios_registrados:
        somar(despesas, "valor"),
    },

    marcos,

    pareceres_internos:
      (projeto.pareceres || []).map(
        (item) =>
          selecionar(item, [
            "id_parecer",
            "autor_id",
            "revisao_projeto",
            "conclusao",
            "conteudo",
            "criado_em",
          ])
      ),

    alertas_internos:
      (projeto.alertas || []).map(
        (item) =>
          selecionar(item, [
            "id_alerta",
            "titulo",
            "descricao",
            "severidade",
            "status",
            "resolucao",
          ])
      ),

    pendencias_preparacao:
      pendencias,

    pendencias_acoes: [
      ...acoes,
      ...outrasAcoes,
    ],

    completude_tecnica: {
      preenchidos:
        Object.keys(TECNICOS).filter(
          (campo) =>
            preenchido(
              complemento[campo]
            )
        ).length,

      total:
        Object.keys(TECNICOS).length,
    },

    complemento_financeiro: {
      rubricas,
      profissionais,
    },
  };
}

function gerarDossie({
  anoBase,
  projetos,
  empresa = {},
  preparacao = {},
  usuario,
  agora = new Date(),
}) {
  empresa = {
    ...empresa,
    ...preparacao,
  };

  const atividades = projetos
    .filter(
      (projeto) =>
        projeto.ano_base === anoBase
    )
    .map(
      (projeto) =>
        atividade(projeto, anoBase)
    );

  const pendencias = [];

  const camposEmpresa = [
    "tipo_empresa",
    "situacao_empresa",
    "origem_capital",
    "receita_operacional_bruta",
    "receita_liquida",
    "total_funcionarios",
    "prejuizo_fiscal",
    "estrutura_pd",
  ];

  if (
    camposEmpresa.some(
      (campo) =>
        !preenchido(empresa[campo])
    )
  ) {
    pendencias.push(
      "Completar as características anuais da empresa."
    );
  }

  if (!empresa.fontes_financiamento) {
    pendencias.push(
      "Informar as fontes de financiamento do exercício."
    );
  }

  for (
    const [campo, titulo] of [
      [
        "pesquisador_exclusivo",
        "Pesquisador Exclusivo",
      ],
      ["artigo_19a", "Art. 19-A"],
    ]
  ) {
    if (
      !empresa[`${campo}_aplicabilidade`] ||
      !empresa[`${campo}_detalhes`]
    ) {
      pendencias.push(
        `Avaliar e justificar a aplicabilidade de ${titulo}.`
      );
    }
  }

  if (
    !empresa.incentivos_fiscais_detalhes ||
    !preenchido(
      empresa.valor_incentivo_informado
    )
  ) {
    pendencias.push(
      "Preencher e revisar os incentivos fiscais com o responsável pela apuração."
    );
  }

  if (
    !empresa.aperfeicoamento_lei_do_bem
  ) {
    pendencias.push(
      "Registrar as observações de aperfeiçoamento ou justificar a ausência."
    );
  }

  if (
    !empresa.modelo_referencia_conferido
  ) {
    pendencias.push(
      "Conferir a versão e as regras do sistema oficial antes da entrega."
    );
  }

  if (!empresa.razao_social) {
    pendencias.push(
      "Informar a razão social da empresa."
    );
  }

  if (!empresa.cnpj) {
    pendencias.push(
      "Informar o CNPJ da empresa."
    );
  }

  if (!atividades.length) {
    pendencias.push(
      "Nenhum projeto cadastrado para o ano-base selecionado."
    );
  }

  if (
    anoBase !==
    REFERENCIA.ano_base_documentado
  ) {
    pendencias.push(
      `O guia consultado documenta o ano-base ${REFERENCIA.ano_base_documentado}; conferir o modelo aplicável ao ano-base ${anoBase}.`
    );
  }

  const grupos = new Map();

  for (const projeto of atividades) {
    for (
      const item of projeto.recursos_humanos
    ) {
      const chave =
        item.colaborador_id;

      if (!grupos.has(chave)) {
        grupos.set(chave, []);
      }

      grupos.get(chave).push(item);
    }
  }

  const profissionaisConsolidados =
    [...grupos].map(
      ([colaborador_id, itens]) => {
        const jornadas = [
          ...new Set(
            itens
              .map(
                (item) =>
                  item.horas_trabalhadas_ano_profissional
              )
              .filter(preenchido)
          ),
        ];

        const remuneracoes = [
          ...new Set(
            itens
              .map(
                (item) =>
                  item.valor_total_pago_profissional
              )
              .filter(preenchido)
          ),
        ];

        const divergente =
          jornadas.length > 1 ||
          remuneracoes.length > 1;

        if (divergente) {
          pendencias.push(
            `Profissional ${colaborador_id}: dados anuais divergem entre projetos. Confira os cadastros.`
          );
        }

        const horas = formatar(
          itens.reduce(
            (total, item) =>
              total + decimal(item.horas),
            0n
          )
        );

        const custo = formatar(
          itens.reduce(
            (total, item) =>
              total +
              decimal(
                item.custo_apropriado_registrado
              ),
            0n
          )
        );

        if (
          jornadas.length === 1 &&
          decimal(jornadas[0]) <
            decimal(horas)
        ) {
          pendencias.push(
            `Profissional ${colaborador_id}: soma de horas nos projetos supera a jornada anual declarada.`
          );
        }

        if (
          remuneracoes.length === 1 &&
          decimal(remuneracoes[0]) <
            decimal(custo)
        ) {
          pendencias.push(
            `Profissional ${colaborador_id}: soma de custos nos projetos supera a remuneração anual declarada.`
          );
        }

        return {
          colaborador_id,

          colaborador_nome:
            itens[0].colaborador_nome,

          horas_lancadas_projetos:
            horas,

          custo_apropriado_projetos:
            custo,

          jornada_anual_declarada:
            jornadas.length === 1
              ? jornadas[0]
              : null,

          remuneracao_anual_declarada:
            remuneracoes.length === 1
              ? remuneracoes[0]
              : null,

          dados_anuais_divergentes:
            divergente,
        };
      }
    );

  const resumos = atividades.map(
    (projeto) =>
      projeto.resumo_interno
  );

  const camposPreenchidos =
    Object.keys(ANUAIS).filter(
      (campo) =>
        preenchido(empresa[campo])
    ).length +
    atividades.reduce(
      (total, projeto) =>
        total +
        projeto.completude_tecnica.preenchidos,
      0
    );

  const totalCampos =
    Object.keys(ANUAIS).length +
    atividades.reduce(
      (total, projeto) =>
        total +
        projeto.completude_tecnica.total,
      0
    );

  const horasPendentes = formatar(
    atividades.reduce(
      (total, projeto) =>
        total +
        decimal(
          projeto.resumo_interno.horas_registradas
        ) -
        decimal(
          projeto.resumo_interno.horas_com_aprovacao_completa
        ),
      0n
    )
  );

  const possuiPendencias =
    pendencias.length > 0 ||
    atividades.some(
      (projeto) =>
        projeto.pendencias_preparacao.length > 0
    );

  return {
    titulo:
      "Dossiê de apoio ao preenchimento do FORMP&D",

    versao_dossie: "1.1",

    referencia: REFERENCIA,

    ano_base: anoBase,

    gerado_em:
      agora.toISOString(),

    gerado_por: usuario
      ? selecionar(
          usuario,
          ["id_usuario", "nome"]
        )
      : null,

    preparacao_anual: {
      dados: preparacao,
    },

    completude: {
      preenchidos:
        camposPreenchidos,

      total:
        totalCampos,
    },

    conciliacao: {
      regra:
        "Custos de pessoal e outros dispêndios são apresentados separadamente. Não são somados para evitar dupla contagem. Custo apropriado não recebe o percentual de elegibilidade novamente.",

      horas_pendentes:
        horasPendentes,
    },

    finalidade:
      "Organização dos registros e identificação de informações a complementar. Não é arquivo de importação oficial nem comprovante de submissão.",

    situacao: possuiPendencias
      ? "Pendente de complementação e revisão"
      : "Preparação interna preenchida; requer conferência para submissão",

    pronto_para_submissao: false,

    resumo: {
      total_projetos:
        atividades.length,

      horas_registradas:
        somar(
          resumos,
          "horas_registradas"
        ),

      horas_com_aprovacao_completa:
        somar(
          resumos,
          "horas_com_aprovacao_completa"
        ),

      custos_pessoal_registrados:
        somar(
          resumos,
          "custos_pessoal_registrados"
        ),

      custos_pessoal_com_aprovacao_completa:
        somar(
          resumos,
          "custos_pessoal_com_aprovacao_completa"
        ),

      dispendios_registrados:
        somar(
          resumos,
          "dispendios_registrados"
        ),

      beneficio_fiscal: null,
    },

    secoes: {
      identificacao_empresa:
        selecionar(empresa, [
          "razao_social",
          "cnpj",
          ...camposEmpresa,
        ]),

      programas_atividades_pdi:
        atividades,

      dispendios_programa: {
        profissionais_consolidados:
          profissionaisConsolidados,

        fontes_financiamento:
          empresa.fontes_financiamento ||
          null,

        situacao:
          "Conferir as rubricas com o responsável.",

        detalhes:
          "Os lançamentos por projeto estão em programas_atividades_pdi. Os valores não são automaticamente classificados como elegíveis.",
      },

      pesquisador_exclusivo: {
        situacao:
          empresa.pesquisador_exclusivo_aplicabilidade ||
          "Aplicabilidade não avaliada",

        dados:
          empresa.pesquisador_exclusivo_detalhes ||
          null,
      },

      artigo_19a: {
        situacao:
          empresa.artigo_19a_aplicabilidade ||
          "Aplicabilidade não avaliada",

        dados:
          empresa.artigo_19a_detalhes ||
          null,
      },

      incentivos_fiscais: {
        situacao:
          empresa.incentivos_fiscais_detalhes
            ? "Informado pelo responsável; sujeito à conferência"
            : "Apuração não informada",

        dados:
          empresa.incentivos_fiscais_detalhes ||
          null,

        valor_informado:
          empresa.valor_incentivo_informado ??
          null,
      },

      relatorio_preenchimento: {
        pendencias_gerais:
          pendencias,

        total_pendencias_projetos:
          atividades.reduce(
            (total, projeto) =>
              total +
              projeto.pendencias_preparacao.length,
            0
          ),
      },

      aperfeicoamento_lei_do_bem: {
        situacao:
          empresa.aperfeicoamento_lei_do_bem
            ? "Informado"
            : "Não preenchido",

        dados:
          empresa.aperfeicoamento_lei_do_bem ||
          null,
      },
    },
  };
}

module.exports = {
  gerarDossie,
};
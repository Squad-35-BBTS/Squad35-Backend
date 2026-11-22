const f = require("../utils/financeiro");

const TECNICOS = {
  objetivos: ["texto", 3000],

  categoria_predominante_formpd: [
    "texto",
    191,
  ],

  area_predominante_formpd: [
    "texto",
    191,
  ],

  palavras_chave: ["texto", 500],
  natureza_predominante: ["texto", 191],
  elemento_inovador: ["texto", 3000],
  metodologia: ["texto", 3000],
  justificativa_trl: ["texto", 1500],

  trl_final_ano_base_confirmado: [
    "inteiro",
    9,
    1,
  ],

  resultado_inovacao: ["texto", 3000],
  resultado_economico: ["texto", 3000],
  projeto_plurianual: ["booleano"],

  atividades_desenvolvidas_no_ano_base: [
    "texto",
    3000,
  ],
};

const ANUAIS = {
  razao_social: ["texto", 191],
  cnpj: ["cnpj"],

  tipo_empresa: ["texto", 191],
  situacao_empresa: ["texto", 191],
  origem_capital: ["texto", 191],

  receita_operacional_bruta: ["decimal"],
  receita_liquida: ["decimal"],

  total_funcionarios: [
    "inteiro",
    100000000,
    0,
  ],

  prejuizo_fiscal: ["booleano"],
  estrutura_pd: ["texto", 3000],
  fontes_financiamento: ["texto", 3000],

  pesquisador_exclusivo_aplicabilidade: [
    "opcao",
  ],

  pesquisador_exclusivo_detalhes: [
    "texto",
    5000,
  ],

  artigo_19a_aplicabilidade: ["opcao"],
  artigo_19a_detalhes: ["texto", 5000],

  incentivos_fiscais_detalhes: [
    "texto",
    5000,
  ],

  valor_incentivo_informado: ["decimal"],

  aperfeicoamento_lei_do_bem: [
    "texto",
    3000,
  ],

  modelo_referencia_conferido: [
    "booleano",
  ],
};

function ano(valor) {
  if (
    !/^\d{4}$/.test(String(valor)) ||
    Number(valor) < 2000 ||
    Number(valor) > 2100
  ) {
    f.erro(
      400,
      "Informe um ano-base entre 2000 e 2100."
    );
  }

  return Number(valor);
}

function cnpjValido(texto) {
  if (
    !/^\d{14}$/.test(texto) ||
    /^(\d)\1+$/.test(texto)
  ) {
    return false;
  }

  const digito = (base) => {
    let peso = base.length - 7;
    let soma = 0;

    for (const numero of base) {
      soma += Number(numero) * peso--;

      if (peso < 2) {
        peso = 9;
      }
    }

    const resto = soma % 11;

    return resto < 2 ? 0 : 11 - resto;
  };

  return (
    digito(texto.slice(0, 12)) ===
      Number(texto[12]) &&
    digito(texto.slice(0, 13)) ===
      Number(texto[13])
  );
}

function cpfValido(texto) {
  if (
    !/^\d{11}$/.test(texto) ||
    /^(\d)\1+$/.test(texto)
  ) {
    return false;
  }

  for (
    let tamanho = 9;
    tamanho <= 10;
    tamanho++
  ) {
    let soma = 0;

    for (
      let indice = 0;
      indice < tamanho;
      indice++
    ) {
      soma +=
        Number(texto[indice]) *
        (tamanho + 1 - indice);
    }

    const digito = (
      (soma * 10) % 11
    ) % 10;

    if (
      digito !== Number(texto[tamanho])
    ) {
      return false;
    }
  }

  return true;
}

function validarCampos(objeto, esquema) {
  if (
    !objeto ||
    typeof objeto !== "object" ||
    Array.isArray(objeto)
  ) {
    f.erro(
      400,
      "Informe os dados do formulário."
    );
  }

  const resultado = {};

  for (
    const [campo, valor]
    of Object.entries(objeto)
  ) {
    if (
      !Object.hasOwn(esquema, campo)
    ) {
      f.erro(
        400,
        `Campo não permitido: ${campo}.`
      );
    }

    if (
      valor === null ||
      valor === ""
    ) {
      resultado[campo] = null;
      continue;
    }

    const [
      tipo,
      maximo,
      minimo,
    ] = esquema[campo];

    if (tipo === "texto") {
      resultado[campo] = f.texto(
        valor,
        campo,
        maximo
      );
    }

    if (tipo === "booleano") {
      if (
        typeof valor !== "boolean"
      ) {
        f.erro(
          400,
          `${campo}: use verdadeiro ou falso.`
        );
      }

      resultado[campo] = valor;
    }

    if (tipo === "inteiro") {
      if (
        !["string", "number"].includes(
          typeof valor
        ) ||
        !/^\d+$/.test(String(valor)) ||
        Number(valor) < minimo ||
        Number(valor) > maximo
      ) {
        f.erro(
          400,
          `${campo}: inteiro inválido.`
        );
      }

      resultado[campo] = Number(valor);
    }

    if (tipo === "decimal") {
      if (
        !/^\d+(\.\d{1,2})?$/.test(
          String(valor)
        )
      ) {
        f.erro(
          400,
          `${campo}: use número não negativo com até duas casas.`
        );
      }

      resultado[campo] = f.decimal(
        valor,
        campo,
        0,
        999999999999.99
      );
    }

    if (tipo === "opcao") {
      if (
        ![
          "Aplicável",
          "Não aplicável",
        ].includes(valor)
      ) {
        f.erro(
          400,
          `${campo}: opção inválida.`
        );
      }

      resultado[campo] = valor;
    }

    if (tipo === "cpf") {
      if (
        typeof valor !== "string"
      ) {
        f.erro(400, "CPF inválido.");
      }

      const numero = valor.replace(
        /[.\-\s]/g,
        ""
      );

      if (!cpfValido(numero)) {
        f.erro(400, "CPF inválido.");
      }

      resultado[campo] = numero;
    }

    if (tipo === "cnpj") {
      if (
        typeof valor !== "string"
      ) {
        f.erro(400, "CNPJ inválido.");
      }

      const numero = valor.replace(
        /[.\/\-\s]/g,
        ""
      );

      if (!cnpjValido(numero)) {
        f.erro(400, "CNPJ inválido.");
      }

      resultado[campo] = numero;
    }
  }

  return resultado;
}

function validar(
  body,
  anual,
  consultoria = false
) {
  f.campos(body, [
    "revisao",
    "dados",
  ]);

  if (
    !Number.isInteger(body.revisao) ||
    body.revisao < 0
  ) {
    f.erro(
      400,
      "Informe a revisão carregada no formulário."
    );
  }

  const esquema = anual
    ? ANUAIS
    : {
        ...TECNICOS,
        rubricas: ["lista"],
        profissionais: ["lista"],
      };

  const simples = Object.fromEntries(
    Object.entries(
      body.dados || {}
    ).filter(
      ([campo]) =>
        ![
          "rubricas",
          "profissionais",
        ].includes(campo)
    )
  );

  if (
    !body.dados ||
    typeof body.dados !== "object" ||
    Array.isArray(body.dados)
  ) {
    f.erro(
      400,
      "Informe os dados do formulário."
    );
  }

  for (
    const campo
    of Object.keys(body.dados)
  ) {
    const campoInexistente =
      !Object.hasOwn(
        esquema,
        campo
      );

    const campoRestrito =
      consultoria &&
      !Object.hasOwn(
        TECNICOS,
        campo
      );

    if (
      campoInexistente ||
      campoRestrito
    ) {
      f.erro(
        403,
        `Campo não permitido para este formulário: ${campo}.`
      );
    }
  }

  const dados = validarCampos(
    simples,
    anual ? ANUAIS : TECNICOS
  );

  if (
    !anual &&
    !consultoria
  ) {
    const colecoes = [
      [
        "rubricas",
        "id_dispendio",
        {
          id_dispendio: [
            "inteiro",
            2147483647,
            1,
          ],

          rubrica: ["texto", 191],

          fonte_financiamento: [
            "texto",
            191,
          ],
        },
      ],

      [
        "profissionais",
        "colaborador_id",
        {
          colaborador_id: [
            "texto",
            191,
          ],

          cpf: ["cpf"],
          sexo: ["texto", 50],
          titulacao: ["texto", 191],

          funcao_projeto_formpd: [
            "texto",
            191,
          ],

          horas_trabalhadas_ano_profissional: [
            "decimal",
          ],

          valor_total_pago_profissional: [
            "decimal",
          ],

          dedicacao_formpd: [
            "texto",
            191,
          ],
        },
      ],
    ];

    for (
      const [
        campo,
        chave,
        campos,
      ] of colecoes
    ) {
      if (
        body.dados[campo] === undefined
      ) {
        continue;
      }

      if (
        !Array.isArray(
          body.dados[campo]
        ) ||
        body.dados[campo].length > 500
      ) {
        f.erro(
          400,
          `${campo}: informe até 500 registros.`
        );
      }

      dados[campo] =
        body.dados[campo].map(
          (item) =>
            validarCampos(
              item,
              campos
            )
        );

      const identificadores =
        dados[campo].map(
          (item) => item[chave]
        );

      if (
        dados[campo].some(
          (item) => !item[chave]
        ) ||
        new Set(
          identificadores
        ).size !== dados[campo].length
      ) {
        f.erro(
          400,
          `${campo}: identificadores ausentes ou repetidos.`
        );
      }

      if (
        campo === "profissionais" &&
        dados[campo].some(
          (item) =>
            Number(
              item.horas_trabalhadas_ano_profissional
            ) > 8784
        )
      ) {
        f.erro(
          400,
          "Jornada anual inválida."
        );
      }
    }
  }

  return {
    revisao: body.revisao,
    dados,
  };
}

function seguro(item, consultoria) {
  const dados = item?.dados || {};

  return {
    ano_base: item?.ano_base ?? null,
    revisao: item?.revisao || 0,

    atualizado_em:
      item?.atualizado_em || null,

    dados: consultoria
      ? Object.fromEntries(
          Object.entries(dados).filter(
            ([campo]) =>
              Object.hasOwn(
                TECNICOS,
                campo
              )
          )
        )
      : dados,
  };
}

module.exports = {
  TECNICOS,
  ANUAIS,
  ano,
  validar,
  seguro,
  cnpjValido,
  cpfValido,
};
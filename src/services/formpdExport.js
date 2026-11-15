function linhas(
  valor,
  caminho = "",
  resultado = []
) {
  if (valor instanceof Date) {
    resultado.push([
      caminho,
      valor.toISOString(),
    ]);
  } else if (Array.isArray(valor)) {
    if (!valor.length) {
      resultado.push([
        caminho,
        "Nenhum registro",
      ]);
    }

    valor.forEach((item, indice) => {
      linhas(
        item,
        `${caminho}[${indice + 1}]`,
        resultado
      );
    });
  } else if (
    valor !== null &&
    typeof valor === "object"
  ) {
    for (
      const [chave, item]
      of Object.entries(valor)
    ) {
      linhas(
        item,
        caminho
          ? `${caminho}.${chave}`
          : chave,
        resultado
      );
    }
  } else {
    const texto =
      valor === null ||
      valor === undefined
        ? "Não informado"
        : typeof valor === "boolean"
          ? valor
            ? "Sim"
            : "Não"
          : String(valor);

    resultado.push([
      caminho,
      texto,
    ]);
  }

  return resultado;
}

const ROTULOS = {
  identificacao_empresa:
    "Identificação da empresa",

  programas_atividades_pdi:
    "Projetos e atividades de PD&I",

  dispendios_programa:
    "Dispêndios do programa",

  pesquisador_exclusivo:
    "Pesquisador exclusivo",

  artigo_19a:
    "Art. 19-A",

  incentivos_fiscais:
    "Incentivos fiscais",

  relatorio_preenchimento:
    "Relatório de preenchimento",

  aperfeicoamento_lei_do_bem:
    "Aperfeiçoamento da Lei do Bem",

  recursos_humanos:
    "Pessoas e horas",

  dispendios:
    "Lançamentos de dispêndios",

  resumo_interno:
    "Resumo dos registros internos",

  custo_apropriado_registrado:
    "Custo apropriado registrado (R$)",

  valor:
    "Valor (R$)",

  valor_informado:
    "Valor declarado pelo responsável (R$)",

  horas_com_aprovacao_completa:
    "Horas com aprovação completa",

  custos_pessoal_com_aprovacao_completa:
    "Custo de pessoal com aprovação completa (R$)",

  custos_pessoal_registrados:
    "Custo de pessoal registrado (R$)",

  dispendios_registrados:
    "Dispêndios registrados (R$)",

  id_iniciativa:
    "Identificador interno do projeto",

  codigo_interno:
    "Código interno",

  trl_final_ano_base_confirmado:
    "TRL final confirmado do exercício",

  ano_base:
    "Ano-base",

  cpf:
    "CPF",

  sexo:
    "Sexo",

  titulacao:
    "Titulação",

  funcao_projeto_formpd:
    "Função no projeto",

  pendencias_preparacao:
    "Pendências de preparação",

  finalidade:
    "Finalidade",

  metodologia:
    "Metodologia",

  resultado_inovacao:
    "Resultados de inovação",

  resultado_economico:
    "Resultados econômicos",

  objetivos:
    "Objetivos",

  barreira_tecnologica:
    "Barreira tecnológica",

  razao_social:
    "Razão social",

  cnpj:
    "CNPJ",

  gerado_em:
    "Gerado em",

  gerado_por:
    "Responsável pela geração",

  referencia:
    "Referência documental",

  revisao:
    "Revisão",

  status_dossie:
    "Situação do dossiê",

  completude:
    "Preenchimento de campos",
};

function nomeCampo(caminho) {
  return caminho
    .split(".")
    .map((parte) => {
      const chave = parte.replace(
        /\[\d+\]/g,
        ""
      );

      const indices =
        parte.match(
          /\[\d+\]/g
        )?.join(" ") || "";

      const titulo =
        ROTULOS[chave] ||
        chave.replace(/_/g, " ");

      return indices
        ? `${titulo} ${indices}`
        : titulo;
    })
    .join(" › ");
}

function csv(dossie) {
  function celula(valor) {
    let texto = String(valor);

    // Evita interpretar conteúdo como fórmula.
    if (
      /^[\s\uFEFF]*[=+\-@]/u.test(
        texto
      )
    ) {
      texto = `'${texto}`;
    }

    return `"${texto.replace(
      /"/g,
      '""'
    )}"`;
  }

  const registros = [
    ["Campo", "Valor"],

    ...linhas(dossie).map(
      ([campo, valor]) => [
        nomeCampo(campo),
        valor,
      ]
    ),
  ];

  return (
    "\uFEFF" +
    registros
      .map((registro) =>
        registro
          .map(celula)
          .join(";")
      )
      .join("\r\n")
  );
}

function html(dossie) {
  function escapar(valor) {
    const entidades = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return String(valor).replace(
      /[&<>"']/g,
      (caractere) =>
        entidades[caractere]
    );
  }

  function bloco(nome, dados) {
    const registros = linhas(dados)
      .map(
        ([campo, valor]) => `
          <tr>
            <th scope="row">
              ${escapar(nomeCampo(campo))}
            </th>
            <td>${escapar(valor)}</td>
          </tr>
        `
      )
      .join("");

    return `
      <section>
        <h2>${escapar(nome)}</h2>

        <table>
          <thead>
            <tr>
              <th>Campo</th>
              <th>Informação</th>
            </tr>
          </thead>

          <tbody>
            ${registros}
          </tbody>
        </table>
      </section>
    `;
  }

  const titulos = {
    identificacao_empresa:
      "1. Identificação da empresa",

    programas_atividades_pdi:
      "2. Programas e atividades de PD&I",

    dispendios_programa:
      "3. Dispêndios do programa",

    pesquisador_exclusivo:
      "4. Pesquisador exclusivo",

    artigo_19a:
      "5. Art. 19-A",

    incentivos_fiscais:
      "6. Incentivos fiscais",

    relatorio_preenchimento:
      "7. Relatório de preenchimento",

    aperfeicoamento_lei_do_bem:
      "8. Aperfeiçoamento da Lei do Bem",
  };

  const secoes = Object.entries(
    dossie.secoes
  )
    .map(([chave, dados]) => {
      if (
        chave !==
        "programas_atividades_pdi"
      ) {
        return bloco(
          titulos[chave] || chave,
          dados
        );
      }

      const projetos = dados.length
        ? dados
            .map((projeto) => {
              const dadosProjeto =
                Object.fromEntries(
                  Object.entries(
                    projeto
                  ).filter(
                    ([campo]) =>
                      ![
                        "pendencias_acoes",
                        "complemento_financeiro",
                      ].includes(campo)
                  )
                );

              return `
                <article class="projeto">
                  <h3>
                    ${escapar(projeto.codigo_interno)}
                    —
                    ${escapar(projeto.titulo)}
                  </h3>

                  ${bloco(
                    "Dados do projeto e conferência",
                    dadosProjeto
                  )}
                </article>
              `;
            })
            .join("")
        : "<p>Nenhum projeto neste exercício.</p>";

      return `
        <section>
          <h2>${escapar(titulos[chave])}</h2>
          ${projetos}
        </section>
      `;
    })
    .join("");

  return `
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">

    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    >

    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
    >

    <title>
      Dossiê FORMPD — ${dossie.ano_base}
    </title>

    <style>
      body {
        font: 14px/1.5 Arial, sans-serif;
        color: #20243c;
        margin: 36px auto;
        max-width: 1100px;
        padding: 0 20px;
      }

      h1 {
        font-size: 26px;
        color: #3231b9;
      }

      h2 {
        font-size: 19px;
        margin-top: 32px;
      }

      h3 {
        font-size: 17px;
        margin-top: 24px;
      }

      p {
        white-space: pre-wrap;
      }

      .aviso {
        padding: 16px;
        background: #fff8e0;
        border: 1px solid #e4d697;
      }

      .projeto {
        border-top: 2px solid #3231b9;
        padding-top: 10px;
      }

      .projeto h2 {
        font-size: 15px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
        margin: 14px 0;
      }

      th,
      td {
        text-align: left;
        border: 1px solid #d6dbea;
        padding: 9px;
        vertical-align: top;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }

      th {
        background: #f2f3fa;
        font-weight: 600;
      }

      tbody th {
        width: 38%;
      }

      thead {
        display: table-header-group;
      }

      footer {
        border-top: 1px solid #ddd;
        margin-top: 28px;
        color: #555;
      }

      @page {
        size: A4;
        margin: 15mm;
      }

      @media print {
        body {
          margin: 0;
          padding: 0;
          max-width: none;
        }

        h2 {
          break-after: avoid;
        }

        tr {
          break-inside: avoid;
        }
      }
    </style>
  </head>

  <body>
    <header>
      <p>SGA-LB · Gestão de P&amp;D</p>

      <h1>${escapar(dossie.titulo)}</h1>

      <p>
        Ano-base: ${dossie.ano_base}<br>
        Emissão: ${escapar(dossie.gerado_em)}
      </p>

      <p class="aviso">
        ${escapar(dossie.finalidade)}<br>
        Para salvar em PDF, use a opção Imprimir do navegador.<br>
        Referência: ${escapar(dossie.referencia.guia)}
        — ano-base documentado
        ${dossie.referencia.ano_base_documentado}.
      </p>
    </header>

    ${bloco(
      "Resumo dos registros internos",
      dossie.resumo
    )}

    <p class="aviso">
      ${escapar(
        dossie.conciliacao?.regra || ""
      )}
    </p>

    ${secoes}

    <footer>
      <p>
        Documento de apoio. A conferência e a entrega
        são realizadas no sistema oficial FORMP&D.
      </p>
    </footer>
  </body>
</html>
  `;
}

module.exports = {
  csv,
  html,
};
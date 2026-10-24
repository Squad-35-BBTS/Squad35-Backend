const prisma = require('../services/prisma');
const axios = require('axios');

module.exports = {
  async getDashboardElegibilidade(req, res) {
    try {
      const projetos = await prisma.iniciativa.findMany({
        include: {
          usuario_responsavel: { select: { nome: true, perfil: true } },
          marcos: true
        }
      });

      return res.json({
        kpis: {
          total_projetos: projetos.length,
          projetos_aderentes: projetos.filter(p => Number(p.elegibilidade_pct) >= 85).length,
          aderencia_parcial: projetos.filter(p => Number(p.elegibilidade_pct) >= 60 && Number(p.elegibilidade_pct) < 85).length,
          alto_risco_glosa: projetos.filter(p => p.risco_glosa && p.risco_glosa.includes('Alto')).length
        },
        projetos
      });
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao carregar painel de elegibilidade.', details: error.message });
    }
  },

  async create(req, res) {
    try {
      const { 
        codigo, 
        nome, 
        descricao, 
        classificacao_pd, 
        score_trl, 
        elegibilidade_pct, 
        risco_glosa, 
        barreira_incerteza, 
        cnae, 
        data_inicio, 
        data_fim, 
        usuario_responsavel_id 
      } = req.body;

      const iniciativa = await prisma.iniciativa.create({
        data: {
          codigo,
          nome,
          descricao,
          classificacao_pd,
          score_trl: Number(score_trl),
          elegibilidade_pct: Number(elegibilidade_pct),
          risco_glosa,
          barreira_incerteza,
          cnae,
          data_inicio: data_inicio ? new Date(data_inicio) : null,
          data_fim: data_fim ? new Date(data_fim) : null,
          usuario_responsavel_id: usuario_responsavel_id || 1
        }
      });

      return res.status(201).json(iniciativa);
    } catch (error) {
      return res.status(400).json({ error: 'Erro ao cadastrar iniciativa.', details: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const iniciativas = await prisma.iniciativa.findMany({
        include: { 
          usuario_responsavel: { select: { nome: true, email: true } },
          marcos: true,
          dispendios: true,
          timesheets: true
        }
      });
      return res.json(iniciativas);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao listar iniciativas.', details: error.message });
    }
  },

  async findById(req, res) {
    try {
      const { id } = req.params;
      const iniciativa = await prisma.iniciativa.findUnique({
        where: { id_iniciativa: Number(id) },
        include: { usuario_responsavel: true, marcos: true, dispendios: true, timesheets: true }
      });

      if (!iniciativa) return res.status(404).json({ error: 'Iniciativa não encontrada.' });
      return res.json(iniciativa);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao buscar iniciativa.', details: error.message });
    }
  },

  async getApuraçãoFinanceira(req, res) {
    try {
      const timesheets = await prisma.timesheet.findMany();
      const dispendios = await prisma.dispendio.findMany();

      const totalHoras = timesheets.reduce((acc, curr) => acc + curr.horas_mes, 0);
      const dispendioTotal = dispendios.reduce((acc, curr) => acc + Number(curr.valor), 0);

      return res.json({
        resumo_horas: { total_horas_apuradas: totalHoras },
        resumo_financeiro: {
          dispendio_consolidado: dispendioTotal,
          incentivo_fiscal_estimado: dispendioTotal * 0.34
        },
        timesheets,
        dispendios
      });
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao apurar dados financeiros.', details: error.message });
    }
  },

  async consultarCnpj(req, res) {
    try {
      const { cnpj } = req.params;
      const cnpjLimpo = cnpj.replace(/\D/g, '');
      const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      
      return res.json({
        razao_social: response.data.razao_social,
        nome_fantasia: response.data.nome_fantasia,
        situacao_cadastral: response.data.descricao_situacao_cadastral,
        cnae_principal: {
          codigo: response.data.cnae_fiscal,
          descricao: response.data.cnae_fiscal_descricao
        },
        municipio: response.data.municipio,
        uf: response.data.uf,
        elegivel_lei_do_bem: true
      });
    } catch (error) {
      return res.status(400).json({ error: 'Erro ao consultar CNPJ na BrasilAPI.', details: error.response?.data || error.message });
    }
  },

  async consultarRepositorioGithub(req, res) {
    try {
      const { owner, repo } = req.query;
      if (!owner || !repo) {
        return res.status(400).json({ error: 'Informe o owner e o repo como query params.' });
      }

      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}`);
      const commitsResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=5`);

      return res.json({
        repositorio: response.data.full_name,
        descricao: response.data.description,
        linguagem_principal: response.data.language,
        ultima_atualizacao: response.data.updated_at,
        ultimos_commits_evidencia: commitsResponse.data.map(c => ({
          autor: c.commit.author.name,
          mensagem: c.commit.message,
          data: c.commit.author.date,
          hash: c.sha
        }))
      });
    } catch (error) {
      return res.status(400).json({ error: 'Erro ao consultar GitHub API.', details: error.response?.data || error.message });
    }
  },

  async exportarMcti(req, res) {
    try {
      const iniciativas = await prisma.iniciativa.findMany({
        include: {
          usuario_responsavel: { select: { nome: true, email: true } },
          marcos: true,
          dispendios: true,
          timesheets: true
        }
      });

      const relatorioMcti = {
        orgao_competente: "MCTI / Receita Federal",
        ano_base: new Date().getFullYear(),
        gerado_em: new Date(),
        total_projetos_envolvidos: iniciativas.length,
        projetos: iniciativas.map(p => ({
          codigo_projeto: p.codigo,
          nome_projeto: p.nome,
          classificacao_frascati: p.classificacao_pd,
          trl: p.score_trl,
          elegibilidade_percentual: Number(p.elegibilidade_pct),
          risco_glosa: p.risco_glosa,
          barreira_tecnologica: p.barreira_incerteza,
          cnae: p.cnae,
          periodo: { inicio: p.data_inicio, fim: p.data_fim },
          responsavel: p.usuario_responsavel?.nome,
          total_marcos_tecnicos: p.marcos.length,
          total_dispendios_registrados: p.dispendios.reduce((acc, curr) => acc + Number(curr.valor), 0),
          total_horas_timesheet: p.timesheets.reduce((acc, curr) => acc + curr.horas_mes, 0)
        }))
      };

      return res.json(relatorioMcti);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao gerar relatório MCTI.', details: error.message });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const { data_inicio, data_fim, ...rest } = req.body;

      const iniciativa = await prisma.iniciativa.update({
        where: { id_iniciativa: Number(id) },
        data: {
          ...rest,
          ...(data_inicio ? { data_inicio: new Date(data_inicio) } : {}),
          ...(data_fim ? { data_fim: new Date(data_fim) } : {})
        }
      });
      return res.json(iniciativa);
    } catch (error) {
      return res.status(400).json({ error: 'Erro ao atualizar iniciativa.', details: error.message });
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;
      await prisma.iniciativa.delete({ where: { id_iniciativa: Number(id) } });
      return res.status(204).send();
    } catch (error) {
      return res.status(400).json({ error: 'Erro ao deletar iniciativa.', details: error.message });
    }
  }
};
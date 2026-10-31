// Limite por processo. Em múltiplas instâncias, use armazenamento compartilhado.
module.exports = function limiteRecuperacao(maximo = 10, janela = 15 * 60 * 1000) {
  const acessos = new Map();
  return (req, res, next) => {
    const agora = Date.now();
    for (const [chave, item] of acessos) if (item.fim <= agora) acessos.delete(chave);
    const chave = req.ip || req.socket.remoteAddress || 'desconhecido';
    let item = acessos.get(chave);
    if (!item) {
      if (acessos.size >= 10000) return res.status(429).json({ error: 'Muitas solicitações. Tente novamente mais tarde.' });
      item = { quantidade: 0, fim: agora + janela }; acessos.set(chave, item);
    }
    item.quantidade++;
    if (item.quantidade > maximo) {
      res.setHeader('Retry-After', String(Math.ceil((item.fim - agora) / 1000)));
      return res.status(429).json({ error: 'Muitas solicitações. Tente novamente mais tarde.' });
    }
    return next();
  };
};


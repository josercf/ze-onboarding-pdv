const NIVEIS = ['boa', 'media', 'ruim'];
const RECOMENDACOES = ['apto', 'revisao_manual', 'nao_apto'];

export function extrairConteudo(resposta) {
  const escolha = resposta && Array.isArray(resposta.choices) ? resposta.choices[0] : undefined;
  const conteudo = escolha && escolha.message ? escolha.message.content : undefined;
  if (conteudo == null) throw new Error('Resposta do modelo sem conteúdo');
  if (typeof conteudo === 'object') return conteudo;
  const texto = String(conteudo).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(texto); } catch { throw new Error('Conteúdo do modelo não é JSON válido'); }
}

export function tokensDe(resposta) {
  const usage = (resposta && resposta.usage) || {};
  return { entrada: usage.prompt_tokens || 0, saida: usage.completion_tokens || 0 };
}

export function validarObservacao(resposta, entrada, RECURSOS) {
  const c = extrairConteudo(resposta);
  const falhas = [];
  if (typeof c.aderente_ao_tipo !== 'boolean') falhas.push('aderente_ao_tipo');
  if (typeof c.confianca !== 'number') falhas.push('confianca');
  if (typeof c.resumo !== 'string') falhas.push('resumo');
  if (!c.qualidade || !NIVEIS.includes(c.qualidade.nitidez) || !NIVEIS.includes(c.qualidade.iluminacao) || typeof c.qualidade.observacao !== 'string') falhas.push('qualidade');
  if (!c.dados || typeof c.dados !== 'object') falhas.push('dados');
  if (!Array.isArray(c.evidencias)) falhas.push('evidencias');
  if (!Array.isArray(c.alertas)) falhas.push('alertas');
  const schema = RECURSOS.schemas[entrada.tipo];
  const obrigatorios = schema && schema.properties && schema.properties.dados ? schema.properties.dados.required || [] : [];
  if (c.dados && typeof c.dados === 'object') for (const chave of obrigatorios) if (!(chave in c.dados)) falhas.push(`dados.${chave}`);
  if (falhas.length) throw new Error(`Observação inválida: ${falhas.join(', ')}`);
  return {
    arquivo_id: entrada.arquivo_id, tipo: entrada.tipo, nome: entrada.nome, mime: entrada.mime,
    modelo: resposta.model || RECURSOS.modelos.analise, tokens: tokensDe(resposta),
    latencia_ms: Math.max(0, Date.now() - (entrada.inicio_ms || Date.now())),
    aderente_ao_tipo: c.aderente_ao_tipo, confianca: Math.min(1, Math.max(0, c.confianca)), resumo: c.resumo,
    qualidade: c.qualidade, dados: c.dados, evidencias: c.evidencias, alertas: c.alertas,
  };
}

export function validarParecer(resposta, RECURSOS) {
  const c = extrairConteudo(resposta);
  if (typeof c.parecer !== 'string' || !Array.isArray(c.pontos_de_atencao) || !RECOMENDACOES.includes(c.recomendacao_sugerida) || typeof c.justificativa !== 'string') {
    throw new Error('Parecer inválido: campos obrigatórios ausentes ou fora do enum');
  }
  return { parecer: c.parecer, pontos_de_atencao: c.pontos_de_atencao, recomendacao_sugerida: c.recomendacao_sugerida, justificativa: c.justificativa, modelo: resposta.model || RECURSOS.modelos.parecer, tokens: tokensDe(resposta) };
}

export function validarClassificacao(resposta, entrada, RECURSOS) {
  const c = extrairConteudo(resposta);
  const tiposValidos = [...Object.keys(RECURSOS.tipos), 'indefinido'];
  if (!tiposValidos.includes(c.tipo_detectado) || typeof c.confianca !== 'number' || typeof c.motivo !== 'string') {
    throw new Error('Classificação inválida: campos obrigatórios ausentes ou fora do enum');
  }
  return {
    arquivo_id: entrada.arquivo_id, nome: entrada.nome, mime: entrada.mime,
    tipo_detectado: c.tipo_detectado, confianca: Math.min(1, Math.max(0, c.confianca)), motivo: c.motivo,
    modelo: resposta.model || RECURSOS.modelos.classificacao, tokens: tokensDe(resposta),
    latencia_ms: Math.max(0, Date.now() - (entrada.inicio_ms || Date.now())),
  };
}

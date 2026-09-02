// Cópia local de preencher: os módulos de n8n/lib não podem importar uns aos outros porque cada um é injetado em um nó isolado.
function preencher(modelo, valores) {
  return modelo.replace(/\{\{(\w+)\}\}/g, (tudo, chave) => (chave in valores ? valores[chave] : tudo));
}

export function montarPromptParecer(body, RECURSOS) {
  const obrigatorios = ['formulario', 'parametros_regiao', 'observacoes', 'verificacoes', 'recomendacao_regras'];
  const faltando = obrigatorios.filter((k) => !body || body[k] === undefined);
  if (faltando.length) return { ok: false, status: 400, erro: { codigo: 'campos_ausentes', mensagem: `Faltam os campos: ${faltando.join(', ')}` } };
  const observacoes = (body.observacoes || []).map((o) => ({
    arquivo_id: o.arquivo_id, tipo: o.tipo, nome: o.nome, aderente_ao_tipo: o.aderente_ao_tipo, confianca: o.confianca, resumo: o.resumo, qualidade: o.qualidade, dados: o.dados, alertas: o.alertas,
  }));
  const texto = preencher(RECURSOS.prompts.parecer, {
    formulario: JSON.stringify(body.formulario), receita: JSON.stringify(body.receita === undefined ? null : body.receita),
    parametros_regiao: JSON.stringify(body.parametros_regiao), observacoes: JSON.stringify(observacoes),
    verificacoes: JSON.stringify(body.verificacoes), recomendacao_regras: String(body.recomendacao_regras),
  });
  return {
    ok: true,
    url: 'https://openrouter.ai/api/v1/chat/completions',
    body: {
      model: RECURSOS.modelos.parecer,
      messages: [{ role: 'user', content: texto }],
      response_format: { type: 'json_schema', json_schema: { name: 'parecer', strict: true, schema: RECURSOS.schemas.parecer } },
      provider: { require_parameters: true, data_collection: 'deny' },
    },
  };
}

export function preencher(modelo, valores) {
  return modelo.replace(/\{\{(\w+)\}\}/g, (tudo, chave) => (chave in valores ? valores[chave] : tudo));
}

export function montarRequisicao(entrada, RECURSOS) {
  const { tipo, nome, mime, base64, contexto } = entrada;
  const dataUrl = `data:${mime};base64,${base64}`;
  const parte = mime.startsWith('video/')
    ? { type: 'video_url', video_url: { url: dataUrl } }
    : mime === 'application/pdf'
      ? { type: 'file', file: { filename: nome, file_data: dataUrl } }
      : { type: 'image_url', image_url: { url: dataUrl } };
  const texto = preencher(RECURSOS.prompts[tipo], { contexto: JSON.stringify(contexto || {}) });
  const body = {
    model: RECURSOS.modelos.analise,
    messages: [
      { role: 'system', content: RECURSOS.prompts.system },
      { role: 'user', content: [{ type: 'text', text: texto }, parte] },
    ],
    response_format: { type: 'json_schema', json_schema: { name: `observacao_${tipo}`, strict: true, schema: RECURSOS.schemas[tipo] } },
    provider: { require_parameters: true, data_collection: 'deny' },
  };
  if (mime === 'application/pdf') body.plugins = [{ id: 'file-parser', pdf: { engine: 'native' } }];
  return { url: 'https://openrouter.ai/api/v1/chat/completions', body };
}

const EXTENSOES = { mp4: 'video/mp4', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };

export function inferirMime(mime, nome) {
  if (mime && mime !== 'application/octet-stream') return mime;
  const ext = String(nome || '').split('.').pop().toLowerCase();
  return EXTENSOES[ext] || '';
}

export function tamanhoBase64(b64) {
  const s = String(b64).replace(/\s/g, '');
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  return Math.floor((s.length * 3) / 4) - pad;
}

export function validarEntrada(item, RECURSOS) {
  const body = (item && item.body) || {};
  const erro = (status, codigo, mensagem) => ({ ok: false, status, erro: { codigo, mensagem } });
  const tipo = body.tipo;
  if (!tipo || !RECURSOS.tipos[tipo]) return erro(400, 'tipo_invalido', `Tipo de anexo não reconhecido: ${tipo || 'vazio'}`);
  if (!body.arquivo_id) return erro(400, 'arquivo_id_ausente', 'Informe o campo arquivo_id');
  if (!item.base64) return erro(400, 'arquivo_ausente', 'Envie o arquivo no campo "arquivo"');
  let contexto = {};
  if (body.contexto) {
    try { contexto = JSON.parse(body.contexto); } catch { return erro(400, 'contexto_invalido', 'O campo contexto precisa ser JSON'); }
  }
  const nome = (item.binario && item.binario.fileName) || 'arquivo';
  const mime = inferirMime(item.binario && item.binario.mimeType, nome);
  if (!RECURSOS.tipos[tipo].formatos.includes(mime)) return erro(400, 'formato_invalido', `Formato ${mime || 'desconhecido'} não aceito para ${tipo}`);
  const tamanho = tamanhoBase64(item.base64);
  const limite = mime.startsWith('video/') ? RECURSOS.limites.maxBytesVideo : RECURSOS.limites.maxBytesImagemPdf;
  if (tamanho > limite) return erro(413, 'arquivo_grande', `Arquivo com ${tamanho} bytes; o limite é ${limite}`);
  return { ok: true, entrada: { tipo, arquivo_id: body.arquivo_id, contexto, nome, mime, base64: item.base64, tamanho_bytes: tamanho, inicio_ms: Date.now() } };
}

import { describe, expect, test } from 'vitest';
import { naoOk, ok } from '../testes/fixtures';
import { verificarAnexos } from './anexos';

describe('completude e qualidade (16)', () => {
  test('caso aprovado é conforme', () => expect(verificarAnexos(ok()).status).toBe('conforme'));
  test('caso reprovado é atenção por foto não aderente ao tipo', () => {
    const v = verificarAnexos(naoOk());
    expect(v.status).toBe('atencao');
    expect(v.observado).toMatch(/gelo\.jpeg não corresponde ao tipo Refrigerador/);
  });
  test('tipo obrigatório faltando', () => {
    const e = ok(); e.observacoes = e.observacoes.filter((o) => o.tipo !== 'nf_ambev'); e.anexosEnviados = e.anexosEnviados.filter((a) => a.tipo !== 'nf_ambev');
    const v = verificarAnexos(e);
    expect(v.status).toBe('atencao');
    expect(v.observado).toMatch(/faltam: NF Ambev/);
  });
  test('câmara fria declarada "não" não é obrigatória', () => {
    const e = ok(); e.formulario = { ...e.formulario, camaraFria: 'nao' };
    e.observacoes = e.observacoes.filter((o) => o.tipo !== 'camara_fria'); e.anexosEnviados = e.anexosEnviados.filter((a) => a.tipo !== 'camara_fria');
    expect(verificarAnexos(e).status).toBe('conforme');
  });
  test('câmara fria declarada "sim" sem anexo vira atenção', () => {
    const e = ok();
    e.observacoes = e.observacoes.filter((o) => o.tipo !== 'camara_fria'); e.anexosEnviados = e.anexosEnviados.filter((a) => a.tipo !== 'camara_fria');
    const v = verificarAnexos(e);
    expect(v.status).toBe('atencao');
    expect(v.observado).toMatch(/faltam: Câmara fria/);
  });
  test('balcão e equipamentos só é obrigatório com computador ou impressora declarados', () => {
    const e = ok(); e.formulario = { ...e.formulario, computadorInternet: 'nao', impressoraTermica: 'nao' };
    e.observacoes = e.observacoes.filter((o) => o.tipo !== 'equipamentos'); e.anexosEnviados = e.anexosEnviados.filter((a) => a.tipo !== 'equipamentos');
    expect(verificarAnexos(e).status).toBe('conforme');
  });
  test('arquivo com falha de análise e vídeo curto viram atenção', () => {
    const e = ok();
    e.anexosEnviados = e.anexosEnviados.map((a) => (a.arquivoId === 'a2' ? { ...a, falhou: true } : a));
    e.observacoes = e.observacoes.filter((o) => o.arquivo_id !== 'a2');
    expect(verificarAnexos(e).observado).toMatch(/1 arquivo\(s\) não analisado/);
    const curto = ok(); (curto.observacoes.find((o) => o.tipo === 'video_geral')!.dados as unknown as { duracao_s: number }).duracao_s = 6;
    expect(verificarAnexos(curto).observado).toMatch(/6 s/);
  });
  test('alerta de foto de tela vira atenção', () => {
    const e = ok(); e.observacoes[0].alertas = [{ codigo: 'foto_de_tela', descricao: 'moldura de celular visível' }];
    expect(verificarAnexos(e).observado).toMatch(/moldura de celular/);
  });
  test('nitidez ruim vira atenção', () => {
    const e = ok(); e.observacoes[0].qualidade.nitidez = 'ruim';
    const v = verificarAnexos(e);
    expect(v.status).toBe('atencao');
    expect(v.observado).toMatch(/com nitidez ruim/);
  });
  test('iluminação ruim vira atenção', () => {
    const e = ok(); e.observacoes[0].qualidade.iluminacao = 'ruim';
    const v = verificarAnexos(e);
    expect(v.status).toBe('atencao');
    expect(v.observado).toMatch(/com iluminação ruim/);
  });
  test('alerta de imagem de internet vira atenção', () => {
    const e = ok(); e.observacoes[0].alertas = [{ codigo: 'imagem_internet', descricao: 'marca d água de banco de imagens' }];
    const v = verificarAnexos(e);
    expect(v.status).toBe('atencao');
    expect(v.observado).toMatch(/marca d água de banco de imagens/);
  });
  test('vídeo curto detectado pela duração do anexo quando duracao_s é nulo', () => {
    const e = ok();
    (e.observacoes.find((o) => o.tipo === 'video_geral')!.dados as unknown as { duracao_s: number | null }).duracao_s = null;
    e.anexosEnviados = e.anexosEnviados.map((a) => (a.arquivoId === 'a9' ? { ...a, duracaoS: 5 } : a));
    const v = verificarAnexos(e);
    expect(v.status).toBe('atencao');
    expect(v.observado).toMatch(/5 s/);
    const semProblema = ok();
    (semProblema.observacoes.find((o) => o.tipo === 'video_geral')!.dados as unknown as { duracao_s: number | null }).duracao_s = null;
    semProblema.anexosEnviados = semProblema.anexosEnviados.map((a) => (a.arquivoId === 'a9' ? { ...a, duracaoS: null } : a));
    expect(verificarAnexos(semProblema).status).toBe('conforme');
  });
  test('documento enviado cuja análise falhou não é contado como ausente', () => {
    const e = ok();
    e.anexosEnviados = e.anexosEnviados.map((a) => (a.tipo === 'nf_ambev' ? { ...a, falhou: true } : a));
    e.observacoes = e.observacoes.filter((o) => o.tipo !== 'nf_ambev');
    const v = verificarAnexos(e);
    expect(v.status).toBe('atencao');
    expect(v.observado).toMatch(/1 arquivo\(s\) não analisado/);
    expect(v.observado).not.toMatch(/faltam/);
  });
});

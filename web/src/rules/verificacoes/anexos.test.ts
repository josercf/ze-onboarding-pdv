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
  test('câmara fria não é obrigatória', () => {
    const e = ok(); e.observacoes = e.observacoes.filter((o) => o.tipo !== 'camara_fria'); e.anexosEnviados = e.anexosEnviados.filter((a) => a.tipo !== 'camara_fria');
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
});

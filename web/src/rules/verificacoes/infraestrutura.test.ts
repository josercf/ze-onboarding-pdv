import { describe, expect, test } from 'vitest';
import type { DadosCamaraFria, DadosEquipamentos, DadosFachada, DadosVideoGeral } from '../../tipos';
import { naoOk, ok } from '../testes/fixtures';
import { contarRefrigeradores, verificarCamaraFria, verificarComputador, verificarFachada, verificarImpressora, verificarMaquininhas, verificarRefrigeradores } from './infraestrutura';

const video = (e: ReturnType<typeof ok>) => e.observacoes.find((o) => o.tipo === 'video_geral')!.dados as unknown as DadosVideoGeral;
const semTipos = (e: ReturnType<typeof ok>, ...tipos: string[]) => { e.observacoes = e.observacoes.filter((o) => !tipos.includes(o.tipo)); return e; };

describe('fixtures', () => {
  test('caso aprovado: itens 7 a 12 conforme', () => {
    const e = ok();
    for (const fn of [verificarRefrigeradores, verificarCamaraFria, verificarFachada, verificarMaquininhas, verificarComputador, verificarImpressora]) {
      const v = fn(e);
      expect(v.status, `${v.id} ${v.item}: ${v.observado}`).toBe('conforme');
    }
  });
  test('caso reprovado: 7 divergente, 8 e 9 atenção, 10 a 12 conforme', () => {
    const e = naoOk();
    expect(verificarRefrigeradores(e).status).toBe('divergente');
    expect(verificarCamaraFria(e).status).toBe('atencao');
    expect(verificarCamaraFria(e).observado).toMatch(/freezer de gelo/);
    expect(verificarFachada(e).status).toBe('atencao');
    expect(verificarMaquininhas(e).status).toBe('conforme');
    expect(verificarComputador(e).status).toBe('conforme');
    expect(verificarImpressora(e).status).toBe('conforme');
  });
});

describe('refrigeradores', () => {
  test('máximo entre vídeo e fotos, sem freezer de gelo e sem fotos não aderentes', () => {
    expect(contarRefrigeradores(ok()).total).toBe(6);
    expect(contarRefrigeradores(naoOk())).toMatchObject({ total: 2, detalhe: '2 no vídeo, 1 nas fotos' });
  });
  test('observado acima do declarado não penaliza', () => {
    const e = ok();
    e.formulario = { ...e.formulario, qtdRefrigeradores: 4 };
    expect(verificarRefrigeradores(e).status).toBe('conforme');
  });
  test('abaixo do mínimo da região é divergente mesmo batendo com o declarado', () => {
    const e = ok();
    e.parametros = { ...e.parametros, minRefrigeradores: 8 };
    expect(verificarRefrigeradores(e).status).toBe('divergente');
  });
  test('sem foto e sem vídeo é não verificável', () => {
    expect(verificarRefrigeradores(semTipos(ok(), 'refrigerador', 'video_geral')).status).toBe('nao_verificavel');
  });
  test('evidência cita timestamps do vídeo', () => {
    expect(verificarRefrigeradores(ok()).evidencia).toContain('t=00:04');
  });
  test('foto de refrigerador com dados incompletos não derruba a verificação (regressão)', () => {
    const e = ok();
    for (const o of e.observacoes) if (o.tipo === 'refrigerador') o.dados = {};
    expect(() => verificarRefrigeradores(e)).not.toThrow();
    expect(contarRefrigeradores(e).detalhe).toMatch(/, 0 nas fotos$/);
  });
});

describe('câmara fria', () => {
  test('declarou sim e o anexo não é câmara: divergente', () => {
    const e = ok();
    (e.observacoes.find((o) => o.tipo === 'camara_fria')!.dados as unknown as DadosCamaraFria).e_camara_frigorifica = false;
    video(e).camara_fria = { presente: false, timestamp_s: null };
    expect(verificarCamaraFria(e).status).toBe('divergente');
  });
  test('declarou sim sem anexo e sem vídeo: não verificável', () => {
    expect(verificarCamaraFria(semTipos(ok(), 'camara_fria', 'video_geral')).status).toBe('nao_verificavel');
  });
  test('declarou não com câmara obrigatória na região: divergente', () => {
    const e = naoOk();
    e.parametros = { ...e.parametros, camaraFriaObrigatoria: true };
    expect(verificarCamaraFria(e).status).toBe('divergente');
  });
  test('declarou não, não obrigatória, sem anexo: conforme', () => {
    const e = semTipos(naoOk(), 'camara_fria');
    expect(verificarCamaraFria(e).status).toBe('conforme');
  });
});

describe('fachada', () => {
  test('loja fechada com letreiro é atenção', () => {
    const e = ok();
    (e.observacoes.find((o) => o.tipo === 'fachada')!.dados as unknown as DadosFachada).tipo_local = 'loja_fechada';
    expect(verificarFachada(e).status).toBe('atencao');
  });
  test('sem fachada, vídeo em loja vale como conforme; vídeo em depósito vale como atenção', () => {
    expect(verificarFachada(semTipos(ok(), 'fachada')).status).toBe('conforme');
    expect(verificarFachada(semTipos(naoOk(), 'fachada')).status).toBe('atencao');
  });
  test('sem fachada e sem vídeo é não verificável', () => {
    expect(verificarFachada(semTipos(ok(), 'fachada', 'video_geral')).status).toBe('nao_verificavel');
  });
  test('fachada com dados incompletos não derruba a verificação (regressão)', () => {
    const e = ok();
    e.observacoes.find((o) => o.tipo === 'fachada')!.dados = {};
    expect(() => verificarFachada(e)).not.toThrow();
  });
});

describe('maquininhas, computador e impressora', () => {
  test('declarou 3 e aparece 1: divergente; declarou 2 e aparece 1: conforme', () => {
    const e = naoOk();
    e.formulario = { ...e.formulario, qtdMaquininhas: 3 };
    expect(verificarMaquininhas(e).status).toBe('divergente');
    expect(verificarMaquininhas(naoOk()).status).toBe('conforme');
  });
  test('nenhuma maquininha visível é divergente', () => {
    const e = ok();
    (e.observacoes.find((o) => o.tipo === 'equipamentos')!.dados as unknown as DadosEquipamentos).maquininhas = [];
    video(e).equipamentos.maquininhas = [];
    expect(verificarMaquininhas(e).status).toBe('divergente');
  });
  test('declarou computador e impressora e nada aparece: divergente', () => {
    const e = ok();
    const eq = e.observacoes.find((o) => o.tipo === 'equipamentos')!.dados as unknown as DadosEquipamentos;
    eq.computador = false; eq.impressora_termica = { presente: false, marca: null };
    video(e).equipamentos = { ...video(e).equipamentos, computador: false, impressora_termica: { presente: false, marca: null } };
    expect(verificarComputador(e).status).toBe('divergente');
    expect(verificarImpressora(e).status).toBe('divergente');
  });
  test('declarou não ter computador ou impressora: atenção para o time', () => {
    const e = ok();
    e.formulario = { ...e.formulario, computadorInternet: 'nao', impressoraTermica: 'nao' };
    expect(verificarComputador(e).status).toBe('atencao');
    expect(verificarImpressora(e).status).toBe('atencao');
  });
  test('sem foto do balcão e sem vídeo: não verificável', () => {
    const e = semTipos(ok(), 'equipamentos', 'video_geral');
    expect(verificarMaquininhas(e).status).toBe('nao_verificavel');
    expect(verificarComputador(e).status).toBe('nao_verificavel');
    expect(verificarImpressora(e).status).toBe('nao_verificavel');
  });
});

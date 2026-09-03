// web/src/ui/EtapaAnalise.test.tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { ErroApi, type ClienteN8n } from '../api/clienteN8n';
import { CLASSIFICACAO_PENDENTE, estadoInicial, reduzir, type Anexo, type EstadoApp } from '../fluxo/estadoApp';
import type { Observacao } from '../tipos';
import { EtapaAnalise } from './EtapaAnalise';

const anexo = (id: string, tipo: Anexo['tipo']): Anexo => ({ arquivoId: id, arquivo: new File(['x'], `${id}.jpeg`, { type: 'image/jpeg' }), nome: `${id}.jpeg`, mime: 'image/jpeg', tipo, duracaoS: null, estado: 'na_fila', classificacao: CLASSIFICACAO_PENDENTE });
const obs = (id: string, tipo: string): Observacao => ({
  arquivo_id: id, tipo: tipo as Observacao['tipo'], nome: `${id}.jpeg`, mime: 'image/jpeg', modelo: 'm', tokens: { entrada: 1, saida: 1 }, latencia_ms: 1,
  aderente_ao_tipo: true, confianca: 0.9, resumo: 'ok', qualidade: { nitidez: 'boa', iluminacao: 'boa', observacao: '' }, dados: {}, evidencias: [], alertas: [],
});

function estadoBase(): EstadoApp {
  const e = estadoInicial();
  return { ...e, etapa: 3, formulario: { ...e.formulario, cnpj: '11222333000181', codigoParceiro: '0011223', qtdRefrigeradores: 2, camaraFria: 'sim' }, anexos: [anexo('a1', 'fachada'), anexo('a2', 'refrigerador')] };
}

function Harness({ cliente }: { cliente: ClienteN8n }) {
  const [estado, despachar] = useReducer(reduzir, undefined, estadoBase);
  return (<><EtapaAnalise estado={estado} despachar={despachar} cliente={cliente} hoje={() => new Date('2026-09-02T12:00:00Z')} /><output data-testid="etapa">{estado.etapa}</output><output data-testid="verificacoes">{estado.verificacoes.length}</output></>);
}

describe('EtapaAnalise', () => {
  test('analisa cada arquivo com o contexto, mostra falha com motivo e permite repetir', async () => {
    let falharA2 = true;
    const analisarArquivo = vi.fn(async (p: { arquivoId: string; tipo: string }) => {
      if (p.arquivoId === 'a2' && falharA2) throw new Error('Sem resposta em 95 s');
      return obs(p.arquivoId, p.tipo);
    });
    const cliente = { analisarArquivo, consolidar: vi.fn() } as unknown as ClienteN8n;
    render(<Harness cliente={cliente} />);

    const linhaA1 = await screen.findByRole('listitem', { name: 'a1.jpeg' });
    expect(await within(linhaA1).findByText('Concluído')).toBeInTheDocument();
    const linhaA2 = screen.getByRole('listitem', { name: 'a2.jpeg' });
    expect(await within(linhaA2).findByText(/Falhou: Sem resposta em 95 s/)).toBeInTheDocument();
    expect(analisarArquivo).toHaveBeenCalledWith(expect.objectContaining({ arquivoId: 'a1', tipo: 'fachada', contexto: expect.objectContaining({ cnpj: '11222333000181', codigo_parceiro_declarado: '0011223', qtd_refrigeradores_declarada: 2, camara_fria_declarada: 'sim' }) }));

    expect(screen.getByRole('button', { name: /Continuar/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Continuar/ })).toHaveTextContent('1 arquivo(s) não analisado(s)');

    falharA2 = false;
    await userEvent.click(within(linhaA2).getByRole('button', { name: 'Repetir' }));
    expect(await within(linhaA2).findByText('Concluído')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument();
  });

  test('continuar roda o motor e avança para o relatório', async () => {
    const cliente = { analisarArquivo: vi.fn(async (p: { arquivoId: string; tipo: string }) => obs(p.arquivoId, p.tipo)), consolidar: vi.fn() } as unknown as ClienteN8n;
    render(<Harness cliente={cliente} />);
    await screen.findAllByText('Concluído');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByTestId('etapa')).toHaveTextContent('4');
    expect(screen.getByTestId('verificacoes')).toHaveTextContent('16');
  });

  test('anexo falho com código auth mostra aviso de configuração e desabilita Repetir', async () => {
    const analisarArquivo = vi.fn(async (p: { arquivoId: string; tipo: string }) => {
      if (p.arquivoId === 'a1') throw new ErroApi('auth', 'O serviço respondeu HTTP 403', 403);
      return obs(p.arquivoId, p.tipo);
    });
    const cliente = { analisarArquivo, consolidar: vi.fn() } as unknown as ClienteN8n;
    render(<Harness cliente={cliente} />);

    const linhaA1 = await screen.findByRole('listitem', { name: 'a1.jpeg' });
    await within(linhaA1).findByText(/Falhou:/);
    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('Token do n8n ausente ou inválido. Verifique a configuração (VITE_N8N_TOKEN) antes de repetir.');
    expect(within(linhaA1).getByRole('button', { name: 'Repetir' })).toBeDisabled();
  });

  test('Repetir fica desabilitado enquanto qualquer item da fila ainda está em andamento', async () => {
    let resolverA1: (o: Observacao) => void = () => {};
    const pendenteA1 = new Promise<Observacao>((resolve) => { resolverA1 = resolve; });
    const analisarArquivo = vi.fn(async (p: { arquivoId: string; tipo: string }) => {
      if (p.arquivoId === 'a1') return pendenteA1;
      throw new Error('Falha imediata');
    });
    const cliente = { analisarArquivo, consolidar: vi.fn() } as unknown as ClienteN8n;
    render(<Harness cliente={cliente} />);

    const linhaA2 = await screen.findByRole('listitem', { name: 'a2.jpeg' });
    await within(linhaA2).findByText(/Falhou:/);
    expect(within(linhaA2).getByRole('button', { name: 'Repetir' })).toBeDisabled();

    resolverA1(obs('a1', 'fachada'));
    await within(screen.getByRole('listitem', { name: 'a1.jpeg' })).findByText('Concluído');
    expect(within(linhaA2).getByRole('button', { name: 'Repetir' })).toBeEnabled();
  });
});

// web/src/ui/EtapaRelatorio.test.tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { describe, expect, test, vi } from 'vitest';
import type { ClienteN8n, PayloadConsolidar } from '../api/clienteN8n';
import { estadoInicial, reduzir, type Anexo, type EstadoApp } from '../fluxo/estadoApp';
import type { EntradaMotor } from '../rules/base';
import { avaliar } from '../rules/motor';
import { naoOk, ok } from '../rules/testes/fixtures';
import type { Parecer } from '../tipos';
import { EtapaRelatorio } from './EtapaRelatorio';

const parecer: Parecer = { parecer: 'Material consistente com o declarado.', pontos_de_atencao: ['Conferir horário na fachada'], recomendacao_sugerida: 'apto', justificativa: 'Todos os itens conformes.', modelo: 'google/gemini-2.5-pro', tokens: { entrada: 5000, saida: 300 } };

function estadoDe(entrada: EntradaMotor): EstadoApp {
  const { verificacoes, recomendacao } = avaliar(entrada);
  const anexos: Anexo[] = entrada.observacoes.map((o) => ({ arquivoId: o.arquivo_id, arquivo: new File(['x'], o.nome, { type: o.mime }), nome: o.nome, mime: o.mime, tipo: o.tipo, duracaoS: null, estado: 'concluido', observacao: o, classificacao: { estado: 'concluida', tipoDetectado: o.tipo, confianca: 0.9, motivo: 'teste' } }));
  return { ...estadoInicial(), etapa: 4, formulario: entrada.formulario, receita: entrada.receita, parametros: entrada.parametros, anexos, verificacoes, recomendacao };
}

function Harness({ cliente, entrada }: { cliente: ClienteN8n; entrada: EntradaMotor }) {
  const [estado, despachar] = useReducer(reduzir, undefined, () => estadoDe(entrada));
  return (<><EtapaRelatorio estado={estado} despachar={despachar} cliente={cliente} agora={() => new Date('2026-09-02T15:04:00')} /><output data-testid="etapa">{estado.etapa}</output></>);
}
const clienteCom = (consolidar: unknown) => ({ analisarArquivo: vi.fn(), consolidar } as unknown as ClienteN8n);

describe('EtapaRelatorio', () => {
  test('caso aprovado: cabeçalho, 16 linhas, parecer e rodapé', async () => {
    const consolidar = vi.fn(async (_p: PayloadConsolidar) => parecer);
    render(<Harness cliente={clienteCom(consolidar)} entrada={ok()} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Relatório de conformidade');
    expect(screen.getByText('EXEMPLO COMERCIO DE BEBIDAS LTDA')).toBeInTheDocument();
    const cabecalho = screen.getByText('EXEMPLO COMERCIO DE BEBIDAS LTDA').closest('p') as HTMLElement;
    expect(within(cabecalho).getByText('11.222.333/0001-81')).toBeInTheDocument();
    expect(screen.getByTestId('recomendacao')).toHaveTextContent('Apto');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(17);
    expect(await screen.findByText('Material consistente com o declarado.')).toBeInTheDocument();
    expect(screen.getByText('Conferir horário na fachada')).toBeInTheDocument();
    expect(consolidar).toHaveBeenCalledTimes(1);
    expect(consolidar.mock.calls[0][0]).toMatchObject({ recomendacao_regras: 'apto' });
    expect((consolidar.mock.calls[0][0] as { verificacoes: unknown[] }).verificacoes).toHaveLength(16);
    expect(screen.getByText(/google\/gemini-2\.5-flash/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 't=00:24' })).toBeInTheDocument();
    expect(cabecalho).not.toHaveClass('introducao');
  });

  test('caso reprovado: recomendação Não apto e divergentes destacados', async () => {
    render(<Harness cliente={clienteCom(vi.fn(async () => ({ ...parecer, recomendacao_sugerida: 'nao_apto' })))} entrada={naoOk()} />);
    expect(screen.getByTestId('recomendacao')).toHaveTextContent('Não apto');
    expect(screen.getAllByText('Divergente')).toHaveLength(2);
    expect(screen.getAllByText('Atenção')).toHaveLength(4);
    expect(await screen.findByText('Material consistente com o declarado.')).toBeInTheDocument();
  });

  test('modelo discordando das regras gera nota', async () => {
    render(<Harness cliente={clienteCom(vi.fn(async () => ({ ...parecer, recomendacao_sugerida: 'revisao_manual' })))} entrada={ok()} />);
    expect(await screen.findByText(/O modelo sugeriu "Revisão manual"/)).toBeInTheDocument();
  });

  test('falha no parecer mostra erro e permite gerar novamente', async () => {
    const consolidar = vi.fn().mockRejectedValueOnce(new Error('O serviço respondeu HTTP 502')).mockResolvedValueOnce(parecer);
    render(<Harness cliente={clienteCom(consolidar)} entrada={ok()} />);
    expect(await screen.findByText(/O serviço respondeu HTTP 502/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Gerar parecer novamente' }));
    expect(await screen.findByText('Material consistente com o declarado.')).toBeInTheDocument();
  });

  test('nova análise volta à etapa 1', async () => {
    render(<Harness cliente={clienteCom(vi.fn(async () => parecer))} entrada={ok()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Nova análise' }));
    expect(screen.getByTestId('etapa')).toHaveTextContent('1');
  });
});

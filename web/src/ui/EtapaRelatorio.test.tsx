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
    expect(within(screen.getByRole('table')).getAllByText('Divergente')).toHaveLength(2);
    expect(within(screen.getByRole('table')).getAllByText('Atenção')).toHaveLength(4);
    expect(await screen.findByText('Material consistente com o declarado.')).toBeInTheDocument();
  });

  test('modelo discordando das regras gera nota', async () => {
    render(<Harness cliente={clienteCom(vi.fn(async () => ({ ...parecer, recomendacao_sugerida: 'revisao_manual' })))} entrada={ok()} />);
    expect(await screen.findByText(/O modelo sugeriu "Revisão manual"/)).toBeInTheDocument();
  });

  test('o resumo mostra a contagem por situação nos dois casos', async () => {
    const { unmount } = render(<Harness cliente={clienteCom(vi.fn(async () => parecer))} entrada={ok()} />);
    const itens = () => within(screen.getByRole('list', { name: 'Contagem por situação' })).getAllByRole('listitem');
    expect(itens().map((li) => li.textContent)).toEqual(['16 Conforme', '0 Divergente', '0 Atenção', '0 Não verificável']);
    unmount();

    render(<Harness cliente={clienteCom(vi.fn(async () => parecer))} entrada={naoOk()} />);
    expect(itens().map((li) => li.textContent)).toEqual(['9 Conforme', '2 Divergente', '4 Atenção', '1 Não verificável']);
  });

  test('os pontos de atenção do parecer aparecem no topo, uma única vez', async () => {
    render(<Harness cliente={clienteCom(vi.fn(async () => parecer))} entrada={ok()} />);
    expect(await screen.findByText('Conferir horário na fachada')).toBeInTheDocument();
    expect(screen.getAllByText('Conferir horário na fachada')).toHaveLength(1);
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

  test('o botão Nova análise é secundário e Imprimir ou salvar PDF continua primário', async () => {
    render(<Harness cliente={clienteCom(vi.fn(async () => parecer))} entrada={ok()} />);
    expect(await screen.findByText('Material consistente com o declarado.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova análise' })).toHaveClass('secundario');
    expect(screen.getByRole('button', { name: 'Imprimir ou salvar PDF' })).not.toHaveClass('secundario');
  });

  test('mostra o tipo detectado por arquivo e destaca reclassificações', async () => {
    const entrada = ok();
    const estado = estadoDe(entrada);
    estado.anexos[0].classificacao = { estado: 'concluida', tipoDetectado: 'refrigerador', confianca: 0.8, motivo: 'teste' };
    const video = estado.anexos.find((a) => a.tipo === 'video_geral')!;
    video.classificacao = { estado: 'concluida', tipoDetectado: 'video_geral', confianca: 1, motivo: 'Vídeo MP4 só pode ser vídeo geral' };
    function HarnessFixo({ cliente }: { cliente: ClienteN8n }) {
      const [e, despachar] = useReducer(reduzir, undefined, () => estado);
      return <EtapaRelatorio estado={e} despachar={despachar} cliente={cliente} agora={() => new Date('2026-09-02T15:04:00')} />;
    }
    render(<HarnessFixo cliente={clienteCom(vi.fn(async () => parecer))} />);
    expect(await screen.findByText('Material consistente com o declarado.')).toBeInTheDocument();
    expect(screen.getByText(/\(detectado como Refrigerador, reclassificado\)/)).toBeInTheDocument();
    expect(screen.getAllByText(/\(detectado automaticamente\)/)).toHaveLength(estado.anexos.length - 1);
    expect(screen.getByText(/Classificação automática: 7 de 8 arquivos aceitos sem correção/)).toBeInTheDocument();
  });
});

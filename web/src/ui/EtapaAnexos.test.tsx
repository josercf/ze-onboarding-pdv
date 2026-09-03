import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { estadoInicial, reduzir } from '../fluxo/estadoApp';
import { EtapaAnexos } from './EtapaAnexos';

const MB = 1048576;
const arquivo = (nome: string, mime: string, tamanho = MB) => {
  const f = new File(['x'], nome, { type: mime });
  Object.defineProperty(f, 'size', { value: tamanho });
  return f;
};

function Harness() {
  const [estado, despachar] = useReducer(reduzir, undefined, () => ({ ...estadoInicial(), etapa: 2 as const }));
  return (<><EtapaAnexos estado={estado} despachar={despachar} obterDuracao={async () => 18} /><output data-testid="etapa">{estado.etapa}</output></>);
}

const entrada = () => screen.getByLabelText('Adicionar arquivos') as HTMLInputElement;
const linha = (nome: string) => screen.getByRole('listitem', { name: nome });

describe('EtapaAnexos', () => {
  test('sugere o tipo pelo nome, mostra duração do vídeo e habilita continuar', async () => {
    render(<Harness />);
    await userEvent.upload(entrada(), [arquivo('fachada 2.jpeg', 'image/jpeg'), arquivo('VIDEO 1.mp4', 'video/mp4', 4 * MB)]);
    expect(within(linha('fachada 2.jpeg')).getByRole('combobox')).toHaveValue('fachada');
    expect(within(linha('VIDEO 1.mp4')).getByRole('combobox')).toHaveValue('video_geral');
    expect(await within(linha('VIDEO 1.mp4')).findByText('18 s')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });

  test('sem tipo sugerido, exige escolha antes de continuar', async () => {
    render(<Harness />);
    await userEvent.upload(entrada(), arquivo('gelo.jpeg', 'image/jpeg'));
    const combo = within(linha('gelo.jpeg')).getByRole('combobox');
    expect(combo).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    await userEvent.selectOptions(combo, 'refrigerador');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });

  test('recusa arquivo grande com o motivo e não cria linha', async () => {
    render(<Harness />);
    await userEvent.upload(entrada(), arquivo('VIDEO grande.mp4', 'video/mp4', 12 * MB));
    expect(screen.getByRole('alert')).toHaveTextContent('WhatsApp');
    expect(screen.queryByRole('listitem', { name: 'VIDEO grande.mp4' })).toBeNull();
  });

  test('tipo incompatível com o formato mostra erro na linha e mantém sem tipo', async () => {
    render(<Harness />);
    await userEvent.upload(entrada(), arquivo('clipe.mp4', 'video/mp4'));
    const combo = within(linha('clipe.mp4')).getByRole('combobox');
    await userEvent.selectOptions(combo, 'refrigerador');
    expect(within(linha('clipe.mp4')).getByText(/Formato não aceito/)).toBeInTheDocument();
    expect(combo).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    await userEvent.selectOptions(combo, 'video_geral');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });

  test('miniatura cria a object URL uma vez por arquivo e revoga ao desmontar', async () => {
    const criar = vi.spyOn(URL, 'createObjectURL').mockClear();
    const revogar = vi.spyOn(URL, 'revokeObjectURL').mockClear();
    const { unmount } = render(<Harness />);
    await userEvent.upload(entrada(), arquivo('gelo.jpeg', 'image/jpeg'));
    expect(criar).toHaveBeenCalledTimes(1);

    const combo = within(linha('gelo.jpeg')).getByRole('combobox');
    await userEvent.selectOptions(combo, 'refrigerador');
    expect(criar).toHaveBeenCalledTimes(1);

    unmount();
    expect(revogar).toHaveBeenCalledTimes(1);
  });

  test('checklist reflete os tipos obrigatórios e remover funciona', async () => {
    render(<Harness />);
    await userEvent.upload(entrada(), arquivo('fachada.jpeg', 'image/jpeg'));
    const checklist = screen.getByRole('list', { name: 'Checklist de anexos' });
    expect(within(checklist).getByText('Fachada: ok')).toBeInTheDocument();
    expect(within(checklist).getByText('NF Ambev: faltando')).toBeInTheDocument();
    expect(within(checklist).queryByText(/Câmara fria/)).toBeNull();
    await userEvent.click(within(linha('fachada.jpeg')).getByRole('button', { name: 'Remover' }));
    expect(screen.queryByRole('listitem', { name: 'fachada.jpeg' })).toBeNull();
  });

  test('continuar avança para a etapa 3 e voltar retorna à 1', async () => {
    render(<Harness />);
    await userEvent.upload(entrada(), arquivo('fachada.jpeg', 'image/jpeg'));
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByTestId('etapa')).toHaveTextContent('3');
  });

  test('com computador declarado, checklist exige Balcão e equipamentos', async () => {
    function HarnessComComputador() {
      const [estado, despachar] = useReducer(reduzir, undefined, () => ({ ...estadoInicial(), etapa: 2 as const, formulario: { ...estadoInicial().formulario, computadorInternet: 'sim' } }));
      return (<><EtapaAnexos estado={estado} despachar={despachar} obterDuracao={async () => 18} /></>);
    }
    render(<HarnessComComputador />);
    const checklist = screen.getByRole('list', { name: 'Checklist de anexos' });
    expect(within(checklist).getByText('Balcão e equipamentos: faltando')).toBeInTheDocument();
  });

  test('sem computador nem impressora declarados, Balcão e equipamentos não aparece no checklist', async () => {
    function HarnessComputadorEImpressoraNao() {
      const [estado, despachar] = useReducer(reduzir, undefined, () => ({ ...estadoInicial(), etapa: 2 as const, formulario: { ...estadoInicial().formulario, computadorInternet: 'nao', impressoraTermica: 'nao' } }));
      return (<><EtapaAnexos estado={estado} despachar={despachar} obterDuracao={async () => 18} /></>);
    }
    render(<HarnessComputadorEImpressoraNao />);
    const checklist = screen.getByRole('list', { name: 'Checklist de anexos' });
    expect(within(checklist).queryByText(/Balcão e equipamentos/)).toBeNull();
  });
});

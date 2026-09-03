import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { ErroApi, type ClienteN8n } from '../api/clienteN8n';
import { estadoInicial, reduzir } from '../fluxo/estadoApp';
import type { Formulario, RespostaClassificacao } from '../tipos';
import { EtapaAnexos } from './EtapaAnexos';

const MB = 1048576;
const arquivo = (nome: string, mime: string, tamanho = MB) => {
  const f = new File(['x'], nome, { type: mime });
  Object.defineProperty(f, 'size', { value: tamanho });
  return f;
};
type Classificar = ClienteN8n['classificarArquivo'];
const classificacaoDe = (tipo: RespostaClassificacao['tipo_detectado'], confianca = 0.9): RespostaClassificacao =>
  ({ arquivo_id: 'x', nome: 'x', mime: 'image/jpeg', tipo_detectado: tipo, confianca, motivo: `parece ${tipo}`, modelo: 'm', tokens: { entrada: 1, saida: 1 }, latencia_ms: 1 });
const porNome = (mapa: Record<string, RespostaClassificacao | Error>) => vi.fn(async (p: { nome: string }) => {
  const r = mapa[p.nome];
  if (r instanceof Error) throw r;
  return r;
}) as unknown as Classificar;

function Harness({ classificar, formulario }: { classificar: Classificar; formulario?: Partial<Formulario> }) {
  const [estado, despachar] = useReducer(reduzir, undefined, () => {
    const e = estadoInicial();
    return { ...e, etapa: 2 as const, formulario: { ...e.formulario, ...formulario } };
  });
  return (<><EtapaAnexos estado={estado} despachar={despachar} cliente={{ classificarArquivo: classificar }} obterDuracao={async () => 18} /><div data-testid="etapa">{estado.etapa}</div></>);
}

const entrada = () => screen.getByLabelText('Adicionar arquivos') as HTMLInputElement;
const linha = (nome: string) => screen.getByRole('listitem', { name: nome });
const continuar = () => screen.getByRole('button', { name: 'Continuar' });
const TODOS = { 'fachada.jpeg': classificacaoDe('fachada'), 'geladeira.jpeg': classificacaoDe('refrigerador'), 'balcao.jpeg': classificacaoDe('equipamentos'), 'nf.jpeg': classificacaoDe('nf_ambev'), 'cartao.pdf': classificacaoDe('cartao_cnpj') };
const subirTodos = async () => userEvent.upload(entrada(), [arquivo('fachada.jpeg', 'image/jpeg'), arquivo('geladeira.jpeg', 'image/jpeg'), arquivo('balcao.jpeg', 'image/jpeg'), arquivo('nf.jpeg', 'image/jpeg'), arquivo('cartao.pdf', 'application/pdf'), arquivo('tour.mp4', 'video/mp4', 4 * MB)]);

describe('EtapaAnexos', () => {
  test('classifica em lote, preenche o tipo com confiança alta, pede escolha com confiança baixa e não classifica vídeo', async () => {
    const classificar = porNome({ 'fachada.jpeg': classificacaoDe('fachada', 0.92), 'gelo.jpeg': classificacaoDe('refrigerador', 0.4) });
    render(<Harness classificar={classificar} />);
    await userEvent.upload(entrada(), [arquivo('fachada.jpeg', 'image/jpeg'), arquivo('gelo.jpeg', 'image/jpeg'), arquivo('tour.mp4', 'video/mp4', 4 * MB)]);
    expect(await within(linha('fachada.jpeg')).findByText('Fachada, detectado')).toBeInTheDocument();
    expect(within(linha('fachada.jpeg')).getByRole('combobox')).toHaveValue('fachada');
    expect(await within(linha('gelo.jpeg')).findByText('Escolha o tipo', { selector: '.selo' })).toBeInTheDocument();
    expect(within(linha('gelo.jpeg')).getByRole('combobox')).toHaveValue('');
    expect(within(linha('gelo.jpeg')).getByText('parece refrigerador')).toBeInTheDocument();
    expect(within(linha('tour.mp4')).getByRole('combobox')).toHaveValue('video_geral');
    expect(await within(linha('tour.mp4')).findByText('18 s')).toBeInTheDocument();
    expect(classificar).toHaveBeenCalledTimes(2);
  });

  test('enquanto classifica, o seletor fica desabilitado e Continuar explica o motivo', async () => {
    let resolver!: (r: RespostaClassificacao) => void;
    const classificar = vi.fn(() => new Promise<RespostaClassificacao>((res) => { resolver = res; })) as unknown as Classificar;
    render(<Harness classificar={classificar} />);
    await userEvent.upload(entrada(), arquivo('fachada.jpeg', 'image/jpeg'));
    const combo = within(linha('fachada.jpeg')).getByRole('combobox');
    expect(combo).toBeDisabled();
    expect(within(linha('fachada.jpeg')).getByText('Classificando...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Aguarde a classificação terminar');
    resolver(classificacaoDe('fachada'));
    await waitFor(() => expect(combo).toBeEnabled());
    expect(combo).toHaveValue('fachada');
  });

  test('falha na classificação deixa o arquivo sem tipo, com aviso, e o usuário escolhe à mão', async () => {
    render(<Harness classificar={porNome({ 'foto.jpeg': new Error('O serviço respondeu HTTP 500') })} />);
    await userEvent.upload(entrada(), arquivo('foto.jpeg', 'image/jpeg'));
    expect(await within(linha('foto.jpeg')).findByText('Não foi possível classificar automaticamente.')).toBeInTheDocument();
    const combo = within(linha('foto.jpeg')).getByRole('combobox');
    expect(combo).toHaveValue('');
    await userEvent.selectOptions(combo, 'refrigerador');
    expect(combo).toHaveValue('refrigerador');
    expect(within(linha('foto.jpeg')).getByText('Refrigerador', { selector: '.selo' })).toBeInTheDocument();
  });

  test('falha de autenticação mostra o aviso de token e não chama o webhook para os próximos arquivos', async () => {
    const classificar = porNome({ 'a.jpeg': new ErroApi('auth', 'token inválido', 401) });
    render(<Harness classificar={classificar} />);
    await userEvent.upload(entrada(), arquivo('a.jpeg', 'image/jpeg'));
    expect(await screen.findByRole('alert')).toHaveTextContent('VITE_N8N_TOKEN');
    await userEvent.upload(entrada(), arquivo('b.jpeg', 'image/jpeg'));
    expect(await within(linha('b.jpeg')).findByText('Não foi possível classificar automaticamente.')).toBeInTheDocument();
    expect(classificar).toHaveBeenCalledTimes(1);
  });

  test('recusa arquivo grande com o motivo e não cria linha', async () => {
    render(<Harness classificar={porNome({})} />);
    await userEvent.upload(entrada(), arquivo('VIDEO grande.mp4', 'video/mp4', 12 * MB));
    expect(screen.getByRole('alert')).toHaveTextContent('WhatsApp');
    expect(screen.queryByRole('listitem', { name: 'VIDEO grande.mp4' })).toBeNull();
  });

  test('tipo incompatível com o formato mostra erro na linha e mantém sem tipo', async () => {
    render(<Harness classificar={porNome({})} />);
    await userEvent.upload(entrada(), arquivo('clipe.mp4', 'video/mp4'));
    const combo = within(linha('clipe.mp4')).getByRole('combobox');
    expect(combo).toHaveValue('video_geral');
    await userEvent.selectOptions(combo, 'refrigerador');
    expect(within(linha('clipe.mp4')).getByText(/Formato não aceito/)).toBeInTheDocument();
    expect(combo).toHaveValue('');
    await userEvent.selectOptions(combo, 'video_geral');
    expect(combo).toHaveValue('video_geral');
  });

  test('miniatura cria a object URL uma vez por arquivo e revoga ao desmontar', async () => {
    const criar = vi.spyOn(URL, 'createObjectURL').mockClear();
    const revogar = vi.spyOn(URL, 'revokeObjectURL').mockClear();
    const { unmount } = render(<Harness classificar={porNome({ 'gelo.jpeg': classificacaoDe('refrigerador') })} />);
    await userEvent.upload(entrada(), arquivo('gelo.jpeg', 'image/jpeg'));
    await within(linha('gelo.jpeg')).findByText('Refrigerador, detectado');
    expect(criar).toHaveBeenCalledTimes(1);
    await userEvent.selectOptions(within(linha('gelo.jpeg')).getByRole('combobox'), 'fachada');
    expect(criar).toHaveBeenCalledTimes(1);
    unmount();
    expect(revogar).toHaveBeenCalledTimes(1);
    criar.mockRestore();
    revogar.mockRestore();
  });

  test('Continuar só habilita com todos os obrigatórios presentes, mostra o que falta e avança para a etapa 3', async () => {
    render(<Harness classificar={porNome(TODOS)} />);
    await userEvent.upload(entrada(), arquivo('fachada.jpeg', 'image/jpeg'));
    await within(linha('fachada.jpeg')).findByText('Fachada, detectado');
    expect(continuar()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Falta: Refrigerador, Balcão e equipamentos, NF Ambev, Cartão CNPJ, Vídeo geral');
    await subirTodos();
    await waitFor(() => expect(continuar()).toBeEnabled());
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    await userEvent.click(continuar());
    expect(screen.getByTestId('etapa')).toHaveTextContent('3');
  });

  test('a região de aviso existe desde o início, mesmo antes de qualquer arquivo', () => {
    render(<Harness classificar={porNome({})} />);
    const regiao = screen.getByRole('status');
    expect(regiao).toBeInTheDocument();
    expect(regiao).toHaveTextContent('Adicione ao menos um arquivo');
  });

  test('câmara fria declarada "sim" entra na lista do que falta', async () => {
    render(<Harness classificar={porNome(TODOS)} formulario={{ camaraFria: 'sim' }} />);
    await subirTodos();
    await within(linha('cartao.pdf')).findByText('Cartão CNPJ, detectado');
    expect(continuar()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Falta: Câmara fria');
  });

  test('voltar retorna à etapa 1', async () => {
    render(<Harness classificar={porNome({})} />);
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByTestId('etapa')).toHaveTextContent('1');
  });

  test('clicar em um documento do checklist abre o seletor e atribui o tipo ao arquivo enviado, mesmo com classificação diferente', async () => {
    const abrir = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    render(<Harness classificar={porNome({ 'nota.jpeg': classificacaoDe('fachada', 0.95) })} />);
    await userEvent.click(screen.getByRole('button', { name: /Adicionar NF Ambev/ }));
    expect(abrir).toHaveBeenCalledTimes(1);
    await userEvent.upload(entrada(), arquivo('nota.jpeg', 'image/jpeg'));
    await waitFor(() => expect(within(linha('nota.jpeg')).getByRole('combobox')).toBeEnabled());
    expect(within(linha('nota.jpeg')).getByRole('combobox')).toHaveValue('nf_ambev');
    expect(within(linha('nota.jpeg')).getByText('NF Ambev', { selector: '.selo' })).toBeInTheDocument();
    abrir.mockRestore();
  });

  test('no celular o painel começa recolhido', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((consulta: string) => ({ matches: consulta.includes('720px'), media: consulta, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia;
    try {
      render(<Harness classificar={porNome({})} />);
      expect(screen.getByText(/Documentos do PDV/).closest('details')).not.toHaveAttribute('open');
    } finally {
      window.matchMedia = original;
    }
  });
});

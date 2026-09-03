import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { CLASSIFICACAO_PENDENTE, estadoInicial, type Anexo, type EstadoApp } from '../fluxo/estadoApp';
import { PainelDocumentos } from './PainelDocumentos';

const anexo = (id: string, tipo: Anexo['tipo']): Anexo => ({ arquivoId: id, arquivo: new File(['x'], `${id}.jpeg`, { type: 'image/jpeg' }), nome: `${id}.jpeg`, mime: 'image/jpeg', tipo, duracaoS: null, estado: 'na_fila', classificacao: CLASSIFICACAO_PENDENTE });
const estadoCom = (anexos: Anexo[], camaraFria: 'sim' | 'nao' = 'sim'): EstadoApp => {
  const e = estadoInicial();
  return { ...e, etapa: 2, formulario: { ...e.formulario, camaraFria }, anexos };
};

describe('PainelDocumentos', () => {
  test('lista obrigatórios primeiro na ordem da configuração, com contagem, situação e resumo', () => {
    render(<PainelDocumentos estado={estadoCom([anexo('a1', 'fachada'), anexo('a2', 'fachada')])} aberto aoEscolher={vi.fn()} />);
    expect(screen.getByText('Documentos do PDV: 1 de 7 obrigatórios enviados')).toBeInTheDocument();
    const itens = within(screen.getByRole('list', { name: 'Checklist de documentos' })).getAllByRole('listitem');
    expect(itens.map((li) => li.textContent)).toEqual([
      'Fachadaobrigatório · 2 arquivo(s)ok',
      'Refrigeradorobrigatório · 0 arquivo(s)falta',
      'Câmara friaobrigatório · 0 arquivo(s)falta',
      'Balcão e equipamentosobrigatório · 0 arquivo(s)falta',
      'NF Ambevobrigatório · 0 arquivo(s)falta',
      'Cartão CNPJobrigatório · 0 arquivo(s)falta',
      'Vídeo geralobrigatório · 0 arquivo(s)falta',
    ]);
    expect(itens[0]).toHaveClass('ok');
    expect(itens[1]).toHaveClass('falta');
  });

  test('câmara fria declarada "não" vira opcional e vai para o fim da lista', () => {
    render(<PainelDocumentos estado={estadoCom([], 'nao')} aberto aoEscolher={vi.fn()} />);
    const itens = within(screen.getByRole('list', { name: 'Checklist de documentos' })).getAllByRole('listitem');
    expect(itens[6]).toHaveTextContent('Câmara friaopcional · 0 arquivo(s)');
    expect(itens[6]).toHaveClass('opcional');
    expect(screen.getByText('Documentos do PDV: 0 de 6 obrigatórios enviados')).toBeInTheDocument();
  });

  test('clicar em um item chama aoEscolher com o tipo', async () => {
    const aoEscolher = vi.fn();
    render(<PainelDocumentos estado={estadoCom([])} aberto aoEscolher={aoEscolher} />);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar NF Ambev' }));
    expect(aoEscolher).toHaveBeenCalledWith('nf_ambev');
  });

  test('aberto=false deixa o painel recolhido', () => {
    render(<PainelDocumentos estado={estadoCom([])} aberto={false} aoEscolher={vi.fn()} />);
    expect(screen.getByText(/Documentos do PDV/).closest('details')).not.toHaveAttribute('open');
  });
});

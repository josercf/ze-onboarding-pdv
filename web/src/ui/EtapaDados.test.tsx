// web/src/ui/EtapaDados.test.tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { ErroBrasilApi } from '../cnpj/brasilapi';
import { estadoInicial, reduzir } from '../fluxo/estadoApp';
import type { Receita } from '../tipos';
import { EtapaDados } from './EtapaDados';

const receita: Receita = {
  cnpj: '11222333000181', razaoSocial: 'EXEMPLO COMERCIO DE BEBIDAS LTDA', nomeFantasia: 'ARMAZEM EXEMPLO', situacao: 'ATIVA', dataSituacao: '2021-03-10', dataInicio: '2021-03-10',
  porte: 'MICRO EMPRESA', naturezaJuridica: 'Sociedade Empresária Limitada', mei: false, cnaePrincipal: { codigo: 4723700, descricao: 'Comércio varejista de bebidas' }, cnaesSecundarios: [],
  qsa: [{ nome: 'MARIA EXEMPLO DA SILVA', qualificacao: 'Sócio-Administrador' }],
  endereco: { logradouro: 'RUA EXEMPLO', numero: '40', complemento: '', bairro: 'CENTRO', municipio: 'VOLTA REDONDA', uf: 'RJ', cep: '27250000' },
};

function Harness({ consultar }: { consultar: (cnpj: string) => Promise<Receita> }) {
  const [estado, despachar] = useReducer(reduzir, undefined, estadoInicial);
  return (<><EtapaDados estado={estado} despachar={despachar} consultar={consultar} /><output data-testid="etapa">{estado.etapa}</output></>);
}

async function preencherRestante() {
  const u = userEvent.setup();
  await u.type(screen.getByLabelText('Nome completo do responsável pelo CNPJ'), 'Maria Exemplo da Silva');
  await u.clear(screen.getByLabelText('Quantidade de refrigeradores')); await u.type(screen.getByLabelText('Quantidade de refrigeradores'), '6');
  await u.type(screen.getByLabelText('Código de parceiro Ambev'), '0011223');
  await u.type(screen.getByLabelText('Dias e horário de funcionamento do delivery'), 'segunda a domingo, 10h às 23h');
}

describe('EtapaDados', () => {
  test('CNPJ válido consulta a Receita, mostra o card e preenche o endereço', async () => {
    const consultar = vi.fn(async () => receita);
    render(<Harness consultar={consultar} />);
    await userEvent.type(screen.getByLabelText('CNPJ'), '11222333000181');
    await waitFor(() => expect(consultar).toHaveBeenCalledWith('11222333000181'));
    expect(await screen.findByText('EXEMPLO COMERCIO DE BEBIDAS LTDA')).toBeInTheDocument();
    expect(screen.getByLabelText('CNPJ')).toHaveValue('11.222.333/0001-81');
    expect(screen.getByLabelText('Logradouro')).toHaveValue('RUA EXEMPLO');
    expect(screen.getByText('47.23-7/00 Comércio varejista de bebidas')).toBeInTheDocument();
  });

  test('CNPJ inválido não consulta e bloqueia o avanço com mensagem', async () => {
    const consultar = vi.fn(async () => receita);
    render(<Harness consultar={consultar} />);
    await userEvent.type(screen.getByLabelText('CNPJ'), '11222333000180');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(consultar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um CNPJ válido.');
    expect(screen.getByTestId('etapa')).toHaveTextContent('1');
  });

  test('falha na Receita mostra o aviso e ainda permite seguir', async () => {
    const consultar = vi.fn(async () => { throw new ErroBrasilApi('nao_encontrado', 'CNPJ não encontrado na Receita Federal.'); });
    render(<Harness consultar={consultar} />);
    await userEvent.type(screen.getByLabelText('CNPJ'), '11222333000181');
    expect(await screen.findByText('CNPJ não encontrado na Receita Federal.')).toBeInTheDocument();
    await preencherRestante();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByTestId('etapa')).toHaveTextContent('2');
  });

  test('parâmetros de avaliação ficam em um painel recolhido e são editáveis', async () => {
    render(<Harness consultar={vi.fn(async () => receita)} />);
    await userEvent.click(screen.getByText('Parâmetros de avaliação'));
    const min = screen.getByLabelText('Mínimo de refrigeradores na região');
    expect(min).toHaveValue(4);
    await userEvent.clear(min); await userEvent.type(min, '2');
    expect(min).toHaveValue(2);
    expect(screen.getByLabelText('Câmara fria obrigatória na região')).not.toBeChecked();
  });

  test('os cinco blocos agrupam os campos da etapa 1', () => {
    render(<Harness consultar={vi.fn(async () => receita)} />);
    const blocos = ['Identificação', 'Endereço do ponto de venda', 'Estrutura e equipamentos', 'Operação e entrega', 'Fiscal e comercial'];
    for (const nome of blocos) expect(screen.getByRole('group', { name: nome })).toBeInTheDocument();

    const em = (nome: string) => within(screen.getByRole('group', { name: nome }));
    expect(em('Identificação').getByLabelText('CNPJ')).toBeInTheDocument();
    expect(em('Endereço do ponto de venda').getByLabelText('Logradouro')).toBeInTheDocument();
    expect(em('Estrutura e equipamentos').getByLabelText('Quantidade de refrigeradores')).toBeInTheDocument();
    expect(em('Operação e entrega').getByLabelText('Dias e horário de funcionamento do delivery')).toBeInTheDocument();
    expect(em('Fiscal e comercial').getByLabelText('Emite cupom fiscal?')).toBeInTheDocument();
  });
});

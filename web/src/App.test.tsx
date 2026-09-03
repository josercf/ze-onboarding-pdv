import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import App from './App';

vi.mock('./config', () => ({ config: { n8nBaseUrl: '', n8nToken: '' } }));
vi.mock('./cnpj/brasilapi', () => ({
  consultarCnpj: vi.fn(async () => ({
    cnpj: '11222333000181', razaoSocial: 'EXEMPLO COMERCIO DE BEBIDAS LTDA', nomeFantasia: 'ARMAZEM EXEMPLO', situacao: 'ATIVA', dataSituacao: '2021-03-10', dataInicio: '2021-03-10',
    porte: 'MICRO EMPRESA', naturezaJuridica: 'Sociedade Empresária Limitada', mei: false, cnaePrincipal: { codigo: 4723700, descricao: 'Comércio varejista de bebidas' }, cnaesSecundarios: [],
    qsa: [{ nome: 'MARIA EXEMPLO DA SILVA', qualificacao: 'Sócio-Administrador' }],
    endereco: { logradouro: 'RUA EXEMPLO', numero: '40', complemento: '', bairro: 'CENTRO', municipio: 'VOLTA REDONDA', uf: 'RJ', cep: '27250000' },
  })),
}));

test('exibe o título e começa na etapa 1', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: 'Onboarding de PDV' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('1. Dados do PDV');
  const atual = screen.getByRole('list', { name: 'Etapas' }).querySelector('[aria-current="step"]');
  expect(atual).toHaveTextContent('Dados do PDV');
});

test('parágrafo introdutório usa a classe escondida na impressão', () => {
  render(<App />);
  expect(screen.getByText('Envie os dados e os arquivos do seu ponto de venda para a validação.')).toHaveClass('introducao');
});

test('sem VITE_N8N_BASE_URL, o aviso de serviço não configurado já aparece na etapa 2, não só na 3', async () => {
  render(<App />);
  expect(screen.queryByRole('alert')).toBeNull();
  await userEvent.type(screen.getByLabelText('CNPJ'), '11222333000181');
  await screen.findByText('EXEMPLO COMERCIO DE BEBIDAS LTDA');
  await userEvent.type(screen.getByLabelText('Nome completo do responsável pelo CNPJ'), 'Maria Exemplo da Silva');
  await userEvent.type(screen.getByLabelText('Código de parceiro Ambev'), '0011223');
  await userEvent.type(screen.getByLabelText('Dias e horário de funcionamento do delivery'), 'segunda a domingo, 10h às 23h');
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('2. Fotos, vídeos e documentos');
  expect(await screen.findByRole('alert')).toHaveTextContent('Serviço de análise não configurado (VITE_N8N_BASE_URL).');
});

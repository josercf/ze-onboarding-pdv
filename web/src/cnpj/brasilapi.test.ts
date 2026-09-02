import { describe, expect, test, vi } from 'vitest';
import { ErroBrasilApi, consultarCnpj } from './brasilapi';

const BRUTO = {
  cnpj: '12345678000195', razao_social: '12.345.678 JOAO EXEMPLO DE SOUZA', nome_fantasia: null,
  descricao_situacao_cadastral: 'ATIVA', data_situacao_cadastral: '2023-11-12', data_inicio_atividade: '2023-11-12',
  porte: 'MICRO EMPRESA', natureza_juridica: 'Empresário (Individual)', opcao_pelo_mei: true,
  cnae_fiscal: 4723700, cnae_fiscal_descricao: 'Comércio varejista de bebidas',
  cnaes_secundarios: [{ codigo: 4729601, descricao: 'Tabacaria' }], qsa: [],
  logradouro: '', numero: '', complemento: null, bairro: 'BRAS', municipio: 'SAO PAULO', uf: 'SP', cep: '03005000',
};

const respostaJson = (status: number, corpo: unknown) => vi.fn(async () => new Response(JSON.stringify(corpo), { status }));

describe('consultarCnpj', () => {
  test('mapeia os campos da BrasilAPI para Receita', async () => {
    const fetchFn = respostaJson(200, BRUTO);
    const r = await consultarCnpj('12.345.678/0001-95', fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledWith('https://brasilapi.com.br/api/cnpj/v1/12345678000195');
    expect(r).toMatchObject({
      cnpj: '12345678000195', razaoSocial: '12.345.678 JOAO EXEMPLO DE SOUZA', nomeFantasia: '', situacao: 'ATIVA', mei: true,
      naturezaJuridica: 'Empresário (Individual)', cnaePrincipal: { codigo: 4723700, descricao: 'Comércio varejista de bebidas' },
      cnaesSecundarios: [{ codigo: 4729601, descricao: 'Tabacaria' }], qsa: [],
      endereco: { logradouro: '', numero: '', complemento: '', bairro: 'BRAS', municipio: 'SAO PAULO', uf: 'SP', cep: '03005000' },
    });
  });
  test('mapeia sócios do QSA', async () => {
    const fetchFn = respostaJson(200, { ...BRUTO, qsa: [{ nome_socio: 'MARIA EXEMPLO', qualificacao_socio: 'Sócio-Administrador' }] });
    const r = await consultarCnpj('12345678000195', fetchFn as unknown as typeof fetch);
    expect(r.qsa).toEqual([{ nome: 'MARIA EXEMPLO', qualificacao: 'Sócio-Administrador' }]);
  });
  test('404 vira nao_encontrado', async () => {
    await expect(consultarCnpj('12345678000195', respostaJson(404, { message: 'x' }) as unknown as typeof fetch)).rejects.toMatchObject({ codigo: 'nao_encontrado' });
  });
  test('500 e falha de rede viram indisponivel', async () => {
    await expect(consultarCnpj('12345678000195', respostaJson(500, {}) as unknown as typeof fetch)).rejects.toBeInstanceOf(ErroBrasilApi);
    const rede = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    await expect(consultarCnpj('12345678000195', rede as unknown as typeof fetch)).rejects.toMatchObject({ codigo: 'indisponivel' });
  });
});

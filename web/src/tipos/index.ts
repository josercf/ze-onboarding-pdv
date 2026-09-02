import type { TipoAnexo } from '@shared/schemas/index';

export type { TipoAnexo };

export type SimNao = 'sim' | 'nao';
export type Nivel = 'boa' | 'media' | 'ruim';
export type CodigoAlerta = 'foto_de_tela' | 'imagem_internet' | 'ambiente_divergente' | 'texto_ilegivel' | 'outro';
export type StatusVerificacao = 'conforme' | 'divergente' | 'atencao' | 'nao_verificavel';
export type Recomendacao = 'apto' | 'revisao_manual' | 'nao_apto';

export interface Endereco { logradouro: string; numero: string; complemento: string; bairro: string; municipio: string; uf: string; cep: string }

export interface Formulario {
  cnpj: string; responsavel: string; possuiSocio: SimNao; contaCorrente: SimNao;
  qtdRefrigeradores: number; camaraFria: SimNao; qtdEntregadores: number; qtdMaquininhas: number;
  computadorInternet: SimNao; impressoraTermica: SimNao; cupomFiscal: SimNao; cupomFiscalObs: string;
  cnaeBebidas: SimNao; parceiroAmbev: SimNao; codigoParceiro: string; trabalha300ml: SimNao;
  lojaAtivaZe: SimNao; horarioDelivery: string; endereco: Endereco;
}

export interface Cnae { codigo: number; descricao: string }
export interface Socio { nome: string; qualificacao: string }
export interface Receita {
  cnpj: string; razaoSocial: string; nomeFantasia: string; situacao: string; dataSituacao: string; dataInicio: string;
  porte: string; naturezaJuridica: string; mei: boolean; cnaePrincipal: Cnae; cnaesSecundarios: Cnae[]; qsa: Socio[]; endereco: Endereco;
}

export interface ParametrosRegiao { minRefrigeradores: number; camaraFriaObrigatoria: boolean; minEntregadores: number }

export interface Evidencia { ref: string; descricao: string }
export interface Alerta { codigo: CodigoAlerta; descricao: string }
export interface Observacao {
  arquivo_id: string; tipo: TipoAnexo; nome: string; mime: string; modelo: string;
  tokens: { entrada: number; saida: number }; latencia_ms: number;
  aderente_ao_tipo: boolean; confianca: number; resumo: string;
  qualidade: { nitidez: Nivel; iluminacao: Nivel; observacao: string };
  dados: Record<string, unknown>; evidencias: Evidencia[]; alertas: Alerta[];
}

export type CategoriaRefrigerador = 'expositor_vertical' | 'freezer_horizontal' | 'geladeira_domestica' | 'freezer_gelo' | 'outro';
export interface DadosFachada { tipo_local: 'loja_aberta' | 'loja_fechada' | 'galpao_deposito' | 'residencia' | 'indefinido'; letreiro: string | null; numero_imovel: string | null; porta: 'aberta' | 'fechada' | 'nao_visivel' }
export interface DadosRefrigerador { unidades: { categoria: CategoriaRefrigerador; marca: string | null; ligado: boolean | null; conteudo: string[] }[] }
export interface DadosCamaraFria { e_camara_frigorifica: boolean; tipo_equipamento: 'camara' | 'freezer_gelo' | 'container' | 'outro'; indicios: string[]; estoque_visivel: 'alto' | 'medio' | 'baixo' | 'vazio' }
export interface DadosEquipamentos { computador: boolean; impressora_termica: { presente: boolean; marca: string | null }; maquininhas: { marca: string | null }[]; roteador: boolean }
export interface DadosNfAmbev {
  emitente: { nome: string | null; cnpj: string | null };
  destinatario: { nome: string | null; cnpj: string | null; codigo_cliente: string | null; endereco: string | null };
  numero: string | null; data_emissao: string | null; valor_total: number | null; itens_300ml: boolean; legivel: boolean;
}
export interface DadosCartaoCnpj { cnpj: string | null; razao_social: string | null; situacao: string | null; cnae_principal: string | null; endereco: string | null; data_emissao: string | null }
export interface DadosVideoGeral {
  duracao_s: number | null; refrigeradores: { categoria: CategoriaRefrigerador; marca: string | null; timestamp_s: number }[];
  camara_fria: { presente: boolean; timestamp_s: number | null }; ambiente: 'loja' | 'deposito' | 'misto';
  entregadores: { motos: number; bags: number; pessoas_entregando: number }; equipamentos: DadosEquipamentos; transcricao: string | null;
}

export interface Verificacao { id: number; item: string; declarado: string; observado: string; status: StatusVerificacao; evidencia: string; critico: boolean; obrigatorio: boolean }
export interface AnexoEnviado { arquivoId: string; tipo: TipoAnexo; nome: string; duracaoS: number | null; falhou: boolean }
export interface Parecer { parecer: string; pontos_de_atencao: string[]; recomendacao_sugerida: Recomendacao; justificativa: string; modelo: string; tokens: { entrada: number; saida: number } }
export interface Contexto { cnpj: string; razao_social: string; codigo_parceiro_declarado: string; qtd_refrigeradores_declarada: number; camara_fria_declarada: SimNao }

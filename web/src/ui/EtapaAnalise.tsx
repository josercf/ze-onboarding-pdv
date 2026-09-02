// web/src/ui/EtapaAnalise.tsx
import { useEffect, useRef } from 'react';
import { TIPOS_CONFIG } from '@shared/config/index';
import { montarContexto, type ClienteN8n } from '../api/clienteN8n';
import { anexosParaMotor, observacoesDoEstado, podeAvancar, type Acao, type Anexo, type EstadoApp } from '../fluxo/estadoApp';
import { executarFila, type ItemFila } from '../fluxo/filaAnalise';
import { avaliar } from '../rules/motor';
import type { TipoAnexo } from '../tipos';
import { Botoes } from './componentes';
import { ROTULO_ESTADO_ITEM } from './rotulos';

interface Props { estado: EstadoApp; despachar: (a: Acao) => void; cliente: ClienteN8n; hoje?: () => Date }

export function EtapaAnalise({ estado, despachar, cliente, hoje = () => new Date() }: Props) {
  const iniciado = useRef(false);
  const contexto = montarContexto(estado.formulario, estado.receita);

  function analisar(anexos: Anexo[]) {
    const itens: ItemFila[] = anexos.filter((a) => a.tipo).map((a) => ({ arquivoId: a.arquivoId, arquivo: a.arquivo, nome: a.nome, tipo: a.tipo as TipoAnexo, estado: a.estado === 'concluido' ? 'concluido' : 'na_fila', observacao: a.observacao }));
    void executarFila(itens, (item) => cliente.analisarArquivo({ arquivo: item.arquivo, nome: item.nome, tipo: item.tipo, arquivoId: item.arquivoId, contexto }), {
      aoMudar: (item) => despachar({ tipo: 'anexo_estado', valor: { arquivoId: item.arquivoId, estado: item.estado, observacao: item.observacao, erro: item.erro } }),
    });
  }

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    analisar(estado.anexos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function continuar() {
    const { verificacoes, recomendacao } = avaliar({
      formulario: estado.formulario, receita: estado.receita, parametros: estado.parametros,
      observacoes: observacoesDoEstado(estado), anexosEnviados: anexosParaMotor(estado), hoje: hoje(),
    });
    despachar({ tipo: 'resultado', verificacoes, recomendacao });
    despachar({ tipo: 'etapa', valor: 4 });
  }

  const terminados = estado.anexos.filter((a) => a.estado === 'concluido' || a.estado === 'falhou').length;
  const falhos = estado.anexos.filter((a) => a.estado === 'falhou').length;
  const emAndamento = estado.anexos.some((a) => a.estado === 'na_fila' || a.estado === 'analisando');

  return (
    <section aria-labelledby="t-analise">
      <h2 id="t-analise">3. Análise dos arquivos</h2>
      <p>Cada arquivo é analisado individualmente. Isso leva de 10 a 40 segundos por arquivo.</p>
      <progress aria-label="Progresso da análise" max={estado.anexos.length} value={terminados} role="progressbar" aria-valuemin={0} aria-valuemax={estado.anexos.length} aria-valuenow={terminados} />
      <ul className="fila" aria-label="Arquivos em análise">
        {estado.anexos.map((a) => (
          <li key={a.arquivoId} aria-label={a.nome} className={`estado-${a.estado}`}>
            <strong>{a.nome}</strong>
            <span>{a.tipo ? TIPOS_CONFIG[a.tipo].rotulo : 'Sem tipo'}</span>
            {a.estado === 'falhou'
              ? <span className="erro">Falhou: {a.erro}</span>
              : <span>{ROTULO_ESTADO_ITEM[a.estado]}</span>}
            {a.estado === 'falhou' && <button type="button" disabled={emAndamento} onClick={() => analisar([a])}>Repetir</button>}
          </li>
        ))}
      </ul>
      {falhos > 0 && terminados === estado.anexos.length && (
        <p className="aviso">Arquivos não analisados entram no relatório como "Não verificável". Você pode repetir cada um ou seguir assim.</p>
      )}
      <Botoes>
        <button type="button" disabled={!podeAvancar(estado)} onClick={continuar}>
          {falhos > 0 ? `Continuar com ${falhos} arquivo(s) não analisado(s)` : 'Continuar'}
        </button>
      </Botoes>
    </section>
  );
}

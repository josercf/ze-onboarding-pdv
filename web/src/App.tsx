// web/src/App.tsx
import { useMemo, useReducer } from 'react';
import { criarClienteN8n } from './api/clienteN8n';
import { config } from './config';
import { estadoInicial, reduzir } from './fluxo/estadoApp';
import { EtapaAnalise } from './ui/EtapaAnalise';
import { EtapaAnexos } from './ui/EtapaAnexos';
import { EtapaDados } from './ui/EtapaDados';
import { EtapaRelatorio } from './ui/EtapaRelatorio';

const ETAPAS = ['Dados do PDV', 'Anexos', 'Análise', 'Relatório'];

export default function App() {
  const [estado, despachar] = useReducer(reduzir, undefined, estadoInicial);
  const cliente = useMemo(() => criarClienteN8n({ baseUrl: config.n8nBaseUrl, token: config.n8nToken }), []);
  return (
    <main className="app">
      <header>
        <h1>Onboarding de PDV</h1>
        <p className="introducao">Envie os dados e os arquivos do seu ponto de venda para a validação.</p>
        <ol className="etapas" aria-label="Etapas">
          {ETAPAS.map((nome, i) => <li key={nome} aria-current={estado.etapa === i + 1 ? 'step' : undefined}>{nome}</li>)}
        </ol>
      </header>
      {!config.n8nBaseUrl && estado.etapa >= 2 && <p role="alert" className="aviso">Serviço de análise não configurado (VITE_N8N_BASE_URL).</p>}
      {estado.etapa === 1 && <EtapaDados estado={estado} despachar={despachar} />}
      {estado.etapa === 2 && <EtapaAnexos estado={estado} despachar={despachar} cliente={cliente} />}
      {estado.etapa === 3 && <EtapaAnalise estado={estado} despachar={despachar} cliente={cliente} />}
      {estado.etapa === 4 && <EtapaRelatorio estado={estado} despachar={despachar} cliente={cliente} />}
    </main>
  );
}

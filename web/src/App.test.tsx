import { render, screen } from '@testing-library/react';
import App from './App';

test('exibe o título e começa na etapa 1', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: 'Onboarding de PDV' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('1. Dados do PDV');
  const atual = screen.getByRole('list', { name: 'Etapas' }).querySelector('[aria-current="step"]');
  expect(atual).toHaveTextContent('Dados do PDV');
});

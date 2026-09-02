import { render, screen } from '@testing-library/react';
import App from './App';

test('exibe o título do produto', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: 'Onboarding de PDV' })).toBeInTheDocument();
});

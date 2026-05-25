import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import App from './App';

test('renders the upgraded login landing page', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /fx trading workspace/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /continue in demo mode/i })).toBeInTheDocument();
});

test('can enter the workspace through demo mode', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: /continue in demo mode/i }));

  expect(await screen.findByText(/next best action/i)).toBeInTheDocument();
});


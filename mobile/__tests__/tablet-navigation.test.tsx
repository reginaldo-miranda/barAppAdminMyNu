import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import TabletMode from '../app/tablet';

jest.mock('../src/services/api', () => {
  const mock = {
    request: jest.fn(async ({ method, url }) => {
      if (method === 'GET' && url === '/setor-impressao/list') {
        return { data: { success: true, data: [ { id: 2, nome: 'Bar', ativo: 1 }, { id: 1, nome: 'cozinha', ativo: 1 } ] } };
      }
      if (method === 'GET' && url.startsWith('/setor-impressao-queue/')) {
        if (url.endsWith('status=pendente')) return { data: { success: true, data: [ { id: 101, saleId: 10 } ] } };
        if (url.endsWith('status=pronto')) return { data: { success: true, data: [ { id: 201, saleId: 10 } ] } };
        if (url.endsWith('status=entregue')) return { data: { success: true, data: [ { id: 301, saleId: 10 } ] } };
      }
      if (method === 'PATCH' && url.startsWith('/setor-impressao-queue/sale/')) {
        return { data: { success: true } };
      }
      return { data: { success: true } };
    }),
  };
  return { apiService: mock, authService: { login: jest.fn(async () => ({ data: { token: 't' } })) } };
});

describe('Tablet navigation flow', () => {
  it('advances to Prontos and Entregues with actions', async () => {
    render(<TabletMode />);

    await waitFor(() => {
      expect(screen.getByText('Pedidos')).toBeTruthy();
      expect(screen.getByText('Bar')).toBeTruthy();
    });

    const btnProntos = await screen.findByText('Prontos');
    fireEvent.press(btnProntos);

    await waitFor(() => {
      expect(screen.getByText('Entregar')).toBeTruthy();
    });

    const btnEntregar = screen.getByText('Entregar');
    fireEvent.press(btnEntregar);

    await waitFor(() => {
      expect(screen.getByText('Limpar entregues')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Limpar entregues'));
  });
});
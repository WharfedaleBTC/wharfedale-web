import './polyfills';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, RouterProvider, useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { Blocks } from './pages/Blocks';
import { Block } from './pages/Block';
import { Home } from './pages/Home';
import { WalletHome } from './pages/Wallet';
import { WalletNew } from './pages/WalletNew';
import { WalletImport } from './pages/WalletImport';
import { WalletBackup } from './pages/WalletBackup';
import { Send } from './pages/Send';
import { Receive } from './pages/Receive';
import { Faucet } from './pages/Faucet';
import { Assets } from './pages/Assets';
import { Docs } from './pages/Docs';
import { client } from './lib/api';

function BlockAtHeight() {
  const { height = '0' } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    client.restText(`block-height/${height}`).then((h) => navigate(`/block/${h.trim()}`, { replace: true }), () => navigate('/blocks', { replace: true }));
  }, [height, navigate]);
  return <main className="shell section"><p className="lead">Loading block {height}…</p></main>;
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'blocks', element: <Blocks /> },
      { path: 'block/:hash', element: <Block /> },
      { path: 'block-height/:height', element: <BlockAtHeight /> },
      { path: 'network', element: <Navigate to="/" replace /> },
      { path: 'wallet', element: <WalletHome /> },
      { path: 'wallet/new', element: <WalletNew /> },
      { path: 'wallet/import', element: <WalletImport /> },
      { path: 'wallet/backup', element: <WalletBackup /> },
      { path: 'wallet/send', element: <Send /> },
      { path: 'wallet/receive', element: <Receive /> },
      { path: 'faucet', element: <Faucet /> },
      { path: 'assets', element: <Assets /> },
      { path: 'docs', element: <Docs /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

const queries = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queries}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

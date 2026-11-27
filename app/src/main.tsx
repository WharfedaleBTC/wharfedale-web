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
import { PlainAssetsPage } from './pages/AssetList';
import { CreateAsset } from './pages/CreateAsset';
import { PlainAsset } from './pages/PlainAsset';
import { AddressPage, TxRoute } from './pages/Tx';
import { RegulatedAsset, RegulatedAssets } from './damp';
import { Docs } from './pages/Docs';
import { client, useConfig } from './lib/api';

function BlockAtHeight() {
  const { height = '0' } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    client.restText(`block-height/${height}`).then((h) => navigate(`/block/${h.trim()}`, { replace: true }), () => navigate('/blocks', { replace: true }));
  }, [height, navigate]);
  return <main className="shell section"><p className="lead">Loading block {height}…</p></main>;
}

/**
 * `/assets`: every asset on the chain. With DAMP configured (and `classicAssets` off) the list
 * includes the regulated assets of its registry; otherwise only plain assets.
 */
function AssetsRoute() {
  const config = useConfig().data;
  if (!config) return null;
  return config.damp && !config.classicAssets ? <RegulatedAssets /> : <PlainAssetsPage />;
}

/** `/assets/:id`: a regulated asset by deployment id when DAMP knows it, otherwise a plain asset by asset id. */
function AssetRoute() {
  const config = useConfig().data;
  if (!config) return null;
  return config.damp && !config.classicAssets ? <RegulatedAsset fallback={<PlainAsset />} /> : <PlainAsset />;
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'blocks', element: <Blocks /> },
      { path: 'block/:hash', element: <Block /> },
      { path: 'block-height/:height', element: <BlockAtHeight /> },
      { path: 'tx/:txid', element: <TxRoute /> },
      { path: 'address/:address', element: <AddressPage /> },
      { path: 'network', element: <Navigate to="/" replace /> },
      { path: 'wallet', element: <WalletHome /> },
      { path: 'wallet/new', element: <WalletNew /> },
      { path: 'wallet/import', element: <WalletImport /> },
      { path: 'wallet/backup', element: <WalletBackup /> },
      { path: 'wallet/send', element: <Send /> },
      { path: 'wallet/receive', element: <Receive /> },
      { path: 'faucet', element: <Faucet /> },
      { path: 'assets', element: <AssetsRoute /> },
      { path: 'assets/new', element: <CreateAsset /> },
      { path: 'assets/:id', element: <AssetRoute /> },
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

// Send a regulated asset: no issuer approval; the deployment's verifier covenant checks the live
// blacklist on chain. Ported from DAMP's holder wallet: the transfer is reviewed against a fresh
// wallet sync and the live policy, and everything is checked again right before signing.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { signTransfer, signerSnapshot } from '@damp/damp-signer';
import { broadcastTransaction, liveAnchorUtxo } from '@damp/chain-wallet';
import { deploymentQueryKeys } from '@damp/deployments';
import { formatUnits, publicManifest, requirePublishedDeployment, shortHash, userFacingError, type Deployment, type PolicySnapshot } from '@damp/domain';
import { esploraUrlForDeployment, requireFreshAnchor, traverseLiveAnchor } from '@damp/esplora';
import {
  createOperationReceipt,
  dismissOperationReceipt,
  finishOperation,
  loadOperationReceipt,
  operationReceiptQueryKey,
  saveOperationReceipt,
  tryBeginOperation,
} from '@damp/operation-receipt';
import { resolvePolicySnapshot } from '@damp/policy-registry';
import { classifyRegulatedFunds } from '@damp/regulated-funds';
import { hasPendingSignerOperation, setSignerOperationPending } from '@damp/signer-operation-state';
import {
  TransferValidationError,
  parseTransferAmount,
  resolveAndValidateRecipientAddress,
  selectTransferFunding,
  type TransferFundingSelection,
} from '@damp/transfer-validation';
import { walletSyncQueryKeys } from '@damp/wallet-query';
import { ensureSignerHolderAddress, synchronizeWallet } from '@damp/wallet-sync';
import { Masthead } from '../components/Layout';
import { Marks } from '../components/motion';
import { ArrowRight } from '../components/icons';
import { client, useConfig } from '../lib/api';
import { Details, useLivePolicy, useRegulatedBalances, useSigner, useWalletGate } from './shared';

type Recipient = { confidentialAddress: string; ownerPublicKey: string };
type Review = {
  amount: string;
  amountUnits: string;
  recipient: Recipient;
  funding: TransferFundingSelection;
  policy: PolicySnapshot;
  anchor: { txid: string; confirmations: number; scriptPubkey: string };
  profileId: string;
  selfSend: boolean;
};
type Errors = { recipient?: string; amount?: string; context?: string };

const outpoints = (utxos: { txid: string; vout: number }[]) => utxos.map((u) => `${u.txid}:${u.vout}`).join(',');

export function RegulatedSend({ deployment }: { deployment: Deployment }) {
  const signer = useSigner();
  const gate = useWalletGate();
  const queryClient = useQueryClient();
  const ticker = deployment.asset.ticker;
  const precision = deployment.asset.precision;
  const native = useConfig().data?.nativeAsset;
  const { sync, snapshot, syncError } = useRegulatedBalances();
  const live = useLivePolicy(deployment);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [checked, setChecked] = useState<{ source: string; address: Recipient } | null>(null);
  const [checking, setChecking] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [review, setReview] = useState<Review | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const broadcasting = useRef(false);
  const attempt = useRef(0);
  const checkRevision = useRef(0);

  const receiptKey = operationReceiptQueryKey(deployment.deploymentId, 'transfer', signer.profileId);
  const receipt = useQuery({
    queryKey: receiptKey,
    enabled: signer.connected && !!signer.profileId,
    staleTime: Infinity,
    queryFn: async () => (await loadOperationReceipt(deployment.deploymentId, 'transfer', signer.profileId!)) ?? null,
  });
  const sent = receipt.data ?? null;
  const confirmed = useQuery({
    queryKey: ['tx-height', sent?.txid],
    enabled: !!sent,
    refetchInterval: (q) => (q.state.data ? false : 1_000),
    queryFn: () => client.txHeight(sent!.txid).then((h) => h ?? null),
  });

  const funds = useMemo(
    () => (snapshot && live.data ? classifyRegulatedFunds(snapshot, deployment, live.data.policy) : undefined),
    [snapshot, live.data, deployment],
  );

  // A new wallet starts a new transfer.
  useEffect(() => {
    attempt.current += 1;
    checkRevision.current += 1;
    setReview(null);
    setErrors({});
    setChecked(null);
    setMessage(null);
  }, [signer.profileId, deployment.deploymentId]);

  // Other DAMP signing waits while this transfer is under review or being signed.
  useEffect(() => {
    const key = `transfer:${deployment.deploymentId}:${signer.profileId ?? 'none'}`;
    setSignerOperationPending(key, Boolean(review || reviewing || busy));
    return () => setSignerOperationPending(key, false);
  }, [busy, review, reviewing, deployment.deploymentId, signer.profileId]);

  function fail(error: unknown) {
    const text = userFacingError(error);
    if (error instanceof TransferValidationError && error.field !== 'context') setErrors((e) => ({ ...e, [error.field]: text }));
    else setErrors((e) => ({ ...e, context: text }));
  }

  async function checkRecipient(value: string) {
    const source = value.trim();
    const revision = ++checkRevision.current;
    if (!source) return setChecked(null);
    setChecking(true);
    try {
      if (!signer.connected) throw new TransferValidationError('context', 'signer', 'Wait for the signer to open before checking the recipient.');
      const address = await resolveAndValidateRecipientAddress(source, deployment);
      if (revision !== checkRevision.current) return;
      setErrors((e) => ({ ...e, recipient: undefined }));
      setChecked({ source, address });
    } catch (error) {
      if (revision === checkRevision.current) {
        setChecked(null);
        fail(error);
      }
    } finally {
      if (revision === checkRevision.current) setChecking(false);
    }
  }

  function checkAmount(value: string) {
    try {
      const parsed = parseTransferAmount(value, precision);
      setErrors((e) => ({ ...e, amount: undefined, context: undefined }));
      if (live.data && snapshot && signer.profileId) {
        selectTransferFunding({ snapshot, deployment, policy: live.data.policy, profileId: signer.profileId, amount: parsed.units });
      }
    } catch (error) {
      fail(error);
    }
  }

  async function startReview() {
    if (inFlight.current) return;
    if (hasPendingSignerOperation()) return setErrors({ context: 'Another signing operation is still open. Finish it first.' });
    const run = ++attempt.current;
    inFlight.current = true;
    setReviewing(true);
    setErrors({});
    setMessage(null);
    const profileId = signer.profileId;
    try {
      const selected = requirePublishedDeployment(deployment);
      if (!signer.connected || !profileId) throw new TransferValidationError('context', 'signer', 'Open a wallet before reviewing a transfer.');
      if (!signer.walletReady) throw new TransferValidationError('context', 'sync', 'Wait for the wallet to finish synchronizing.', true);
      const parsed = parseTransferAmount(amount, precision);
      const address = checked?.source === recipient.trim() ? checked.address : await resolveAndValidateRecipientAddress(recipient, selected);
      const [walletResult, liveResult, own] = await Promise.all([sync.refetch(), live.refetch(), ensureSignerHolderAddress(selected, profileId)]);
      if (run !== attempt.current) return;
      if (walletResult.error || !walletResult.data?.snapshot || walletResult.data.syncError) {
        throw new TransferValidationError('context', 'wallet-sync', walletResult.data?.syncError ?? userFacingError(walletResult.error ?? 'The wallet did not synchronize.'), true);
      }
      if (liveResult.error || !liveResult.data) throw new TransferValidationError('context', 'policy-sync', `Couldn't check the current policy: ${userFacingError(liveResult.error)}`, true);
      const funding = selectTransferFunding({ snapshot: walletResult.data.snapshot, deployment: selected, policy: liveResult.data.policy, profileId, amount: parsed.units });
      if (signerSnapshot().profileId !== profileId) throw new TransferValidationError('context', 'profile-changed', 'The active wallet changed. Review again.');
      setReview({
        amount: parsed.normalized,
        amountUnits: parsed.units.toString(),
        recipient: address,
        funding,
        policy: liveResult.data.policy,
        anchor: liveResult.data.anchor,
        profileId,
        selfSend: own.ownerPublicKey === address.ownerPublicKey,
      });
    } catch (error) {
      if (run === attempt.current) fail(error);
    } finally {
      if (run === attempt.current) {
        inFlight.current = false;
        setReviewing(false);
      }
    }
  }

  async function send() {
    if (!review || !tryBeginOperation(broadcasting, sent)) return;
    setBusy(true);
    setErrors({});
    try {
      const selected = requirePublishedDeployment(deployment);
      const parsed = parseTransferAmount(review.amount, precision);
      const address = await resolveAndValidateRecipientAddress(review.recipient.confidentialAddress, selected);
      if (address.ownerPublicKey !== review.recipient.ownerPublicKey) throw new TransferValidationError('context', 'recipient-changed', 'The recipient changed. Review again.');
      const now = signerSnapshot();
      if (!now.connected || !now.walletReady || now.profileId !== review.profileId || now.network !== selected.network) {
        throw new TransferValidationError('context', 'profile-changed', 'The active wallet changed. Review again.');
      }
      const esplora = esploraUrlForDeployment(selected);
      const [anchor, wallet] = await Promise.all([traverseLiveAnchor(selected, esplora), synchronizeWallet({ profileId: review.profileId, network: selected.network })]);
      if (anchor.live.confirmations < 1) throw new Error('The live verifier output is not confirmed yet.');
      const policy = await resolvePolicySnapshot(selected, anchor.live.scriptPubkey);
      const verifierUtxo = await liveAnchorUtxo(selected, anchor.live.txid);
      const funding = selectTransferFunding({ snapshot: wallet, deployment: selected, policy, profileId: review.profileId, amount: parsed.units });
      if (
        anchor.live.txid !== review.anchor.txid ||
        anchor.live.scriptPubkey !== review.anchor.scriptPubkey ||
        policy.policyRoot !== review.policy.policyRoot ||
        funding.fee !== review.funding.fee ||
        funding.regulatedChange !== review.funding.regulatedChange ||
        outpoints(funding.regulatedUtxos) !== outpoints(review.funding.regulatedUtxos) ||
        outpoints(funding.feeUtxos) !== outpoints(review.funding.feeUtxos)
      ) {
        throw new TransferValidationError('context', 'state-changed', 'The wallet, fee or policy changed since the review. Review again.', true);
      }
      await requireFreshAnchor(selected, anchor.live, esplora);
      if (signerSnapshot().profileId !== review.profileId) throw new TransferValidationError('context', 'profile-changed', 'The active wallet changed. Review again.');
      const result = await signTransfer({
        deployment: publicManifest(selected),
        currentPolicy: policy,
        verifierUtxo,
        regulatedUtxos: funding.regulatedUtxos,
        feeUtxos: funding.feeUtxos,
        recipientAddress: address.confidentialAddress,
        amount: parsed.units.toString(),
        fee: funding.fee.toString(),
      });
      if (signerSnapshot().profileId !== review.profileId) throw new Error('The active wallet changed before broadcast. Review again.');
      const txid = await broadcastTransaction(selected, result.transaction);
      if (txid !== result.txid) throw new Error('The node returned a different transaction id.');
      const done = createOperationReceipt({ deployment: selected, operation: 'transfer', txid, amount: parsed.units.toString(), signerProfileId: review.profileId });
      // Show the sent state before saving it: a storage failure must not re-enable sending.
      queryClient.setQueryData(receiptKey, done);
      try {
        await saveOperationReceipt(done);
      } catch (error) {
        setMessage(`The receipt couldn't be saved for reload: ${userFacingError(error)}`);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: walletSyncQueryKeys.wallet(review.profileId, selected.network) }),
        queryClient.invalidateQueries({ queryKey: ['damp-live-policy', selected.deploymentId] }),
        queryClient.invalidateQueries({ queryKey: deploymentQueryKeys.all }),
      ]);
      setReview(null);
    } catch (error) {
      if (error instanceof TransferValidationError) setReview(null);
      fail(error);
    } finally {
      finishOperation(broadcasting);
      setBusy(false);
    }
  }

  async function startOver() {
    if (signer.profileId) await dismissOperationReceipt(deployment.deploymentId, 'transfer', signer.profileId);
    queryClient.setQueryData(receiptKey, null);
    setRecipient('');
    setAmount('');
    setChecked(null);
    setErrors({});
    setMessage(null);
  }

  const published = deployment.publication === 'published';
  const walletReady = !!snapshot && !syncError && signer.walletReady;
  const policyReady = !!live.data && !live.error;
  const spendable = funds?.spendable ?? 0n;
  const canReview = published && walletReady && policyReady && spendable > 0n && !!checked && checked.source === recipient.trim() && !!amount.trim() && !errors.amount && !reviewing && !checking;
  const state = (ok: boolean, bad = false): 'done' | 'error' | 'active' => (ok ? 'done' : bad ? 'error' : 'active');
  const contextError = errors.context ?? syncError ?? (live.error ? userFacingError(live.error) : undefined);

  return (
    <main>
      <Masthead
        no="03"
        section="Send"
        title={sent ? 'Transfer sent' : review ? 'Confirm the transfer' : `Send ${deployment.asset.name}`}
        back={{ to: '/wallet', label: 'Wallet' }}
        lede={
          funds ? (
            <>
              Spendable <span className="num" style={{ color: 'var(--ink)' }}>{formatUnits(spendable, precision)} {ticker}</span>
              {funds.blacklisted > 0n && <> · {formatUnits(funds.blacklisted, precision)} {ticker} blacklisted</>}
            </>
          ) : (
            'No issuer approval needed: the asset’s covenant checks the blacklist on chain.'
          )
        }
      />
      <section className="shell section section--snug">
        {gate ? (
          <p className="notice">{gate}</p>
        ) : !published ? (
          <p className="notice">Transfers start once the issuer publishes this asset's registry files.</p>
        ) : (
          <div className="split">
            <div className="split__main stack-lg">
              {!sent && contextError && (
                <div className="notice notice--danger" role="alert">
                  <strong>{review ? 'The transfer needs attention.' : "The transfer isn't ready."}</strong> {contextError}
                  <div className="button-row" style={{ marginTop: '0.75rem' }}>
                    <button className="button button--sm button--secondary" type="button" disabled={busy || sync.isFetching} onClick={() => void sync.refetch()}>Refresh wallet</button>
                    <button className="button button--sm button--secondary" type="button" disabled={busy || live.isFetching} onClick={() => void live.refetch()}>Recheck policy</button>
                  </div>
                </div>
              )}
              {funds && funds.blacklisted > 0n && !sent && (
                <p className="notice notice--danger">
                  <strong>{spendable === 0n ? 'All your confirmed coins of this asset are blacklisted.' : 'Some of your coins are blacklisted.'}</strong> {formatUnits(funds.blacklisted, precision)} {ticker} can't be spent.
                </p>
              )}
              {sent ? (
                <div className="stack-lg">
                  <p className="notice notice--ok" role="status">
                    <strong>
                      Sent {formatUnits(sent.amount, precision)} {sent.ticker}.
                    </strong>{' '}
                    <span className="mono">{shortHash(sent.txid, 10, 8)}</span>
                    <br />
                    {confirmed.data ? (
                      <>
                        Confirmed in <Link className="text-link" to={`/block-height/${confirmed.data}`}>block {confirmed.data.toLocaleString('en-US')}</Link>
                      </>
                    ) : (
                      'Waiting for a block…'
                    )}
                  </p>
                  <div className="button-row">
                    <button className="button button--lg button--primary" type="button" onClick={() => void startOver()}>New transfer</button>
                    <Link className="button button--lg button--secondary" to="/wallet">Wallet</Link>
                  </div>
                </div>
              ) : !review ? (
                <form
                  className="stack-lg"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void startReview();
                  }}
                >
                  <div className="field">
                    <label htmlFor="to">To</label>
                    <input
                      id="to"
                      className="input input--mono"
                      value={recipient}
                      placeholder="The recipient's holder address (wfc1…)"
                      spellCheck={false}
                      autoComplete="off"
                      autoCapitalize="none"
                      aria-invalid={!!errors.recipient}
                      onChange={(e) => {
                        setRecipient(e.target.value);
                        checkRevision.current += 1;
                        setChecked(null);
                        setErrors((x) => ({ ...x, recipient: undefined, context: undefined }));
                      }}
                      onBlur={(e) => void checkRecipient(e.target.value)}
                    />
                    <span className={errors.recipient ? 'hint err' : 'hint'}>
                      {errors.recipient ?? (checking ? 'Checking the network and the holder covenant…' : checked ? `A ${ticker} holder address.` : `From the recipient's Receive page for ${ticker}.`)}
                    </span>
                  </div>
                  <div className="field">
                    <label htmlFor="amount">Amount</label>
                    <div className="amount">
                      <input
                        id="amount"
                        inputMode="decimal"
                        value={amount}
                        placeholder="0"
                        autoComplete="off"
                        aria-invalid={!!errors.amount}
                        onChange={(e) => {
                          setAmount(e.target.value);
                          setErrors((x) => ({ ...x, amount: undefined, context: undefined }));
                        }}
                        onBlur={(e) => e.target.value.trim() && checkAmount(e.target.value)}
                      />
                      <span className="amount__unit">{ticker}</span>
                      <button className="button button--sm button--accent" type="button" disabled={!spendable} onClick={() => { const max = formatUnits(spendable, precision).replace(/,/g, ''); setAmount(max); checkAmount(max); }}>
                        Max
                      </button>
                    </div>
                    {errors.amount && <span className="hint err">{errors.amount}</span>}
                  </div>
                  <div className="button-row">
                    <button className="button button--lg button--primary" type="submit" disabled={!canReview} aria-busy={reviewing}>
                      {reviewing ? 'Checking…' : 'Review transfer'} <ArrowRight />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="stack-lg">
                  <dl className="dl">
                    <div><dt>To</dt><dd>{shortHash(review.recipient.confidentialAddress, 14, 10)}</dd></div>
                    <div><dt>Amount</dt><dd>{review.amount} {ticker}</dd></div>
                    <div><dt>Network fee</dt><dd>{formatUnits(review.funding.fee, native?.precision ?? 8)} {native?.ticker ?? 'WBTC'}</dd></div>
                    <div><dt>Change to you</dt><dd>{formatUnits(review.funding.regulatedChange, precision)} {ticker}</dd></div>
                  </dl>
                  {review.selfSend && <p className="notice">This is your own address: you are sending to yourself.</p>}
                  <div className="button-row">
                    <button className="button button--lg button--secondary" type="button" disabled={busy} onClick={() => setReview(null)}>Edit</button>
                    <button className="button button--lg button--primary" type="button" disabled={busy || !signer.walletReady} aria-busy={busy} onClick={() => void send()}>
                      {busy ? 'Signing and sending…' : 'Sign and send'} <ArrowRight />
                    </button>
                  </div>
                  <Details label="Details">
                    <dl className="dl">
                      <div><dt>Asset</dt><dd>{shortHash(deployment.regulatedAsset, 12, 10)}</dd></div>
                      <div><dt>Policy</dt><dd>depth {review.policy.treeDepth} · {review.policy.entryCount} blocked · {shortHash(review.policy.policyRoot, 8, 6)}</dd></div>
                      <div><dt>Verifier</dt><dd>{shortHash(review.anchor.txid, 10, 8)} · {review.anchor.confirmations} conf.</dd></div>
                      <div><dt>Inputs</dt><dd>{review.funding.regulatedUtxos.length} {ticker} · {review.funding.feeUtxos.length} fee</dd></div>
                    </dl>
                  </Details>
                </div>
              )}
              {message && <p className="hint" role="status">{message}</p>}
            </div>
            <div className="split__aside sticky">
              <div className="plate">
                <Marks />
                <div className="panel panel--dark on-dark stack-lg">
                  <span className="label label--mark">Before signing</span>
                  <ol className="steps">
                    <li data-state={state(walletReady, !!syncError)}>Wallet synchronized</li>
                    <li data-state={state(policyReady, !!live.error)}>Live blacklist checked</li>
                    <li data-state={funds ? state(spendable > 0n, true) : 'active'}>{funds ? (spendable > 0n ? `${formatUnits(spendable, precision)} ${ticker} spendable` : `No spendable ${ticker}`) : 'Spendable balance'}</li>
                    <li data-state={sent ? (confirmed.data ? 'done' : 'active') : undefined}>In a block</li>
                  </ol>
                  <p className="hint">
                    The transfer spends the issuer's verifier output and recreates it unchanged; the fee is paid in {native?.ticker ?? 'WBTC'} from your wallet.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

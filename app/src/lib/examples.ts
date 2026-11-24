// General flows in both SDKs, for the Docs page. Kept in step with the SDK READMEs, where the
// Rust versions compile as doctests and the TypeScript versions are type-checked and run.
export interface Example {
  id: string;
  title: string;
  text: string;
  rust: string;
  ts: string;
}

export const EXAMPLES: Example[] = [
  {
    id: 'connect',
    title: 'Connect to a node',
    text: 'One client covers JSON-RPC and the Esplora REST API, served on the same URL. Point it at a full node.',
    rust: `use wharfedale_sdk::Client;

fn main() -> Result<(), wharfedale_sdk::Error> {
    let client = Client::new("http://127.0.0.1:18447");
    let info = client.chain_info()?;
    println!("{} at height {}, fee asset {}", info.chain, info.blocks, info.fee_asset);

    let tip = client.rest_text("blocks/tip/hash")?;
    let block = client.rest(&format!("block/{tip}"))?;
    println!("tip has {} transactions", block["tx_count"]);
    Ok(())
}`,
    ts: `import { Client } from '@wharfedale/sdk';

const client = new Client('http://127.0.0.1:18447');
const info = await client.chainInfo();
console.log(\`\${info.chain} at height \${info.blocks}, fee asset \${info.feeAsset}\`);

const tip = await client.restText('blocks/tip/hash');
const block = await client.rest<{ tx_count: number }>(\`block/\${tip}\`);
console.log(\`tip has \${block.tx_count} transactions\`);`,
  },
  {
    id: 'keys',
    title: 'Create a wallet from a recovery phrase',
    text: 'A 12-word BIP39 phrase; the key is derived at m/86′/1′/0′/0/0. One key gives a confidential wfc1 address and an explicit wf1 address.',
    rust: `use wharfedale_sdk::keys::generate_mnemonic;
use wharfedale_sdk::Key;

fn main() -> Result<(), wharfedale_sdk::Error> {
    let phrase = generate_mnemonic(12)?;
    let key = Key::from_mnemonic(&phrase)?;
    println!("write down: {phrase}");
    println!("confidential: {}", key.address());        // wfc1p…
    println!("explicit:     {}", key.explicit_address()); // wf1p…
    Ok(())
}`,
    ts: `import { Key, generateMnemonic } from '@wharfedale/sdk';

const phrase = generateMnemonic(12);
const key = Key.fromMnemonic(phrase);
console.log('write down:', phrase);
console.log('confidential:', key.address()); // wfc1p…
console.log('explicit:    ', key.explicitAddress()); // wf1p…`,
  },
  {
    id: 'balances',
    title: 'See balances',
    text: 'Coins paid to the key, confirmed and not already spent in the mempool. Confidential coins are unblinded with the key’s blinding key.',
    rust: `use wharfedale_sdk::{Client, Key, Wallet};

fn main() -> Result<(), wharfedale_sdk::Error> {
    let key = Key::from_mnemonic("<your 12 words>")?;
    let wallet = Wallet::new(Client::new("http://127.0.0.1:18447"), key);
    for (asset, amount) in wallet.balances()? {
        println!("{asset}: {amount}");
    }
    Ok(())
}`,
    ts: `import { Client, Key, Wallet } from '@wharfedale/sdk';

const wallet = new Wallet(new Client('http://127.0.0.1:18447'), Key.fromMnemonic('<your 12 words>'));
for (const [asset, amount] of await wallet.balances()) console.log(\`\${asset}: \${amount}\`);`,
  },
  {
    id: 'send',
    title: 'Send a confidential payment',
    text: 'To a wfc1 address the amount and asset are blinded; change is blinded back to you. Dry-run it on the node before sending.',
    rust: `use std::time::Duration;
use wharfedale_sdk::{Client, Key, SendOptions, Wallet};

fn main() -> Result<(), wharfedale_sdk::Error> {
    let client = Client::new("http://127.0.0.1:18447");
    let wallet = Wallet::new(client.clone(), Key::from_mnemonic("<your 12 words>")?);

    let tx = wallet.build_send("wfc1p…", 250_000, &SendOptions::default())?;
    match client.test_accept(&tx)? {
        Ok(()) => {
            let txid = client.send_transaction(&tx)?;
            println!("confirmed at {}", client.wait_for_tx(&txid, Duration::from_secs(60))?);
        }
        Err(reason) => println!("the node would reject it: {reason}"),
    }
    Ok(())
}`,
    ts: `import { Client, Key, Wallet } from '@wharfedale/sdk';

const client = new Client('http://127.0.0.1:18447');
const wallet = new Wallet(client, Key.fromMnemonic('<your 12 words>'));

const tx = await wallet.buildSend('wfc1p…', 250_000);
const reason = await client.testAccept(tx);
if (reason) throw new Error(\`the node would reject it: \${reason}\`);
const txid = await client.sendTransaction(tx);
console.log('confirmed at', await client.waitForTx(txid));`,
  },
  {
    id: 'issue',
    title: 'Issue a named asset',
    text: 'The name, ticker and decimals go on chain (OP_RETURN “WFA1”), bound to the asset id through the issuance contract hash. A reissuance token lets you mint more.',
    rust: `use wharfedale_sdk::{AssetMetadata, Client, Key, Wallet};

fn main() -> Result<(), wharfedale_sdk::Error> {
    let client = Client::new("http://127.0.0.1:18447");
    let issuer = Wallet::new(client.clone(), Key::from_mnemonic("<your 12 words>")?);

    let meta = AssetMetadata::new("Demo Points", "DPT", 2)?;
    // 1 000 000 base units (10 000.00 DPT), 1 reissuance token, fee 1 000.
    let issued = issuer.issue_named(1_000_000, 1, 1_000, &meta)?;
    println!("asset {} (token {})", issued.asset, issued.token);

    // Later, with the token: mint 500.00 more.
    issuer.reissue(issued.asset, 50_000, 1_000)?;
    Ok(())
}`,
    ts: `import { Client, Key, Wallet } from '@wharfedale/sdk';

const client = new Client('http://127.0.0.1:18447');
const issuer = new Wallet(client, Key.fromMnemonic('<your 12 words>'));

// 1 000 000 base units (10 000.00 DPT), 1 reissuance token, fee 1 000.
const issued = await issuer.issue(1_000_000, 1, 1_000, { name: 'Demo Points', ticker: 'DPT', precision: 2 });
console.log(\`asset \${issued.asset} (token \${issued.token})\`);

// Later, with the token: mint 500.00 more.
await issuer.reissue(issued.asset, 50_000);`,
  },
  {
    id: 'contract',
    title: 'Spend a Simplicity contract',
    text: 'Coins locked to a pay-to-public-key contract move only with the owner’s signature over sig_all_hash. Rust compiles SimplicityHL; TypeScript spends from an artifact compiled once (wharfedale-wallet contract-artifact).',
    rust: `use serde_json::json;
use wharfedale_sdk::contract::{self, ContractSpend};
use wharfedale_sdk::{Client, Contract, Key};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::new("http://127.0.0.1:18447");
    let owner = Key::from_mnemonic("<owner's 12 words>")?;
    let source = std::fs::read_to_string("examples/contracts/p2pk.simf")?;
    let args = json!({ "OWNER": format!("0x{}", owner.xonly_public_key()) });
    let p2pk = Contract::compile(&source, &args.to_string())?;
    println!("pay to {}", p2pk.address()); // wf1p…

    let spend = ContractSpend::new("wfc1p…", 60_000, json!({ "SIG": "sign:owner" }));
    let txid = contract::spend(&client, &p2pk, &spend, &|_| Ok(owner.clone()))?;
    println!("{txid}");
    Ok(())
}`,
    ts: `import { readFileSync } from 'node:fs';
import { Client, Key, SignatureContract, type SignatureArtifact } from '@wharfedale/sdk';

const client = new Client('http://127.0.0.1:18447');
const owner = Key.fromMnemonic("<owner's 12 words>");
// {"cmr", "program", "signatures"} from: wharfedale-wallet contract-artifact --program p2pk.simf --args args.json
const p2pk = new SignatureContract(JSON.parse(readFileSync('p2pk.artifact.json', 'utf8')) as SignatureArtifact);
console.log('pay to', p2pk.address()); // wf1p…

const txid = await p2pk.spend(client, { to: 'wfc1p…', amount: 60_000, signers: { SIG: owner } });
console.log(txid);`,
  },
];

/** Pages of the node's mdBook, relative to its base URL. */
export const DOC_PAGES: { path: string; title: string; text: string }[] = [
  { path: 'introduction.html', title: 'Introduction', text: 'What Wharfedale is: Malachite BFT, the Elements transaction format, Simplicity.' },
  { path: 'architecture.html', title: 'Architecture', text: 'Crates, processes and how a transaction becomes a block.' },
  { path: 'configuration.html', title: 'Configuration', text: 'Genesis, config.toml, validators and full nodes, the testnet generator.' },
  { path: 'consensus/index.html', title: 'Consensus', text: 'The application loop, blocks, proposals, the mempool channel.' },
  { path: 'ledger/index.html', title: 'Ledger', text: 'Types, cryptography and the Elements subset the chain accepts.' },
  { path: 'ledger/validation.html', title: 'Validation', text: 'The check pipeline and its map to Elements, deviations included.' },
  { path: 'ledger/simplicity.html', title: 'Simplicity', text: 'Contract outputs, witness layout, budget, the C library.' },
  { path: 'rpc.html', title: 'RPC and Esplora', text: 'JSON-RPC methods, Esplora REST, on-chain asset names (WFA1).' },
  { path: 'sdk.html', title: 'SDKs', text: 'The Rust and TypeScript SDKs, shared test vectors.' },
  { path: 'wallet.html', title: 'Wallet CLI', text: 'wharfedale-wallet: keys, payments, issuance, contracts.' },
  { path: 'docker.html', title: 'Docker', text: 'The local network, the e2e test and the web profile.' },
  { path: 'web.html', title: 'Web app', text: 'This app: screens, server, configuration.' },
];

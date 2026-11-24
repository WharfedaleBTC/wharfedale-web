import { useState } from 'react';
import { copyText } from '../lib/clipboard';

/** A labelled value (an id, an address) shown in full, with a button that copies it. */
export function CopyValue({ label, value }: { label: string; value: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  return (
    <div className="copy-value">
      <div className="copy-value__text">
        <span className="copy-value__label">{label}</span>
        <span className="copy-value__value">{value}</span>
      </div>
      <button
        type="button"
        className="copy-button"
        data-done={state === 'done' ? '' : undefined}
        aria-label={`Copy ${label.toLowerCase()}`}
        onClick={async () => {
          setState((await copyText(value)) ? 'done' : 'failed');
          setTimeout(() => setState('idle'), 1500);
        }}
      >
        {state === 'done' ? 'Copied' : state === 'failed' ? 'Select it' : 'Copy'}
      </button>
    </div>
  );
}

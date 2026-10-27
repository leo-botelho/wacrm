'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const CONFIG_ID = process.env.NEXT_PUBLIC_META_ES_CONFIG_ID;
const GRAPH_VERSION = 'v23.0';

interface FacebookSdk {
  init(opts: Record<string, unknown>): void;
  login(
    cb: (res: { authResponse?: { code?: string } | null }) => void,
    opts: Record<string, unknown>,
  ): void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

interface SignupSession {
  wabaId?: string;
  phoneNumberId?: string;
  code?: string;
}

interface EmbeddedSignupButtonProps {
  onConnected: () => void | Promise<void>;
}

/** Whether the deployment has the Meta app configured for Embedded Signup. */
export const embeddedSignupAvailable = Boolean(APP_ID && CONFIG_ID);

function loadFacebookSdk(): Promise<FacebookSdk> {
  return new Promise((resolve, reject) => {
    if (window.FB) {
      resolve(window.FB);
      return;
    }
    window.fbAsyncInit = () => {
      if (!window.FB) return reject(new Error('Facebook SDK indisponível'));
      window.FB.init({
        appId: APP_ID,
        autoLogAppEvents: true,
        xfbml: false,
        version: GRAPH_VERSION,
      });
      resolve(window.FB);
    };
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => reject(new Error('Falha ao carregar o SDK do Facebook'));
    document.body.appendChild(script);
  });
}

export function EmbeddedSignupButton({ onConnected }: EmbeddedSignupButtonProps) {
  const [busy, setBusy] = useState(false);
  const session = useRef<SignupSession>({});
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;

  // Meta sends the WABA / phone number ids through a postMessage event
  // separate from the FB.login callback (which only carries the code), and
  // either can arrive first — so both feed tryFinish, which fires once all
  // three values are present.
  const tryFinish = useRef(async () => {});
  tryFinish.current = async () => {
    const { code, wabaId, phoneNumberId } = session.current;
    if (!code || !wabaId || !phoneNumberId) return;
    session.current = {};
    try {
      const res = await fetch('/api/whatsapp/embedded-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          waba_id: wabaId,
          phone_number_id: phoneNumberId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Falha ao concluir a conexão');
        return;
      }
      toast.success(
        data.phone_info?.verified_name
          ? `Conectado a ${data.phone_info.verified_name}`
          : 'WhatsApp conectado com sucesso',
      );
      await onConnectedRef.current();
    } catch (err) {
      console.error('Embedded signup finish error:', err);
      toast.error('Falha ao concluir a conexão');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com'
      ) {
        return;
      }
      let payload: unknown;
      try {
        payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      const msg = payload as {
        type?: string;
        event?: string;
        data?: { waba_id?: string; phone_number_id?: string };
      };
      if (msg?.type !== 'WA_EMBEDDED_SIGNUP') return;

      if (msg.event === 'FINISH') {
        session.current.wabaId = msg.data?.waba_id;
        session.current.phoneNumberId = msg.data?.phone_number_id;
        void tryFinish.current();
      } else if (msg.event === 'CANCEL') {
        session.current = {};
        setBusy(false);
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  async function handleClick() {
    setBusy(true);
    session.current = {};
    try {
      const fb = await loadFacebookSdk();
      fb.login(
        (res) => {
          const code = res.authResponse?.code;
          if (!code) {
            setBusy(false);
            return;
          }
          session.current.code = code;
          void tryFinish.current();
        },
        {
          config_id: CONFIG_ID,
          response_type: 'code',
          override_default_response_type: true,
          extras: { setup: {}, sessionInfoVersion: '3' },
        },
      );
    } catch (err) {
      console.error('Embedded signup start error:', err);
      toast.error(err instanceof Error ? err.message : 'Falha ao iniciar a conexão');
      setBusy(false);
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={busy}
      className="bg-[#1877F2] text-white hover:bg-[#1877F2]/90"
    >
      {busy ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Conectando...
        </>
      ) : (
        <>
          <LogIn className="size-4" />
          Conectar com Facebook
        </>
      )}
    </Button>
  );
}

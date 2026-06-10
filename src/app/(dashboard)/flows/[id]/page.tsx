"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { FlowBuilder } from "@/components/flows/flow-builder";
import type { FlowRow, FlowNodeRow } from "@/lib/flows/types";

/**
 * Shell do editor de fluxo.
 *
 * Carrega `{flow, nodes}` de `/api/flows/[id]` e passa para
 * `<FlowBuilder>`. Gerencia o estado de carregamento/erro para que o
 * builder possa focar apenas na edição.
 *
 * Aberto para todos os usuários autenticados — o bloqueio beta que
 * anteriormente retornava 404 para contas não-beta foi removido no PR #134.
 * A API ainda retorna 404 para um flow id que o chamador não possui (RLS),
 * o que se torna o estado "Fluxo não encontrado" abaixo.
 */
export default function FlowEditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [flow, setFlow] = useState<FlowRow | null>(null);
  const [nodes, setNodes] = useState<FlowNodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/flows/${params.id}`);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error(`Falha: ${res.status}`);
        const json = (await res.json()) as {
          flow: FlowRow;
          nodes: FlowNodeRow[];
        };
        if (!cancelled) {
          setFlow(json.flow);
          setNodes(json.nodes ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          toast.error("Não foi possível carregar o fluxo.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }
  if (notFound || !flow) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-slate-400">Fluxo não encontrado.</p>
        <button
          type="button"
          onClick={() => router.push("/flows")}
          className="text-sm text-primary hover:opacity-80"
        >
          ← Voltar para fluxos
        </button>
      </div>
    );
  }

  return <FlowBuilder initialFlow={flow} initialNodes={nodes} />;
}

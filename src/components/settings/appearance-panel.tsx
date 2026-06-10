"use client";

import { Check } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";
import { THEMES, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";

/**
 * Painel de aparência — seletor de tema de cor.
 *
 * Clique em um cartão → aplica e persiste imediatamente. Sem botão salvar:
 * a alteração é uma simples troca de variável CSS em <html>, sem nada
 * a desfazer. O cartão ativo exibe um chip com check e borda tingida
 * com a cor primária para destacar a escolha atual.
 *
 * Persistência: apenas localStorage (escopo por dispositivo). O script
 * de inicialização em layout.tsx repete a escolha antes do primeiro
 * render nas visitas seguintes.
 */
export function AppearancePanel() {
  const { theme, setTheme } = useTheme();
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Tema de cor</h2>
        <p className="mt-1 text-sm text-slate-400">
          Escolha a cor de destaque usada em todo o aplicativo. Todos os temas
          permanecem escuros — apenas a cor primária (botões, nav ativo, badges)
          muda. Salvo neste dispositivo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((t) => (
          <ThemeCard
            key={t.id}
            id={t.id}
            name={t.name}
            tagline={t.tagline}
            swatch={t.swatch}
            isActive={t.id === theme}
            onPick={() => setTheme(t.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ThemeCard({
  id,
  name,
  tagline,
  swatch,
  isActive,
  onPick,
}: {
  id: ThemeId;
  name: string;
  tagline: string;
  swatch: string;
  isActive: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={isActive}
      aria-label={`Usar tema ${name}`}
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-4 text-left transition-colors",
        isActive
          ? "border-primary/60 ring-2 ring-primary/40"
          : "border-slate-800 hover:border-slate-700 hover:bg-slate-800/40",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          aria-hidden
          className="h-8 w-8 shrink-0 rounded-full"
          style={{
            background: swatch,
            boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.15)",
          }}
        />
        {isActive && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
            <Check className="h-3 w-3" />
            Ativo
          </span>
        )}
      </div>
      <div>
        <div className="text-sm font-semibold text-white">{name}</div>
        <div className="mt-1 text-xs leading-relaxed text-slate-400">
          {tagline}
        </div>
      </div>
      <div
        className="mt-1 flex h-2 overflow-hidden rounded-full"
        aria-hidden
      >
        <span className="flex-1" style={{ background: swatch }} />
        <span className="w-3 bg-slate-700" />
        <span className="w-3 bg-slate-800" />
        <span className="w-3 bg-slate-900" />
      </div>
      <span className="sr-only">ID do tema: {id}</span>
    </button>
  );
}

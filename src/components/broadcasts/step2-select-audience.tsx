'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CustomField, Tag } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Users,
  Tags,
  Filter,
  Upload,
  Loader2,
  ArrowRight,
  ArrowLeft,
  X,
  FileText,
} from 'lucide-react';

const CSV_PHONE_ALIASES = ['phone', 'telefone', 'tel', 'celular', 'whatsapp'];
const CSV_NAME_ALIASES = ['name', 'nome'];

function parseCsvContacts(text: string): { phone: string; name?: string }[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/["']/g, ''));
  const phoneIdx = headers.findIndex((h) => CSV_PHONE_ALIASES.includes(h));
  if (phoneIdx === -1) return [];
  const nameIdx = headers.findIndex((h) => CSV_NAME_ALIASES.includes(h));

  const rows: { phone: string; name?: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(',').map((v) => v.trim().replace(/["']/g, ''));
    const phone = values[phoneIdx];
    if (!phone) continue;
    rows.push({ phone, name: nameIdx >= 0 ? values[nameIdx] || undefined : undefined });
  }
  return rows;
}

type AudienceType = 'all' | 'tags' | 'custom_field' | 'csv';
type CustomFieldOperator = 'is' | 'is_not' | 'contains';

interface CustomFieldFilter {
  fieldId: string;
  operator: CustomFieldOperator;
  value: string;
}

interface AudienceConfig {
  type: AudienceType;
  tagIds?: string[];
  customField?: CustomFieldFilter;
  csvContacts?: { phone: string; name?: string }[];
  excludeTagIds?: string[];
}

interface Step2Props {
  audience: AudienceConfig;
  onUpdate: (audience: AudienceConfig) => void;
  onNext: () => void;
  onBack: () => void;
}

const audienceOptions: {
  type: AudienceType;
  label: string;
  description: string;
  icon: typeof Users;
}[] = [
  {
    type: 'all',
    label: 'Todos os Contatos',
    description: 'Enviar para todos os contatos do seu banco de dados',
    icon: Users,
  },
  {
    type: 'tags',
    label: 'Filtrar por Tags',
    description: 'Segmentar contatos com tags específicas',
    icon: Tags,
  },
  {
    type: 'custom_field',
    label: 'Campo Personalizado',
    description: 'Filtrar por valor de campo personalizado',
    icon: Filter,
  },
  {
    type: 'csv',
    label: 'Enviar CSV',
    description: 'Envie uma lista de números de telefone',
    icon: Upload,
  },
];

const OPERATOR_OPTIONS: { value: CustomFieldOperator; label: string }[] = [
  { value: 'is', label: 'é' },
  { value: 'is_not', label: 'não é' },
  { value: 'contains', label: 'contém' },
];

export function Step2SelectAudience({
  audience,
  onUpdate,
  onNext,
  onBack,
}: Step2Props) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  // Tags are used both by the primary "Filter by Tags" audience type
  // AND by the exclude-list below — so always load once on mount.
  useEffect(() => {
    async function fetchTags() {
      setLoadingTags(true);
      try {
        const supabase = createClient();
        const { data } = await supabase.from('tags').select('*').order('name');
        setTags(data ?? []);
      } finally {
        setLoadingTags(false);
      }
    }
    fetchTags();
  }, []);

  // Lazy-load custom fields only when that audience type is active.
  useEffect(() => {
    if (audience.type !== 'custom_field') return;
    async function fetchFields() {
      setLoadingFields(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('custom_fields')
          .select('*')
          .order('field_name');
        setCustomFields(data ?? []);
      } finally {
        setLoadingFields(false);
      }
    }
    fetchFields();
  }, [audience.type]);

  const fetchEstimatedCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const supabase = createClient();

      // Base query — produces the superset before exclude is applied.
      let baseIds: Set<string> | null = null; // null means "all contacts"

      if (audience.type === 'all') {
        // Handled below — full-table count adjusted by excludes.
      } else if (
        audience.type === 'tags' &&
        audience.tagIds &&
        audience.tagIds.length > 0
      ) {
        const { data } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', audience.tagIds);
        baseIds = new Set((data ?? []).map((r) => r.contact_id));
      } else if (
        audience.type === 'custom_field' &&
        audience.customField?.fieldId &&
        audience.customField.value
      ) {
        const { fieldId, operator, value } = audience.customField;
        let q = supabase
          .from('contact_custom_values')
          .select('contact_id')
          .eq('custom_field_id', fieldId);
        if (operator === 'is') q = q.eq('value', value);
        else if (operator === 'is_not') q = q.neq('value', value);
        else q = q.ilike('value', `%${value}%`);
        const { data } = await q;
        baseIds = new Set((data ?? []).map((r) => r.contact_id));
      } else if (
        audience.type === 'csv' &&
        audience.csvContacts &&
        audience.csvContacts.length > 0
      ) {
        setEstimatedCount(audience.csvContacts.length);
        return;
      } else {
        // Partially-configured audience — wait for the user to finish.
        setEstimatedCount(null);
        return;
      }

      // Apply exclude tags
      let excludeSet: Set<string> | null = null;
      if (audience.excludeTagIds && audience.excludeTagIds.length > 0) {
        const { data: excludeRows } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', audience.excludeTagIds);
        excludeSet = new Set((excludeRows ?? []).map((r) => r.contact_id));
      }

      if (baseIds) {
        const effective = [...baseIds].filter(
          (id) => !excludeSet?.has(id),
        );
        setEstimatedCount(effective.length);
      } else {
        // "All" — fetch the total, then subtract exclude set if any.
        const { count } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true });
        const total = count ?? 0;
        setEstimatedCount(excludeSet ? Math.max(0, total - excludeSet.size) : total);
      }
    } finally {
      setLoadingCount(false);
    }
  }, [
    audience.type,
    audience.tagIds,
    audience.customField,
    audience.csvContacts,
    audience.excludeTagIds,
  ]);

  useEffect(() => {
    fetchEstimatedCount();
  }, [fetchEstimatedCount]);

  function toggleTag(tagId: string) {
    const current = audience.tagIds ?? [];
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    onUpdate({ ...audience, tagIds: updated });
  }

  function toggleExcludeTag(tagId: string) {
    const current = audience.excludeTagIds ?? [];
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    onUpdate({ ...audience, excludeTagIds: updated });
  }

  function clearExcludeTags() {
    onUpdate({ ...audience, excludeTagIds: [] });
  }

  async function handleCsvFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setCsvError(null);

    const text = await file.text();
    const rows = parseCsvContacts(text);
    if (rows.length === 0) {
      setCsvError('Nenhum número válido encontrado. Verifique se o CSV tem a coluna "phone".');
      onUpdate({ ...audience, csvContacts: undefined });
      return;
    }
    onUpdate({ ...audience, csvContacts: rows });
  }

  function clearCsvFile() {
    setCsvFileName(null);
    setCsvError(null);
    if (csvInputRef.current) csvInputRef.current.value = '';
    onUpdate({ ...audience, csvContacts: undefined });
  }

  function updateCustomField(patch: Partial<CustomFieldFilter>) {
    const prev = audience.customField ?? {
      fieldId: '',
      operator: 'is' as CustomFieldOperator,
      value: '',
    };
    onUpdate({ ...audience, customField: { ...prev, ...patch } });
  }

  const isValid =
    audience.type === 'all' ||
    (audience.type === 'tags' && audience.tagIds && audience.tagIds.length > 0) ||
    (audience.type === 'custom_field' &&
      !!audience.customField?.fieldId &&
      audience.customField.value.length > 0) ||
    (audience.type === 'csv' &&
      audience.csvContacts &&
      audience.csvContacts.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Selecionar Público</h2>
        <p className="mt-1 text-sm text-slate-400">
          Escolha quem receberá este disparo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {audienceOptions.map((option) => {
          const isSelected = audience.type === option.type;
          const Icon = option.icon;
          return (
            <button
              key={option.type}
              onClick={() => {
                if (option.type !== 'csv') {
                  setCsvFileName(null);
                  setCsvError(null);
                  if (csvInputRef.current) csvInputRef.current.value = '';
                }
                onUpdate({
                  ...audience,
                  type: option.type,
                  // Wipe shape fields from other types to avoid stale
                  // config leaking across selections.
                  tagIds: option.type === 'tags' ? audience.tagIds : undefined,
                  customField:
                    option.type === 'custom_field'
                      ? audience.customField
                      : undefined,
                  csvContacts:
                    option.type === 'csv' ? audience.csvContacts : undefined,
                });
              }}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  isSelected
                    ? 'bg-primary/10 text-primary'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{option.label}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {audience.type === 'tags' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="mb-3 text-sm font-medium text-white">Selecionar Tags</p>
          {loadingTags ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : tags.length === 0 ? (
            <p className="text-xs text-slate-400">
              Nenhuma tag encontrada. Crie tags em Configurações.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isSelected = audience.tagIds?.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span
                      className="mr-1.5 h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {audience.type === 'custom_field' && (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-sm font-medium text-white">Filtro por Campo Personalizado</p>
          {loadingFields ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : customFields.length === 0 ? (
            <p className="text-xs text-slate-400">
              Nenhum campo personalizado definido. Crie um em Configurações → Campos Personalizados.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)]">
              <select
                value={audience.customField?.fieldId ?? ''}
                onChange={(e) => updateCustomField({ fieldId: e.target.value })}
                className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">Selecionar campo…</option>
                {customFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.field_name}
                  </option>
                ))}
              </select>
              <select
                value={audience.customField?.operator ?? 'is'}
                onChange={(e) =>
                  updateCustomField({
                    operator: e.target.value as CustomFieldOperator,
                  })
                }
                className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {OPERATOR_OPTIONS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={audience.customField?.value ?? ''}
                onChange={(e) => updateCustomField({ value: e.target.value })}
                placeholder="Valor"
                className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>
      )}

      {audience.type === 'csv' && (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-sm font-medium text-white">Enviar CSV</p>
          <p className="text-xs text-slate-400">
            Arquivo CSV com a coluna &quot;phone&quot; ou &quot;telefone&quot; (obrigatória) e
            &quot;name&quot;/&quot;nome&quot; (opcional).
          </p>

          <div
            onClick={() => csvInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-700 p-6 cursor-pointer hover:border-primary/50 transition-colors"
          >
            {csvFileName ? (
              <>
                <FileText className="h-6 w-6 text-primary" />
                <p className="text-sm text-slate-300">{csvFileName}</p>
                <p className="text-xs text-slate-500">
                  {audience.csvContacts?.length ?? 0} número
                  {(audience.csvContacts?.length ?? 0) !== 1 ? 's' : ''} detectado
                  {(audience.csvContacts?.length ?? 0) !== 1 ? 's' : ''}
                </p>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 text-slate-500" />
                <p className="text-sm text-slate-400">Clique para enviar arquivo CSV</p>
              </>
            )}
          </div>

          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvFileChange}
            className="hidden"
          />

          {csvError && <p className="text-xs text-red-400">{csvError}</p>}

          {csvFileName && (
            <button
              type="button"
              onClick={clearCsvFile}
              className="text-xs text-slate-400 hover:text-white hover:underline"
            >
              Remover arquivo
            </button>
          )}
        </div>
      )}

      {/* Exclude list — applies regardless of audience type */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <X className="h-4 w-4 text-red-400" />
          <p className="text-sm font-medium text-white">
            Excluir contatos com estas tags
          </p>
          <span className="text-xs text-slate-500">(opcional)</span>
          {(audience.excludeTagIds?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={clearExcludeTags}
              className="ml-auto text-xs text-slate-400 hover:text-white hover:underline"
            >
              Limpar
            </button>
          )}
        </div>
        {tags.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma tag disponível.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const isExcluded = audience.excludeTagIds?.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleExcludeTag(tag.id)}
                  title={isExcluded ? 'Clique para remover da exclusão' : 'Clique para excluir'}
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    isExcluded
                      ? 'border-red-500/30 bg-red-500/10 text-red-300'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span
                    className="mr-1.5 h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                  {isExcluded && <X className="ml-1.5 h-3 w-3" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Audience Summary */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <p className="mb-2 text-sm font-medium text-white">Resumo do Público</p>
        {loadingCount ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-slate-400">Calculando…</span>
          </div>
        ) : estimatedCount !== null ? (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm text-white">
              {estimatedCount.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs text-slate-400">destinatários estimados</span>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Selecione um tipo de público para ver a estimativa.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-800 pt-4">
        <Button
          variant="outline"
          onClick={onBack}
          className="border-slate-700 text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button
          onClick={onNext}
          disabled={!isValid}
          className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Próximo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

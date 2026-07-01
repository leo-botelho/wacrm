'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, CheckCircle, XCircle, Download } from 'lucide-react';

const CSV_TEMPLATE = [
  'phone,name,email,company,tags',
  '+5511999999999,Joao Silva,joao@email.com,Empresa XYZ,cliente;vip',
].join('\n');

function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo-contatos.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// Accepts common PT-BR header aliases alongside the canonical English names
// so a user typing "telefone" instead of "phone" doesn't silently get zero
// valid rows.
const HEADER_ALIASES: Record<string, 'phone' | 'name' | 'email' | 'company' | 'tags'> = {
  phone: 'phone',
  telefone: 'phone',
  tel: 'phone',
  celular: 'phone',
  whatsapp: 'phone',
  name: 'name',
  nome: 'name',
  email: 'email',
  'e-mail': 'email',
  company: 'company',
  empresa: 'company',
  tags: 'tags',
  etiquetas: 'tags',
};

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface ParsedRow {
  phone: string;
  name?: string;
  email?: string;
  company?: string;
  tags: string[];
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const rawHeaders = headerLine.split(',').map((h) => h.trim().toLowerCase().replace(/["']/g, ''));
  const headers = rawHeaders.map((h) => HEADER_ALIASES[h] ?? h);

  const phoneIdx = headers.indexOf('phone');
  if (phoneIdx === -1) return [];

  const nameIdx = headers.indexOf('name');
  const emailIdx = headers.indexOf('email');
  const companyIdx = headers.indexOf('company');
  const tagsIdx = headers.indexOf('tags');

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parse (handles quoted fields)
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const phone = values[phoneIdx]?.replace(/["']/g, '').trim();
    if (!phone) continue;

    const tagsRaw = tagsIdx >= 0 ? values[tagsIdx]?.replace(/["']/g, '').trim() : '';
    const tags = tagsRaw
      ? tagsRaw.split(';').map((t) => t.trim()).filter(Boolean)
      : [];

    rows.push({
      phone,
      name: nameIdx >= 0 ? values[nameIdx]?.replace(/["']/g, '').trim() || undefined : undefined,
      email: emailIdx >= 0 ? values[emailIdx]?.replace(/["']/g, '').trim() || undefined : undefined,
      company:
        companyIdx >= 0 ? values[companyIdx]?.replace(/["']/g, '').trim() || undefined : undefined,
      tags,
    });
  }

  return rows;
}

export function ImportModal({ open, onOpenChange, onImported }: ImportModalProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: number } | null>(null);

  function reset() {
    setFile(null);
    setParsedRows([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setResult(null);

    const text = await selected.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      toast.error('Nenhuma linha válida encontrada. Verifique se o CSV tem a coluna "phone".');
      setParsedRows([]);
      return;
    }

    setParsedRows(rows);
  }

  async function handleImport() {
    if (parsedRows.length === 0) return;
    setImporting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Não autenticado');

      // Resolve tag names -> ids up front: reuse existing tags (matched
      // case-insensitively) and create whichever ones don't exist yet.
      const uniqueTagNames = Array.from(
        new Set(parsedRows.flatMap((r) => r.tags).filter(Boolean))
      );
      const tagIdByName = new Map<string, string>();
      if (uniqueTagNames.length > 0) {
        const { data: existingTags } = await supabase
          .from('tags')
          .select('id, name')
          .eq('user_id', user.id);
        for (const t of existingTags ?? []) {
          tagIdByName.set(t.name.toLowerCase(), t.id);
        }
        const missing = uniqueTagNames.filter(
          (name) => !tagIdByName.has(name.toLowerCase())
        );
        if (missing.length > 0) {
          const { data: createdTags, error: createTagsErr } = await supabase
            .from('tags')
            .insert(missing.map((name) => ({ user_id: user.id, name })))
            .select('id, name');
          if (createTagsErr) {
            toast.error(`Falha ao criar tags: ${createTagsErr.message}`);
          }
          for (const t of createdTags ?? []) {
            tagIdByName.set(t.name.toLowerCase(), t.id);
          }
        }
      }

      const linkTags = async (contactId: string, tagNames: string[]) => {
        const tagIds = tagNames
          .map((name) => tagIdByName.get(name.toLowerCase()))
          .filter((id): id is string => !!id);
        if (tagIds.length === 0) return;
        await supabase
          .from('contact_tags')
          .insert(tagIds.map((tagId) => ({ contact_id: contactId, tag_id: tagId })));
      };

      let imported = 0;
      let failed = 0;

      // Batch insert in chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < parsedRows.length; i += chunkSize) {
        const chunk = parsedRows.slice(i, i + chunkSize);
        const rows = chunk.map((row) => ({
          user_id: user.id,
          phone: row.phone,
          name: row.name || null,
          email: row.email || null,
          company: row.company || null,
        }));

        const { data, error } = await supabase
          .from('contacts')
          .insert(rows)
          .select('id');

        if (error) {
          // Try individual inserts for this chunk
          for (let j = 0; j < rows.length; j++) {
            const { data: single, error: singleErr } = await supabase
              .from('contacts')
              .insert(rows[j])
              .select('id')
              .single();
            if (singleErr || !single) {
              failed++;
            } else {
              imported++;
              await linkTags(single.id, chunk[j].tags);
            }
          }
        } else {
          imported += data?.length ?? chunk.length;
          // Postgres/PostgREST returns RETURNING rows in the same order as
          // the VALUES list for a plain multi-row insert, so index i of
          // `data` lines up with `chunk[i]`.
          await Promise.all(
            (data ?? []).map((row, j) => linkTags(row.id, chunk[j].tags))
          );
        }
      }

      setResult({ imported, failed });
      if (imported > 0) {
        toast.success(`${imported} contato${imported !== 1 ? 's' : ''} importado${imported !== 1 ? 's' : ''}`);
        onImported();
      }
      if (failed > 0) {
        toast.error(`${failed} contato${failed !== 1 ? 's' : ''} falhou na importação`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha na importação';
      toast.error(message);
    } finally {
      setImporting(false);
    }
  }

  const preview = parsedRows.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Importar Contatos</DialogTitle>
          <DialogDescription className="text-slate-400">
            Envie um arquivo CSV com a coluna &quot;phone&quot; ou &quot;telefone&quot; (obrigatória).
            Colunas opcionais: name/nome, email, company/empresa, tags (separadas por &quot;;&quot;).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <button
            type="button"
            onClick={downloadCsvTemplate}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <Download className="size-3.5" />
            Baixar modelo CSV
          </button>

          {/* Upload area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-700 p-6 cursor-pointer hover:border-primary/50 transition-colors"
          >
            {file ? (
              <>
                <FileText className="size-8 text-primary" />
                <p className="text-sm text-slate-300">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {parsedRows.length} linha{parsedRows.length !== 1 ? 's' : ''} detectada{parsedRows.length !== 1 ? 's' : ''}
                </p>
              </>
            ) : (
              <>
                <Upload className="size-8 text-slate-500" />
                <p className="text-sm text-slate-400">
                  Clique para enviar arquivo CSV
                </p>
                <p className="text-xs text-slate-500">
                  CSV com coluna &quot;phone&quot; obrigatória
                </p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Preview table */}
          {preview.length > 0 && !result && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Pré-visualização (primeiras {preview.length} linhas)
              </p>
              <div className="rounded-lg border border-slate-700 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800">
                      <th className="px-3 py-1.5 text-left text-slate-400 font-medium">Telefone</th>
                      <th className="px-3 py-1.5 text-left text-slate-400 font-medium">Nome</th>
                      <th className="px-3 py-1.5 text-left text-slate-400 font-medium">E-mail</th>
                      <th className="px-3 py-1.5 text-left text-slate-400 font-medium">Empresa</th>
                      <th className="px-3 py-1.5 text-left text-slate-400 font-medium">Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-slate-700/50">
                        <td className="px-3 py-1.5 text-slate-300">{row.phone}</td>
                        <td className="px-3 py-1.5 text-slate-300">{row.name || '-'}</td>
                        <td className="px-3 py-1.5 text-slate-300">{row.email || '-'}</td>
                        <td className="px-3 py-1.5 text-slate-300">{row.company || '-'}</td>
                        <td className="px-3 py-1.5 text-slate-300">{row.tags.join(', ') || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 5 && (
                <p className="text-xs text-slate-500">
                  ...e mais {parsedRows.length - 5} linhas
                </p>
              )}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="rounded-lg border border-slate-700 p-4 space-y-2">
              <p className="text-sm font-medium text-white">Importação Concluída</p>
              <div className="flex items-center gap-4">
                {result.imported > 0 && (
                  <div className="flex items-center gap-1.5 text-primary text-sm">
                    <CheckCircle className="size-4" />
                    {result.imported} importado{result.imported !== 1 ? 's' : ''}
                  </div>
                )}
                {result.failed > 0 && (
                  <div className="flex items-center gap-1.5 text-red-400 text-sm">
                    <XCircle className="size-4" />
                    {result.failed} falhou{result.failed !== 1 ? 'ram' : ''}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="bg-slate-900 border-slate-700">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            {result ? 'Fechar' : 'Cancelar'}
          </Button>
          {!result && (
            <Button
              type="button"
              disabled={parsedRows.length === 0 || importing}
              onClick={handleImport}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {importing && <Loader2 className="size-4 animate-spin" />}
              Importar {parsedRows.length > 0 ? `${parsedRows.length} Contato${parsedRows.length !== 1 ? 's' : ''}` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

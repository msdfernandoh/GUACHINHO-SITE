"use client";

import { useMemo, useRef, useState } from "react";
import { ContactRound, FileUp, Plus, Tag, Trash2, UserPlus, X } from "lucide-react";
import {
  discardContactAction,
  saveContactsAction,
  sendContactToLeadAction,
  updateContactClassificationAction,
  updateContactTagsAction,
  type ContactInput,
} from "./actions";

type Contact = ContactInput & { id: string; telefone_normalizado: string; tags?: string[] };
type EditableField = "empresa" | "profissao";

function parseCsv(text: string): ContactInput[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(/[;,]/).map((value) => value.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(/[;,]/).map((value) => value.trim().replace(/^"|"$/g, ""));
    const get = (...names: string[]) => values[headers.findIndex((header) => names.includes(header))] ?? "";
    return { nome: get("nome", "name", "nome completo"), telefone: get("telefone", "phone", "celular", "whatsapp"), email: get("email", "e-mail"), empresa: get("empresa", "company"), profissao: get("profissão", "profissao", "cargo", "occupation") };
  });
}

function parseVcf(text: string): ContactInput[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  return unfolded.split(/BEGIN:VCARD/i).slice(1).map((card) => {
    const phones = [...card.matchAll(/(?:^|\n)(?:item\d+\.)?TEL(?:;[^:]*)?:([^\r\n]+)/gi)].map((match) => match[1].trim());
    return { nome: card.match(/(?:^|\n)FN(?:;[^:]*)?:([^\r\n]+)/i)?.[1]?.trim() ?? "", telefone: phones.find(Boolean) ?? "", email: card.match(/(?:^|\n)EMAIL(?:;[^:]*)?:([^\r\n]+)/i)?.[1]?.trim() ?? "", empresa: card.match(/(?:^|\n)ORG(?:;[^:]*)?:([^\r\n]+)/i)?.[1]?.trim().replace(/;$/, "") ?? "", profissao: card.match(/(?:^|\n)TITLE(?:;[^:]*)?:([^\r\n]+)/i)?.[1]?.trim() ?? "" };
  }).filter((contact) => contact.telefone);
}

function uniqueValues(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])].sort((first, second) => first.localeCompare(second, "pt-BR"));
}

export default function ContactsClient({ initialContacts }: { initialContacts: Contact[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [message, setMessage] = useState("");
  const [editingField, setEditingField] = useState<{ id: string; field: EditableField; value: string } | null>(null);
  const [tagEditor, setTagEditor] = useState<{ id: string; value: string } | null>(null);
  const [companyFilter, setCompanyFilter] = useState("");
  const [professionFilter, setProfessionFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const companies = useMemo(() => uniqueValues(contacts.map((contact) => contact.empresa)), [contacts]);
  const professions = useMemo(() => uniqueValues(contacts.map((contact) => contact.profissao)), [contacts]);
  const tags = useMemo(() => uniqueValues(contacts.flatMap((contact) => contact.tags ?? [])), [contacts]);
  const visibleContacts = useMemo(() => contacts.filter((contact) => (!companyFilter || contact.empresa === companyFilter) && (!professionFilter || contact.profissao === professionFilter) && (!tagFilter || contact.tags?.includes(tagFilter))), [companyFilter, contacts, professionFilter, tagFilter]);

  async function importFile(file?: File) {
    if (!file) return;
    const parsed = file.name.toLowerCase().endsWith(".vcf") ? parseVcf(await file.text()) : parseCsv(await file.text());
    const result = await saveContactsAction(parsed);
    setMessage(result.ok ? `${result.count} contatos importados${result.duplicatesIgnored ? `; ${result.duplicatesIgnored} repetidos foram consolidados.` : "."}` : result.error ?? "Erro");
    if (result.ok) location.reload();
  }

  async function saveClassification(contact: Contact, field: EditableField, value: string) {
    const result = await updateContactClassificationAction(contact.id, field, value);
    if (!result.ok) { setMessage(result.error ?? "Não foi possível atualizar o contato."); return; }
    setContacts((previous) => previous.map((item) => item.id === contact.id ? { ...item, [field]: value.trim() } : item));
    setEditingField(null);
  }

  async function addTag(contact: Contact, tag: string) {
    const nextTags = [...(contact.tags ?? []), tag];
    const result = await updateContactTagsAction(contact.id, nextTags);
    if (!result.ok) { setMessage(result.error ?? "Não foi possível atualizar as tags."); return; }
    setContacts((previous) => previous.map((item) => item.id === contact.id ? { ...item, tags: result.tags } : item));
    setTagEditor({ id: contact.id, value: "" });
  }

  async function removeTag(contact: Contact, tag: string) {
    const result = await updateContactTagsAction(contact.id, (contact.tags ?? []).filter((item) => item !== tag));
    if (!result.ok) { setMessage(result.error ?? "Não foi possível atualizar as tags."); return; }
    setContacts((previous) => previous.map((item) => item.id === contact.id ? { ...item, tags: result.tags } : item));
  }

  async function sendToLead(id: string) {
    const result = await sendContactToLeadAction(id);
    setMessage(result.ok ? "Contato enviado para Novo lead com você como responsável." : result.error ?? "Erro");
  }

  async function discard(contact: Contact) {
    if (!window.confirm(`Descartar ${contact.nome}? Esta ação remove o contato da sua lista.`)) return;
    const result = await discardContactAction(contact.id);
    if (!result.ok) { setMessage(result.error ?? "Não foi possível descartar o contato."); return; }
    setContacts((previous) => previous.filter((item) => item.id !== contact.id));
    setMessage("Contato descartado da sua lista.");
  }

  function renderClassificationCell(contact: Contact, field: EditableField, emptyLabel: string) {
    const editing = editingField?.id === contact.id && editingField.field === field;
    if (editing) return <input autoFocus className="w-full rounded border border-blue-400 bg-white px-2 py-1 text-slate-900 outline-none ring-2 ring-blue-100" value={editingField.value} onChange={(event) => setEditingField({ ...editingField, value: event.target.value })} onBlur={() => saveClassification(contact, field, editingField.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveClassification(contact, field, editingField.value); if (event.key === "Escape") setEditingField(null); }} aria-label={field === "empresa" ? "Empresa" : "Profissão"}/>;
    return <button type="button" title={`Clique para incluir ${field}`} className="w-full text-left text-slate-700 hover:text-blue-700 hover:underline" onClick={() => setEditingField({ id: contact.id, field, value: contact[field] ?? "" })}>{contact[field] || <span className="text-slate-400">{emptyLabel}</span>}</button>;
  }

  return (
    <div className="contacts-import-page space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-zinc-50">Meus contatos</h1><p className="text-sm text-zinc-300">Clique em Empresa ou Profissão para classificar. Use tags para organizar e filtrar depois.</p></div><><input ref={inputRef} hidden type="file" accept=".csv,.vcf,text/csv,text/vcard" onChange={(event) => importFile(event.target.files?.[0])}/><button type="button" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300" onClick={() => inputRef.current?.click()}><FileUp className="mr-2 inline h-4 w-4"/>Importar CSV ou VCF</button></></div>
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{message}</div>}
      <div className="flex flex-wrap gap-3 rounded-xl border border-zinc-700 bg-zinc-900/70 p-3"><select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)} className="rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"><option value="">Todas as empresas</option>{companies.map((company) => <option key={company} value={company}>{company}</option>)}</select><select value={professionFilter} onChange={(event) => setProfessionFilter(event.target.value)} className="rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"><option value="">Todas as profissões</option>{professions.map((profession) => <option key={profession} value={profession}>{profession}</option>)}</select><select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} className="rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"><option value="">Todas as tags</option>{tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select>{(companyFilter || professionFilter || tagFilter) && <button type="button" className="px-2 text-sm font-semibold text-blue-300 hover:text-white" onClick={() => { setCompanyFilter(""); setProfessionFilter(""); setTagFilter(""); }}>Limpar filtros</button>}<span className="ml-auto self-center text-sm text-zinc-400">{visibleContacts.length} contatos</span></div>
      <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm"><table className="w-full min-w-[980px] text-left text-sm text-slate-800"><thead className="border-b border-slate-200 bg-slate-100 text-slate-700"><tr><th className="p-3 font-bold">Nome</th><th className="p-3 font-bold">Telefone</th><th className="p-3 font-bold">Empresa</th><th className="p-3 font-bold">Profissão</th><th className="p-3 font-bold">Tags</th><th className="p-3 font-bold">Ações</th></tr></thead><tbody>{visibleContacts.map((contact) => <tr key={contact.id} className="border-t border-slate-200 bg-white text-slate-800 hover:bg-slate-50"><td className="p-3 font-medium text-slate-900"><ContactRound className="mr-2 inline h-4 w-4 text-slate-500"/>{contact.nome}</td><td className="p-3 text-slate-700">{contact.telefone}</td><td className="p-3">{renderClassificationCell(contact, "empresa", "Adicionar empresa")}</td><td className="p-3">{renderClassificationCell(contact, "profissao", "Adicionar profissão")}</td><td className="p-3"><div className="flex min-w-[190px] flex-wrap items-center gap-1">{(contact.tags ?? []).map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800"><Tag className="h-3 w-3"/>{tag}<button type="button" aria-label={`Remover tag ${tag}`} className="ml-0.5 hover:text-blue-950" onClick={() => removeTag(contact, tag)}><X className="h-3 w-3"/></button></span>)}{tagEditor?.id === contact.id ? <span className="inline-flex items-center"><input autoFocus value={tagEditor.value} placeholder="Nova tag" className="w-24 rounded-l border border-blue-400 px-2 py-1 text-xs text-slate-900 outline-none" onChange={(event) => setTagEditor({ ...tagEditor, value: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") void addTag(contact, tagEditor.value); if (event.key === "Escape") setTagEditor(null); }}/><button type="button" aria-label="Adicionar tag" className="rounded-r bg-blue-600 p-1 text-white hover:bg-blue-700" onClick={() => addTag(contact, tagEditor.value)}><Plus className="h-4 w-4"/></button></span> : <button type="button" className="inline-flex items-center gap-1 rounded border border-dashed border-blue-400 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50" onClick={() => setTagEditor({ id: contact.id, value: "" })}><Plus className="h-3.5 w-3.5"/>Tag</button>}</div></td><td className="p-3 whitespace-nowrap"><div className="flex items-center gap-3"><button type="button" className="font-semibold text-emerald-700 hover:text-emerald-900 hover:underline" onClick={() => sendToLead(contact.id)}><UserPlus className="mr-1 inline h-4 w-4"/>Enviar para lead</button><button type="button" className="inline-flex items-center gap-1 font-semibold text-red-700 hover:text-red-900 hover:underline" onClick={() => discard(contact)}><Trash2 className="h-4 w-4"/>Descartar</button></div></td></tr>)}</tbody></table>{!visibleContacts.length && <p className="p-8 text-center text-slate-600">Nenhum contato encontrado com estes filtros.</p>}</div>
    </div>
  );
}

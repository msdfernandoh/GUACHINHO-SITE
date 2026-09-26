"use client";

import { useRef, useState } from "react";
import { ContactRound, FileUp, UserPlus } from "lucide-react";
import {
  saveContactsAction,
  sendContactToLeadAction,
  updateContactAction,
  type ContactInput,
} from "./actions";

type Contact = ContactInput & { id: string; telefone_normalizado: string };

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

export default function ContactsClient({ initialContacts }: { initialContacts: Contact[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function importFile(file?: File) {
    if (!file) return;
    const parsed = file.name.toLowerCase().endsWith(".vcf") ? parseVcf(await file.text()) : parseCsv(await file.text());
    const result = await saveContactsAction(parsed);
    setMessage(result.ok ? `${result.count} contatos importados${result.duplicatesIgnored ? `; ${result.duplicatesIgnored} repetidos foram consolidados.` : "."}` : result.error ?? "Erro");
    if (result.ok) location.reload();
  }

  async function sendToLead(id: string) {
    const result = await sendContactToLeadAction(id);
    setMessage(result.ok ? "Contato enviado para Novo lead com você como responsável." : result.error ?? "Erro");
  }

  async function edit(contact: Contact) {
    const empresa = window.prompt("Empresa", contact.empresa ?? "");
    const profissao = window.prompt("Profissão", contact.profissao ?? "");
    if (empresa === null || profissao === null) return;
    await updateContactAction(contact.id, { ...contact, empresa, profissao });
    setContacts((previous) => previous.map((item) => (item.id === contact.id ? { ...item, empresa, profissao } : item)));
  }

  return (
    <div className="contacts-import-page space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-zinc-50">Meus contatos</h1><p className="text-sm text-zinc-300">Somente contatos telefônicos importados por você nesta empresa.</p></div>
        <><input ref={inputRef} hidden type="file" accept=".csv,.vcf,text/csv,text/vcard" onChange={(event) => importFile(event.target.files?.[0])}/><button type="button" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300" onClick={() => inputRef.current?.click()}><FileUp className="mr-2 inline h-4 w-4"/>Importar CSV ou VCF</button></>
      </div>
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{message}</div>}
      <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
        <table className="w-full min-w-[780px] text-left text-sm text-slate-800">
          <thead className="border-b border-slate-200 bg-slate-100 text-slate-700"><tr><th className="p-3 font-bold">Nome</th><th className="p-3 font-bold">Telefone</th><th className="p-3 font-bold">Empresa</th><th className="p-3 font-bold">Profissão</th><th className="p-3 font-bold">Ações</th></tr></thead>
          <tbody>{contacts.map((contact) => <tr key={contact.id} className="border-t border-slate-200 bg-white text-slate-800 hover:bg-slate-50"><td className="p-3 font-medium text-slate-900"><ContactRound className="mr-2 inline h-4 w-4 text-slate-500"/>{contact.nome}</td><td className="p-3 text-slate-700">{contact.telefone}</td><td className="p-3 text-slate-700">{contact.empresa || "—"}</td><td className="p-3 text-slate-700">{contact.profissao || "—"}</td><td className="p-3 whitespace-nowrap"><button type="button" className="mr-3 font-semibold text-blue-700 hover:text-blue-900 hover:underline" onClick={() => edit(contact)}>Editar</button><button type="button" className="font-semibold text-emerald-700 hover:text-emerald-900 hover:underline" onClick={() => sendToLead(contact.id)}><UserPlus className="mr-1 inline h-4 w-4"/>Enviar para lead</button></td></tr>)}</tbody>
        </table>
        {!contacts.length && <p className="p-8 text-center text-slate-600">Importe um CSV ou VCF para começar.</p>}
      </div>
    </div>
  );
}

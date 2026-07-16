"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Textarea } from "@/components/ui/form-primitives";
import {
  ContratacaoEnderecoFields,
  type EnderecoFormState,
} from "@/components/contratacao/contratacao-endereco-fields";
import { updateContratacaoClienteAction } from "@/app/admin/contratacoes/actions";
import type { ContratacaoOnlineRow, TipoPessoa } from "@/lib/contratacoes-online/types";
import {
  formatCnpjBrInput,
  formatCpfBrInput,
  formatWhatsappBrInput,
} from "@/lib/utils/format";
import { formatCepBrInput } from "@/lib/contratacoes-online/endereco";

type Props = {
  contratacao: ContratacaoOnlineRow;
  onCancel: () => void;
};

export function ContratacaoClienteEditForm({ contratacao, onCancel }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nome, setNome] = useState(contratacao.nome ?? "");
  const [telefone, setTelefone] = useState(
    contratacao.telefone ? formatWhatsappBrInput(contratacao.telefone) : "",
  );
  const [email, setEmail] = useState(contratacao.email ?? "");
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>(
    contratacao.tipo_pessoa === "cnpj" ? "cnpj" : "cpf",
  );
  const [cpf, setCpf] = useState(contratacao.cpf ? formatCpfBrInput(contratacao.cpf) : "");
  const [dataNascimento, setDataNascimento] = useState(contratacao.data_nascimento ?? "");
  const [razaoSocial, setRazaoSocial] = useState(contratacao.razao_social ?? "");
  const [cnpj, setCnpj] = useState(contratacao.cnpj ? formatCnpjBrInput(contratacao.cnpj) : "");
  const [responsavelNome, setResponsavelNome] = useState(contratacao.responsavel_nome ?? "");
  const [responsavelCpf, setResponsavelCpf] = useState(
    contratacao.responsavel_cpf ? formatCpfBrInput(contratacao.responsavel_cpf) : "",
  );
  const [observacao, setObservacao] = useState(contratacao.observacao_cliente ?? "");
  const [endereco, setEndereco] = useState<EnderecoFormState>({
    cep: contratacao.cep ? formatCepBrInput(contratacao.cep) : "",
    endereco: contratacao.endereco ?? "",
    numero: contratacao.numero ?? "",
    complemento: contratacao.complemento ?? "",
    bairro: contratacao.bairro ?? "",
    cidade: contratacao.cidade ?? "",
    uf: contratacao.uf ?? "",
  });

  const onEnderecoChange = useCallback((patch: Partial<EnderecoFormState>) => {
    setEndereco((prev) => ({ ...prev, ...patch }));
  }, []);

  function salvar() {
    setError(null);
    startTransition(async () => {
      const res = await updateContratacaoClienteAction(contratacao.id, {
        nome,
        telefone,
        email,
        tipo_pessoa: tipoPessoa,
        cpf: tipoPessoa === "cpf" ? cpf : undefined,
        data_nascimento: tipoPessoa === "cpf" ? dataNascimento : undefined,
        razao_social: tipoPessoa === "cnpj" ? razaoSocial : undefined,
        cnpj: tipoPessoa === "cnpj" ? cnpj : undefined,
        responsavel_nome: tipoPessoa === "cnpj" ? responsavelNome : undefined,
        responsavel_cpf: tipoPessoa === "cnpj" ? responsavelCpf : undefined,
        observacao_cliente: observacao,
        cep: endereco.cep,
        endereco: endereco.endereco,
        numero: endereco.numero,
        complemento: endereco.complemento,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        uf: endereco.uf,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      onCancel();
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Nome *</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div>
          <Label>Telefone *</Label>
          <Input
            value={telefone}
            onChange={(e) => setTelefone(formatWhatsappBrInput(e.target.value))}
            required
          />
        </div>
        <div>
          <Label>E-mail</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-zinc-300">Tipo de pessoa</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="tipo_pessoa"
              checked={tipoPessoa === "cpf"}
              onChange={() => setTipoPessoa("cpf")}
            />
            CPF
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="tipo_pessoa"
              checked={tipoPessoa === "cnpj"}
              onChange={() => setTipoPessoa("cnpj")}
            />
            CNPJ
          </label>
        </div>
      </fieldset>

      {tipoPessoa === "cpf" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>CPF *</Label>
            <Input value={cpf} onChange={(e) => setCpf(formatCpfBrInput(e.target.value))} />
          </div>
          <div>
            <Label>Data de nascimento</Label>
            <Input
              type="date"
              value={dataNascimento?.slice(0, 10) ?? ""}
              onChange={(e) => setDataNascimento(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Razão social *</Label>
            <Input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} />
          </div>
          <div>
            <Label>CNPJ *</Label>
            <Input value={cnpj} onChange={(e) => setCnpj(formatCnpjBrInput(e.target.value))} />
          </div>
          <div>
            <Label>Responsável *</Label>
            <Input value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} />
          </div>
          <div>
            <Label>CPF do responsável *</Label>
            <Input
              value={responsavelCpf}
              onChange={(e) => setResponsavelCpf(formatCpfBrInput(e.target.value))}
            />
          </div>
        </div>
      )}

      <div>
        <Label>Observação do cliente</Label>
        <Textarea
          rows={2}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Endereço
        </h3>
        <ContratacaoEnderecoFields values={endereco} onChange={onEnderecoChange} />
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" onClick={salvar} disabled={pending}>
          {pending ? "Salvando…" : "Salvar dados"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

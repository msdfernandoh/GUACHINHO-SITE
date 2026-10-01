export type CadastroParceiroEtapa = {
  nome: string;
  whatsapp: string;
  email: string;
  cpf: string;
  cidade: string;
  estado: string;
  profissao: string;
  chavePix: string;
  jaVendeConsorcio: string;
  potencialMensal: string;
  interesseNetwork: string;
};

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function mensagemValidacaoEtapaCadastroParceiro(
  step: number,
  form: CadastroParceiroEtapa,
  modelo: string,
): string | null {
  if (step === 0) {
    if (form.nome.trim().split(/\s+/).length < 2) return "Informe seu nome completo.";
    if (form.whatsapp.replace(/\D/g, "").length < 10) return "Informe um WhatsApp válido com DDD.";
    return null;
  }
  if (step === 1) {
    if (form.cpf.replace(/\D/g, "").length !== 11) return "Informe um CPF com 11 dígitos.";
    if (!emailValido(form.email)) {
      return "Informe seu e-mail neste campo. A senha inicial será criada automaticamente com os últimos 6 dígitos do CPF.";
    }
    return null;
  }
  if (step === 2) {
    if (!form.cidade.trim()) return "Informe sua cidade.";
    if (form.estado.trim().length !== 2) return "Informe a sigla do estado com 2 letras.";
    if (!form.profissao.trim()) return "Informe sua profissão ou atividade atual.";
    if (!form.jaVendeConsorcio) return "Informe se você já vende consórcio.";
    return null;
  }
  if (step === 3) {
    if (!modelo) return "Escolha uma modalidade de participação.";
    if (!form.potencialMensal) return "Informe quanto acredita que consegue movimentar por mês.";
    if (!form.interesseNetwork) return "Informe se deseja participar do Network.";
    return null;
  }
  if (!form.chavePix.trim() || form.chavePix.trim().length < 3) {
    return "Informe sua chave PIX para concluir.";
  }
  return null;
}


// app/privacidade/page.tsx  — Next.js (App Router)

export const metadata = {
  title: "Política de Privacidade | Gauchinho Consórcios",
  description: "Como a Gauchinho Consórcios coleta, usa e protege dados pessoais.",
};

const EMPRESA = "ERONI BOLFE LTDA";
const CNPJ = "44.276.638/0001-25";
const ENDERECO = "Rua Turim, 715, Casa 5, Residencial Florença, Sinop/MT, CEP 78.555-399";
const EMAIL = "eronimt@hotmail.com";
const TELEFONE = "(66) 99912-6120";
const ATUALIZADO = "19 de outubro de 2026";

export default function Privacidade() {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "48px 20px", lineHeight: 1.7 }}>
      <h1>Política de Privacidade</h1>
      <p><em>Última atualização: {ATUALIZADO}</em></p>

      <p>
        Esta Política explica como a <strong>{EMPRESA}</strong> (“Gauchinho Consórcios”), inscrita no
        CNPJ {CNPJ}, com sede em {ENDERECO}, trata dados pessoais no site gauchinhoconsorcios.com.br,
        no sistema de gestão (ERP) e nas integrações com o WhatsApp Business, em conformidade com a
        Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD).
      </p>

      <h2>1. Dados que coletamos</h2>
      <ul>
        <li>Dados de identificação e contato: nome, CPF/CNPJ, telefone, e-mail, cidade.</li>
        <li>Dados de interesse em consórcio: tipo de bem, valor de crédito, simulações e propostas.</li>
        <li>Mensagens trocadas pelo WhatsApp com nossa equipe e com nossas unidades franqueadas.</li>
        <li>
          Dados de integração com a Meta: ao conectar uma conta do WhatsApp Business ao nosso sistema,
          recebemos identificadores da conta (WABA ID), do número de telefone e tokens de acesso
          autorizados pelo titular da conta.
        </li>
        <li>Dados técnicos de navegação: endereço IP, navegador, páginas acessadas e cookies.</li>
      </ul>

      <h2>2. Como usamos os dados</h2>
      <ul>
        <li>Atender solicitações, enviar simulações e propostas de consórcio.</li>
        <li>Enviar e receber mensagens pelo WhatsApp em nome da Gauchinho e de suas franquias.</li>
        <li>Gerir clientes, contratos, comissões e o relacionamento comercial no ERP.</li>
        <li>Cumprir obrigações legais e regulatórias.</li>
        <li>Melhorar nossos serviços e a segurança da plataforma.</li>
      </ul>

      <h2>3. Bases legais</h2>
      <p>
        Execução de contrato e de procedimentos preliminares, consentimento, legítimo interesse e
        cumprimento de obrigação legal, conforme o art. 7º da LGPD.
      </p>

      <h2>4. Compartilhamento</h2>
      <p>Compartilhamos dados apenas quando necessário com:</p>
      <ul>
        <li>Administradora de consórcio parceira, para formalização de propostas e contratos.</li>
        <li>Unidades franqueadas Gauchinho, para atendimento ao cliente da sua região.</li>
        <li>Meta Platforms (WhatsApp Business Platform), para o envio e recebimento de mensagens.</li>
        <li>Provedores de hospedagem e tecnologia que operam nosso sistema.</li>
        <li>Autoridades, quando exigido por lei.</li>
      </ul>
      <p>Não vendemos dados pessoais.</p>

      <h2>5. Dados obtidos da Meta / WhatsApp</h2>
      <p>
        Os dados recebidos das APIs da Meta são usados exclusivamente para operar o atendimento por
        WhatsApp da empresa que autorizou a conexão. Não usamos esses dados para publicidade de
        terceiros nem os transferimos para outras finalidades. O titular da conta pode revogar o
        acesso a qualquer momento nas configurações do Gerenciador de Negócios da Meta ou solicitando
        a exclusão pelo e-mail abaixo.
      </p>

      <h2>6. Armazenamento e segurança</h2>
      <p>
        Os dados são armazenados em servidores com criptografia em trânsito, controle de acesso por
        usuário e registro de atividades. Mantemos os dados pelo tempo necessário às finalidades
        acima ou pelo prazo exigido em lei.
      </p>

      <h2>7. Seus direitos</h2>
      <p>
        Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade,
        exclusão e revogação de consentimento, nos termos do art. 18 da LGPD.
      </p>

      <h2 id="exclusao">8. Exclusão de dados</h2>
      <p>
        Para excluir seus dados, envie um e-mail para <a href={`mailto:${EMAIL}`}>{EMAIL}</a> com o
        assunto “Exclusão de dados”, informando nome e telefone. Respondemos em até 15 dias.
      </p>

      <h2>9. Cookies</h2>
      <p>Usamos cookies necessários ao funcionamento do site e cookies de medição de audiência.</p>

      <h2>10. Contato do encarregado (DPO)</h2>
      <p>
        {EMPRESA} — <a href={`mailto:${EMAIL}`}>{EMAIL}</a> — WhatsApp/telefone {TELEFONE}
      </p>

      <h2>11. Alterações</h2>
      <p>Esta Política pode ser atualizada. A versão vigente estará sempre nesta página.</p>
    </main>
  );
}

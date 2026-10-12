import { aoClicar } from "./base";

const CONTATO = "contato@planetadiario.online";
const PRIVACIDADE = "privacidade@planetadiario.online";
const ATUALIZADO = "12 de outubro de 2026";

function Pagina({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <article className="max-w-3xl">
      <h1 className="text-3xl font-bold">{titulo}</h1>
      <p className="mt-1 text-sm text-suave">Atualizado em {ATUALIZADO}</p>
      <div className="mt-6 flex flex-col gap-5 leading-relaxed [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        {children}
      </div>
    </article>
  );
}

export function Privacidade() {
  return (
    <Pagina titulo="Política de Privacidade">
      <p>
        Esta política explica como o Planeta Diário (planetadiario.online) trata seus dados pessoais, de acordo com a Lei Geral de
        Proteção de Dados (Lei nº 13.709/2018 — LGPD).
      </p>
      <h2>1. Quais dados coletamos</h2>
      <ul>
        <li><b>Conta:</b> nome, e-mail e foto do seu perfil Google, quando você entra com o Google.</li>
        <li><b>Atividade no site:</b> comentários, curtidas, votos nas pautas, pontos e preferências (como tema claro/escuro).</li>
        <li><b>Pagamentos:</b> CPF e celular (opcional), usados só para emitir o PIX pela nossa processadora (Lytex). Não guardamos dados de cartão.</li>
        <li><b>Dados técnicos:</b> informações de navegação necessárias para o funcionamento e a segurança do site.</li>
      </ul>
      <h2>2. Para que usamos</h2>
      <ul>
        <li>Criar e manter sua conta, mostrar seu nome nos comentários, no ranking e no Mural dos Fundadores (se você permitir).</li>
        <li>Processar assinaturas e o Clube de Fundadores, e liberar os benefícios.</li>
        <li>Moderar conteúdo, prevenir abuso e fraudes, e cumprir obrigações legais.</li>
        <li>Melhorar o site e entender quais conteúdos interessam mais (estatísticas agregadas).</li>
      </ul>
      <h2>3. Bases legais</h2>
      <p>Execução de contrato (sua conta, assinatura e Clube), cumprimento de obrigação legal, legítimo interesse (segurança e melhorias) e consentimento quando aplicável.</p>
      <h2>4. Com quem compartilhamos</h2>
      <ul>
        <li><b>Supabase</b> (banco de dados e autenticação), <b>Cloudflare</b> (hospedagem), <b>Google</b> (login).</li>
        <li><b>Lytex</b> (emissão e confirmação do PIX).</li>
        <li>Se houver anúncios, parceiros de publicidade (como o Google AdSense) podem usar cookies; assinantes Pro não veem anúncios.</li>
      </ul>
      <p>Não vendemos seus dados.</p>
      <h2>5. Por quanto tempo guardamos</h2>
      <p>Enquanto sua conta existir. Registros de pagamento podem ser mantidos pelo prazo exigido em lei.</p>
      <h2>6. Seus direitos</h2>
      <p>
        Você pode acessar, corrigir, exportar ou apagar seus dados. A exclusão da conta pode ser feita a qualquer momento em{" "}
        <a href="/conta#privacidade" onClick={aoClicar("/conta#privacidade")} className="text-globo underline">Minha conta → Privacidade e dados</a>. Para outros pedidos, escreva para{" "}
        <a href={`mailto:${PRIVACIDADE}`} className="text-globo underline">{PRIVACIDADE}</a>.
      </p>
      <h2>7. Segurança</h2>
      <p>Usamos conexão criptografada (HTTPS), controle de acesso por usuário no banco de dados e não armazenamos senhas.</p>
      <h2>8. Menores de idade</h2>
      <p>O cadastro e os pagamentos são destinados a maiores de 18 anos ou a menores com autorização dos responsáveis.</p>
      <h2>9. Contato</h2>
      <p>Encarregado de dados (DPO): <a href={`mailto:${PRIVACIDADE}`} className="text-globo underline">{PRIVACIDADE}</a>.</p>
    </Pagina>
  );
}

export function Termos() {
  return (
    <Pagina titulo="Termos de Uso">
      <p>Ao usar o Planeta Diário (planetadiario.online), você concorda com estes termos.</p>
      <h2>1. O serviço</h2>
      <p>
        O Planeta Diário publica notícias e vídeos sobre o que acontece no Brasil e no mundo, com créditos às fontes originais. Nos esforçamos
        para publicar informações corretas; se encontrar algum erro, avise pelo e-mail {CONTATO}.
      </p>
      <h2>2. Conta e comentários</h2>
      <ul>
        <li>Você é responsável pelo que comenta. É proibido publicar conteúdo ilegal, ofensivo, discriminatório, spam ou que viole direitos de terceiros.</li>
        <li>Podemos remover comentários e suspender contas que descumpram estas regras.</li>
        <li>Pontos e ranking não têm valor em dinheiro e podem ser ajustados em caso de abuso.</li>
      </ul>
      <h2>3. Planeta Diário Pro (assinatura)</h2>
      <ul>
        <li>Pagamento por PIX, válido por 30 dias a partir da confirmação. Não há renovação automática nem fidelidade.</li>
        <li>Benefícios: acesso antecipado às notícias, conteúdo exclusivo, site sem anúncios, selo e pontos em dobro.</li>
        <li>Você pode pedir reembolso em até 7 dias após o pagamento (direito de arrependimento — Código de Defesa do Consumidor, art. 49).</li>
      </ul>
      <h2>4. Clube de Fundadores</h2>
      <ul>
        <li>Pagamento único que dá número de fundador, selo, nome no mural, votação de pautas, certificado digital e dias de Pro de presente.</li>
        <li><b>Não é participação societária, investimento, título ou promessa de qualquer retorno financeiro.</b> O certificado é simbólico.</li>
        <li>As votações de pautas são consultivas: ajudam a decidir coberturas, mas a decisão editorial é do Planeta Diário.</li>
        <li>Reembolso em até 7 dias após o pagamento; nesse caso o número e o selo são cancelados.</li>
      </ul>
      <h2>5. Conteúdo de terceiros</h2>
      <p>
        Vídeos e imagens de terceiros são usados com fins informativos e jornalísticos, com crédito à fonte. Se você é titular de algum conteúdo
        e deseja a remoção, escreva para {CONTATO} que analisaremos com prioridade.
      </p>
      <h2>6. Alterações</h2>
      <p>Podemos atualizar estes termos; a data no topo indica a última versão.</p>
      <h2>7. Contato</h2>
      <p><a href={`mailto:${CONTATO}`} className="text-globo underline">{CONTATO}</a></p>
    </Pagina>
  );
}

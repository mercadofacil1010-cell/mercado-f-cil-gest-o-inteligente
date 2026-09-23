import { useMemo, useState, type ChangeEvent } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Mail,
  Save,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { completeCompanySignup, type CompanySignupData } from "@/lib/complete-signup";
import { saveSignupDraft, loadSignupDraft, clearSignupDraft } from "@/lib/signup-draft";

type FormData = {
  name: string;
  cpf: string;
  birthDate: string;
  whatsapp: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  terms: boolean;
  legalName: string;
  tradeName: string;
  cnpj: string;
  stateRegistration: string;
  companyPhone: string;
  companyEmail: string;
  zipCode: string;
  address: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  stores: string;
  segment: string;
  products: string;
  hasPos: string;
  posName: string;
  wantsTrial: string;
};

const initialData: FormData = {
  name: "", cpf: "", birthDate: "", whatsapp: "", email: "", password: "", passwordConfirmation: "", terms: false,
  legalName: "", tradeName: "", cnpj: "", stateRegistration: "", companyPhone: "", companyEmail: "", zipCode: "", address: "", number: "", complement: "", district: "", city: "", state: "",
  stores: "1", segment: "Supermercado", products: "Até 5.000", hasPos: "Sim", posName: "", wantsTrial: "Sim",
};

// Idade mínima do responsável (DEC-B1-04).
const MINIMUM_AGE_YEARS = 18;
function ageInYears(birthDate: string) {
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDiff = today.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) age -= 1;
  return age;
}

const responsibleSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo").max(120),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "Informe um CPF válido"),
  birthDate: z.string().min(1, "Informe a data de nascimento").refine((value) => ageInYears(value) >= MINIMUM_AGE_YEARS, {
    message: `É preciso ter ${MINIMUM_AGE_YEARS} anos ou mais para se cadastrar`,
  }),
  whatsapp: z.string().min(14, "Informe um telefone válido"),
  email: z.string().trim().email("Informe um e-mail válido").max(255),
  // Regra de senha (DEC-B1-01): mínimo 8 caracteres, com letra e número.
  password: z.string().min(8, "Use pelo menos 8 caracteres")
    .regex(/[a-zA-Z]/, "A senha precisa ter pelo menos uma letra")
    .regex(/[0-9]/, "A senha precisa ter pelo menos um número")
    .max(72),
  passwordConfirmation: z.string(),
  terms: z.literal(true, { errorMap: () => ({ message: "Aceite os termos para continuar" }) }),
}).refine((data) => data.password === data.passwordConfirmation, { message: "As senhas não coincidem", path: ["passwordConfirmation"] });

const companySchema = z.object({
  legalName: z.string().trim().min(3, "Informe a razão social").max(160),
  tradeName: z.string().trim().min(2, "Informe o nome fantasia").max(120),
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "Informe um CNPJ válido"),
  // Inscrição estadual é opcional (D-07): nem toda empresa/segmento tem uma.
  stateRegistration: z.string().trim().max(30),
  companyPhone: z.string().min(14, "Informe um telefone válido"),
  companyEmail: z.string().trim().email("Informe um e-mail comercial válido").max(255),
  zipCode: z.string().regex(/^\d{5}-\d{3}$/, "Informe um CEP válido"),
  address: z.string().trim().min(3, "Informe o endereço").max(160),
  number: z.string().trim().min(1, "Informe o número").max(12),
  district: z.string().trim().min(2, "Informe o bairro").max(80),
  city: z.string().trim().min(2, "Informe a cidade").max(80),
  state: z.string().min(2, "Selecione o estado"),
});

const setupSchema = z.object({
  stores: z.string().refine((value) => Number(value) > 0, "Informe ao menos um mercado"),
  segment: z.string().min(1, "Selecione o segmento"),
  products: z.string().min(1, "Selecione a quantidade de produtos"),
  hasPos: z.string().min(1, "Selecione uma opção"),
  posName: z.string().max(80),
  wantsTrial: z.string().min(1, "Selecione uma opção"),
}).refine((data) => data.hasPos !== "Sim" || data.posName.trim().length >= 2, { message: "Informe o nome do sistema de PDV", path: ["posName"] });

const steps = [
  { label: "Responsável", icon: UserRound },
  { label: "Empresa", icon: Building2 },
  { label: "Configuração", icon: Store },
  { label: "Confirmação", icon: ShieldCheck },
];

function onlyDigits(value: string) { return value.replace(/\D/g, ""); }
function maskCpf(value: string) { return onlyDigits(value).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"); }
function maskCnpj(value: string) { return onlyDigits(value).slice(0, 14).replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2"); }
function maskPhone(value: string) { return onlyDigits(value).slice(0, 11).replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2"); }
function maskZip(value: string) { return onlyDigits(value).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2"); }
// CPF mascarado nas telas por padrão (DEC-B1-08); CNPJ não precisa, é registro público.
function displayMaskedCpf(value: string) {
  const digits = onlyDigits(value);
  if (digits.length < 11) return value;
  return `***.***.**${digits.slice(-2)}`;
}

// O rascunho salvo no aparelho nunca guarda a senha (RF-ACC-07): mesmo sendo
// só neste dispositivo, não é seguro manter uma senha em texto puro salva por
// até 7 dias no armazenamento do navegador.
type DraftData = Omit<FormData, "password" | "passwordConfirmation">;

export function SignupFlow({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(() => {
    const draft = loadSignupDraft<DraftData>();
    return draft ? { ...initialData, ...draft.data } : initialData;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [success, setSuccess] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function saveDraft() {
    const { password: _password, passwordConfirmation: _passwordConfirmation, ...draftData } = data;
    saveSignupDraft<DraftData>(draftData);
  }

  const progress = ((step + 1) / steps.length) * 100;
  const currentTitle = ["Dados do responsável", "Dados da empresa", "Configuração inicial", "Revise e confirme"][step];
  const currentDescription = ["Crie seu acesso principal à plataforma.", "Conte-nos sobre o primeiro mercado da sua rede.", "Ajuste o Mercado Fácil ao tamanho da sua operação.", "Confira os dados antes de criar sua empresa."][step];

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((current) => ({ ...current, [key]: value }));
    setErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  }

  function inputProps(key: keyof FormData, mask?: (value: string) => string) {
    return {
      value: String(data[key]),
      onChange: (event: ChangeEvent<HTMLInputElement>) => update(key, mask ? mask(event.target.value) : event.target.value),
      "aria-invalid": Boolean(errors[key]),
    };
  }

  function validateCurrent() {
    const schema = step === 0 ? responsibleSchema : step === 1 ? companySchema : setupSchema;
    const result = schema.safeParse(data);
    if (result.success) { setErrors({}); return true; }
    const nextErrors: Record<string, string> = {};
    result.error.issues.forEach((issue) => { const key = String(issue.path[0]); if (!nextErrors[key]) nextErrors[key] = issue.message; });
    setErrors(nextErrors);
    return false;
  }

  function next() {
    if (step < 3 && validateCurrent()) { setStep((current) => current + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  async function submit() {
    setSubmitError("");
    if (!responsibleSchema.safeParse(data).success || !companySchema.safeParse(data).success || !setupSchema.safeParse(data).success) {
      setSubmitError("Revise as etapas anteriores: há algum dado pendente ou inválido.");
      return;
    }
    setSubmitting(true);
    try {
      // Confere o dígito verificador de verdade (não só o formato) antes de gravar.
      const [{ data: cpfOk }, { data: cnpjOk }] = await Promise.all([
        supabase.rpc("is_valid_cpf", { value: onlyDigits(data.cpf) }),
        supabase.rpc("is_valid_cnpj", { value: onlyDigits(data.cnpj) }),
      ]);
      if (!cpfOk) { setSubmitError("O CPF informado não é válido."); return; }
      if (!cnpjOk) { setSubmitError("O CNPJ informado não é válido."); return; }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: data.email.trim(),
        password: data.password,
        options: { data: { full_name: data.name.trim() } },
      });
      if (signUpError) {
        setSubmitError(signUpError.message.toLowerCase().includes("already registered")
          ? "Este e-mail já tem uma conta no Mercado Fácil."
          : "Não foi possível criar sua conta agora. Tente novamente.");
        return;
      }

      const { password: _password, passwordConfirmation: _passwordConfirmation, ...draftData } = data;

      if (signUpData.session) {
        // E-mail já confirmado (ou confirmação desligada no painel): segue direto.
        const result = await completeCompanySignup(data);
        if (!result.ok) { setSubmitError(result.message); return; }
        clearSignupDraft();
        setSuccess(true);
      } else {
        // Falta confirmar o e-mail (DEC-B1-02): guarda os dados da empresa para
        // criar assim que o usuário confirmar e fizer login (ver auth-context).
        saveSignupDraft<DraftData>(draftData, data.email.trim());
        setAwaitingConfirmation(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (awaitingConfirmation) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5 py-10">
        <section className="w-full max-w-xl rounded-lg border border-border bg-card p-7 text-center shadow-card sm:p-10">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-lg bg-primary-soft text-primary"><Mail className="h-9 w-9" /></span>
          <h1 className="mt-6 text-3xl font-extrabold tracking-normal">Confirme seu e-mail</h1>
          <p className="mx-auto mt-3 max-w-md text-base leading-7 text-muted-foreground">
            Enviamos um link de confirmação para <strong>{data.email}</strong>. Depois de confirmar, faça login que sua empresa "{data.tradeName}" é criada automaticamente.
          </p>
          <Button className="mt-7 w-full sm:w-auto" onClick={onBack}>Voltar para o login <ArrowRight className="h-4 w-4" /></Button>
        </section>
      </main>
    );
  }

  if (success) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5 py-10">
        <section className="w-full max-w-xl rounded-lg border border-border bg-card p-7 text-center shadow-card sm:p-10">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-lg bg-highlight-soft text-success"><CheckCircle2 className="h-9 w-9" /></span>
          <h1 className="mt-6 text-3xl font-extrabold tracking-normal">Empresa cadastrada com sucesso!</h1>
          <p className="mx-auto mt-3 max-w-md text-base leading-7 text-muted-foreground">Sua conta e sua empresa já estão gravadas no Mercado Fácil.</p>
          <div className="mt-7 rounded-md bg-muted p-4 text-left"><span className="text-sm text-muted-foreground">Empresa</span><strong className="mt-1 block">{data.tradeName}</strong></div>
          <Button className="mt-7 w-full sm:w-auto" onClick={onComplete}>Acessar minha dashboard <ArrowRight className="h-4 w-4" /></Button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 sm:px-7">
          <Button variant="ghost" size="icon" onClick={step === 0 ? onBack : () => setStep((current) => current - 1)} aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Button>
          <BrandLogo className="justify-self-center" />
          <span className="hidden text-sm font-semibold text-muted-foreground sm:block">Configuração da conta</span>
          <span className="w-10 sm:hidden" />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-7 sm:py-10">
        <div className="mb-8 lg:hidden">
          <div className="flex items-center justify-between text-sm font-semibold"><span>Etapa {step + 1} de 4</span><span className="text-primary">{steps[step]?.label}</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-12">
          <aside className="hidden lg:block">
            <p className="mb-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Seu progresso</p>
            <ol className="space-y-2">
              {steps.map(({ label, icon: Icon }, index) => (
                <li key={label} className={cn("grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md p-3", index === step && "bg-primary-soft", index < step && "text-success")}>
                  <span className={cn("grid h-9 w-9 place-items-center rounded-md border border-border bg-card", index === step && "border-primary bg-primary text-primary-foreground", index < step && "border-success")}>
                    {index < step ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0"><span className="block text-xs text-muted-foreground">Etapa {index + 1}</span><strong className="block truncate text-sm">{label}</strong></div>
                </li>
              ))}
            </ol>
          </aside>

          <section className="min-w-0">
            <div className="mb-7"><p className="text-sm font-bold text-primary">Etapa {step + 1} de 4</p><h1 className="mt-1 text-2xl font-extrabold tracking-normal sm:text-3xl">{currentTitle}</h1><p className="mt-2 text-base text-muted-foreground">{currentDescription}</p></div>
            <div className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-7">
              {step === 0 && <ResponsibleFields data={data} update={update} inputProps={inputProps} errors={errors} />}
              {step === 1 && <CompanyFields data={data} update={update} inputProps={inputProps} errors={errors} />}
              {step === 2 && <SetupFields data={data} update={update} errors={errors} />}
              {step === 3 && <Confirmation data={data} />}
            </div>

            {saved && <p role="status" className="mt-4 rounded-md bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">Progresso salvo neste aparelho por 7 dias.</p>}
            {submitError && <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">{submitError}</p>}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
              <Button variant="outline" onClick={step === 0 ? onBack : () => setStep((current) => current - 1)}><ArrowLeft className="h-4 w-4" /> Voltar</Button>
              <Button variant="ghost" onClick={() => { saveDraft(); setSaved(true); window.setTimeout(() => setSaved(false), 3000); }}><Save className="h-4 w-4" /> Salvar e continuar depois</Button>
              <Button className="sm:ml-auto" disabled={submitting} onClick={step === 3 ? () => void submit() : next}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{step === 3 ? "Criar minha empresa" : "Continuar"} {step === 3 ? <Building2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}</>}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

type FieldProps = {
  data: FormData;
  update: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
  inputProps: (key: keyof FormData, mask?: (value: string) => string) => { value: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; "aria-invalid": boolean };
  errors: Record<string, string>;
};

function Field({ label, field, error, optional, children }: { label: string; field: string; error?: string | undefined; optional?: boolean | undefined; children: React.ReactNode }) {
  return <label className="block min-w-0"><span className="mb-2 block text-sm font-semibold">{label}{optional && <span className="font-normal text-muted-foreground"> (opcional)</span>}</span>{children}{error && <span className="mt-1.5 block text-sm font-medium text-critical" id={`${field}-error`}>{error}</span>}</label>;
}
const inputClass = "h-12 w-full rounded-md border border-input bg-card px-4 text-base outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15 aria-invalid:border-critical aria-invalid:ring-critical/10";
const selectClass = `${inputClass} appearance-none`;

function ResponsibleFields({ data, update, inputProps, errors }: FieldProps) {
  return <div className="grid gap-5 sm:grid-cols-2">
    <div className="sm:col-span-2"><Field label="Nome completo" field="name" error={errors["name"]}><input {...inputProps("name")} maxLength={120} autoComplete="name" placeholder="Nome e sobrenome" className={inputClass} /></Field></div>
    <Field label="CPF" field="cpf" error={errors["cpf"]}><input {...inputProps("cpf", maskCpf)} inputMode="numeric" placeholder="000.000.000-00" className={inputClass} /></Field>
    <Field label="Data de nascimento" field="birthDate" error={errors["birthDate"]}><input {...inputProps("birthDate")} type="date" className={inputClass} /></Field>
    <Field label="Telefone/WhatsApp" field="whatsapp" error={errors["whatsapp"]}><input {...inputProps("whatsapp", maskPhone)} inputMode="tel" placeholder="(00) 00000-0000" className={inputClass} /></Field>
    <Field label="E-mail" field="email" error={errors["email"]}><input {...inputProps("email")} type="email" maxLength={255} autoComplete="email" placeholder="voce@empresa.com.br" className={inputClass} /></Field>
    <Field label="Senha" field="password" error={errors["password"]}><input {...inputProps("password")} type="password" maxLength={72} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" className={inputClass} /></Field>
    <Field label="Confirmação da senha" field="passwordConfirmation" error={errors["passwordConfirmation"]}><input {...inputProps("passwordConfirmation")} type="password" maxLength={72} autoComplete="new-password" placeholder="Repita a senha" className={inputClass} /></Field>
    <div className="sm:col-span-2"><label className="flex items-start gap-3 rounded-md bg-muted p-4 text-sm leading-6"><input type="checkbox" checked={data.terms} onChange={(event) => update("terms", event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-primary" /><span>Li e aceito os <strong className="text-primary">Termos de Uso</strong> e a <strong className="text-primary">Política de Privacidade</strong>.</span></label>{errors["terms"] && <span className="mt-1.5 block text-sm font-medium text-critical">{errors["terms"]}</span>}</div>
  </div>;
}

function CompanyFields({ inputProps, errors }: FieldProps) {
  return <div className="grid gap-5 sm:grid-cols-2">
    <div className="sm:col-span-2"><Field label="Razão social" field="legalName" error={errors["legalName"]}><input {...inputProps("legalName")} maxLength={160} className={inputClass} /></Field></div>
    <Field label="Nome fantasia" field="tradeName" error={errors["tradeName"]}><input {...inputProps("tradeName")} maxLength={120} className={inputClass} /></Field>
    <Field label="CNPJ" field="cnpj" error={errors["cnpj"]}><input {...inputProps("cnpj", maskCnpj)} inputMode="numeric" placeholder="00.000.000/0000-00" className={inputClass} /></Field>
    <Field label="Inscrição estadual" field="stateRegistration" error={errors["stateRegistration"]} optional><input {...inputProps("stateRegistration")} maxLength={30} className={inputClass} /></Field>
    <Field label="Telefone" field="companyPhone" error={errors["companyPhone"]}><input {...inputProps("companyPhone", maskPhone)} inputMode="tel" placeholder="(00) 00000-0000" className={inputClass} /></Field>
    <div className="sm:col-span-2"><Field label="E-mail comercial" field="companyEmail" error={errors["companyEmail"]}><input {...inputProps("companyEmail")} type="email" maxLength={255} className={inputClass} /></Field></div>
    <Field label="CEP" field="zipCode" error={errors["zipCode"]}><input {...inputProps("zipCode", maskZip)} inputMode="numeric" placeholder="00000-000" className={inputClass} /></Field>
    <Field label="Endereço" field="address" error={errors["address"]}><input {...inputProps("address")} maxLength={160} className={inputClass} /></Field>
    <Field label="Número" field="number" error={errors["number"]}><input {...inputProps("number")} maxLength={12} className={inputClass} /></Field>
    <Field label="Complemento" field="complement" optional><input {...inputProps("complement")} maxLength={80} className={inputClass} /></Field>
    <Field label="Bairro" field="district" error={errors["district"]}><input {...inputProps("district")} maxLength={80} className={inputClass} /></Field>
    <Field label="Cidade" field="city" error={errors["city"]}><input {...inputProps("city")} maxLength={80} className={inputClass} /></Field>
    <Field label="Estado" field="state" error={errors["state"]}><select value={String(inputProps("state").value)} onChange={(event) => inputProps("state").onChange(event as unknown as ChangeEvent<HTMLInputElement>)} className={selectClass}><option value="">Selecione</option>{["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((state) => <option key={state}>{state}</option>)}</select></Field>
  </div>;
}

function SetupFields({ data, update, errors }: Omit<FieldProps, "inputProps">) {
  const choices = (key: keyof FormData, options: string[]) => <div className="grid gap-3 sm:grid-cols-2">{options.map((option) => <label key={option} className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-md border p-3.5 transition", data[key] === option ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40")}><input type="radio" name={key} value={option} checked={data[key] === option} onChange={() => update(key, option as never)} className="h-4 w-4 accent-primary" /><span className="text-sm font-semibold">{option}</span></label>)}</div>;
  return <div className="grid gap-6 sm:grid-cols-2">
    <Field label="Quantidade inicial de mercados" field="stores" error={errors["stores"]}><input type="number" min="1" max="999" value={data.stores} onChange={(event) => update("stores", event.target.value)} className={inputClass} /></Field>
    <Field label="Segmento da empresa" field="segment" error={errors["segment"]}><select value={data.segment} onChange={(event) => update("segment", event.target.value)} className={selectClass}><option>Supermercado</option><option>Atacarejo</option><option>Mercado de bairro</option><option>Hortifrúti</option><option>Conveniência</option></select></Field>
    <div className="sm:col-span-2"><Field label="Quantidade aproximada de produtos" field="products" error={errors["products"]}><select value={data.products} onChange={(event) => update("products", event.target.value)} className={selectClass}><option>Até 5.000</option><option>De 5.001 a 15.000</option><option>De 15.001 a 50.000</option><option>Mais de 50.000</option></select></Field></div>
    <div className="sm:col-span-2"><Field label="Possui sistema de PDV?" field="hasPos" error={errors["hasPos"]}>{choices("hasPos", ["Sim", "Não"])}</Field></div>
    {data.hasPos === "Sim" && <div className="sm:col-span-2"><Field label="Nome do sistema de PDV" field="posName" error={errors["posName"]}><input value={data.posName} onChange={(event) => update("posName", event.target.value)} maxLength={80} placeholder="Informe o sistema utilizado" className={inputClass} /></Field></div>}
    <div className="sm:col-span-2"><Field label="Deseja iniciar um período de teste?" field="wantsTrial" error={errors["wantsTrial"]}>{choices("wantsTrial", ["Sim", "Não"])}</Field></div>
  </div>;
}

function Confirmation({ data }: { data: FormData }) {
  const groups = useMemo(() => [
    { title: "Responsável", items: [["Nome", data.name], ["CPF", displayMaskedCpf(data.cpf)], ["E-mail", data.email], ["WhatsApp", data.whatsapp]] },
    { title: "Empresa", items: [["Nome fantasia", data.tradeName], ["Razão social", data.legalName], ["CNPJ", data.cnpj], ["Localização", `${data.city} · ${data.state}`]] },
    { title: "Configuração", items: [["Mercados", data.stores], ["Segmento", data.segment], ["Produtos", data.products], ["Sistema de PDV", data.hasPos === "Sim" ? data.posName : "Não possui"]] },
  ], [data]);
  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-3">{groups.map((group) => <section key={group.title} className="rounded-md border border-border p-4"><h2 className="mb-4 font-bold">{group.title}</h2><dl className="space-y-3">{group.items.map(([label, value]) => <div key={label}><dt className="text-xs font-semibold text-muted-foreground">{label}</dt><dd className="mt-0.5 break-words text-sm font-semibold">{value}</dd></div>)}</dl></section>)}</div>
    <section className="grid gap-5 rounded-lg bg-brand-panel p-5 text-sidebar-foreground sm:grid-cols-[auto_minmax(0,1fr)] sm:p-6">
      <span className="grid h-11 w-11 place-items-center rounded-md bg-sidebar-accent text-brand-soft"><CreditCard className="h-5 w-5" /></span>
      <div><h2 className="text-lg font-bold">Seu início no Mercado Fácil</h2><p className="mt-2 text-sm leading-6 text-sidebar-muted">O período de teste é gratuito. Depois dele, a cobrança será feita por mercado adicionado e você poderá cancelar quando quiser.</p><div className="mt-4 flex items-center justify-between border-t border-sidebar-border pt-4"><span className="text-sm text-sidebar-muted">Valor após o teste</span><strong className="text-lg text-brand-soft">A definir</strong></div></div>
    </section>
  </div>;
}
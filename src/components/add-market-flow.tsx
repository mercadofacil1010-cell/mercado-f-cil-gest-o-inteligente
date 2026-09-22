import { useState, type ChangeEvent, type ComponentType } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  MapPin,
  Save,
  Store,
  UserRound,
  Warehouse,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NewMarketData = {
  unitName: string;
  legalName: string;
  cnpj: string;
  cnpjType: "Próprio" | "Matriz";
  internalCode: string;
  phone: string;
  email: string;
  openingHours: string;
  initialStatus: "Aberto" | "Fechado";
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  reference: string;
  managerName: string;
  managerCpf: string;
  managerPhone: string;
  managerEmail: string;
  inviteManager: boolean;
  checkouts: string;
  warehouses: string;
  employees: string;
  area: string;
  posSystem: string;
  barcodeReaders: "Sim" | "Não";
  labelPrinter: "Sim" | "Não";
  billingAccepted: boolean;
};

const initialData: NewMarketData = {
  unitName: "", legalName: "", cnpj: "", cnpjType: "Próprio", internalCode: "", phone: "", email: "", openingHours: "", initialStatus: "Aberto",
  zipCode: "", street: "", number: "", complement: "", district: "", city: "", state: "", reference: "",
  managerName: "", managerCpf: "", managerPhone: "", managerEmail: "", inviteManager: true,
  checkouts: "", warehouses: "", employees: "", area: "", posSystem: "", barcodeReaders: "Sim", labelPrinter: "Sim", billingAccepted: false,
};

const identificationSchema = z.object({
  unitName: z.string().trim().min(2, "Informe o nome da unidade").max(100),
  legalName: z.string().trim().min(3, "Informe o nome empresarial").max(160),
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "Informe um CNPJ válido"),
  internalCode: z.string().trim().min(2, "Informe o código interno").max(30),
  phone: z.string().min(14, "Informe um telefone válido"),
  email: z.string().trim().email("Informe um e-mail válido").max(255),
  openingHours: z.string().trim().min(5, "Informe o horário de funcionamento").max(80),
  initialStatus: z.enum(["Aberto", "Fechado"]),
});
const addressSchema = z.object({
  zipCode: z.string().regex(/^\d{5}-\d{3}$/, "Informe um CEP válido"),
  street: z.string().trim().min(3, "Informe a rua").max(160),
  number: z.string().trim().min(1, "Informe o número").max(12),
  district: z.string().trim().min(2, "Informe o bairro").max(80),
  city: z.string().trim().min(2, "Informe a cidade").max(80),
  state: z.string().length(2, "Selecione o estado"),
});
const managerSchema = z.object({
  managerName: z.string().trim().min(3, "Informe o nome do gerente").max(120),
  managerCpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "Informe um CPF válido"),
  managerPhone: z.string().min(14, "Informe um telefone válido"),
  managerEmail: z.string().trim().email("Informe um e-mail válido").max(255),
});
const structureSchema = z.object({
  checkouts: z.string().refine((value) => Number(value) > 0, "Informe ao menos um caixa"),
  warehouses: z.string().refine((value) => Number(value) > 0, "Informe ao menos um depósito"),
  employees: z.string().refine((value) => Number(value) > 0, "Informe a quantidade de funcionários"),
  area: z.string().refine((value) => Number(value) > 0, "Informe a área aproximada"),
  posSystem: z.string().trim().min(2, "Informe o sistema de PDV").max(80),
});
const billingSchema = z.object({ billingAccepted: z.literal(true, { errorMap: () => ({ message: "Confirme o aceite para adicionar a unidade" }) }) });

const steps: Array<{ label: string; icon: ComponentType<{ className?: string }> }> = [
  { label: "Identificação", icon: Store },
  { label: "Endereço", icon: MapPin },
  { label: "Responsável", icon: UserRound },
  { label: "Estrutura", icon: Warehouse },
  { label: "Cobrança", icon: CreditCard },
];

const digits = (value: string) => value.replace(/\D/g, "");
const maskCpf = (value: string) => digits(value).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const maskCnpj = (value: string) => digits(value).slice(0, 14).replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
const maskPhone = (value: string) => digits(value).slice(0, 11).replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
const maskZip = (value: string) => digits(value).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");

export function AddMarketFlow({ onCancel, onComplete }: { onCancel: () => void; onComplete: (data: NewMarketData) => void }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<NewMarketData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [success, setSuccess] = useState(false);
  const titles = ["Identificação da unidade", "Endereço do mercado", "Responsável pela unidade", "Estrutura operacional", "Resumo da cobrança"];
  const descriptions = ["Informe os dados cadastrais e operacionais básicos.", "Localize a nova unidade da sua rede.", "Defina quem responderá pela operação local.", "Dimensione a estrutura deste mercado.", "Confira o impacto demonstrativo na assinatura."];

  function update<K extends keyof NewMarketData>(key: K, value: NewMarketData[K]) {
    setData((current) => ({ ...current, [key]: value }));
    setErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  }
  function inputProps(key: keyof NewMarketData, mask?: (value: string) => string) {
    return { value: String(data[key]), onChange: (event: ChangeEvent<HTMLInputElement>) => update(key, (mask ? mask(event.target.value) : event.target.value) as never), "aria-invalid": Boolean(errors[key]) };
  }
  function validate() {
    const schema = [identificationSchema, addressSchema, managerSchema, structureSchema, billingSchema][step];
    const result = schema?.safeParse(data);
    if (result?.success) { setErrors({}); return true; }
    const nextErrors: Record<string, string> = {};
    result?.error.issues.forEach((issue) => { const key = String(issue.path[0]); if (!nextErrors[key]) nextErrors[key] = issue.message; });
    setErrors(nextErrors);
    return false;
  }
  function continueFlow() {
    if (!validate()) return;
    if (step === 4) setSuccess(true);
    else { setStep((current) => current + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  if (success) return <main className="grid min-h-screen place-items-center bg-background px-5 py-10">
    <section className="w-full max-w-xl rounded-lg border border-border bg-card p-7 text-center shadow-card sm:p-10">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-lg bg-highlight-soft text-success"><CheckCircle2 className="h-9 w-9" /></span>
      <h1 className="mt-6 text-3xl font-extrabold">Mercado adicionado com sucesso!</h1>
      <p className="mx-auto mt-3 max-w-md leading-7 text-muted-foreground">A unidade foi ativada nesta demonstração e já pode ser acompanhada na visão geral.</p>
      <div className="mt-6 rounded-md bg-muted p-4 text-left"><span className="text-sm text-muted-foreground">Nova unidade</span><strong className="mt-1 block">{data.unitName}</strong><span className="mt-1 block text-sm text-muted-foreground">{data.city} · {data.state}</span></div>
      <Button className="mt-7 w-full sm:w-auto" onClick={() => onComplete(data)}>Ver mercado na dashboard <ArrowRight className="h-4 w-4" /></Button>
    </section>
  </main>;

  return <main className="min-h-screen bg-background">
    <header className="border-b border-border bg-card"><div className="mx-auto grid max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 sm:px-7">
      <Button variant="ghost" size="icon" onClick={step === 0 ? onCancel : () => setStep((current) => current - 1)} aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Button>
      <BrandLogo className="justify-self-center" /><span className="hidden text-sm font-semibold text-muted-foreground sm:block">Nova unidade</span><span className="w-10 sm:hidden" />
    </div></header>
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-7 sm:py-10">
      <div className="mb-8 lg:hidden"><div className="flex items-center justify-between text-sm font-semibold"><span>Etapa {step + 1} de 5</span><span className="text-primary">{steps[step]?.label}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((step + 1) / 5) * 100}%` }} /></div></div>
      <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block"><p className="mb-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Cadastro da unidade</p><ol className="space-y-2">{steps.map(({ label, icon: Icon }, index) => <li key={label} className={cn("grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md p-3", index === step && "bg-primary-soft", index < step && "text-success")}><span className={cn("grid h-9 w-9 place-items-center rounded-md border border-border bg-card", index === step && "border-primary bg-primary text-primary-foreground", index < step && "border-success")}>{index < step ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span><div><span className="block text-xs text-muted-foreground">Etapa {index + 1}</span><strong className="block text-sm">{label}</strong></div></li>)}</ol></aside>
        <section className="min-w-0"><div className="mb-7"><p className="text-sm font-bold text-primary">Etapa {step + 1} de 5</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{titles[step]}</h1><p className="mt-2 text-muted-foreground">{descriptions[step]}</p></div>
          <div className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-7">
            {step === 0 && <Identification data={data} update={update} inputProps={inputProps} errors={errors} />}
            {step === 1 && <Address data={data} update={update} inputProps={inputProps} errors={errors} />}
            {step === 2 && <Manager data={data} update={update} inputProps={inputProps} errors={errors} />}
            {step === 3 && <Structure data={data} update={update} inputProps={inputProps} errors={errors} />}
            {step === 4 && <Billing data={data} update={update} error={errors["billingAccepted"]} />}
          </div>
          {saved && <p role="status" className="mt-4 rounded-md bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">Rascunho salvo nesta demonstração.</p>}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center"><Button variant="outline" onClick={step === 0 ? onCancel : () => setStep((current) => current - 1)}><ArrowLeft className="h-4 w-4" /> Voltar</Button><Button variant="ghost" onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 3000); }}><Save className="h-4 w-4" /> Salvar rascunho</Button><Button className="sm:ml-auto" onClick={continueFlow}>{step === 4 ? "Confirmar e adicionar mercado" : "Continuar"} {step === 4 ? <Building2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}</Button></div>
        </section>
      </div>
    </div>
  </main>;
}

type FieldsProps = { data: NewMarketData; update: <K extends keyof NewMarketData>(key: K, value: NewMarketData[K]) => void; inputProps: (key: keyof NewMarketData, mask?: (value: string) => string) => { value: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; "aria-invalid": boolean }; errors: Record<string, string> };
const inputClass = "h-12 w-full rounded-md border border-input bg-card px-4 text-base outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15 aria-invalid:border-critical aria-invalid:ring-critical/10";
const selectClass = `${inputClass} appearance-none`;
function Field({ label, field, error, optional, children }: { label: string; field: string; error?: string; optional?: boolean; children: React.ReactNode }) { return <label className="block min-w-0"><span className="mb-2 block text-sm font-semibold">{label}{optional && <span className="font-normal text-muted-foreground"> (opcional)</span>}</span>{children}{error && <span id={`${field}-error`} className="mt-1.5 block text-sm font-medium text-critical">{error}</span>}</label>; }
function Choice<K extends keyof NewMarketData>({ label, name, value, options, update }: { label: string; name: K; value: NewMarketData[K]; options: string[]; update: FieldsProps["update"] }) { return <div><span className="mb-2 block text-sm font-semibold">{label}</span><div className="grid grid-cols-2 gap-3">{options.map((option) => <label key={option} className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-md border p-3.5", value === option ? "border-primary bg-primary-soft" : "border-border")}><input type="radio" name={String(name)} checked={value === option} onChange={() => update(name, option as NewMarketData[K])} className="h-4 w-4 accent-primary" /><span className="text-sm font-semibold">{option}</span></label>)}</div></div>; }

function Identification({ data, update, inputProps, errors }: FieldsProps) { return <div className="grid gap-5 sm:grid-cols-2"><Field label="Nome da unidade" field="unitName" error={errors["unitName"]}><input {...inputProps("unitName")} maxLength={100} placeholder="Ex.: Mercado Vila Nova" className={inputClass} /></Field><Field label="Nome empresarial" field="legalName" error={errors["legalName"]}><input {...inputProps("legalName")} maxLength={160} className={inputClass} /></Field><div className="sm:col-span-2"><Choice label="CNPJ próprio ou CNPJ da matriz" name="cnpjType" value={data.cnpjType} options={["Próprio", "Matriz"]} update={update} /></div><Field label="CNPJ" field="cnpj" error={errors["cnpj"]}><input {...inputProps("cnpj", maskCnpj)} inputMode="numeric" placeholder="00.000.000/0000-00" className={inputClass} /></Field><Field label="Código interno da unidade" field="internalCode" error={errors["internalCode"]}><input {...inputProps("internalCode")} maxLength={30} placeholder="Ex.: UND-004" className={inputClass} /></Field><Field label="Telefone" field="phone" error={errors["phone"]}><input {...inputProps("phone", maskPhone)} inputMode="tel" placeholder="(00) 00000-0000" className={inputClass} /></Field><Field label="E-mail" field="email" error={errors["email"]}><input {...inputProps("email")} type="email" maxLength={255} placeholder="unidade@empresa.com.br" className={inputClass} /></Field><Field label="Horário de funcionamento" field="openingHours" error={errors["openingHours"]}><input {...inputProps("openingHours")} maxLength={80} placeholder="Ex.: Seg a sáb, 8h às 22h" className={inputClass} /></Field><Field label="Status inicial" field="initialStatus"><select value={data.initialStatus} onChange={(event) => update("initialStatus", event.target.value as NewMarketData["initialStatus"])} className={selectClass}><option>Aberto</option><option>Fechado</option></select></Field></div>; }
function Address({ data, update, inputProps, errors }: FieldsProps) { return <div className="grid gap-5 sm:grid-cols-2"><Field label="CEP" field="zipCode" error={errors["zipCode"]}><input {...inputProps("zipCode", maskZip)} inputMode="numeric" placeholder="00000-000" className={inputClass} /></Field><Field label="Rua" field="street" error={errors["street"]}><input {...inputProps("street")} maxLength={160} className={inputClass} /></Field><Field label="Número" field="number" error={errors["number"]}><input {...inputProps("number")} maxLength={12} className={inputClass} /></Field><Field label="Complemento" field="complement" optional><input {...inputProps("complement")} maxLength={80} className={inputClass} /></Field><Field label="Bairro" field="district" error={errors["district"]}><input {...inputProps("district")} maxLength={80} className={inputClass} /></Field><Field label="Cidade" field="city" error={errors["city"]}><input {...inputProps("city")} maxLength={80} className={inputClass} /></Field><Field label="Estado" field="state" error={errors["state"]}><select value={data.state} onChange={(event) => update("state", event.target.value)} className={selectClass}><option value="">Selecione</option>{["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((state) => <option key={state}>{state}</option>)}</select></Field><Field label="Ponto de referência" field="reference" optional><input {...inputProps("reference")} maxLength={120} className={inputClass} /></Field></div>; }
function Manager({ data, update, inputProps, errors }: FieldsProps) { return <div className="grid gap-5 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Nome do gerente" field="managerName" error={errors["managerName"]}><input {...inputProps("managerName")} maxLength={120} className={inputClass} /></Field></div><Field label="CPF" field="managerCpf" error={errors["managerCpf"]}><input {...inputProps("managerCpf", maskCpf)} inputMode="numeric" placeholder="000.000.000-00" className={inputClass} /></Field><Field label="Telefone" field="managerPhone" error={errors["managerPhone"]}><input {...inputProps("managerPhone", maskPhone)} inputMode="tel" placeholder="(00) 00000-0000" className={inputClass} /></Field><div className="sm:col-span-2"><Field label="E-mail" field="managerEmail" error={errors["managerEmail"]}><input {...inputProps("managerEmail")} type="email" maxLength={255} className={inputClass} /></Field></div><div className="sm:col-span-2"><label className="flex items-start gap-3 rounded-md bg-muted p-4 text-sm leading-6"><input type="checkbox" checked={data.inviteManager} onChange={(event) => update("inviteManager", event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-primary" /><span><strong>Enviar convite de acesso ao gerente</strong><span className="block text-muted-foreground">O envio é apenas simulado nesta versão.</span></span></label></div></div>; }
function Structure({ data, update, inputProps, errors }: FieldsProps) { return <div className="grid gap-5 sm:grid-cols-2"><Field label="Quantidade de caixas" field="checkouts" error={errors["checkouts"]}><input {...inputProps("checkouts")} type="number" min="1" max="999" className={inputClass} /></Field><Field label="Quantidade de depósitos" field="warehouses" error={errors["warehouses"]}><input {...inputProps("warehouses")} type="number" min="1" max="99" className={inputClass} /></Field><Field label="Quantidade aproximada de funcionários" field="employees" error={errors["employees"]}><input {...inputProps("employees")} type="number" min="1" max="9999" className={inputClass} /></Field><Field label="Área aproximada do mercado (m²)" field="area" error={errors["area"]}><input {...inputProps("area")} type="number" min="1" max="999999" className={inputClass} /></Field><div className="sm:col-span-2"><Field label="Sistema de PDV utilizado" field="posSystem" error={errors["posSystem"]}><input {...inputProps("posSystem")} maxLength={80} placeholder="Informe o sistema utilizado" className={inputClass} /></Field></div><Choice label="Possui leitores de código de barras?" name="barcodeReaders" value={data.barcodeReaders} options={["Sim", "Não"]} update={update} /><Choice label="Possui impressora de etiquetas?" name="labelPrinter" value={data.labelPrinter} options={["Sim", "Não"]} update={update} /></div>; }
function Billing({ data, update, error }: { data: NewMarketData; update: FieldsProps["update"]; error?: string }) { const items = [["Plano atual", "Gestão Profissional"], ["Mercados já contratados", "3 unidades"], ["Novo mercado", data.unitName || "Nova unidade"], ["Valor adicional mensal", "R$ 249,00"], ["Próxima data de cobrança", "10/10/2026"], ["Valor proporcional do período", "R$ 149,40"], ["Total estimado da próxima mensalidade", "R$ 996,00"]]; return <div className="space-y-6"><div className="flex flex-col gap-3 rounded-md border border-warning/40 bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between"><div><strong className="block">Simulação de cobrança</strong><span className="mt-1 block text-sm text-muted-foreground">Valores fictícios, somente para demonstração.</span></div><span className="self-start rounded-md bg-warning px-2.5 py-1 text-xs font-bold text-primary-foreground">DEMONSTRAÇÃO</span></div><dl className="divide-y divide-border rounded-md border border-border">{items.map(([label, value], index) => <div key={label} className={cn("flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between", index === items.length - 1 && "bg-primary-soft")}><dt className="text-sm font-semibold text-muted-foreground">{label}</dt><dd className={cn("font-bold", index === items.length - 1 && "text-lg text-primary")}>{value}</dd></div>)}</dl><div><label className={cn("flex items-start gap-3 rounded-md border p-4 text-sm leading-6", error ? "border-critical bg-critical/5" : "border-primary/30 bg-primary-soft")}><input type="checkbox" checked={data.billingAccepted} onChange={(event) => update("billingAccepted", event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-primary" /><span>Estou ciente de que a ativação desta unidade poderá aumentar o valor da assinatura.</span></label>{error && <span className="mt-1.5 block text-sm font-medium text-critical">{error}</span>}</div><p className="text-sm text-muted-foreground">Nenhuma cobrança ou pagamento real será realizado nesta etapa.</p></div>; }
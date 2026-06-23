import type { Locale } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-FACING copy. Selected by clients.preferred_language — NOT the operator's
// app locale. Every template exists in both languages.
// ─────────────────────────────────────────────────────────────────────────────

export type SmsTemplateKey =
  | "quote_sent"
  | "quote_followup_d2"
  | "quote_followup_d7"
  | "rebooking"
  | "review_request"
  | "warranty_inspection";

export interface TemplateVars {
  first_name?: string;
  service?: string;
  quote_link?: string;
  review_link?: string;
}

const SMS: Record<SmsTemplateKey, Record<Locale, string>> = {
  quote_sent: {
    en: "Hi {first_name}, thanks for considering Render Exteriors. Here's your quote: {quote_link}",
    zh: "{first_name}您好，感谢您考虑 Render Exteriors。这是您的报价：{quote_link}",
  },
  quote_followup_d2: {
    en: "Hi {first_name}, just following up on your Render Exteriors quote — happy to answer any questions: {quote_link}",
    zh: "{first_name}您好，跟进一下您的 Render Exteriors 报价，如有任何问题欢迎咨询：{quote_link}",
  },
  quote_followup_d7: {
    en: "Hi {first_name}, your Render Exteriors quote is still available if you'd like to go ahead: {quote_link}",
    zh: "{first_name}您好，您的 Render Exteriors 报价仍然有效，如需预约请点击：{quote_link}",
  },
  rebooking: {
    en: "Hi {first_name}, it's been about a year since your {service}. Ready to book a refresh? Reply to get on the schedule.",
    zh: "{first_name}您好，距离您上次的{service}已约一年。需要再次预约吗？回复即可安排。",
  },
  review_request: {
    en: "Thanks for choosing Render Exteriors, {first_name}! If you were happy with the {service}, a quick review means a lot: {review_link}",
    zh: "{first_name}，感谢您选择 Render Exteriors！如果您对这次{service}满意，欢迎留下评价：{review_link}",
  },
  warranty_inspection: {
    en: "Hi {first_name}, your {service} is coming up on its warranty check-in. Want us to schedule a free inspection?",
    zh: "{first_name}您好，您的{service}即将到保修检查时间。需要我们安排一次免费检查吗？",
  },
};

function interpolate(tpl: string, vars: TemplateVars): string {
  return tpl.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = (vars as Record<string, string | undefined>)[key];
    return v ?? "";
  });
}

/** Render an SMS body in the client's language. */
export function renderSms(
  key: SmsTemplateKey,
  language: Locale,
  vars: TemplateVars,
): string {
  return interpolate(SMS[key][language], vars);
}

// ── Quote / invoice document labels (client-facing, both languages) ──────────
export const docLabels: Record<Locale, Record<string, string>> = {
  en: {
    quote: "Quote",
    invoice: "Invoice",
    business: "Render Exteriors",
    billedTo: "Prepared for",
    item: "Service",
    qty: "Qty",
    price: "Price",
    lineTotal: "Amount",
    subtotal: "Subtotal",
    gst: "GST (5%)",
    total: "Total",
    validUntil: "Valid until",
    warranty: "Warranty",
    warrantyRoof: "Roof wash includes a 2-year warranty.",
    accept: "Accept Quote",
    accepted: "Thank you — your quote is accepted. We'll be in touch shortly.",
    eTransfer: "Payment by Interac e-Transfer to",
  },
  zh: {
    quote: "报价单",
    invoice: "发票",
    business: "Render Exteriors",
    billedTo: "客户",
    item: "服务项目",
    qty: "数量",
    price: "单价",
    lineTotal: "金额",
    subtotal: "小计",
    gst: "消费税 (5%)",
    total: "总计",
    validUntil: "有效期至",
    warranty: "保修",
    warrantyRoof: "屋顶清洗提供两年保修。",
    accept: "接受报价",
    accepted: "感谢您！报价已确认，我们会尽快与您联系。",
    eTransfer: "请通过 Interac e-Transfer 付款至",
  },
};

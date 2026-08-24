import { z } from "zod";

export const configSchema = z.object({
  DATABASE_URL: z.string().min(1),
  /** Extensions up to this many days are approved on the spot; longer ones go to the lead. */
  AUTO_APPROVE_MAX_DAYS: z.coerce.number().int().min(0).max(365).default(3),
  LLM_PROVIDER: z.enum(["fake", "openai"]).default("fake"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  // Cheapest capable model; the prompts are short and the answers are tiny JSON.
  OPENAI_MODEL: z.string().default("gpt-4.1-nano"),
  // Below this, the message is treated as not understood rather than guessed at.
  MIN_PARSE_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.6),
  EMAIL_PROVIDER: z.enum(["fake", "resend"]).default("fake"),
  RESEND_API_KEY: z.string().min(1).optional(),
  /** Signing secret of the Resend webhook, in `whsec_...` form. */
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
  EMAIL_FROM: z.string().default("Dealdesk <dealdesk@example.com>"),
  EMAIL_REPLY_TO: z.string().default("dealdesk@example.com"),
  /** Only these addresses may decide. Anyone else is logged and ignored. */
  APPROVER_EMAILS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  EMAIL_INBOUND_SECRET: z.string().min(1).optional(),
  // Optional until the Slack app is installed, so the rest of the app runs without it.
  SLACK_SIGNING_SECRET: z.string().min(1).optional(),
  SLACK_BOT_TOKEN: z.string().min(1).optional(),
  SLACK_CHANNEL_ID: z.string().min(1).optional(),
});

export type Config = z.infer<typeof configSchema>;

export type SlackConfig = {
  signingSecret: string;
  botToken: string;
  channelId: string;
};

let cached: Config | undefined;

export function getConfig(): Config {
  if (cached) return cached;

  const parsed = configSchema.safeParse(process.env);
  if (!parsed.success) {
    // Names only: values may be secrets.
    const keys = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration: ${keys}`);
  }

  cached = parsed.data;
  return cached;
}

export function getSlackConfig(): SlackConfig | null {
  const config = getConfig();
  if (!config.SLACK_SIGNING_SECRET || !config.SLACK_BOT_TOKEN || !config.SLACK_CHANNEL_ID) {
    return null;
  }
  return {
    signingSecret: config.SLACK_SIGNING_SECRET,
    botToken: config.SLACK_BOT_TOKEN,
    channelId: config.SLACK_CHANNEL_ID,
  };
}

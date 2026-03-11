import {
  Bot,
  MessageCircleMore,
  MessagesSquare,
  RadioTower,
  Send,
  Smartphone,
  type LucideIcon,
} from 'lucide-react'

export type ConnectorName = 'qq' | 'telegram' | 'discord' | 'slack' | 'feishu' | 'whatsapp'

export type ConnectorFieldKind = 'text' | 'password' | 'url' | 'boolean' | 'select' | 'list'

export type ConnectorField = {
  key: string
  label: string
  kind: ConnectorFieldKind
  readOnly?: boolean
  placeholder?: string
  description: string
  whereToGet: string
  docUrl?: string
  options?: Array<{ label: string; value: string }>
}

export type ConnectorSection = {
  id: string
  title: string
  description: string
  fields: ConnectorField[]
  variant?: 'primary' | 'legacy'
}

export type ConnectorCatalogEntry = {
  name: ConnectorName
  label: string
  subtitle: string
  icon: LucideIcon
  portalLabel: string
  portalUrl: string
  deliveryNote: string
  sections: ConnectorSection[]
}

const commonAccessFields: ConnectorField[] = [
  {
    key: 'dm_policy',
    label: 'Direct chat policy',
    kind: 'select',
    description: 'Controls whether direct messages auto-pair, require allowlists, or stay disabled.',
    whereToGet: 'Choose the access mode that matches your team policy.',
    options: [
      { label: 'Pairing', value: 'pairing' },
      { label: 'Allowlist', value: 'allowlist' },
      { label: 'Open', value: 'open' },
      { label: 'Disabled', value: 'disabled' },
    ],
  },
  {
    key: 'allow_from',
    label: 'Direct allowlist',
    kind: 'list',
    placeholder: 'user-a, user-b, *',
    description: 'Comma-separated sender ids allowed to message the bot directly.',
    whereToGet: 'Use platform user ids captured from runtime activity, or `*` for open mode.',
  },
  {
    key: 'group_policy',
    label: 'Group policy',
    kind: 'select',
    description: 'Controls whether group chats are allowlisted, open, or disabled.',
    whereToGet: 'Choose the access mode that matches your group rollout plan.',
    options: [
      { label: 'Allowlist', value: 'allowlist' },
      { label: 'Open', value: 'open' },
      { label: 'Disabled', value: 'disabled' },
    ],
  },
  {
    key: 'group_allow_from',
    label: 'Group allowlist',
    kind: 'list',
    placeholder: 'group-user-a, group-user-b',
    description: 'Comma-separated sender ids allowed inside groups.',
    whereToGet: 'Use sender ids captured from connector runtime activity.',
  },
  {
    key: 'groups',
    label: 'Group ids',
    kind: 'list',
    placeholder: 'group-1, group-2',
    description: 'Comma-separated target group ids for allowlist mode.',
    whereToGet: 'Copy the chat or channel ids from the platform admin console, or select from discovered targets after the first message.',
  },
  {
    key: 'auto_bind_dm_to_active_quest',
    label: 'Auto-bind DM to active quest',
    kind: 'boolean',
    description: 'If enabled, direct messages can automatically attach to the current active quest.',
    whereToGet: 'Enable when 1:1 chats should continue the latest active quest by default.',
  },
]

const relayFallbackFields: ConnectorField[] = [
  {
    key: 'relay_url',
    label: 'Relay URL',
    kind: 'url',
    placeholder: 'https://relay.example.com/connectors/...',
    description: 'Optional fallback relay endpoint used when outbound delivery is delegated.',
    whereToGet: 'Only fill this when you intentionally keep a relay or sidecar bridge.',
  },
  {
    key: 'relay_auth_token',
    label: 'Relay auth token',
    kind: 'password',
    placeholder: 'token-or-secret',
    description: 'Optional relay authorization token used for outbound delivery.',
    whereToGet: 'Copy from your relay deployment or reverse-proxy secret configuration.',
  },
]

export const connectorCatalog: ConnectorCatalogEntry[] = [
  {
    name: 'telegram',
    label: 'Telegram',
    subtitle: 'Best for direct bot chats. Preferred runtime path is long polling, not public webhooks.',
    icon: Send,
    portalLabel: 'Telegram Bot docs',
    portalUrl: 'https://core.telegram.org/bots',
    deliveryNote: 'Active send tests use `getMe` and direct Bot API sends when `bot_token` is configured.',
    sections: [
      {
        id: 'identity',
        title: 'Native runtime',
        description: 'Prefer long polling so Telegram can work without a public callback URL.',
        fields: [
          {
            key: 'transport',
            label: 'Transport',
            kind: 'select',
            description: 'Choose the preferred runtime path. `polling` is the default no-callback route.',
            whereToGet: 'Use `polling` unless you intentionally keep a legacy webhook or relay setup.',
            options: [
              { label: 'Polling', value: 'polling' },
              { label: 'Legacy webhook', value: 'legacy_webhook' },
              { label: 'Relay', value: 'relay' },
            ],
          },
          {
            key: 'bot_name',
            label: 'Bot name',
            kind: 'text',
            placeholder: 'DeepScientist',
            description: 'Display name used by your local runtime.',
            whereToGet: 'Choose the alias shown in messages and connector cards.',
          },
          {
            key: 'bot_token',
            label: 'Bot token',
            kind: 'password',
            placeholder: '123456:ABCDEF...',
            description: 'Telegram Bot token used for long polling, identity checks, and outbound sends.',
            whereToGet: 'Create or reset it in BotFather.',
            docUrl: 'https://core.telegram.org/bots/tutorial',
          },
          {
            key: 'command_prefix',
            label: 'Command prefix',
            kind: 'text',
            placeholder: '/',
            description: 'Prefix used for connector-side commands such as `/use` or `/status`.',
            whereToGet: 'Usually keep `/` to match the web and TUI command surface.',
          },
          {
            key: 'require_mention_in_groups',
            label: 'Require mention in groups',
            kind: 'boolean',
            description: 'Only process group messages that explicitly mention the bot.',
            whereToGet: 'Enable to reduce accidental trigger noise in shared groups.',
          },
        ],
      },
      {
        id: 'access',
        title: 'Access control',
        description: 'Who can talk to the bot directly or in groups.',
        fields: commonAccessFields,
      },
      {
        id: 'legacy',
        title: 'Legacy webhook / relay',
        description: 'Only use these fields if you intentionally keep the old callback or relay path.',
        variant: 'legacy',
        fields: [
          {
            key: 'webhook_secret',
            label: 'Webhook secret',
            kind: 'password',
            placeholder: 'optional-secret',
            description: 'Optional secret used when Telegram calls a legacy public webhook.',
            whereToGet: 'Set it only when configuring the legacy webhook endpoint.',
            docUrl: 'https://core.telegram.org/bots/webhooks',
          },
          {
            key: 'public_callback_url',
            label: 'Public callback URL',
            kind: 'url',
            placeholder: 'https://public.example.com/api/connectors/telegram/webhook',
            description: 'Public inbound callback URL registered with Telegram for legacy webhook delivery.',
            whereToGet: 'Only fill this when you intentionally register a webhook.',
          },
          ...relayFallbackFields,
        ],
      },
    ],
  },
  {
    name: 'discord',
    label: 'Discord',
    subtitle: 'Preferred runtime path is Gateway + REST, not public interaction callbacks.',
    icon: MessageCircleMore,
    portalLabel: 'Discord Developer Portal',
    portalUrl: 'https://discord.com/developers/applications',
    deliveryNote: 'Direct readiness checks use `users/@me`; runtime target discovery will come from gateway activity.',
    sections: [
      {
        id: 'identity',
        title: 'Native runtime',
        description: 'Prefer Gateway mode so Discord can run without a public interactions endpoint.',
        fields: [
          {
            key: 'transport',
            label: 'Transport',
            kind: 'select',
            description: 'Choose the preferred runtime path. `gateway` is the default no-callback route.',
            whereToGet: 'Use `gateway` unless you intentionally keep a legacy interaction callback or relay setup.',
            options: [
              { label: 'Gateway', value: 'gateway' },
              { label: 'Legacy interactions', value: 'legacy_interactions' },
              { label: 'Relay', value: 'relay' },
            ],
          },
          {
            key: 'bot_name',
            label: 'Bot name',
            kind: 'text',
            placeholder: 'DeepScientist',
            description: 'Display name used by the local runtime.',
            whereToGet: 'Choose the local alias shown in the workspace and connector cards.',
          },
          {
            key: 'bot_token',
            label: 'Bot token',
            kind: 'password',
            placeholder: 'discord-bot-token',
            description: 'Bot token used for gateway auth, identity checks, and outbound sending.',
            whereToGet: 'Copy it from the Bot tab in the Discord Developer Portal.',
            docUrl: 'https://discord.com/developers/applications',
          },
          {
            key: 'application_id',
            label: 'Application ID',
            kind: 'text',
            placeholder: '1234567890',
            description: 'Application or client id of the Discord bot.',
            whereToGet: 'Copy it from General Information in the developer portal.',
            docUrl: 'https://discord.com/developers/applications',
          },
          {
            key: 'guild_allowlist',
            label: 'Guild allowlist',
            kind: 'list',
            placeholder: 'guild-1, guild-2',
            description: 'Optional comma-separated guild ids that are allowed to use the bot.',
            whereToGet: 'Copy guild ids from Discord developer mode or from runtime discovery.',
          },
          {
            key: 'require_mention_in_groups',
            label: 'Require mention in groups',
            kind: 'boolean',
            description: 'Only respond when the bot is mentioned in guild channels.',
            whereToGet: 'Enable for safer group collaboration.',
          },
        ],
      },
      {
        id: 'access',
        title: 'Access control',
        description: 'Configure DM and group-style policies.',
        fields: commonAccessFields,
      },
      {
        id: 'legacy',
        title: 'Legacy interaction callback / relay',
        description: 'Only use these fields if you intentionally expose a public Discord callback.',
        variant: 'legacy',
        fields: [
          {
            key: 'public_key',
            label: 'Public key',
            kind: 'password',
            placeholder: 'public-key',
            description: 'Used to verify interaction signatures if you expose a legacy callback endpoint.',
            whereToGet: 'Copy it from General Information in the developer portal.',
            docUrl: 'https://discord.com/developers/applications',
          },
          {
            key: 'public_interactions_url',
            label: 'Interactions URL',
            kind: 'url',
            placeholder: 'https://public.example.com/api/connectors/discord/callback',
            description: 'Public interaction endpoint registered in the Discord portal.',
            whereToGet: 'Only fill this when you intentionally use callback-based interactions.',
            docUrl: 'https://discord.com/developers/docs/interactions/receiving-and-responding',
          },
          ...relayFallbackFields,
        ],
      },
    ],
  },
  {
    name: 'slack',
    label: 'Slack',
    subtitle: 'Preferred runtime path is Socket Mode, which avoids public event callbacks.',
    icon: MessagesSquare,
    portalLabel: 'Slack App dashboard',
    portalUrl: 'https://api.slack.com/apps',
    deliveryNote: 'Readiness checks use `auth.test`; Socket Mode additionally needs the App Token.',
    sections: [
      {
        id: 'identity',
        title: 'Native runtime',
        description: 'Prefer Socket Mode so Slack can run without a public callback URL.',
        fields: [
          {
            key: 'transport',
            label: 'Transport',
            kind: 'select',
            description: 'Choose the preferred runtime path. `socket_mode` is the default no-callback route.',
            whereToGet: 'Use `socket_mode` unless you intentionally keep a legacy events API or relay setup.',
            options: [
              { label: 'Socket Mode', value: 'socket_mode' },
              { label: 'Legacy Events API', value: 'legacy_events_api' },
              { label: 'Relay', value: 'relay' },
            ],
          },
          {
            key: 'bot_name',
            label: 'Bot name',
            kind: 'text',
            placeholder: 'DeepScientist',
            description: 'Local display name for Slack connector messages.',
            whereToGet: 'Choose the alias shown in DeepScientist surfaces.',
          },
          {
            key: 'bot_token',
            label: 'Bot token',
            kind: 'password',
            placeholder: 'xoxb-...',
            description: 'Bot user OAuth token used for Socket Mode and direct API access.',
            whereToGet: 'Install the app and copy the Bot User OAuth Token from your Slack app.',
            docUrl: 'https://api.slack.com/apps',
          },
          {
            key: 'app_token',
            label: 'App token',
            kind: 'password',
            placeholder: 'xapp-...',
            description: 'App-Level token used by Socket Mode so Slack can push events without a public URL.',
            whereToGet: 'Create it under Basic Information → App-Level Tokens.',
            docUrl: 'https://api.slack.com/apps',
          },
          {
            key: 'bot_user_id',
            label: 'Bot user id',
            kind: 'text',
            placeholder: 'U012345',
            description: 'Optional bot user id used for mention filtering or routing.',
            whereToGet: 'Read it from `auth.test` or from the Slack app installation metadata.',
          },
          {
            key: 'command_prefix',
            label: 'Command prefix',
            kind: 'text',
            placeholder: '/',
            description: 'Prefix used for connector-side commands.',
            whereToGet: 'Usually keep `/` to match the TUI and web commands.',
          },
          {
            key: 'require_mention_in_groups',
            label: 'Require mention in groups',
            kind: 'boolean',
            description: 'Only react to channel messages that mention the bot.',
            whereToGet: 'Recommended in shared Slack channels.',
          },
        ],
      },
      {
        id: 'access',
        title: 'Access control',
        description: 'Configure DM and channel access rules.',
        fields: commonAccessFields,
      },
      {
        id: 'legacy',
        title: 'Legacy callback / relay',
        description: 'Only use these fields if you intentionally keep Slack callback verification or a relay.',
        variant: 'legacy',
        fields: [
          {
            key: 'signing_secret',
            label: 'Signing secret',
            kind: 'password',
            placeholder: 'signing-secret',
            description: 'Used to verify Slack inbound events and slash command requests in legacy callback mode.',
            whereToGet: 'Copy it from Basic Information in your Slack app.',
            docUrl: 'https://api.slack.com/apps',
          },
          {
            key: 'public_callback_url',
            label: 'Public callback URL',
            kind: 'url',
            placeholder: 'https://public.example.com/api/connectors/slack/webhook',
            description: 'Public inbound callback URL registered with Slack for legacy events delivery.',
            whereToGet: 'Only fill this when you intentionally configure callback-based events.',
          },
          ...relayFallbackFields,
        ],
      },
    ],
  },
  {
    name: 'feishu',
    label: 'Feishu / Lark',
    subtitle: 'Preferred runtime path is long connection. Keep webhook secrets only as a legacy fallback.',
    icon: Bot,
    portalLabel: 'Feishu Open Platform',
    portalUrl: 'https://open.feishu.cn/app',
    deliveryNote: 'Readiness checks use tenant token exchange. Legacy verification fields are optional unless you keep webhooks.',
    sections: [
      {
        id: 'identity',
        title: 'Native runtime',
        description: 'Prefer long connection so Feishu can work without a public callback URL when supported by the app type.',
        fields: [
          {
            key: 'transport',
            label: 'Transport',
            kind: 'select',
            description: 'Choose the preferred runtime path. `long_connection` is the default no-callback route.',
            whereToGet: 'Use `long_connection` unless you intentionally keep a legacy webhook or relay setup.',
            options: [
              { label: 'Long connection', value: 'long_connection' },
              { label: 'Legacy webhook', value: 'legacy_webhook' },
              { label: 'Relay', value: 'relay' },
            ],
          },
          {
            key: 'bot_name',
            label: 'Bot name',
            kind: 'text',
            placeholder: 'DeepScientist',
            description: 'Local display name for the Feishu connector.',
            whereToGet: 'Choose the alias shown in DeepScientist surfaces.',
          },
          {
            key: 'app_id',
            label: 'App ID',
            kind: 'text',
            placeholder: 'cli_xxx',
            description: 'Internal app id used for tenant token exchange and long-connection setup.',
            whereToGet: 'Copy from your Feishu or Lark app credentials page.',
            docUrl: 'https://open.feishu.cn/app',
          },
          {
            key: 'app_secret',
            label: 'App secret',
            kind: 'password',
            placeholder: 'app-secret',
            description: 'Secret used for token exchange and app authentication.',
            whereToGet: 'Copy from your Feishu or Lark app credentials page.',
            docUrl: 'https://open.feishu.cn/app',
          },
          {
            key: 'api_base_url',
            label: 'API base URL',
            kind: 'url',
            placeholder: 'https://open.feishu.cn',
            description: 'Base URL for direct Feishu API calls.',
            whereToGet: 'Normally keep the default Feishu Open Platform host.',
            docUrl: 'https://open.feishu.cn/app',
          },
          {
            key: 'require_mention_in_groups',
            label: 'Require mention in groups',
            kind: 'boolean',
            description: 'Only process group messages that mention the bot.',
            whereToGet: 'Recommended for noisy team chats.',
          },
        ],
      },
      {
        id: 'access',
        title: 'Access control',
        description: 'Control who can talk to the bot in direct and group chats.',
        fields: commonAccessFields,
      },
      {
        id: 'legacy',
        title: 'Legacy webhook / relay',
        description: 'Only use these fields if you intentionally keep Feishu event subscriptions via public callback.',
        variant: 'legacy',
        fields: [
          {
            key: 'verification_token',
            label: 'Verification token',
            kind: 'password',
            placeholder: 'verification-token',
            description: 'Used to verify webhook-style inbound callbacks.',
            whereToGet: 'Copy from Event Subscriptions in the Feishu Open Platform.',
            docUrl: 'https://open.feishu.cn/app',
          },
          {
            key: 'encrypt_key',
            label: 'Encrypt key',
            kind: 'password',
            placeholder: 'encrypt-key',
            description: 'Optional encryption key for encrypted Feishu event payloads.',
            whereToGet: 'Copy from Event Subscriptions in the Feishu Open Platform.',
            docUrl: 'https://open.feishu.cn/app',
          },
          {
            key: 'public_callback_url',
            label: 'Public callback URL',
            kind: 'url',
            placeholder: 'https://public.example.com/api/connectors/feishu/webhook',
            description: 'Public inbound callback URL registered in Feishu Event Subscriptions.',
            whereToGet: 'Only fill this when you intentionally configure a callback endpoint.',
          },
          ...relayFallbackFields,
        ],
      },
    ],
  },
  {
    name: 'whatsapp',
    label: 'WhatsApp',
    subtitle: 'Preferred runtime path is a local session, not Meta Cloud API webhooks.',
    icon: Smartphone,
    portalLabel: 'WhatsApp Cloud API docs',
    portalUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/',
    deliveryNote: 'Local-session is the preferred design target. Meta Cloud API fields stay available only as a legacy fallback.',
    sections: [
      {
        id: 'identity',
        title: 'Native runtime',
        description: 'Prefer local session mode so WhatsApp can work without a public callback URL.',
        fields: [
          {
            key: 'transport',
            label: 'Transport',
            kind: 'select',
            description: 'Choose the preferred runtime path. `local_session` is the default no-callback route.',
            whereToGet: 'Use `local_session` unless you intentionally keep Meta Cloud API or a relay setup.',
            options: [
              { label: 'Local session', value: 'local_session' },
              { label: 'Legacy Meta Cloud', value: 'legacy_meta_cloud' },
              { label: 'Relay', value: 'relay' },
            ],
          },
          {
            key: 'bot_name',
            label: 'Bot name',
            kind: 'text',
            placeholder: 'DeepScientist',
            description: 'Local display name used by the WhatsApp connector.',
            whereToGet: 'Choose the alias shown in DeepScientist surfaces.',
          },
          {
            key: 'auth_method',
            label: 'Auth method',
            kind: 'select',
            description: 'Preferred local-session auth flow.',
            whereToGet: 'Use QR in browser by default; switch to pairing code on headless machines.',
            options: [
              { label: 'QR browser', value: 'qr_browser' },
              { label: 'Pairing code', value: 'pairing_code' },
              { label: 'QR terminal', value: 'qr_terminal' },
            ],
          },
          {
            key: 'session_dir',
            label: 'Session directory',
            kind: 'text',
            placeholder: '~/.deepscientist/connectors/whatsapp',
            description: 'Directory where the local WhatsApp auth/session state is stored.',
            whereToGet: 'Keep the default unless you intentionally isolate sessions elsewhere.',
          },
          {
            key: 'command_prefix',
            label: 'Command prefix',
            kind: 'text',
            placeholder: '/',
            description: 'Prefix used for `/use`, `/status`, and related commands.',
            whereToGet: 'Usually keep `/` so WhatsApp matches the web and TUI command surface.',
          },
        ],
      },
      {
        id: 'access',
        title: 'Access control',
        description: 'Control direct and group delivery rules.',
        fields: commonAccessFields,
      },
      {
        id: 'legacy',
        title: 'Legacy Meta Cloud / relay',
        description: 'Only use these fields if you intentionally keep Meta Cloud API callbacks or a relay.',
        variant: 'legacy',
        fields: [
          {
            key: 'provider',
            label: 'Legacy provider',
            kind: 'select',
            description: 'Legacy provider choice for callback or relay paths.',
            whereToGet: 'Use `meta` only when you intentionally keep Meta Cloud API fallback.',
            options: [
              { label: 'Relay', value: 'relay' },
              { label: 'Meta', value: 'meta' },
            ],
          },
          {
            key: 'access_token',
            label: 'Access token',
            kind: 'password',
            placeholder: 'EAAG...',
            description: 'Bearer token for Meta Cloud API requests.',
            whereToGet: 'Copy it from your Meta app or WhatsApp Cloud API setup.',
            docUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/',
          },
          {
            key: 'phone_number_id',
            label: 'Phone number ID',
            kind: 'text',
            placeholder: '1234567890',
            description: 'Phone number id used for direct outbound sends in Meta Cloud fallback mode.',
            whereToGet: 'Copy it from the WhatsApp Cloud API getting started dashboard.',
            docUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/',
          },
          {
            key: 'business_account_id',
            label: 'Business account ID',
            kind: 'text',
            placeholder: '1234567890',
            description: 'Optional business account id for bookkeeping or API exploration.',
            whereToGet: 'Copy it from the Meta developer dashboard if available.',
            docUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/',
          },
          {
            key: 'verify_token',
            label: 'Verify token',
            kind: 'password',
            placeholder: 'verify-token',
            description: 'Webhook verification token for Meta callback registration.',
            whereToGet: 'Choose and register it only if you intentionally configure a webhook.',
            docUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/',
          },
          {
            key: 'api_base_url',
            label: 'API base URL',
            kind: 'url',
            placeholder: 'https://graph.facebook.com',
            description: 'Base URL for Meta Cloud API calls.',
            whereToGet: 'Normally keep the default Meta Graph host.',
            docUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/',
          },
          {
            key: 'api_version',
            label: 'API version',
            kind: 'text',
            placeholder: 'v21.0',
            description: 'Meta Graph API version used for direct tests and sends.',
            whereToGet: 'Use the current Graph version required by your Meta app.',
            docUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/',
          },
          {
            key: 'public_callback_url',
            label: 'Public callback URL',
            kind: 'url',
            placeholder: 'https://public.example.com/api/connectors/whatsapp/webhook',
            description: 'Public callback URL registered with Meta when using Cloud API webhooks.',
            whereToGet: 'Only fill this when you intentionally keep callback-based Meta delivery.',
          },
          ...relayFallbackFields,
        ],
      },
    ],
  },
  {
    name: 'qq',
    label: 'QQ',
    subtitle: 'Official QQ bot workflow through the built-in gateway direct connection.',
    icon: RadioTower,
    portalLabel: 'Tencent QQ Bot Platform',
    portalUrl: 'https://bot.q.qq.com/',
    deliveryNote: 'Readiness checks exchange `access_token`, probe `/gateway`, and can actively send when you provide a user `openid` or group `group_openid`.',
    sections: [
      {
        id: 'identity',
        title: 'Native runtime',
        description: 'QQ already uses the preferred no-callback path through the built-in gateway direct connection.',
        fields: [
          {
            key: 'transport',
            label: 'Transport',
            kind: 'text',
            readOnly: true,
            placeholder: 'gateway_direct',
            description: 'QQ transport is fixed to the built-in gateway direct mode.',
            whereToGet: 'No change needed. QQ does not require a public callback URL in this runtime.',
          },
          {
            key: 'bot_name',
            label: 'Bot name',
            kind: 'text',
            placeholder: 'DeepScientist',
            description: 'Display name used by the QQ connector in DeepScientist.',
            whereToGet: 'Choose the alias shown in the workspace and connector cards.',
          },
          {
            key: 'app_id',
            label: 'App ID',
            kind: 'text',
            placeholder: 'qq-app-id',
            description: 'Tencent app id for the QQ bot.',
            whereToGet: 'Copy it from the QQ bot platform console.',
            docUrl: 'https://bot.q.qq.com/',
          },
          {
            key: 'app_secret',
            label: 'App secret',
            kind: 'password',
            placeholder: 'qq-app-secret',
            description: 'Used for QQ access token exchange and direct API delivery.',
            whereToGet: 'Copy it from the QQ bot platform console.',
            docUrl: 'https://cloud.tencent.com.cn/developer/article/2635190',
          },
          {
            key: 'main_chat_id',
            label: 'Detected OpenID',
            kind: 'text',
            readOnly: true,
            placeholder: 'openid-or-group_openid',
            description: 'This value is auto-filled after a QQ user sends the bot the first private message.',
            whereToGet: 'Save `app_id` + `app_secret`, then send one private QQ message to the bot. The system will detect and save the `openid` automatically.',
          },
        ],
      },
      {
        id: 'transport',
        title: 'Gateway behavior',
        description: 'QQ only uses the built-in gateway direct connection in DeepScientist.',
        fields: [
          {
            key: 'require_at_in_groups',
            label: 'Require @ mention in groups',
            kind: 'boolean',
            description: 'Only process group messages when the bot is @mentioned.',
            whereToGet: 'Recommended for large QQ groups.',
          },
          {
            key: 'gateway_restart_on_config_change',
            label: 'Restart gateway on config change',
            kind: 'boolean',
            description: 'Restart the local QQ gateway worker after credentials or target settings change.',
            whereToGet: 'Keep this enabled so the daemon reconnects cleanly after QQ settings updates.',
          },
          {
            key: 'command_prefix',
            label: 'Command prefix',
            kind: 'text',
            placeholder: '/',
            description: 'Prefix used for `/use`, `/status`, `/approve`, and related commands.',
            whereToGet: 'Usually keep `/` so QQ matches the web and TUI command surface.',
          },
        ],
      },
      {
        id: 'access',
        title: 'Quest binding',
        description: 'QQ is often used for long-lived operator conversations, milestone push, and quest follow-up.',
        fields: [
          {
            key: 'auto_bind_dm_to_active_quest',
            label: 'Auto-bind DM to active quest',
            kind: 'boolean',
            description: 'If enabled, private QQ chats can automatically attach to the current active quest.',
            whereToGet: 'Enable when one operator usually drives the active quest from QQ.',
          },
        ],
      },
    ],
  },
]

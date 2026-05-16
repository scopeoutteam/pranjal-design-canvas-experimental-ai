import { defineConfig, loadEnv, type Plugin, type Connect } from 'vite'
import react from '@vitejs/plugin-react'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Kind = 'chat' | 'mobile' | 'web' | 'component' | 'journey' | 'empathy'

function anthropicProxy(env: Record<string, string>): Plugin {
  return {
    name: 'anthropic-proxy',
    configureServer(server) {
      const envApiKey = env.ANTHROPIC_API_KEY
      const catalogPath = resolve(__dirname, 'src/catalog/fluent-v9.json')
      const defaultCatalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
      // mutable so settings UI can hot-swap the design system at runtime
      let activeCatalog: unknown = defaultCatalog
      let catalogStr = JSON.stringify(activeCatalog)
      // When true, generation skips the catalog and instructs the LLM to compose
      // surfaces from a minimal set of A2UI primitives — the "no design system
      // connected" state.
      let noDesignSystem = false
      const getCatalogId = (c: unknown): string =>
        (c && typeof c === 'object' && 'catalogId' in c && typeof (c as { catalogId: unknown }).catalogId === 'string'
          ? (c as { catalogId: string }).catalogId
          : 'unknown')

      // Mutable Anthropic client + key source so settings UI can update the key at runtime
      let client = envApiKey ? new Anthropic({ apiKey: envApiKey }) : null
      let keySource: 'env' | 'runtime' | 'none' = envApiKey ? 'env' : 'none'
      const maskKey = (k: string) =>
        k.length > 12 ? `${k.slice(0, 6)}…${k.slice(-4)}` : '••••'


      const requireKey = (res: Parameters<Connect.NextHandleFunction>[1]) => {
        if (client) return true
        res.statusCode = 500
        res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY missing in .env' }))
        return false
      }

      const routeHandler: Connect.NextHandleFunction = async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'POST only' }))
          return
        }
        if (!requireKey(res)) return
        try {
          const body = (await readJson(req)) as { prompt: string }
          if (!body?.prompt) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'prompt required' }))
            return
          }
          const response = await client!.messages.create({
            model: 'claude-opus-4-7',
            max_tokens: 800,
            output_config: {
              effort: 'low',
              format: {
                type: 'json_schema',
                schema: {
                  type: 'object',
                  properties: {
                    kind: { type: 'string', enum: ['chat', 'mobile', 'web', 'journey', 'empathy'] },
                    reasoning: { type: 'string', description: 'One short sentence on why.' },
                    refined_intent: {
                      type: 'string',
                      description:
                        'A concise, well-phrased restatement of what the user wants, ready to hand off to the block-specific agent.',
                    },
                  },
                  required: ['kind', 'reasoning', 'refined_intent'],
                  additionalProperties: false,
                },
              },
            },
            system: ROUTER_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: body.prompt }],
          })
          const text = response.content.find((b) => b.type === 'text')
          const raw = text && 'text' in text ? text.text : ''
          let parsed: { kind: Kind; reasoning: string; refined_intent: string } | null = null
          try {
            parsed = JSON.parse(raw)
          } catch {
            const m = raw.match(/\{[\s\S]*\}/)
            if (m) parsed = JSON.parse(m[0])
          }
          if (!parsed) {
            parsed = { kind: 'chat', reasoning: 'fallback', refined_intent: body.prompt }
          }
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(parsed))
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error('[router] error:', message)
          res.statusCode = 500
          res.end(JSON.stringify({ error: message }))
        }
      }

      const generateHandler: Connect.NextHandleFunction = async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'POST only' }))
          return
        }
        if (!requireKey(res)) return

        try {
          const body = (await readJson(req)) as {
            kind?: Kind
            messages: Array<{ role: 'user' | 'assistant'; content: string }>
            currentSurface?: unknown
          }
          const kind: Kind = body.kind ?? 'chat'
          const messages = body.messages
          if (!Array.isArray(messages) || messages.length === 0) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'messages[] required' }))
            return
          }

          // Catalog connected → catalog-driven prompt.
          // No catalog connected → pure primitives-on-the-fly prompt.
          let system = noDesignSystem
            ? buildOnTheFlyPrompt(kind)
            : buildSystemPrompt(kind, catalogStr)
          if (body.currentSurface) {
            const surfaceSnap = JSON.stringify(body.currentSurface).slice(0, 50000)
            system += `\n\n# Current surface (your prior output, for iteration)\n\nThis is the surface the user is editing. Regenerate the FULL surface envelope with the user's edits applied, preserving everything else.\n\n${surfaceSnap}`
          }

          const callOnce = async () => {
            const r = await client!.messages.create({
              model: 'claude-opus-4-7',
              max_tokens: 16000,
              system: [
                { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
              ],
              thinking: { type: 'adaptive' },
              messages: messages.map((m) => ({ role: m.role, content: m.content })),
            })
            const t = r.content.find((b) => b.type === 'text')
            const rawText = t && 'text' in t ? t.text : ''
            return { response: r, rawText, parsed: extractA2uiJson(rawText) }
          }

          let { response, rawText: raw, parsed: a2ui } = await callOnce()
          // The LLM occasionally emits invalid JSON (e.g. a stray ':' instead of ','). Retry once.
          if (a2ui == null) {
            console.warn('[generate] first response unparseable, retrying once')
            const retry = await callOnce()
            response = retry.response
            raw = retry.rawText
            a2ui = retry.parsed
          }

          // Multi-screen detection: if response is { surfaces: [...] }, return as-is.
          // Otherwise wrap single surface (an A2UI message array) into a single-surface response.
          let surfaces: Array<{ title?: string; messages: unknown }> | null = null
          if (a2ui && typeof a2ui === 'object' && !Array.isArray(a2ui) && 'surfaces' in a2ui) {
            const s = (a2ui as { surfaces: unknown }).surfaces
            if (Array.isArray(s)) surfaces = s as typeof surfaces
          } else if (Array.isArray(a2ui)) {
            surfaces = [{ messages: a2ui }]
          }

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              surfaces,
              messages: a2ui,
              raw,
              usage: response.usage,
            }),
          )
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error('[generate] error:', message)
          res.statusCode = 500
          res.end(JSON.stringify({ error: message }))
        }
      }

      const empathyHandler: Connect.NextHandleFunction = async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'POST only' }))
          return
        }
        if (!requireKey(res)) return
        try {
          const body = (await readJson(req)) as { prompt: string }
          if (!body?.prompt) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'prompt required' }))
            return
          }
          const response = await client!.messages.create({
            model: 'claude-opus-4-7',
            max_tokens: 3000,
            thinking: { type: 'adaptive' },
            system: EMPATHY_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: body.prompt }],
          })
          const text = response.content.find((b) => b.type === 'text')
          const raw = text && 'text' in text ? text.text : ''
          const parsed = extractA2uiJson(raw)
          if (
            !parsed ||
            typeof parsed !== 'object' ||
            !('quadrants' in parsed) ||
            !('persona' in parsed)
          ) {
            throw new Error('Model did not return a valid empathy map JSON')
          }
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(parsed))
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error('[empathy] error:', message)
          res.statusCode = 500
          res.end(JSON.stringify({ error: message }))
        }
      }

      const journeyHandler: Connect.NextHandleFunction = async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'POST only' }))
          return
        }
        if (!requireKey(res)) return
        try {
          const body = (await readJson(req)) as { prompt: string }
          if (!body?.prompt) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'prompt required' }))
            return
          }
          const response = await client!.messages.create({
            model: 'claude-opus-4-7',
            max_tokens: 6000,
            thinking: { type: 'adaptive' },
            system: JOURNEY_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: body.prompt }],
          })
          const text = response.content.find((b) => b.type === 'text')
          const raw = text && 'text' in text ? text.text : ''
          const parsed = extractA2uiJson(raw)
          if (!parsed || typeof parsed !== 'object' || !('nodes' in parsed)) {
            throw new Error('Model did not return a valid journey JSON')
          }
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(parsed))
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error('[journey] error:', message)
          res.statusCode = 500
          res.end(JSON.stringify({ error: message }))
        }
      }

      const catalogGetHandler: Connect.NextHandleFunction = (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'GET only' }))
          return
        }
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            catalogId: noDesignSystem ? null : getCatalogId(activeCatalog),
            catalog: noDesignSystem ? null : activeCatalog,
            disconnected: noDesignSystem,
          }),
        )
      }

      const catalogSetHandler: Connect.NextHandleFunction = async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'POST only' }))
          return
        }
        try {
          const body = (await readJson(req)) as {
            url?: string
            catalog?: unknown
            reset?: boolean
            disconnect?: boolean
          }
          if (body.disconnect) {
            noDesignSystem = true
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ catalogId: null, disconnected: true }))
            return
          }
          if (body.reset) {
            activeCatalog = defaultCatalog
            catalogStr = JSON.stringify(activeCatalog)
            noDesignSystem = false
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({ catalogId: getCatalogId(activeCatalog), reset: true, disconnected: false }),
            )
            return
          }
          let next: unknown
          if (body.catalog) {
            next = body.catalog
          } else if (body.url) {
            const r = await fetch(body.url)
            if (!r.ok) throw new Error(`Fetch failed: ${r.status} ${r.statusText}`)
            const ct = r.headers.get('content-type') ?? ''
            if (ct.includes('application/json') || body.url.endsWith('.json')) {
              next = await r.json()
            } else {
              const txt = await r.text()
              try {
                next = JSON.parse(txt)
              } catch {
                throw new Error('URL did not return JSON')
              }
            }
          } else {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Provide { url } or { catalog }' }))
            return
          }
          if (!next || typeof next !== 'object' || !('catalogId' in (next as object))) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Invalid catalog — missing catalogId' }))
            return
          }
          activeCatalog = next
          catalogStr = JSON.stringify(activeCatalog)
          noDesignSystem = false
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ catalogId: getCatalogId(activeCatalog), disconnected: false }))
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          res.statusCode = 500
          res.end(JSON.stringify({ error: message }))
        }
      }

      const catalogFromStorybookHandler: Connect.NextHandleFunction = async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'POST only' }))
          return
        }
        try {
          const body = (await readJson(req)) as { url?: string }
          let rawUrl = body.url?.trim() ?? ''
          if (!rawUrl) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'url required' }))
            return
          }
          // Strip trailing slash, /?path=..., /index.html, etc — normalize to base URL
          rawUrl = rawUrl.replace(/[?#].*$/, '').replace(/\/(index\.html?|iframe\.html?)?$/, '')
          const base = rawUrl.replace(/\/$/, '')

          // Try Storybook 7+ /index.json, then /stories.json (SB 6)
          const tryFetch = async (path: string) => {
            try {
              const r = await fetch(`${base}${path}`, { headers: { Accept: 'application/json' } })
              if (!r.ok) return null
              return await r.json()
            } catch {
              return null
            }
          }

          let sbIndex: unknown = await tryFetch('/index.json')
          if (!sbIndex) sbIndex = await tryFetch('/stories.json')
          if (!sbIndex) {
            throw new Error(
              `Could not load Storybook index from ${base}. Tried /index.json and /stories.json — make sure the URL points to a Storybook deployment.`,
            )
          }

          const entries = (sbIndex as { entries?: Record<string, unknown>; stories?: Record<string, unknown> })
          const records = entries.entries ?? entries.stories ?? {}
          const componentNames = new Set<string>()
          for (const id in records) {
            const e = records[id] as { type?: string; title?: string; name?: string }
            if (e && (e.type === 'story' || !e.type) && typeof e.title === 'string') {
              const parts = e.title.split('/')
              const lastPart = parts[parts.length - 1].trim()
              if (lastPart) componentNames.add(lastPart)
            }
          }

          if (componentNames.size === 0) {
            throw new Error(
              'Storybook index parsed but no stories found. The URL may not be a Storybook root, or the deployment hides stories.',
            )
          }

          const components: Record<string, unknown> = {}
          for (const name of componentNames) {
            components[name] = {
              type: 'object',
              description: `${name} component imported from ${base}.`,
              properties: {
                component: { const: name },
                id: { type: 'string' },
                text: { type: 'string', description: 'Primary text content if applicable.' },
                label: { type: 'string', description: 'Accessible label or display label.' },
                value: { type: 'string', description: 'Current value if input-like.' },
                children: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of child component IDs for composition.',
                },
                onClick: { $ref: '#/$defs/Action' },
                onPress: { $ref: '#/$defs/Action' },
                onChange: { $ref: '#/$defs/Action' },
              },
              required: ['component', 'id'],
              additionalProperties: true,
            }
          }

          const newCatalog = {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            catalogId: `storybook:${base}`,
            title: `Imported from ${base}`,
            description:
              'Catalog auto-generated by scraping a Storybook index. Component names are real; prop schemas are generic placeholders — the AI infers usage from common Fluent/shadcn conventions.',
            components,
            $defs: {
              Action: {
                type: 'object',
                description: 'Server-side event triggered by an interaction.',
                properties: {
                  event: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      context: { type: 'object', additionalProperties: true },
                    },
                    required: ['name'],
                  },
                },
                required: ['event'],
              },
            },
          }

          activeCatalog = newCatalog
          catalogStr = JSON.stringify(activeCatalog)
          noDesignSystem = false

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              catalogId: getCatalogId(activeCatalog),
              componentCount: componentNames.size,
              components: Array.from(componentNames).sort(),
            }),
          )
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error('[storybook] error:', message)
          res.statusCode = 500
          res.end(JSON.stringify({ error: message }))
        }
      }

      // Scrape a docs site (e.g. vercel.com/geist/introduction) for component
      // names. Strategy: fetch HTML, find all <a href> matching the input URL's
      // parent path with a slug, filter out known non-component pages, return
      // unique slugs as components. Works for many docs sites that follow the
      // /[design-system]/[component] URL pattern.
      const NON_COMPONENT_SLUGS = new Set([
        'introduction', 'overview', 'getting-started', 'installation', 'install',
        'principles', 'foundations', 'foundation', 'design-tokens', 'tokens',
        'theming', 'theme', 'colors', 'color', 'typography', 'spacing', 'icons',
        'accessibility', 'a11y', 'contributing', 'changelog', 'docs', 'guides',
        'usage', 'about', 'faq', 'license', 'support', 'sponsors', 'community',
        'examples', 'showcase', 'playground', 'releases', 'versions', 'changes',
        'roadmap', 'styleguide', 'style', 'patterns', 'pattern', 'resources',
        'home', 'index', 'core-concepts', 'concepts', 'design-principles',
      ])

      const catalogFromDocsHandler: Connect.NextHandleFunction = async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'POST only' }))
          return
        }
        try {
          const body = (await readJson(req)) as { url?: string }
          const rawUrl = body.url?.trim() ?? ''
          if (!rawUrl) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'url required' }))
            return
          }
          let parsed: URL
          try {
            parsed = new URL(rawUrl)
          } catch {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Invalid URL' }))
            return
          }

          // basePath = the parent of the input page. For vercel.com/geist/introduction
          // → /geist . For ui.shadcn.com/docs/components/button → /docs/components .
          const pathParts = parsed.pathname.split('/').filter(Boolean)
          if (pathParts.length === 0) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'URL must include a path segment (e.g. /geist/introduction)' }))
            return
          }
          const basePath = '/' + pathParts.slice(0, -1).join('/')
          const origin = parsed.origin

          const r = await fetch(parsed.href, {
            headers: {
              // Some sites block default fetch UAs. Pretend to be a normal browser.
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml',
            },
          })
          if (!r.ok) throw new Error(`Fetch failed: ${r.status} ${r.statusText}`)
          const html = await r.text()

          // Match `${basePath}/<slug>` anchors. Slug = lowercase letters, digits, hyphens.
          // Honor both absolute (`href="https://origin/geist/button"`) and root-relative
          // (`href="/geist/button"`) forms.
          const escapedBase = basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const hrefRe = new RegExp(
            `href\\s*=\\s*["'](?:${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})?${escapedBase}/([a-z][a-z0-9-]{1,40})(?:[/#?][^"']*)?["']`,
            'g',
          )
          const slugs = new Set<string>()
          for (const match of html.matchAll(hrefRe)) {
            const slug = match[1]
            if (!NON_COMPONENT_SLUGS.has(slug)) slugs.add(slug)
          }

          if (slugs.size === 0) {
            throw new Error(
              `No component-shaped links found under ${origin}${basePath}/<slug>. The page may be client-rendered or use a different URL scheme.`,
            )
          }

          // Convert slug → PascalCase component name (button → Button, alert-dialog → AlertDialog)
          const slugToName = (s: string) =>
            s.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')
          const componentNames = new Set(Array.from(slugs).map(slugToName))

          const components: Record<string, unknown> = {}
          for (const name of componentNames) {
            components[name] = {
              type: 'object',
              description: `${name} component scraped from ${origin}${basePath}.`,
              properties: {
                component: { const: name },
                id: { type: 'string' },
                text: { type: 'string', description: 'Primary text content if applicable.' },
                label: { type: 'string', description: 'Accessible label or display label.' },
                value: { type: 'string', description: 'Current value if input-like.' },
                children: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of child component IDs for composition.',
                },
                onClick: { $ref: '#/$defs/Action' },
                onPress: { $ref: '#/$defs/Action' },
                onChange: { $ref: '#/$defs/Action' },
              },
              required: ['component', 'id'],
              additionalProperties: true,
            }
          }

          const newCatalog = {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            catalogId: `docs:${parsed.hostname}${basePath}`,
            title: `Imported from ${parsed.hostname}${basePath}`,
            description:
              'Catalog auto-generated by scraping a docs site. Component names are real; prop schemas are generic placeholders — the AI infers usage from common DS conventions.',
            components,
            $defs: {
              Action: {
                type: 'object',
                description: 'Server-side event triggered by an interaction.',
                properties: {
                  event: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      context: { type: 'object', additionalProperties: true },
                    },
                    required: ['name'],
                  },
                },
                required: ['event'],
              },
            },
          }

          activeCatalog = newCatalog
          catalogStr = JSON.stringify(activeCatalog)
          noDesignSystem = false

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              catalogId: getCatalogId(activeCatalog),
              componentCount: componentNames.size,
              components: Array.from(componentNames).sort(),
              basePath: `${origin}${basePath}`,
            }),
          )
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error('[docs] error:', message)
          res.statusCode = 500
          res.end(JSON.stringify({ error: message }))
        }
      }

      const configStatusHandler: Connect.NextHandleFunction = (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'GET only' }))
          return
        }
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            hasKey: !!client,
            source: keySource,
            envHasKey: !!envApiKey,
            maskedKey: keySource === 'env' && envApiKey ? maskKey(envApiKey) : null,
          }),
        )
      }

      const configApiKeyHandler: Connect.NextHandleFunction = async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'POST only' }))
          return
        }
        try {
          const body = (await readJson(req)) as { apiKey?: string; reset?: boolean }
          if (body.reset) {
            client = envApiKey ? new Anthropic({ apiKey: envApiKey }) : null
            keySource = envApiKey ? 'env' : 'none'
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ hasKey: !!client, source: keySource, reset: true }))
            return
          }
          const key = body.apiKey?.trim()
          if (!key) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'apiKey required' }))
            return
          }
          if (!key.startsWith('sk-ant-')) {
            res.statusCode = 400
            res.end(
              JSON.stringify({
                error: 'Looks like an invalid Anthropic key (expected to start with sk-ant-)',
              }),
            )
            return
          }
          client = new Anthropic({ apiKey: key })
          keySource = 'runtime'
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ hasKey: true, source: 'runtime' }))
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          res.statusCode = 500
          res.end(JSON.stringify({ error: message }))
        }
      }

      server.middlewares.use('/api/route', routeHandler)
      server.middlewares.use('/api/generate', generateHandler)
      server.middlewares.use('/api/journey', journeyHandler)
      server.middlewares.use('/api/empathy', empathyHandler)
      server.middlewares.use('/api/catalog/get', catalogGetHandler)
      server.middlewares.use('/api/catalog/set', catalogSetHandler)
      server.middlewares.use('/api/catalog/from-storybook', catalogFromStorybookHandler)
      server.middlewares.use('/api/catalog/from-docs', catalogFromDocsHandler)
      server.middlewares.use('/api/config/status', configStatusHandler)
      server.middlewares.use('/api/config/api-key', configApiKeyHandler)
    },
  }
}

function readJson(req: Connect.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function extractA2uiJson(raw: string): unknown {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fence ? fence[1] : raw
  try {
    return JSON.parse(body.trim())
  } catch {
    // Try to find a top-level object first (multi-surface envelope), then array fallback
    const objStart = body.indexOf('{')
    const objEnd = body.lastIndexOf('}')
    if (objStart !== -1 && objEnd > objStart) {
      try {
        return JSON.parse(body.slice(objStart, objEnd + 1))
      } catch {
        // fall through to array attempt
      }
    }
    const arrStart = body.indexOf('[')
    const arrEnd = body.lastIndexOf(']')
    if (arrStart !== -1 && arrEnd > arrStart) {
      try {
        return JSON.parse(body.slice(arrStart, arrEnd + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

const EMPATHY_SYSTEM_PROMPT = `You are a user-research empathy-map generator. Given a target user described in the user message, produce a six-quadrant empathy map.

# Output format

Respond with ONE JSON object, no prose, no markdown fences:

{
  "title": "Empathy Map",
  "persona": {
    "name": "Jolly Jane",
    "archetype": "Busy working parent",
    "bullets": ["Age: 30-40", "Lives in metro city", "2 kids under 8", "Works full-time"],
    "about": "Two sentences describing the persona's context and motivations."
  },
  "quadrants": {
    "hears":         ["short sticky 1", "short sticky 2", "short sticky 3"],
    "sees":          ["short sticky 1", "short sticky 2", "short sticky 3"],
    "saysAndDoes":   ["short sticky 1", "short sticky 2", "short sticky 3"],
    "thinksAndFeels":["short sticky 1", "short sticky 2", "short sticky 3"],
    "pain":          ["short sticky 1", "short sticky 2", "short sticky 3"],
    "gain":          ["short sticky 1", "short sticky 2", "short sticky 3"]
  }
}

# Quadrant guidance

- "hears" — what they hear from peers, family, media, coworkers. (Quotes or sources.)
- "sees" — what they observe in their environment, market, competitors.
- "saysAndDoes" — their actual quoted statements and observable behaviors. (Verbs.)
- "thinksAndFeels" — internal beliefs, worries, motivations, doubts. (Often start with "I'm…" or "Will I…")
- "pain" — frustrations, blockers, fears, anxieties.
- "gain" — desired outcomes, hopes, success criteria.

# Sticky writing rules

- EXACTLY 3 stickies per quadrant.
- Each sticky 6–14 words. Concrete. No filler.
- Use first-person voice when natural ("I worry about…", "I'd love to…").
- No emoji, no markdown.

# Persona rules

- Name: a friendly first + last name (real-feeling, alliterative is fine).
- Archetype: 2-4 word descriptor in quotes (no quotes in your JSON).
- Bullets: 3-5 short fact lines.
- About: 1-2 sentences placing the persona in context.

Emit JSON only.`

const JOURNEY_SYSTEM_PROMPT = `You are a user-journey / flowchart designer. Given a description of a flow, return a vertical flowchart as JSON. The client will spawn each node as a shape on an infinite canvas and connect them with arrows.

# Output format

Respond with ONE JSON object, no prose, no markdown fences:

{
  "title": "Short flow name",
  "nodes": [
    { "id": "n1", "shape": "ellipse",   "text": "Start of Day",          "x": 0,    "y": 0   },
    { "id": "n2", "shape": "rectangle", "text": "Wake Up",                "x": 0,    "y": 160 },
    { "id": "n3", "shape": "diamond",   "text": "Hungry?",                "x": 0,    "y": 320 },
    { "id": "n4", "shape": "rectangle", "text": "Eat breakfast",          "x": -150, "y": 500 },
    { "id": "n5", "shape": "rectangle", "text": "Skip to work",           "x":  150, "y": 500 }
  ],
  "edges": [
    { "from": "n1", "to": "n2" },
    { "from": "n2", "to": "n3" },
    { "from": "n3", "to": "n4", "label": "Yes" },
    { "from": "n3", "to": "n5", "label": "No"  }
  ]
}

# Shape vocabulary

- "ellipse"  — start / end terminators ("Start of Day", "End of Day"). Always use ellipses for the very first and very last node.
- "rectangle" — a process step ("Wake Up", "Order Food", "Send Notification"). Default choice for most nodes.
- "diamond" — a yes/no or branching decision ("Hungry?", "Logged In?"). Edges leaving a diamond MUST carry "Yes"/"No" or short branch labels.
- "triangle" — rare, use for warnings / alert states only.
- "text" — a plain text label with no outline. Use only for callouts.

# Layout rules

- Coordinates are in pixels in canvas space. Origin (0,0) is the top-left of where the flow will spawn.
- The flow grows DOWNWARD. Use \`y\` to advance through the flow, \`x\` to spread branches.
- Default node spacing: 160px vertical between sequential nodes.
- Decision branches: place left branch at \`x: -160\` and right branch at \`x: 160\` (relative to the parent diamond's x). After the branches, both edges should converge back to the next node centered at the original x.
- Default node sizes (you don't need to return them — client uses these defaults):
  - rectangle: 220 × 80
  - ellipse: 220 × 80
  - diamond: 220 × 120
- Use \`text\` shape with no edges when you need a free-floating annotation (rare).

# Quality

- 6–20 nodes for typical journeys. Don't pad.
- Each node text is short (≤ 6 words). Verbs preferred for processes ("Confirm payment"), questions for decisions ("Has account?").
- Always end with an ellipse terminator ("Done", "Complete", "End of Day", etc).
- Branches that lead to a dead end (e.g. "Cancel") still need a terminator ellipse.

Emit JSON only — no commentary.`

const ROUTER_SYSTEM_PROMPT = `You are an intent router. Given a user's message, decide which surface should answer it.

Surfaces:
- "chat" — a conversational reply rendered as rich UI inside a phone-shaped chat container. Use for: questions, information, comparisons, recommendations, opinions, calculations, code explanations, dashboards-as-an-answer, anything the user wants delivered as a chat response.
- "mobile" — a designed mobile app screen rendered inside a phone frame. Use ONLY when the user is explicitly asking to design / mockup / build a mobile app screen, phone UI, or iOS/Android view (e.g. "design an onboarding screen", "build a settings page for an app").
- "web" — a designed desktop/web app screen rendered inside a browser frame. Use ONLY when the user is explicitly asking to design / mockup / build a web page, dashboard, admin panel, marketing site, or browser-based UI (e.g. "design a sales dashboard", "build a pricing page").
- "journey" — a vertical flowchart drawn directly on the canvas using shape nodes + connecting arrows. Use when the user asks for a user journey, user flow, flowchart, customer journey, decision flow, process diagram, swimlane, or describes a step-by-step flow with branches (e.g. "create a user journey for onboarding", "flowchart for password reset", "map out the checkout flow with edge cases").
- "empathy" — a six-quadrant empathy map (Hears, Sees, Says & Does, Thinks & Feels, Pain, Gain) drawn as colored sticky notes around a central persona, FigJam-template style. Use when the user asks for an empathy map, persona map, user empathy, or wants to map a user's mindset / pain & gain (e.g. "create an empathy map for a busy parent", "make an empathy map of a first-time crypto investor").

Tiebreak rules:
- Conversation, comparison, lookup, analysis → "chat".
- Verbs like "design a screen", "mockup a UI", "build a page", "lay out a view" → "mobile" or "web" based on the platform mentioned. If no platform is mentioned but the verb is design/build/mockup, default to "web".
- Verbs like "map", "flow", "journey", "flowchart", "diagram", "step-by-step", combined with decisions/branches/process language → "journey".
- Phrases like "empathy map", "persona empathy", "what they hear/see/think/feel", "pain and gain" → "empathy".
- If unsure, choose "chat".

Also write a \`refined_intent\` — a one-sentence well-phrased restatement that will be passed to the chosen surface's generator. Make it specific and actionable.`

function buildSystemPrompt(kind: Kind, catalogStr: string): string {
  if (kind === 'mobile') return buildScreenDesignPrompt('mobile', catalogStr)
  if (kind === 'web') return buildScreenDesignPrompt('web', catalogStr)
  if (kind === 'component') return buildComponentPrompt(catalogStr)
  return buildChatPrompt(catalogStr)
}

// Prompt used when the user has explicitly disconnected the design system.
// No catalog is supplied — the model composes from a fixed set of A2UI
// primitives that the renderer already knows how to draw.
const ON_THE_FLY_PRIMITIVES = `# Primitives (the only component names you may use)

Layout:    Column, Row, Card, Divider
Text:      Heading (level: 1-4), Text
Inputs:    Button, Input, Textarea, Checkbox, Switch, RadioGroup (with radios), Dropdown (with options)
Data:      Table, KeyValueList, StatCard, MetricGrid, BarChart, LineChart
Feedback:  MessageBar (intent: info|success|warning|error), Spinner, ProgressBar
Media:     Image, Avatar
Misc:      Accordion (with items), Badge, Tag, Link

These are A2UI primitives — no design system is attached. Treat them as raw,
unstyled building blocks. Do NOT reference component names outside this list.

# Component shape — FLAT, no \`props\` wrapper

Every component object has properties at the top level alongside \`id\` and \`component\`. There is NO \`props: { ... }\` nesting. Examples:

  ✅ { "id": "root", "component": "Column", "gap": "m", "padding": "m", "children": ["a", "b"] }
  ❌ { "id": "root", "component": "Column", "props": { "gap": "m", "children": ["a", "b"] } }

  ✅ { "id": "title", "component": "Heading", "level": 2, "text": "Revenue" }
  ✅ { "id": "btn", "component": "Button", "label": "Save", "appearance": "primary", "onClick": { "event": { "name": "save", "context": {} } } }
  ✅ { "id": "kpi", "component": "StatCard", "label": "MRR", "value": "$84.2k", "delta": "+12%", "trend": "up" }
  ✅ { "id": "chart", "component": "BarChart", "title": "Daily orders", "data": [{ "label": "Mon", "value": 24 }, ...] }
  ✅ { "id": "kpis", "component": "MetricGrid", "columns": 4, "children": ["kpi_mrr", "kpi_users", "kpi_churn", "kpi_nps"] }

Common keys: \`children\` (array of ids), \`text\` / \`label\` / \`value\`, \`gap\` ("xs"|"s"|"m"|"l"|"xl"), \`padding\` ("none"|"xs"|"s"|"m"|"l"), \`align\`, \`justify\`, \`level\` (Heading), \`intent\` (MessageBar), \`appearance\` (Button), \`onClick\` / \`onPress\` / \`onChange\` (Action), \`data\` (chart/table rows), \`columns\` (MetricGrid count), \`rows\` (Table rows), \`items\` (Accordion items).

When generating, be inventive with composition: layer Cards inside Columns,
combine MetricGrids with BarCharts, etc. The result is meant to demonstrate
that generative UI works even without a connected DS.`

function buildOnTheFlyPrompt(kind: Kind): string {
  if (kind === 'mobile') return buildScreenOnTheFlyPrompt('mobile')
  if (kind === 'web') return buildScreenOnTheFlyPrompt('web')
  if (kind === 'component') return buildComponentOnTheFlyPrompt()
  return buildChatOnTheFlyPrompt()
}

function buildChatOnTheFlyPrompt(): string {
  return `You are a general-purpose conversational AI that responds with rich, generative UI instead of plain text. No design system is connected — generate each component on the fly from A2UI primitives.

The client renders each turn inside a mobile-shaped chat surface (~360px wide).

# Output format — A2UI v0.10

Respond with a JSON array of two messages, and nothing else (no prose, no markdown):

[
  { "version": "v0.10", "createSurface": { "surfaceId": "turn", "catalogId": "a2ui:primitives", "theme": { "mode": "light" } } },
  { "version": "v0.10", "updateComponents": { "surfaceId": "turn", "components": [ /* flat list — exactly one component has id "root" */ ] } }
]

${ON_THE_FLY_PRIMITIVES}

Rules:
- Components are flat. Each has its own \`id\`. Compose via \`children\` (Column/Row/Card/MetricGrid), \`panelChildId\` (Accordion items), etc.
- Exactly one component has \`id: "root"\`.
- Interactive elements take Action: \`{ "event": { "name": "<snake_case>", "context": { ...literal values... } } }\`.
- Use real numbers and plausible content. No Lorem ipsum.

Always emit valid A2UI JSON as the entire response.`
}

function buildComponentOnTheFlyPrompt(): string {
  return `You produce a SINGLE A2UI v0.10 component (or small composition) as JSON. No design system is connected — generate on the fly from primitives.

This component renders directly on the canvas — it should be the natural size of the component itself, not a full screen.

# Output format

Respond with a JSON array of two messages, nothing else:

[
  { "version": "v0.10", "createSurface": { "surfaceId": "turn", "catalogId": "a2ui:primitives", "theme": { "mode": "light" } } },
  { "version": "v0.10", "updateComponents": { "surfaceId": "turn", "components": [ /* flat list — exactly one component has id "root" */ ] } }
]

${ON_THE_FLY_PRIMITIVES}

Rules:
- Exactly one component has \`id: "root"\`. The root IS the component.
- Targeted edits: if the user message begins with \`[edit target_component=ID]\`, modify only that id.
- Use plausible real data — no Lorem ipsum.

Always emit valid A2UI JSON as the entire response.`
}

function buildScreenOnTheFlyPrompt(kind: 'mobile' | 'web'): string {
  const surface = kind === 'mobile' ? 'mobile app screen' : 'desktop / web app screen'
  const sizing =
    kind === 'mobile'
      ? 'The screen renders inside a phone frame ~380px wide × ~775px tall (9:19.5). Use a Column root with stacked sections.'
      : 'The screen renders inside a desktop browser frame ~880px wide × ~500px tall (16:10). Use Row + Column combinations.'

  return `You are a UI designer producing ${surface}s as A2UI v0.10 JSON. No design system is connected — generate each component on the fly from primitives.

# Output format — multi-screen envelope

{
  "surfaces": [
    {
      "title": "Short screen name",
      "messages": [
        { "version": "v0.10", "createSurface": { "surfaceId": "turn", "catalogId": "a2ui:primitives", "theme": { "mode": "light" } } },
        { "version": "v0.10", "updateComponents": { "surfaceId": "turn", "components": [ /* flat list — exactly one component has id "root" */ ] } }
      ]
    }
  ]
}

Single screen → ONE surface item. Multi-screen flow → 3-8 surface items.

${ON_THE_FLY_PRIMITIVES}

# Surface
${sizing}

Rules:
- Each surface is independent. Inside each, components are flat with exactly one \`id: "root"\`.
- Use real, plausible content. No Lorem ipsum.
- Targeted edits: if the user message begins with \`[edit target_component=ID]\`, modify only that id.

Always emit valid A2UI JSON as the entire response.`
}

function buildComponentPrompt(catalogStr: string): string {
  return `You produce a SINGLE A2UI v0.10 component (or small composition) as JSON.

This component renders directly on the canvas with no surrounding frame — it should be the natural size of the component itself, not a full screen.

# Output format

Respond with a JSON array of two messages, nothing else (no prose, no markdown):

[
  { "version": "v0.10", "createSurface": { "surfaceId": "turn", "catalogId": "verbos.co:fluent-v9-mini", "theme": { "mode": "light" } } },
  { "version": "v0.10", "updateComponents": { "surfaceId": "turn", "components": [ /* flat list — exactly one component has id "root" */ ] } }
]

Rules:
- Exactly one component has \`id: "root"\`. The root IS the component (e.g. a Card, a BarChart, a StatCard, a Button).
- Use only catalog components. If the user asks for "a chart of weekly sales", use BarChart or LineChart with realistic data.
- Targeted edits: if the user message begins with \`[edit target_component=ID]\`, regenerate keeping other components stable and only modify the named id.
- Iteration: if a "Current surface" block is present in the system prompt, regenerate the FULL component reflecting the user's requested changes.

# Catalog

${catalogStr}

# Style

- Use plausible real data (real names, real metrics, real trends). Avoid Lorem ipsum.
- For charts, use 4–12 data points that tell a clear story.
- Keep the component compact and self-contained.

Always emit valid A2UI JSON as the entire response.`
}

function buildChatPrompt(catalogStr: string): string {
  return `You are a general-purpose conversational AI that responds with rich, generative UI instead of plain text. You can talk about anything — facts, comparisons, recommendations, planning, calculations, how-to explanations, opinions, code, data, weather, recipes, fitness, finance, travel, learning, and so on.

The client renders each of your turns inside a mobile-shaped chat surface (~360px wide). Use the catalog below to compose the best UI for whatever the user asked.

# Output format — A2UI v0.10

Respond with a JSON array of two messages, and nothing else. No prose, no explanation, no markdown code fences.

[
  { "version": "v0.10", "createSurface": { "surfaceId": "turn", "catalogId": "verbos.co:fluent-v9-mini", "theme": { "mode": "light" } } },
  { "version": "v0.10", "updateComponents": { "surfaceId": "turn", "components": [ /* flat list — exactly one component has id "root" */ ] } }
]

Rules:
- Components are flat. Each has its own \`id\`. Compose via \`children\` (Column/Row/Card/MetricGrid), \`panelChildId\` (Accordion items), etc.
- Exactly one component has \`id: "root"\` — it is rendered first.
- Use only components defined in the catalog.
- Interactive elements take Action: \`{ "event": { "name": "<snake_case>", "context": { ...literal values... } } }\`.
- Place literal IDs/values in context. Do not invent data-binding paths.

# Theme

Set \`createSurface.theme.mode\` to \`"dark"\` when the user explicitly asks for dark mode / dark theme / night mode / "make it dark" — otherwise default to \`"light"\`. The renderer switches Fluent's theme and the surface background accordingly.

# Catalog

${catalogStr}

# Choosing components

- Plain explanation → \`Column\` with \`Text\` blocks.
- Side-by-side comparison → \`Row\` of \`Card\`s or a \`Table\`.
- Numeric summary → \`MetricGrid\` of \`StatCard\`s.
- Trend over time → \`LineChart\`. Category comparison → \`BarChart\`.
- Tabular data → \`Table\`. Quick facts → \`KeyValueList\`.
- Pickable options → \`Card\`s with \`onClick\`, \`RadioGroup\`, or \`Tag\`s.
- Status/notice → \`MessageBar\`. Long content → \`Accordion\`.

# Conversation loop

User free-text → respond with the next turn. Action event (e.g. \`[action] name=select_option context={"id":"42"}\`) → treat as the user choosing that option.

Targeted edits: if a user message begins with \`[edit target_component=ID] ...\`, the user is asking to modify just that specific component in your previous surface. Regenerate the full surface keeping everything else identical, but apply the requested change to the named component id.

Each turn replaces the previous surface — design each turn to stand on its own.

# Style

- Lead with the most important thing.
- Be concise.
- Use real numbers when asked for data. If you don't have authoritative data, say so in a MessageBar (intent: warning) with a labeled best estimate.

Always emit valid A2UI JSON as the entire response. Never produce more than one turn.`
}

function buildScreenDesignPrompt(kind: 'mobile' | 'web', catalogStr: string): string {
  const surface = kind === 'mobile' ? 'mobile app screen' : 'desktop / web app screen'
  const sizing =
    kind === 'mobile'
      ? 'The screen renders inside a phone frame ~380px wide × ~775px tall (9:19.5 aspect ratio). Use a single Column at the root with stacked sections. Prefer vertical layouts, full-width Cards, and full-width Buttons.'
      : 'The screen renders inside a desktop browser frame ~880px wide × ~500px tall (16:10 laptop aspect ratio). Use Row + Column combinations for sidebars and multi-column areas. Place denser content (MetricGrids, Tables, charts) in the main area and navigation/filters on the side.'
  const examples =
    kind === 'mobile'
      ? `Examples: "onboarding screen", "profile editor", "settings", "checkout step", "feed", "notification preferences".`
      : `Examples: "analytics dashboard", "team admin panel", "pricing page", "settings", "user directory".`

  return `You are a UI designer that produces one or more ${surface}s as A2UI v0.10 JSON.

You are NOT a chatbot. You generate FINISHED, well-composed screen designs. No greetings, no follow-up questions — just the design.

# Output format — multi-screen envelope

Respond with this JSON shape, and nothing else (no prose, no markdown):

{
  "surfaces": [
    {
      "title": "Short screen name (e.g. 'Home', 'Settings')",
      "messages": [
        { "version": "v0.10", "createSurface": { "surfaceId": "turn", "catalogId": "verbos.co:fluent-v9-mini", "theme": { "mode": "light" } } },
        { "version": "v0.10", "updateComponents": { "surfaceId": "turn", "components": [ /* flat list — exactly one component has id "root" */ ] } }
      ]
    }
  ]
}

When the user asks for a SINGLE screen, return ONE item in \`surfaces\`. When the user asks for an app/flow/feature that naturally spans multiple screens (e.g. "design a fitness app", "build the signup flow", "create a checkout journey"), return ONE ITEM PER SCREEN — 3 to 8 items. Do NOT design a single screen with buttons that navigate to other screens; design each destination as its own surface so the user can see the full flow side-by-side.

Rules:
- Each surface is independent and self-contained — all components for that screen are inside its own \`messages\`.
- Inside each surface, components are flat. Exactly one component has \`id: "root"\`.
- Use only components in the catalog.
- For buttons/links/interactive cards: include onPress/onClick with a useful Action name (e.g. \`{ "event": { "name": "go_to_settings", "context": {} } }\`).
- Iteration: if an earlier assistant message in the conversation already returned surfaces, REGENERATE the full envelope with the requested edits applied. The client will replace previously generated screens.
- Targeted edits: if the user message begins with \`[edit target_component=ID]\`, regenerate the screens with that specific component modified per the user's instruction; keep other components stable.

# Theme

Set \`createSurface.theme.mode\` to \`"dark"\` when the user explicitly asks for dark mode / dark theme / night mode — otherwise default to \`"light"\`. The renderer switches Fluent's theme and the surface background accordingly.

# Surface

${sizing}

${examples}

# Catalog

${catalogStr}

# Design quality

- Clear visual hierarchy: title3 / subtitle1 / body1 / caption1.
- Use real, plausible placeholder content (not "Lorem ipsum"). If the user mentions a domain or brand, lean into it.
- Use Cards to group related content. Use Divider sparingly.
- For data-heavy designs, use MetricGrid + Table + BarChart/LineChart appropriately.
- For input-heavy designs, use clearly labeled Input/Textarea/Dropdown/RadioGroup with a primary Button at the end.
- Use MessageBar for empty states, warnings, or success confirmations.

# Iteration

If a follow-up message arrives with the prior generation in context, REGENERATE the full screen with the requested edits applied. Don't describe the change — emit the updated A2UI JSON.

Always emit valid A2UI JSON as the entire response.`
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), anthropicProxy(env)],
  }
})

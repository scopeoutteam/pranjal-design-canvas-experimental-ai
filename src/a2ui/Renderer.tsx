import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  Text,
  Button,
  Input,
  Textarea,
  Checkbox,
  Switch,
  Radio,
  RadioGroup,
  Card,
  Avatar,
  Badge,
  Divider,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  ProgressBar,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  Combobox,
  Option,
  Tag,
  Link,
} from '@fluentui/react-components'
import type { A2uiAction, A2uiComponent, A2uiMessage, OnAction } from './types'

type ComponentMap = Map<string, A2uiComponent>

const GAP: Record<string, number> = { xs: 4, s: 8, m: 12, l: 16, xl: 24 }
const PAD: Record<string, number> = { none: 0, xs: 4, s: 8, m: 12, l: 16 }

export function extractTheme(messages: A2uiMessage[] | null | undefined): 'light' | 'dark' {
  if (!messages) return 'light'
  for (const m of messages) {
    if ('createSurface' in m) {
      const t = (m.createSurface as { theme?: { mode?: string } }).theme
      if (t?.mode === 'dark') return 'dark'
    }
  }
  return 'light'
}

export default function A2uiRenderer({
  messages,
  onAction,
  selectedComponentId,
  onSelectComponent,
  onEditText,
}: {
  messages: A2uiMessage[]
  onAction: OnAction
  selectedComponentId?: string | null
  onSelectComponent?: (id: string | null) => void
  onEditText?: (componentId: string, newText: string) => void
}) {
  const components = useMemo<ComponentMap>(() => {
    const map = new Map<string, A2uiComponent>()
    for (const msg of messages || []) {
      if ('updateComponents' in msg && msg.updateComponents?.components) {
        for (const c of msg.updateComponents.components) {
          if (c && c.id) map.set(c.id, c)
        }
      }
    }
    return map
  }, [messages])

  const themeMode = useMemo(() => extractTheme(messages), [messages])
  const theme = themeMode === 'dark' ? webDarkTheme : webLightTheme

  if (!components.has('root')) {
    return (
      <FluentProvider theme={theme}>
        <Text size={300} style={{ color: '#a3a3a3' }}>
          (empty surface — no root component)
        </Text>
      </FluentProvider>
    )
  }

  const handleSelectClick = (e: React.MouseEvent) => {
    if (!onSelectComponent || !(e.altKey || e.metaKey)) return
    const el = (e.target as HTMLElement).closest('[data-a2ui-id]')
    const id = el?.getAttribute('data-a2ui-id') ?? null
    if (id) {
      e.stopPropagation()
      e.preventDefault()
      onSelectComponent(id === selectedComponentId ? null : id)
    }
  }

  return (
    <FluentProvider
      theme={theme}
      style={{ background: 'transparent' }}
      onClickCapture={handleSelectClick}
    >
      <Node
        id="root"
        map={components}
        onAction={onAction}
        selectedComponentId={selectedComponentId}
        onEditText={onEditText}
      />
    </FluentProvider>
  )
}

function Node({
  id,
  map,
  onAction,
  selectedComponentId,
  onEditText,
}: {
  id: string
  map: ComponentMap
  onAction: OnAction
  selectedComponentId?: string | null
  onEditText?: (componentId: string, newText: string) => void
}) {
  const c = map.get(id)
  if (!c) {
    return (
      <Text size={200} style={{ color: '#dc2626' }}>
        Missing: {id}
      </Text>
    )
  }

  const fire = (action: A2uiAction | undefined) => {
    if (action?.event) onAction(action.event)
  }

  const isSelected = selectedComponentId === id
  const wrapStyle: React.CSSProperties = isSelected
    ? { outline: '2px dashed #0f6cbd', outlineOffset: 2, borderRadius: 6, display: 'inline-block', maxWidth: '100%' }
    : { display: 'contents' }

  const renderInner = (): React.ReactNode => {
    switch (c.component) {
    case 'Column': {
      const gap = GAP[(c.gap as string) ?? 'm'] ?? 12
      const padding = PAD[(c.padding as string) ?? 'none'] ?? 0
      const align = (c.align as string) ?? 'stretch'
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap,
            padding,
            minWidth: 0,
            maxWidth: '100%',
            alignItems:
              align === 'center'
                ? 'center'
                : align === 'end'
                ? 'flex-end'
                : align === 'start'
                ? 'flex-start'
                : 'stretch',
          }}
        >
          {((c.children as string[]) ?? []).map((cid) => (
            <Node key={cid} id={cid} map={map} onAction={onAction} selectedComponentId={selectedComponentId} onEditText={onEditText} />
          ))}
        </div>
      )
    }

    case 'Row': {
      const gap = GAP[(c.gap as string) ?? 'm'] ?? 12
      const align = (c.align as string) ?? 'center'
      const justify = (c.justify as string) ?? 'start'
      const wrap = (c.wrap as boolean) ?? false
      const justifyMap: Record<string, string> = {
        start: 'flex-start',
        center: 'center',
        end: 'flex-end',
        between: 'space-between',
        around: 'space-around',
      }
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap,
            minWidth: 0,
            maxWidth: '100%',
            alignItems:
              align === 'baseline'
                ? 'baseline'
                : align === 'start'
                ? 'flex-start'
                : align === 'end'
                ? 'flex-end'
                : 'center',
            justifyContent: justifyMap[justify] ?? 'flex-start',
            flexWrap: wrap ? 'wrap' : 'wrap',
          }}
        >
          {((c.children as string[]) ?? []).map((cid) => (
            <Node key={cid} id={cid} map={map} onAction={onAction} selectedComponentId={selectedComponentId} onEditText={onEditText} />
          ))}
        </div>
      )
    }

    case 'Card': {
      const onClick = c.onClick as A2uiAction | undefined
      return (
        <Card
          appearance={(c.appearance as 'filled' | 'outline' | 'subtle') ?? 'outline'}
          selected={c.selected as boolean | undefined}
          onClick={onClick ? () => fire(onClick) : undefined}
          style={{ cursor: onClick ? 'pointer' : 'default' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {((c.children as string[]) ?? []).map((cid) => (
              <Node key={cid} id={cid} map={map} onAction={onAction} selectedComponentId={selectedComponentId} onEditText={onEditText} />
            ))}
          </div>
        </Card>
      )
    }

    case 'Text': {
      const variant = (c.variant as string) ?? 'body1'
      const text = (c.text as string) ?? ''
      const align = (c.align as string) ?? 'start'
      const color = colorToken((c.color as string) ?? 'neutral')
      const { size, weight, as } = textVariant(variant)
      return (
        <Text
          size={size}
          weight={weight}
          as={as}
          align={align as 'start' | 'center' | 'end' | 'justify'}
          style={{ color, overflowWrap: 'anywhere', wordBreak: 'break-word', maxWidth: '100%' }}
          block
        >
          <EditableText
            value={text}
            onChange={onEditText ? (v) => onEditText(c.id as string, v) : undefined}
          />
        </Text>
      )
    }

    case 'Image': {
      const shape = (c.shape as string) ?? 'rounded'
      const radius = shape === 'circular' ? 999 : shape === 'rounded' ? 8 : 0
      return (
        <img
          src={c.src as string}
          alt={(c.description as string) ?? ''}
          style={{
            maxWidth: '100%',
            borderRadius: radius,
            objectFit: ((c.fit as string) ?? 'default') === 'default' ? undefined : (c.fit as 'cover' | 'contain'),
          }}
        />
      )
    }

    case 'Avatar': {
      return (
        <Avatar
          name={c.name as string | undefined}
          image={c.image ? { src: c.image as string } : undefined}
          size={c.size as 16 | 20 | 24 | 28 | 32 | 36 | 40 | 48 | 56 | 64 | 72 | 96 | 120 | 128 | undefined}
          color={(c.color as 'neutral' | 'brand' | 'colorful') ?? 'colorful'}
        />
      )
    }

    case 'Badge': {
      return (
        <Badge
          appearance={(c.appearance as 'filled' | 'ghost' | 'outline' | 'tint') ?? 'filled'}
          color={(c.color as 'brand' | 'danger' | 'important' | 'informative' | 'severe' | 'subtle' | 'success' | 'warning') ?? 'brand'}
          shape={(c.shape as 'rounded' | 'circular' | 'square') ?? 'circular'}
        >
          <EditableText
            value={c.text as string}
            onChange={onEditText ? (v) => onEditText(c.id, v) : undefined}
          />
        </Badge>
      )
    }

    case 'Tag': {
      const onClick = c.onClick as A2uiAction | undefined
      return (
        <Tag
          appearance={c.selected ? 'brand' : 'outline'}
          shape="rounded"
          onClick={onClick ? () => fire(onClick) : undefined}
          style={{ cursor: onClick ? 'pointer' : 'default' }}
        >
          <EditableText
            value={c.text as string}
            onChange={onEditText ? (v) => onEditText(c.id, v) : undefined}
          />
        </Tag>
      )
    }

    case 'Divider':
      return <Divider appearance={(c.appearance as 'default' | 'subtle' | 'strong') ?? 'default'} />

    case 'Button': {
      const onPress = c.onPress as A2uiAction | undefined
      return (
        <Button
          appearance={(c.appearance as 'primary' | 'secondary' | 'outline' | 'subtle' | 'transparent') ?? 'secondary'}
          size={(c.size as 'small' | 'medium' | 'large') ?? 'medium'}
          disabled={c.disabled as boolean | undefined}
          onClick={() => fire(onPress)}
        >
          <EditableText
            value={c.text as string}
            onChange={onEditText ? (v) => onEditText(c.id, v) : undefined}
          />
        </Button>
      )
    }

    case 'Input':
      return <ControlledInput c={c} onAction={onAction} />

    case 'Textarea':
      return <ControlledTextarea c={c} onAction={onAction} />

    case 'Checkbox': {
      const onChange = c.onChange as A2uiAction | undefined
      return (
        <Checkbox
          label={c.label as string}
          defaultChecked={c.checked as boolean | undefined}
          onChange={(_, data) =>
            onChange &&
            onAction({
              name: onChange.event.name,
              context: { ...(onChange.event.context ?? {}), value: !!data.checked },
            })
          }
        />
      )
    }

    case 'Switch': {
      const onChange = c.onChange as A2uiAction | undefined
      return (
        <Switch
          label={c.label as string}
          defaultChecked={c.checked as boolean | undefined}
          onChange={(_, data) =>
            onChange &&
            onAction({
              name: onChange.event.name,
              context: { ...(onChange.event.context ?? {}), value: data.checked },
            })
          }
        />
      )
    }

    case 'RadioGroup': {
      const onChange = c.onChange as A2uiAction | undefined
      const layout = (c.layout as string) ?? 'vertical'
      const options = (c.options as Array<{ value: string; label: string; hint?: string }>) ?? []
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {c.label ? (
            <Text size={200} weight="semibold" block>
              {c.label as string}
            </Text>
          ) : null}
          <RadioGroup
            layout={layout as 'vertical' | 'horizontal' | 'horizontal-stacked'}
            defaultValue={c.value as string | undefined}
            onChange={(_, data) =>
              onChange &&
              onAction({
                name: onChange.event.name,
                context: { ...(onChange.event.context ?? {}), value: data.value },
              })
            }
          >
            {options.map((o) => (
              <Radio key={o.value} value={o.value} label={o.hint ? `${o.label} — ${o.hint}` : o.label} />
            ))}
          </RadioGroup>
        </div>
      )
    }

    case 'Dropdown': {
      const onChange = c.onChange as A2uiAction | undefined
      const options = (c.options as Array<{ value: string; label: string }>) ?? []
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {c.label ? (
            <Text size={200} weight="semibold" block>
              {c.label as string}
            </Text>
          ) : null}
          <Combobox
            placeholder={c.placeholder as string | undefined}
            defaultSelectedOptions={c.value ? [c.value as string] : undefined}
            onOptionSelect={(_, data) =>
              onChange &&
              onAction({
                name: onChange.event.name,
                context: { ...(onChange.event.context ?? {}), value: data.optionValue },
              })
            }
          >
            {options.map((o) => (
              <Option key={o.value} value={o.value}>
                {o.label}
              </Option>
            ))}
          </Combobox>
        </div>
      )
    }

    case 'MessageBar': {
      return (
        <MessageBar intent={(c.intent as 'info' | 'warning' | 'error' | 'success') ?? 'info'}>
          <MessageBarBody>
            {c.title ? <MessageBarTitle>{c.title as string}</MessageBarTitle> : null}
            {c.text as string}
          </MessageBarBody>
        </MessageBar>
      )
    }

    case 'Spinner':
      return (
        <Spinner
          size={(c.size as 'tiny' | 'extra-small' | 'small' | 'medium' | 'large') ?? 'medium'}
          label={c.label as string | undefined}
        />
      )

    case 'ProgressBar':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {c.label ? (
            <Text size={200} block>
              {c.label as string}
            </Text>
          ) : null}
          <ProgressBar
            value={c.value as number | undefined}
            thickness={(c.thickness as 'medium' | 'large') ?? 'medium'}
          />
        </div>
      )

    case 'Accordion': {
      const items = (c.items as Array<{ value: string; header: string; panelChildId?: string }>) ?? []
      return (
        <Accordion
          collapsible={(c.collapsible as boolean) ?? true}
          multiple={(c.multiple as boolean) ?? false}
          defaultOpenItems={c.defaultOpenValues as string[] | undefined}
        >
          {items.map((it) => (
            <AccordionItem key={it.value} value={it.value}>
              <AccordionHeader>{it.header}</AccordionHeader>
              <AccordionPanel>
                {it.panelChildId ? (
                  <Node id={it.panelChildId} map={map} onAction={onAction} selectedComponentId={selectedComponentId} onEditText={onEditText} />
                ) : null}
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      )
    }

    case 'Link': {
      const onPress = c.onPress as A2uiAction | undefined
      if (onPress) {
        return (
          <Link as="button" onClick={() => fire(onPress)}>
            <EditableText
              value={c.text as string}
              onChange={onEditText ? (v) => onEditText(c.id, v) : undefined}
            />
          </Link>
        )
      }
      return (
        <Link href={c.href as string} target="_blank">
          <EditableText
            value={c.text as string}
            onChange={onEditText ? (v) => onEditText(c.id, v) : undefined}
          />
        </Link>
      )
    }

    case 'StatCard': {
      const intent = (c.intent as string) ?? 'neutral'
      const intentBg: Record<string, string> = {
        neutral: '#ffffff',
        success: '#f0fdf4',
        warning: '#fffbeb',
        danger: '#fef2f2',
        brand: '#eff6ff',
      }
      const intentBorder: Record<string, string> = {
        neutral: '#e5e5e5',
        success: '#bbf7d0',
        warning: '#fde68a',
        danger: '#fecaca',
        brand: '#bfdbfe',
      }
      const trend = c.trend as string | undefined
      const trendColor =
        trend === 'up' ? '#107c10' : trend === 'down' ? '#b10e1c' : '#737373'
      const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'
      return (
        <div
          style={{
            background: intentBg[intent],
            border: `1px solid ${intentBorder[intent]}`,
            borderRadius: 12,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <Text size={200} weight="semibold" style={{ color: '#737373', textTransform: 'uppercase', letterSpacing: 0.4 }} block>
            {c.label as string}
          </Text>
          <Text size={700} weight="semibold" as="div" style={{ color: '#171717', lineHeight: 1.1 }} block>
            {c.value as string}
          </Text>
          {c.sublabel ? (
            <Text size={200} style={{ color: '#737373' }} block>
              {c.sublabel as string}
            </Text>
          ) : null}
          {trend && c.trendValue ? (
            <Text size={200} weight="semibold" style={{ color: trendColor }} block>
              {trendArrow} {c.trendValue as string}
            </Text>
          ) : null}
        </div>
      )
    }

    case 'MetricGrid': {
      const columns = (c.columns as number) ?? 2
      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 10,
          }}
        >
          {((c.children as string[]) ?? []).map((cid) => (
            <Node key={cid} id={cid} map={map} onAction={onAction} selectedComponentId={selectedComponentId} onEditText={onEditText} />
          ))}
        </div>
      )
    }

    case 'BarChart':
      return <BarChartView c={c} />

    case 'LineChart':
      return <LineChartView c={c} />

    case 'Table':
      return <TableView c={c} />

    case 'KeyValueList': {
      const items = (c.items as Array<{ label: string; value: string }>) ?? []
      return (
        <div
          style={{
            border: '1px solid #e5e5e5',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {items.map((it, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                gap: 12,
                borderTop: i === 0 ? 'none' : '1px solid #f0f0f0',
              }}
            >
              <Text size={200} style={{ color: '#737373' }}>
                {it.label}
              </Text>
              <Text size={300} weight="semibold" style={{ color: '#171717', textAlign: 'right' }}>
                {it.value}
              </Text>
            </div>
          ))}
        </div>
      )
    }

    default:
      return (
        <Text size={200} style={{ color: '#dc2626' }}>
          Unknown component: {c.component}
        </Text>
      )
    }
  }

  return (
    <div data-a2ui-id={id} style={wrapStyle}>
      {renderInner()}
    </div>
  )
}

function EditableText({
  value,
  onChange,
  style,
}: {
  value: string
  onChange?: (next: string) => void
  style?: React.CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [editing])

  if (!onChange) {
    return <>{value}</>
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          if (draft !== value) onChange(draft)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            inputRef.current?.blur()
          } else if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
          e.stopPropagation()
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        style={{
          font: 'inherit',
          color: 'inherit',
          background: 'transparent',
          border: '1px solid #0f6cbd',
          borderRadius: 4,
          padding: '0 4px',
          margin: '-1px -5px',
          outline: 'none',
          minWidth: 24,
          width: `${Math.max(4, draft.length + 1)}ch`,
          ...style,
        }}
      />
    )
  }

  return (
    <span
      onDoubleClick={(e) => {
        e.stopPropagation()
        setDraft(value)
        setEditing(true)
      }}
      style={{ cursor: 'inherit', ...style }}
    >
      {value}
    </span>
  )
}

function ControlledInput({ c, onAction }: { c: A2uiComponent; onAction: OnAction }) {
  const [value, setValue] = useState((c.value as string) ?? '')
  const onChange = c.onChange as A2uiAction | undefined
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {c.label ? (
        <Text size={200} weight="semibold" block>
          {c.label as string}
        </Text>
      ) : null}
      <Input
        placeholder={c.placeholder as string | undefined}
        value={value}
        type={(c.type as 'text' | 'email' | 'tel' | 'url' | 'password' | 'number') ?? 'text'}
        disabled={c.disabled as boolean | undefined}
        onChange={(_, data) => setValue(data.value)}
        onBlur={() =>
          onChange &&
          onAction({
            name: onChange.event.name,
            context: { ...(onChange.event.context ?? {}), value },
          })
        }
      />
      {c.hint ? (
        <Text size={100} style={{ color: '#a3a3a3' }} block>
          {c.hint as string}
        </Text>
      ) : null}
    </div>
  )
}

function ControlledTextarea({ c, onAction }: { c: A2uiComponent; onAction: OnAction }) {
  const [value, setValue] = useState((c.value as string) ?? '')
  const onChange = c.onChange as A2uiAction | undefined
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {c.label ? (
        <Text size={200} weight="semibold" block>
          {c.label as string}
        </Text>
      ) : null}
      <Textarea
        placeholder={c.placeholder as string | undefined}
        value={value}
        rows={(c.rows as number) ?? 3}
        onChange={(_, data) => setValue(data.value)}
        onBlur={() =>
          onChange &&
          onAction({
            name: onChange.event.name,
            context: { ...(onChange.event.context ?? {}), value },
          })
        }
      />
    </div>
  )
}

function textVariant(
  v: string,
): { size: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 1000; weight: 'regular' | 'medium' | 'semibold' | 'bold'; as: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' } {
  switch (v) {
    case 'title1':
      return { size: 800, weight: 'bold', as: 'h1' }
    case 'title2':
      return { size: 700, weight: 'semibold', as: 'h2' }
    case 'title3':
      return { size: 500, weight: 'semibold', as: 'h3' }
    case 'subtitle1':
      return { size: 400, weight: 'semibold', as: 'h4' }
    case 'subtitle2':
      return { size: 300, weight: 'semibold', as: 'h5' }
    case 'body1Strong':
      return { size: 300, weight: 'semibold', as: 'p' }
    case 'caption1':
      return { size: 200, weight: 'regular', as: 'span' }
    case 'caption2':
      return { size: 100, weight: 'regular', as: 'span' }
    case 'body1':
    default:
      return { size: 300, weight: 'regular', as: 'p' }
  }
}

function BarChartView({ c }: { c: A2uiComponent }) {
  const data = (c.data as Array<{ label: string; value: number; color?: string }>) ?? []
  const orientation = (c.orientation as string) ?? 'vertical'
  const prefix = (c.valuePrefix as string) ?? ''
  const suffix = (c.valueSuffix as string) ?? ''
  const max = data.length ? Math.max(...data.map((d) => d.value)) : 1
  const defaultColor = '#0f6cbd'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {c.title ? (
        <Text size={300} weight="semibold" block>
          {c.title as string}
        </Text>
      ) : null}
      {orientation === 'horizontal' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 90, fontSize: 12, color: '#525252' }}>{d.label}</div>
              <div style={{ flex: 1, background: '#f5f5f5', borderRadius: 6, height: 16, position: 'relative', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(d.value / max) * 100}%`,
                    height: '100%',
                    background: d.color || defaultColor,
                    transition: 'width 200ms ease',
                  }}
                />
              </div>
              <div style={{ width: 60, fontSize: 12, color: '#171717', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {prefix}{d.value.toLocaleString()}{suffix}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${data.length || 1}, 1fr)`,
            gap: 8,
            alignItems: 'end',
            height: 140,
          }}
        >
          {data.map((d, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
              <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                <div
                  style={{
                    width: '100%',
                    height: `${(d.value / max) * 100}%`,
                    background: d.color || defaultColor,
                    borderRadius: '6px 6px 0 0',
                    transition: 'height 200ms ease',
                    minHeight: 2,
                  }}
                  title={`${d.label}: ${prefix}${d.value}${suffix}`}
                />
              </div>
              <div style={{ fontSize: 10, color: '#525252', textAlign: 'center', lineHeight: 1.2 }}>{d.label}</div>
              <div style={{ fontSize: 11, color: '#171717', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {prefix}{d.value}{suffix}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LineChartView({ c }: { c: A2uiComponent }) {
  const data = (c.data as Array<{ label: string; value: number }>) ?? []
  const color = (c.color as string) ?? '#0f6cbd'
  const prefix = (c.valuePrefix as string) ?? ''
  const suffix = (c.valueSuffix as string) ?? ''
  if (data.length < 2) {
    return (
      <Text size={200} style={{ color: '#a3a3a3' }}>
        Need at least 2 data points for a line chart.
      </Text>
    )
  }
  const width = 320
  const height = 140
  const padX = 8
  const padY = 12
  const innerW = width - padX * 2
  const innerH = height - padY * 2
  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = data.map((d, i) => {
    const x = padX + (innerW * i) / (data.length - 1)
    const y = padY + innerH - ((d.value - min) / range) * innerH
    return { x, y, ...d }
  })
  const path = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ')
  const area = `${path} L ${points[points.length - 1].x} ${padY + innerH} L ${points[0].x} ${padY + innerH} Z`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {c.title ? (
        <Text size={300} weight="semibold" block>
          {c.title as string}
        </Text>
      ) : null}
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }} role="img">
        <path d={area} fill={color} opacity={0.12} />
        <path d={path} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color}>
            <title>
              {p.label}: {prefix}
              {p.value}
              {suffix}
            </title>
          </circle>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#737373' }}>
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  )
}

function TableView({ c }: { c: A2uiComponent }) {
  const columns = (c.columns as Array<{ key: string; header: string; align?: 'start' | 'center' | 'end' }>) ?? []
  const rows = (c.rows as Array<Record<string, unknown>>) ?? []
  return (
    <div
      style={{
        border: '1px solid #e5e5e5',
        borderRadius: 12,
        overflow: 'auto',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
          color: '#171717',
        }}
      >
        <thead style={{ background: '#fafafa' }}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: col.align === 'end' ? 'right' : col.align === 'center' ? 'center' : 'left',
                  padding: '8px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#525252',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  borderBottom: '1px solid #e5e5e5',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => {
                const v = row[col.key]
                const display =
                  v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
                return (
                  <td
                    key={col.key}
                    style={{
                      textAlign: col.align === 'end' ? 'right' : col.align === 'center' ? 'center' : 'left',
                      padding: '8px 12px',
                      borderTop: i === 0 ? 'none' : '1px solid #f0f0f0',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {display}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function colorToken(c: string): string {
  switch (c) {
    case 'subtle':
      return '#737373'
    case 'brand':
      return '#0f6cbd'
    case 'danger':
      return '#b10e1c'
    case 'success':
      return '#107c10'
    case 'warning':
      return '#bc4b09'
    case 'neutral':
    default:
      return '#171717'
  }
}

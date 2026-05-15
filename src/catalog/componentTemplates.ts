// Pre-built A2UI v0.10 surface fragments for each catalog component.
// Used when the user drags a component out of the design system flyout —
// we spawn a 'component' node with the corresponding surface, no LLM call needed.

import type { A2uiMessage } from '../a2ui/types'

export interface CatalogEntry {
  name: string
  description: string
  category: 'layout' | 'text' | 'input' | 'data' | 'feedback' | 'navigation' | 'media'
  /** Builds a surface containing one root component of this type. */
  build: () => A2uiMessage[]
}

function surface(components: Array<Record<string, unknown>>): A2uiMessage[] {
  return [
    { version: 'v0.10', createSurface: { surfaceId: 'turn', catalogId: 'verbos.co:fluent-v9-mini' } },
    { version: 'v0.10', updateComponents: { surfaceId: 'turn', components: components as never } },
  ]
}

export const CATALOG: CatalogEntry[] = [
  // ── Text ────────────────────────────────────────────────────────
  {
    name: 'Text',
    description: 'Display text with semantic variants.',
    category: 'text',
    build: () =>
      surface([{ id: 'root', component: 'Text', text: 'Hello world', variant: 'body1' }]),
  },
  {
    name: 'Heading',
    description: 'Title typography (title3).',
    category: 'text',
    build: () =>
      surface([{ id: 'root', component: 'Text', text: 'Section title', variant: 'title3' }]),
  },

  // ── Layout ──────────────────────────────────────────────────────
  {
    name: 'Column',
    description: 'Vertical stack of content.',
    category: 'layout',
    build: () =>
      surface([
        { id: 'root', component: 'Column', gap: 'm', children: ['t1', 't2'] },
        { id: 't1', component: 'Text', text: 'First item', variant: 'body1Strong' },
        { id: 't2', component: 'Text', text: 'Second item', variant: 'body1' },
      ]),
  },
  {
    name: 'Row',
    description: 'Horizontal stack of content.',
    category: 'layout',
    build: () =>
      surface([
        { id: 'root', component: 'Row', gap: 'm', children: ['t1', 't2'] },
        { id: 't1', component: 'Text', text: 'Left', variant: 'body1' },
        { id: 't2', component: 'Text', text: 'Right', variant: 'body1' },
      ]),
  },
  {
    name: 'Card',
    description: 'Container with border and padding.',
    category: 'layout',
    build: () =>
      surface([
        { id: 'root', component: 'Card', appearance: 'outline', children: ['ct1', 'ct2'] },
        { id: 'ct1', component: 'Text', text: 'Card title', variant: 'subtitle1' },
        { id: 'ct2', component: 'Text', text: 'Card body content goes here.', variant: 'body1', color: 'subtle' },
      ]),
  },
  {
    name: 'Divider',
    description: 'Horizontal divider.',
    category: 'layout',
    build: () => surface([{ id: 'root', component: 'Divider' }]),
  },

  // ── Input ───────────────────────────────────────────────────────
  {
    name: 'Button',
    description: 'Action button.',
    category: 'input',
    build: () =>
      surface([
        {
          id: 'root',
          component: 'Button',
          text: 'Primary action',
          appearance: 'primary',
          onPress: { event: { name: 'press', context: {} } },
        },
      ]),
  },
  {
    name: 'Input',
    description: 'Single-line text field.',
    category: 'input',
    build: () =>
      surface([{ id: 'root', component: 'Input', label: 'Email', placeholder: 'name@example.com' }]),
  },
  {
    name: 'Textarea',
    description: 'Multi-line text field.',
    category: 'input',
    build: () =>
      surface([
        { id: 'root', component: 'Textarea', label: 'Notes', placeholder: 'Type something…', rows: 4 },
      ]),
  },
  {
    name: 'Checkbox',
    description: 'Single binary toggle.',
    category: 'input',
    build: () => surface([{ id: 'root', component: 'Checkbox', label: 'I agree', checked: false }]),
  },
  {
    name: 'Switch',
    description: 'On/off switch.',
    category: 'input',
    build: () =>
      surface([{ id: 'root', component: 'Switch', label: 'Enable notifications', checked: true }]),
  },
  {
    name: 'RadioGroup',
    description: 'Mutually exclusive options.',
    category: 'input',
    build: () =>
      surface([
        {
          id: 'root',
          component: 'RadioGroup',
          label: 'Preferred contact',
          value: 'email',
          options: [
            { value: 'email', label: 'Email' },
            { value: 'sms', label: 'SMS' },
            { value: 'phone', label: 'Phone' },
          ],
        },
      ]),
  },
  {
    name: 'Dropdown',
    description: 'Single-select dropdown.',
    category: 'input',
    build: () =>
      surface([
        {
          id: 'root',
          component: 'Dropdown',
          label: 'Country',
          placeholder: 'Choose one…',
          options: [
            { value: 'us', label: 'United States' },
            { value: 'in', label: 'India' },
            { value: 'uk', label: 'United Kingdom' },
          ],
        },
      ]),
  },

  // ── Data ────────────────────────────────────────────────────────
  {
    name: 'StatCard',
    description: 'KPI tile with value, label, and trend.',
    category: 'data',
    build: () =>
      surface([
        {
          id: 'root',
          component: 'StatCard',
          label: 'Active users',
          value: '12,480',
          sublabel: 'Last 30 days',
          trend: 'up',
          trendValue: '+8.2%',
          intent: 'brand',
        },
      ]),
  },
  {
    name: 'MetricGrid',
    description: 'Grid of StatCards.',
    category: 'data',
    build: () =>
      surface([
        { id: 'root', component: 'MetricGrid', columns: 2, children: ['s1', 's2', 's3', 's4'] },
        { id: 's1', component: 'StatCard', label: 'Revenue', value: '$84.2k', trend: 'up', trendValue: '+12%' },
        { id: 's2', component: 'StatCard', label: 'Signups', value: '1,204', trend: 'up', trendValue: '+5%' },
        { id: 's3', component: 'StatCard', label: 'Churn', value: '2.1%', trend: 'down', trendValue: '-0.3pp' },
        { id: 's4', component: 'StatCard', label: 'NPS', value: '47', trend: 'flat', trendValue: '0' },
      ]),
  },
  {
    name: 'BarChart',
    description: 'Vertical or horizontal bars.',
    category: 'data',
    build: () =>
      surface([
        {
          id: 'root',
          component: 'BarChart',
          title: 'Daily orders',
          orientation: 'vertical',
          data: [
            { label: 'Mon', value: 24 },
            { label: 'Tue', value: 38 },
            { label: 'Wed', value: 32 },
            { label: 'Thu', value: 41 },
            { label: 'Fri', value: 55 },
            { label: 'Sat', value: 28 },
            { label: 'Sun', value: 19 },
          ],
        },
      ]),
  },
  {
    name: 'LineChart',
    description: 'Line / sparkline for time series.',
    category: 'data',
    build: () =>
      surface([
        {
          id: 'root',
          component: 'LineChart',
          title: 'Weekly revenue',
          data: [
            { label: 'W1', value: 12 },
            { label: 'W2', value: 18 },
            { label: 'W3', value: 16 },
            { label: 'W4', value: 24 },
            { label: 'W5', value: 28 },
            { label: 'W6', value: 32 },
          ],
        },
      ]),
  },
  {
    name: 'Table',
    description: 'Tabular data with columns.',
    category: 'data',
    build: () =>
      surface([
        {
          id: 'root',
          component: 'Table',
          columns: [
            { key: 'name', header: 'Name' },
            { key: 'role', header: 'Role' },
            { key: 'salary', header: 'Salary', align: 'end' },
          ],
          rows: [
            { name: 'Alice', role: 'Engineer', salary: '$120k' },
            { name: 'Bob', role: 'Designer', salary: '$95k' },
            { name: 'Cara', role: 'PM', salary: '$110k' },
          ],
        },
      ]),
  },
  {
    name: 'KeyValueList',
    description: 'List of label/value pairs.',
    category: 'data',
    build: () =>
      surface([
        {
          id: 'root',
          component: 'KeyValueList',
          items: [
            { label: 'Plan', value: 'Pro' },
            { label: 'Status', value: 'Active' },
            { label: 'Renews', value: 'Mar 14, 2026' },
          ],
        },
      ]),
  },
  {
    name: 'Badge',
    description: 'Compact status/numeric label.',
    category: 'data',
    build: () =>
      surface([{ id: 'root', component: 'Badge', text: 'New', appearance: 'filled', color: 'brand' }]),
  },
  {
    name: 'Tag',
    description: 'Selectable chip / filter.',
    category: 'data',
    build: () => surface([{ id: 'root', component: 'Tag', text: 'Featured', selected: true }]),
  },
  {
    name: 'Avatar',
    description: 'Person avatar with initials fallback.',
    category: 'media',
    build: () => surface([{ id: 'root', component: 'Avatar', name: 'Ada Lovelace', size: 48 }]),
  },
  {
    name: 'Image',
    description: 'Image placeholder.',
    category: 'media',
    build: () =>
      surface([
        {
          id: 'root',
          component: 'Image',
          src: 'https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=800',
          description: 'Mountain landscape',
          shape: 'rounded',
        },
      ]),
  },

  // ── Feedback ────────────────────────────────────────────────────
  {
    name: 'MessageBar',
    description: 'Inline notice / alert.',
    category: 'feedback',
    build: () =>
      surface([
        {
          id: 'root',
          component: 'MessageBar',
          intent: 'success',
          title: 'Saved',
          text: 'Your changes have been saved.',
        },
      ]),
  },
  {
    name: 'Spinner',
    description: 'Loading spinner.',
    category: 'feedback',
    build: () => surface([{ id: 'root', component: 'Spinner', label: 'Loading…', size: 'medium' }]),
  },
  {
    name: 'ProgressBar',
    description: 'Determinate progress.',
    category: 'feedback',
    build: () =>
      surface([{ id: 'root', component: 'ProgressBar', label: 'Upload progress', value: 0.62 }]),
  },

  // ── Navigation ──────────────────────────────────────────────────
  {
    name: 'Accordion',
    description: 'Collapsible sections.',
    category: 'navigation',
    build: () =>
      surface([
        {
          id: 'root',
          component: 'Accordion',
          collapsible: true,
          multiple: false,
          defaultOpenValues: ['s1'],
          items: [
            { value: 's1', header: 'Section one', panelChildId: 'p1' },
            { value: 's2', header: 'Section two', panelChildId: 'p2' },
          ],
        },
        { id: 'p1', component: 'Text', text: 'First section content.', variant: 'body1' },
        { id: 'p2', component: 'Text', text: 'Second section content.', variant: 'body1' },
      ]),
  },
  {
    name: 'Link',
    description: 'Hyperlink.',
    category: 'navigation',
    build: () =>
      surface([{ id: 'root', component: 'Link', text: 'Learn more', href: 'https://example.com' }]),
  },
]

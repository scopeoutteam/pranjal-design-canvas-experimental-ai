export interface A2uiAction {
  event: {
    name: string
    context?: Record<string, unknown>
  }
}

export interface A2uiComponent {
  id: string
  component: string
  [key: string]: unknown
}

export interface CreateSurfaceMessage {
  version: 'v0.10'
  createSurface: {
    surfaceId: string
    catalogId: string
  }
}

export interface UpdateComponentsMessage {
  version: 'v0.10'
  updateComponents: {
    surfaceId: string
    components: A2uiComponent[]
  }
}

export type A2uiMessage = CreateSurfaceMessage | UpdateComponentsMessage

export type OnAction = (action: A2uiAction['event']) => void

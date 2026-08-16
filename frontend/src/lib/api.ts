import type {
  ArenaState,
  DatasetResponse,
  GenerateDatasetRequest,
  GraphExplanation,
  InfluenceSummary,
  LabelEfficiencyResponse,
  NodeExplanation,
  ResultExplanation,
  StartArenaRequest,
} from '../types'

const getBaseUrl = (): string => {
  const envUrl = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL) as string | undefined
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '')
  }
  return 'http://127.0.0.1:8000'
}

const DEFAULT_BASE_URL = getBaseUrl()

export class ApiClient {
  constructor(private baseUrl: string = DEFAULT_BASE_URL) {
    this.baseUrl = this.baseUrl.replace(/\/+$/, '')
  }

  async generateDataset(request: GenerateDatasetRequest): Promise<DatasetResponse> {
    const response = await fetch(`${this.baseUrl}/api/datasets/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error(`Failed to generate dataset: ${response.statusText}`)
    return response.json()
  }

  async uploadDataset(file: File, labelFraction: number): Promise<DatasetResponse> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('label_fraction', String(labelFraction))
    const response = await fetch(`${this.baseUrl}/api/datasets/upload`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) throw new Error(`Failed to upload dataset: ${response.statusText}`)
    return response.json()
  }

  async runLabelEfficiency(sessionId: string, fractions: number[]): Promise<LabelEfficiencyResponse> {
    const response = await fetch(`${this.baseUrl}/api/experiments/${sessionId}/label-efficiency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fractions }),
    })
    if (!response.ok) throw new Error(`Failed to run label efficiency sweep: ${response.statusText}`)
    return response.json()
  }

  // ------------------------------------------------------ interpretability

  explainGraph(sessionId: string): Promise<GraphExplanation> {
    return this.get(`/api/explain/${sessionId}/graph`, 'graph diagnostics')
  }

  explainInfluence(sessionId: string): Promise<InfluenceSummary> {
    return this.get(`/api/explain/${sessionId}/influence`, 'influence summary')
  }

  explainNode(sessionId: string, nodeId: number): Promise<NodeExplanation> {
    return this.get(`/api/explain/${sessionId}/node/${nodeId}`, 'node explanation')
  }

  explainResult(sessionId: string): Promise<ResultExplanation> {
    return this.get(`/api/explain/${sessionId}/result`, 'result diagnostics')
  }

  // ------------------------------------------------------- active learning

  startArena(sessionId: string, request: StartArenaRequest): Promise<ArenaState> {
    return this.post(`/api/arena/${sessionId}/start`, request, 'start the arena')
  }

  stepArena(sessionId: string): Promise<ArenaState> {
    return this.post(`/api/arena/${sessionId}/step`, {}, 'advance the arena')
  }

  getArena(sessionId: string): Promise<ArenaState> {
    return this.get(`/api/arena/${sessionId}`, 'arena state')
  }

  async resetArena(sessionId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/arena/${sessionId}`, { method: 'DELETE' })
  }

  // ---------------------------------------------------------------- shared

  private async get<T>(path: string, what: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`)
    if (!response.ok) throw new Error(await this.reason(response, what))
    return response.json()
  }

  private async post<T>(path: string, body: unknown, what: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(await this.reason(response, what))
    return response.json()
  }

  /** The API explains refusals in `detail`; surface that rather than a bare status. */
  private async reason(response: Response, what: string): Promise<string> {
    try {
      const body = await response.json()
      if (typeof body?.detail === 'string') return body.detail
    } catch {
      /* fall through to the status line */
    }
    return `Failed to load ${what}: ${response.statusText}`
  }

  graphSocketUrl(sessionId: string): string {
    return `${this.wsBase()}/ws/graph/${sessionId}`
  }

  propagateSocketUrl(sessionId: string): string {
    return `${this.wsBase()}/ws/propagate/${sessionId}`
  }

  private wsBase(): string {
    if (this.baseUrl.startsWith('http://') || this.baseUrl.startsWith('https://')) {
      return this.baseUrl.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://')
    }
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${protocol}//${window.location.host}${this.baseUrl}`
    }
    return 'ws://127.0.0.1:8000'
  }
}

export const apiClient = new ApiClient()

export interface Alert {
  id: string
  timestamp: string
  type: string
  confidence: number
  source: 'audio' | 'video' | 'both'
  frame_url?: string
  audio_event?: string
  frame_file?: string
  audio_file?: string
}

export interface Stats {
  total: number
  by_type: Record<string, number>
  by_source: Record<string, number>
  hourly_24h: Array<{ hour: string; count: number }>
  daily_7d: Array<{ date: string; count: number }>
  cameras_online: number
}

export interface Camera {
  id: string
  name: string
  url: string
  active: boolean
}

export interface DetectionResult {
  type: string
  confidence: number
  source: string
  timestamp: string
  frame_index?: number
  note?: string
}

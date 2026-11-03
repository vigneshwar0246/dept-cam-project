export type PageKey = 'overview' | 'monitoring' | 'cameras' | 'events' | 'analytics' | 'settings'
export type CameraStatus = 'Online' | 'Offline' | 'Connecting'
export type CameraType = 'Laptop Webcam' | 'CCTV / RTSP Camera' | 'Mobile Camera' | 'IP Camera'

export interface Camera {
  id: string
  name: string
  type: CameraType
  zone: string
  location: string
  connectionMethod: string
  connectionDetails: string
  status: CameraStatus
  enabled: boolean
  addedDate: string
  lastActive: string
}

export interface Zone { id: string; name: string; occupancy: number; capacity: number }

export interface OccupancyEvent {
  id: string
  timestamp: string
  camera: string
  zone: string
  trackingId: string
  type: 'ENTRY' | 'EXIT'
  direction: string
  status: 'Verified' | 'Pending'
}

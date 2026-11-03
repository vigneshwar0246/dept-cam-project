import type { Camera, OccupancyEvent, Zone } from '../types'

export const initialZones: Zone[] = [
  { id: 'main-entrance', name: 'Main Entrance', occupancy: 12, capacity: 30 },
  { id: 'ai-lab', name: 'AI Lab', occupancy: 28, capacity: 35 },
  { id: 'computer-lab', name: 'Computer Lab', occupancy: 42, capacity: 50 },
  { id: 'seminar-hall', name: 'Seminar Hall', occupancy: 36, capacity: 80 },
  { id: 'corridor', name: 'Department Corridor', occupancy: 9, capacity: 25 },
]

export const initialCameras: Camera[] = [
  { id: 'CAM-001', name: 'Main Entrance Camera', type: 'CCTV / RTSP Camera', zone: 'Main Entrance', location: 'Ground floor entrance', connectionMethod: 'RTSP stream', connectionDetails: 'Stored securely', status: 'Online', enabled: true, addedDate: '2026-10-12', lastActive: 'Just now' },
  { id: 'CAM-002', name: 'AI Lab Camera', type: 'IP Camera', zone: 'AI Lab', location: 'North wall', connectionMethod: 'IP stream', connectionDetails: 'Stored securely', status: 'Online', enabled: true, addedDate: '2026-10-14', lastActive: '12 sec ago' },
  { id: 'CAM-003', name: 'Computer Lab Camera', type: 'Laptop Webcam', zone: 'Computer Lab', location: 'Lecturer station', connectionMethod: 'Device index 0', connectionDetails: '0', status: 'Online', enabled: true, addedDate: '2026-10-20', lastActive: '18 sec ago' },
  { id: 'CAM-004', name: 'Department Corridor Camera', type: 'CCTV / RTSP Camera', zone: 'Department Corridor', location: 'First floor corridor', connectionMethod: 'RTSP stream', connectionDetails: 'Stored securely', status: 'Connecting', enabled: true, addedDate: '2026-10-25', lastActive: '4 min ago' },
  { id: 'CAM-005', name: 'Seminar Hall Camera', type: 'IP Camera', zone: 'Seminar Hall', location: 'Rear wall', connectionMethod: 'IP stream', connectionDetails: 'Stored securely', status: 'Offline', enabled: false, addedDate: '2026-10-28', lastActive: '2 hr ago' },
]

const eventZones = initialZones.map((zone) => zone.name)
const eventCameras = initialCameras.map((camera) => camera.name)
export const events: OccupancyEvent[] = Array.from({ length: 38 }, (_, index) => ({
  id: `EVT-${String(1098 - index).padStart(4, '0')}`,
  timestamp: `2026-11-03 ${String(15 - Math.floor(index / 6)).padStart(2, '0')}:${String(58 - (index * 7) % 58).padStart(2, '0')}`,
  camera: eventCameras[index % eventCameras.length],
  zone: eventZones[index % eventZones.length],
  trackingId: `TRK-${String(8142 + index * 17).slice(-4)}`,
  type: index % 3 === 0 ? 'EXIT' : 'ENTRY',
  direction: index % 3 === 0 ? 'Inside → Outside' : 'Outside → Inside',
  status: index % 11 === 0 ? 'Pending' : 'Verified',
}))

export const occupancyTrend = [
  { time: '08:00', occupancy: 18, entries: 22, exits: 4 }, { time: '09:00', occupancy: 47, entries: 34, exits: 5 },
  { time: '10:00', occupancy: 82, entries: 42, exits: 7 }, { time: '11:00', occupancy: 104, entries: 31, exits: 9 },
  { time: '12:00', occupancy: 91, entries: 18, exits: 31 }, { time: '13:00', occupancy: 76, entries: 14, exits: 29 },
  { time: '14:00', occupancy: 109, entries: 41, exits: 8 }, { time: '15:00', occupancy: 127, entries: 29, exits: 11 },
  { time: '16:00', occupancy: 112, entries: 12, exits: 27 }, { time: '17:00', occupancy: 68, entries: 7, exits: 51 },
]

export const weeklyData = [
  { day: 'Mon', occupancy: 118, entries: 184, exits: 173 }, { day: 'Tue', occupancy: 132, entries: 201, exits: 190 },
  { day: 'Wed', occupancy: 126, entries: 196, exits: 202 }, { day: 'Thu', occupancy: 149, entries: 224, exits: 211 },
  { day: 'Fri', occupancy: 137, entries: 213, exits: 219 }, { day: 'Sat', occupancy: 48, entries: 71, exits: 68 },
  { day: 'Sun', occupancy: 22, entries: 36, exits: 31 },
]

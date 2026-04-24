export type UserRole = 'admin' | 'mitarbeiter' | 'viewer'
export type WorkReportStatus = 'entwurf' | 'abgeschlossen'
export type DeviceStatus =
  | 'lager'
  | 'im_einsatz'
  | 'defekt'
  | 'ausgemustert'
  | 'verkauft'
  | 'reserviert'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  created_at: string
}

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  notes: string | null
  created_at: string
}

export interface ManufacturerRef {
  name: string
}

export interface CategoryRef {
  name: string
  icon: string | null
}

export interface ModelRef {
  modellname: string
  variante: string | null
  manufacturer: ManufacturerRef | null
  category: CategoryRef | null
}

export interface Device {
  id: string
  serial_number: string | null
  status: DeviceStatus
  model: ModelRef | null
}

export interface WorkReport {
  id: string
  report_number: string | null
  customer_id: string
  technician_id: string
  description: string | null
  work_hours: number | null
  travel_from: string | null
  travel_to: string | null
  start_time: string
  end_time: string | null
  status: WorkReportStatus
  technician_signature: string | null
  customer_signature: string | null
  completed_at: string | null
  pdf_path: string | null
  pdf_uploaded_at: string | null
  created_at: string
  updated_at: string
  customer?: Customer
  technician?: Profile
  devices?: Device[]
}

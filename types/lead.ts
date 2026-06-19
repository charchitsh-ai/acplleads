export type FmType = 'CF' | 'MF' | 'DF' | 'SF' | 'Collab'
export type LeadQuality = '#Hot_Lead' | '#Warm_Lead' | '#Cold_Lead' | '#Low_Potential'
export type FollowUpStatus =
  | '#First_Call'
  | '#Followup_1'
  | '#Followup_2'
  | '#Meeting_Scheduled'
  | '#Proposal_Sent'
  | '#Lost'
  | '#Contacted'
export type ObjectionTag =
  | '#Need_More_Time'
  | '#ROI_Concern'
  | '#Investment_Issue'
  | '#Not_Interested'
  | '#Discuss_With_Partner'
  | '#Documents_Pending'

export interface Lead {
  id: string
  created_at: string
  updated_at: string
  s_no?: number
  name: string
  contact?: string
  email?: string
  city?: string
  state?: string
  occupation?: string
  assigned_to?: string
  assigned_user_id?: string
  fbdm?: string
  fm_type?: FmType
  source?: string
  lead_quality?: LeadQuality
  follow_up_status?: FollowUpStatus
  objection_tag?: ObjectionTag
  last_remark?: string
  last_activity?: string
  lead_date?: string
  next_followup_date?: string
}

export type LeadInsert = Omit<Lead, 'id' | 'created_at' | 'updated_at'>

export type UserRole = 'admin' | 'manager' | 'user'

export interface Profile {
  id: string
  created_at: string
  updated_at: string
  email: string
  display_name: string
  role: UserRole
  is_active: boolean
}

export interface LeadActivity {
  id: string
  lead_id: string
  created_at: string
  activity_type: 'remark' | 'created' | 'updated'
  remark: string
  created_by?: string
  next_followup_date?: string
}

export type UserActivityType =
  | 'login'
  | 'logout'
  | 'lead_created'
  | 'lead_updated'
  | 'lead_deleted'
  | 'lead_remark'
  | 'lead_assigned'
  | 'user_created'

export interface UserActivityLog {
  id: string
  created_at: string
  actor_id?: string
  actor_name?: string
  actor_email?: string
  activity_type: UserActivityType
  lead_id?: string
  lead_name?: string
  target_user_id?: string
  target_user_name?: string
  detail: string
}

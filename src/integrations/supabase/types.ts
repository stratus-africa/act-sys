export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          diff: Json | null
          id: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          diff?: Json | null
          id?: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          diff?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      care_plan_tasks: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          created_by: string | null
          frequency: string | null
          id: string
          patient_id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          created_by?: string | null
          frequency?: string | null
          id?: string
          patient_id: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          created_by?: string | null
          frequency?: string | null
          id?: string
          patient_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_signatures: {
        Row: {
          created_at: string
          document_id: string
          id: string
          patient_id: string
          signature_typed: string | null
          signature_url: string | null
          signed_at: string
          signer_id: string | null
          signer_name: string | null
          signer_role: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          patient_id: string
          signature_typed?: string | null
          signature_url?: string | null
          signed_at?: string
          signer_id?: string | null
          signer_name?: string | null
          signer_role: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          patient_id?: string
          signature_typed?: string | null
          signature_url?: string | null
          signed_at?: string
          signer_id?: string | null
          signer_name?: string | null
          signer_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "patient_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      fall_risk_assessments: {
        Row: {
          age_65: boolean
          assessment_date: string
          assessment_type: string
          clinician_id: string | null
          clinician_signature_typed: string | null
          clinician_signature_url: string | null
          cognitive_impairment: boolean
          created_at: string
          environmental_hazards: boolean
          id: string
          incontinence: boolean
          mobility_impairment: boolean
          multiple_diagnoses: boolean
          pain_affecting_function: boolean
          patient_id: string
          patient_signature_typed: string | null
          patient_signature_url: string | null
          polypharmacy: boolean
          prior_falls: boolean
          risk_level: string
          total_score: number
          visual_impairment: boolean
        }
        Insert: {
          age_65?: boolean
          assessment_date?: string
          assessment_type: string
          clinician_id?: string | null
          clinician_signature_typed?: string | null
          clinician_signature_url?: string | null
          cognitive_impairment?: boolean
          created_at?: string
          environmental_hazards?: boolean
          id?: string
          incontinence?: boolean
          mobility_impairment?: boolean
          multiple_diagnoses?: boolean
          pain_affecting_function?: boolean
          patient_id: string
          patient_signature_typed?: string | null
          patient_signature_url?: string | null
          polypharmacy?: boolean
          prior_falls?: boolean
          risk_level?: string
          total_score?: number
          visual_impairment?: boolean
        }
        Update: {
          age_65?: boolean
          assessment_date?: string
          assessment_type?: string
          clinician_id?: string | null
          clinician_signature_typed?: string | null
          clinician_signature_url?: string | null
          cognitive_impairment?: boolean
          created_at?: string
          environmental_hazards?: boolean
          id?: string
          incontinence?: boolean
          mobility_impairment?: boolean
          multiple_diagnoses?: boolean
          pain_affecting_function?: boolean
          patient_id?: string
          patient_signature_typed?: string | null
          patient_signature_url?: string | null
          polypharmacy?: boolean
          prior_falls?: boolean
          risk_level?: string
          total_score?: number
          visual_impairment?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fall_risk_assessments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      hipaa_authorizations: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string | null
          exclude_communicable: boolean | null
          exclude_mental_health: boolean | null
          exclude_other: string | null
          exclude_substance_abuse: boolean | null
          expiry_date: string | null
          expiry_event: string | null
          extent: string | null
          id: string
          patient_id: string
          patient_signature_typed: string | null
          patient_signature_url: string | null
          period_type: string | null
          printed_name: string | null
          provider_name: string | null
          recipient_name: string | null
          relationship: string | null
          revoked_at: string | null
          signed_at: string | null
          start_date: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          exclude_communicable?: boolean | null
          exclude_mental_health?: boolean | null
          exclude_other?: string | null
          exclude_substance_abuse?: boolean | null
          expiry_date?: string | null
          expiry_event?: string | null
          extent?: string | null
          id?: string
          patient_id: string
          patient_signature_typed?: string | null
          patient_signature_url?: string | null
          period_type?: string | null
          printed_name?: string | null
          provider_name?: string | null
          recipient_name?: string | null
          relationship?: string | null
          revoked_at?: string | null
          signed_at?: string | null
          start_date?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          exclude_communicable?: boolean | null
          exclude_mental_health?: boolean | null
          exclude_other?: string | null
          exclude_substance_abuse?: boolean | null
          expiry_date?: string | null
          expiry_event?: string | null
          extent?: string | null
          id?: string
          patient_id?: string
          patient_signature_typed?: string | null
          patient_signature_url?: string | null
          period_type?: string | null
          printed_name?: string | null
          provider_name?: string | null
          recipient_name?: string | null
          relationship?: string | null
          revoked_at?: string | null
          signed_at?: string | null
          start_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hipaa_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_assessments: {
        Row: {
          activities_of_visit: Json | null
          adl_status: Json | null
          assessment_date: string
          cardiovascular: Json | null
          caregiver_names: string | null
          change_log: Json | null
          created_at: string
          diet: Json | null
          gastrointestinal: Json | null
          general_condition: string | null
          genitourinary: Json | null
          health_needs: Json | null
          id: string
          medication_management: string | null
          medications: Json | null
          mental_health: Json | null
          musculoskeletal: Json | null
          neurological: Json | null
          notes: string | null
          nurse_id: string | null
          pain: Json | null
          participant_signature_typed: string | null
          participant_signature_url: string | null
          patient_id: string
          psychosocial: Json | null
          respiratory: Json | null
          rn_signature_typed: string | null
          rn_signature_url: string | null
          sensory: Json | null
          signed_at: string | null
          skin: Json | null
          status: string
          updated_at: string
          visit_type: string
          vitals: Json | null
          weight: Json | null
        }
        Insert: {
          activities_of_visit?: Json | null
          adl_status?: Json | null
          assessment_date?: string
          cardiovascular?: Json | null
          caregiver_names?: string | null
          change_log?: Json | null
          created_at?: string
          diet?: Json | null
          gastrointestinal?: Json | null
          general_condition?: string | null
          genitourinary?: Json | null
          health_needs?: Json | null
          id?: string
          medication_management?: string | null
          medications?: Json | null
          mental_health?: Json | null
          musculoskeletal?: Json | null
          neurological?: Json | null
          notes?: string | null
          nurse_id?: string | null
          pain?: Json | null
          participant_signature_typed?: string | null
          participant_signature_url?: string | null
          patient_id: string
          psychosocial?: Json | null
          respiratory?: Json | null
          rn_signature_typed?: string | null
          rn_signature_url?: string | null
          sensory?: Json | null
          signed_at?: string | null
          skin?: Json | null
          status?: string
          updated_at?: string
          visit_type: string
          vitals?: Json | null
          weight?: Json | null
        }
        Update: {
          activities_of_visit?: Json | null
          adl_status?: Json | null
          assessment_date?: string
          cardiovascular?: Json | null
          caregiver_names?: string | null
          change_log?: Json | null
          created_at?: string
          diet?: Json | null
          gastrointestinal?: Json | null
          general_condition?: string | null
          genitourinary?: Json | null
          health_needs?: Json | null
          id?: string
          medication_management?: string | null
          medications?: Json | null
          mental_health?: Json | null
          musculoskeletal?: Json | null
          neurological?: Json | null
          notes?: string | null
          nurse_id?: string | null
          pain?: Json | null
          participant_signature_typed?: string | null
          participant_signature_url?: string | null
          patient_id?: string
          psychosocial?: Json | null
          respiratory?: Json | null
          rn_signature_typed?: string | null
          rn_signature_url?: string | null
          sensory?: Json | null
          signed_at?: string | null
          skin?: Json | null
          status?: string
          updated_at?: string
          visit_type?: string
          vitals?: Json | null
          weight?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_assessments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_assignments: {
        Row: {
          assigned_at: string
          id: string
          patient_id: string
          role: Database["public"]["Enums"]["app_role"]
          staff_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          patient_id: string
          role: Database["public"]["Enums"]["app_role"]
          staff_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          patient_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_consents: {
        Row: {
          advance_directive: boolean
          agency_signature_typed: string | null
          agency_signature_url: string | null
          consent_emergency: boolean
          consent_payment: boolean
          consent_privacy: boolean
          consent_services: boolean
          created_at: string
          created_by: string | null
          id: string
          patient_id: string
          patient_signature_typed: string | null
          patient_signature_url: string | null
          signed_at: string | null
          ssn_full: string | null
          start_of_care: string | null
          status: string
        }
        Insert: {
          advance_directive?: boolean
          agency_signature_typed?: string | null
          agency_signature_url?: string | null
          consent_emergency?: boolean
          consent_payment?: boolean
          consent_privacy?: boolean
          consent_services?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          patient_id: string
          patient_signature_typed?: string | null
          patient_signature_url?: string | null
          signed_at?: string | null
          ssn_full?: string | null
          start_of_care?: string | null
          status?: string
        }
        Update: {
          advance_directive?: boolean
          agency_signature_typed?: string | null
          agency_signature_url?: string | null
          consent_emergency?: boolean
          consent_payment?: boolean
          consent_privacy?: boolean
          consent_services?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          patient_id?: string
          patient_signature_typed?: string | null
          patient_signature_url?: string | null
          signed_at?: string | null
          ssn_full?: string | null
          start_of_care?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_documents: {
        Row: {
          category: string | null
          created_at: string
          file_name: string
          file_path: string
          id: string
          locked: boolean
          mime_type: string | null
          patient_id: string
          required_signers: string[]
          signature_typed: string | null
          signature_url: string | null
          signed_at: string | null
          signed_by: string | null
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          locked?: boolean
          mime_type?: string | null
          patient_id: string
          required_signers?: string[]
          signature_typed?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signed_by?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          locked?: boolean
          mime_type?: string | null
          patient_id?: string
          required_signers?: string[]
          signature_typed?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signed_by?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      patients: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          dnr_status: boolean
          dob: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          first_name: string
          general_condition: string | null
          id: string
          insurance: string | null
          last_name: string
          mrn: string | null
          notes: string | null
          phone: string | null
          primary_physician: string | null
          ssn_last4: string | null
          start_of_care: string | null
          state: string | null
          status: string
          updated_at: string
          user_id: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          dnr_status?: boolean
          dob?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          first_name: string
          general_condition?: string | null
          id?: string
          insurance?: string | null
          last_name: string
          mrn?: string | null
          notes?: string | null
          phone?: string | null
          primary_physician?: string | null
          ssn_last4?: string | null
          start_of_care?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          dnr_status?: boolean
          dob?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          first_name?: string
          general_condition?: string | null
          id?: string
          insurance?: string | null
          last_name?: string
          mrn?: string | null
          notes?: string | null
          phone?: string | null
          primary_physician?: string | null
          ssn_last4?: string | null
          start_of_care?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          license_no: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          license_no?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          license_no?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          completed_at: string
          completed_by: string | null
          id: string
          notes: string | null
          patient_id: string
          task_id: string
        }
        Insert: {
          completed_at?: string
          completed_by?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          task_id: string
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "care_plan_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          hours: number
          id: string
          notes: string | null
          rejection_reason: string | null
          staff_id: string
          status: string
          submitted_at: string | null
          updated_at: string
          week_start: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          hours?: number
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          staff_id: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          week_start: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          hours?: number
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          staff_id?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          week_start?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          check_in_at: string | null
          check_out_at: string | null
          created_at: string
          id: string
          notes: string | null
          patient_id: string
          scheduled_date: string
          scheduled_time: string | null
          staff_id: string | null
          status: string
          updated_at: string
          visit_type: string
        }
        Insert: {
          check_in_at?: string | null
          check_out_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          patient_id: string
          scheduled_date: string
          scheduled_time?: string | null
          staff_id?: string | null
          status?: string
          updated_at?: string
          visit_type?: string
        }
        Update: {
          check_in_at?: string | null
          check_out_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          patient_id?: string
          scheduled_date?: string
          scheduled_time?: string | null
          staff_id?: string | null
          status?: string
          updated_at?: string
          visit_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_has_any_role: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_assigned_to_patient: {
        Args: { _patient_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "rn" | "caregiver" | "patient"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "rn", "caregiver", "patient"],
    },
  },
} as const

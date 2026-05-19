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
      applicant_documents: {
        Row: {
          applicant_id: string
          created_at: string
          data: Json
          file_path: string | null
          id: string
          kind: string
          reviewed_at: string | null
          reviewed_by: string | null
          signature_typed: string | null
          signature_url: string | null
          signed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          applicant_id: string
          created_at?: string
          data?: Json
          file_path?: string | null
          id?: string
          kind: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          signature_typed?: string | null
          signature_url?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          created_at?: string
          data?: Json
          file_path?: string | null
          id?: string
          kind?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          signature_typed?: string | null
          signature_url?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      applicant_skills: {
        Row: {
          applicant_id: string
          checklist_kind: string
          created_at: string
          created_by: string | null
          id: string
          observed_at: string | null
          ratings: Json
          rn_supervisor_name: string | null
          signature_typed: string | null
          signature_url: string | null
          signed_at: string | null
          updated_at: string
        }
        Insert: {
          applicant_id: string
          checklist_kind?: string
          created_at?: string
          created_by?: string | null
          id?: string
          observed_at?: string | null
          ratings?: Json
          rn_supervisor_name?: string | null
          signature_typed?: string | null
          signature_url?: string | null
          signed_at?: string | null
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          checklist_kind?: string
          created_at?: string
          created_by?: string | null
          id?: string
          observed_at?: string | null
          ratings?: Json
          rn_supervisor_name?: string | null
          signature_typed?: string | null
          signature_url?: string | null
          signed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      applicants: {
        Row: {
          address: string | null
          applied_at: string
          availability: Json | null
          city: string | null
          counties_willing: string[] | null
          created_at: string
          created_by: string | null
          dob: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          first_name: string
          hired_at: string | null
          hired_user_id: string | null
          id: string
          interviewer: string | null
          last_name: string
          notes: string | null
          pay_agreement: string | null
          phone: string | null
          position: string
          rejection_reason: string | null
          source: string | null
          ssn_last4: string | null
          state: string | null
          status: string
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          applied_at?: string
          availability?: Json | null
          city?: string | null
          counties_willing?: string[] | null
          created_at?: string
          created_by?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          first_name: string
          hired_at?: string | null
          hired_user_id?: string | null
          id?: string
          interviewer?: string | null
          last_name: string
          notes?: string | null
          pay_agreement?: string | null
          phone?: string | null
          position: string
          rejection_reason?: string | null
          source?: string | null
          ssn_last4?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          applied_at?: string
          availability?: Json | null
          city?: string | null
          counties_willing?: string[] | null
          created_at?: string
          created_by?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          first_name?: string
          hired_at?: string | null
          hired_user_id?: string | null
          id?: string
          interviewer?: string | null
          last_name?: string
          notes?: string | null
          pay_agreement?: string | null
          phone?: string | null
          position?: string
          rejection_reason?: string | null
          source?: string | null
          ssn_last4?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          zip?: string | null
        }
        Relationships: []
      }
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
      care_plan_goals: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          patient_id: string
          priority: string
          source_assessment_id: string | null
          source_assessment_type: string | null
          status: string
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          patient_id: string
          priority?: string
          source_assessment_id?: string | null
          source_assessment_type?: string | null
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          patient_id?: string
          priority?: string
          source_assessment_id?: string | null
          source_assessment_type?: string | null
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      care_plan_interventions: {
        Row: {
          active: boolean
          assigned_role: string | null
          created_at: string
          created_by: string | null
          description: string
          frequency: string | null
          goal_id: string
          id: string
          patient_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          assigned_role?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          frequency?: string | null
          goal_id: string
          id?: string
          patient_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          assigned_role?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          frequency?: string | null
          goal_id?: string
          id?: string
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_plan_interventions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "care_plan_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      care_plan_progress: {
        Row: {
          goal_id: string
          id: string
          note: string
          patient_id: string
          recorded_at: string
          recorded_by: string | null
          status: string
        }
        Insert: {
          goal_id: string
          id?: string
          note: string
          patient_id: string
          recorded_at?: string
          recorded_by?: string | null
          status?: string
        }
        Update: {
          goal_id?: string
          id?: string
          note?: string
          patient_id?: string
          recorded_at?: string
          recorded_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_plan_progress_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "care_plan_goals"
            referencedColumns: ["id"]
          },
        ]
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
      caregiver_assessments: {
        Row: {
          caregiver_id: string | null
          caregiver_name: string | null
          caregiver_signature_typed: string | null
          caregiver_signature_url: string | null
          created_at: string
          general_notes: string | null
          id: string
          nurse_id: string | null
          nurse_name: string | null
          nurse_signature_typed: string | null
          nurse_signature_url: string | null
          patient_id: string
          service_date: string
          signed_at: string | null
          tasks: Json
          updated_at: string
        }
        Insert: {
          caregiver_id?: string | null
          caregiver_name?: string | null
          caregiver_signature_typed?: string | null
          caregiver_signature_url?: string | null
          created_at?: string
          general_notes?: string | null
          id?: string
          nurse_id?: string | null
          nurse_name?: string | null
          nurse_signature_typed?: string | null
          nurse_signature_url?: string | null
          patient_id: string
          service_date?: string
          signed_at?: string | null
          tasks?: Json
          updated_at?: string
        }
        Update: {
          caregiver_id?: string | null
          caregiver_name?: string | null
          caregiver_signature_typed?: string | null
          caregiver_signature_url?: string | null
          created_at?: string
          general_notes?: string | null
          id?: string
          nurse_id?: string | null
          nurse_name?: string | null
          nurse_signature_typed?: string | null
          nurse_signature_url?: string | null
          patient_id?: string
          service_date?: string
          signed_at?: string | null
          tasks?: Json
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
      medication_administrations: {
        Row: {
          administered_at: string
          administered_by: string | null
          created_at: string
          dose_given: string | null
          id: string
          is_prn: boolean
          medication_id: string
          patient_id: string
          prn_reason: string | null
          response_note: string | null
          status: string
        }
        Insert: {
          administered_at?: string
          administered_by?: string | null
          created_at?: string
          dose_given?: string | null
          id?: string
          is_prn?: boolean
          medication_id: string
          patient_id: string
          prn_reason?: string | null
          response_note?: string | null
          status?: string
        }
        Update: {
          administered_at?: string
          administered_by?: string | null
          created_at?: string
          dose_given?: string | null
          id?: string
          is_prn?: boolean
          medication_id?: string
          patient_id?: string
          prn_reason?: string | null
          response_note?: string | null
          status?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          metadata: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
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
      patient_allergies: {
        Row: {
          active: boolean
          allergen: string
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          onset_date: string | null
          patient_id: string
          reaction: string | null
          severity: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          allergen: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          onset_date?: string | null
          patient_id: string
          reaction?: string | null
          severity?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          allergen?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          onset_date?: string | null
          patient_id?: string
          reaction?: string | null
          severity?: string
          updated_at?: string
        }
        Relationships: []
      }
      patient_allergy_events: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          allergy_id: string | null
          before: Json | null
          created_at: string
          id: string
          patient_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          allergy_id?: string | null
          before?: Json | null
          created_at?: string
          id?: string
          patient_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          allergy_id?: string | null
          before?: Json | null
          created_at?: string
          id?: string
          patient_id?: string
        }
        Relationships: []
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
      patient_document_versions: {
        Row: {
          change_note: string | null
          created_at: string
          document_id: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          patient_id: string
          size_bytes: number | null
          uploaded_by: string | null
          version: number
        }
        Insert: {
          change_note?: string | null
          created_at?: string
          document_id: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          patient_id: string
          size_bytes?: number | null
          uploaded_by?: string | null
          version: number
        }
        Update: {
          change_note?: string | null
          created_at?: string
          document_id?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          patient_id?: string
          size_bytes?: number | null
          uploaded_by?: string | null
          version?: number
        }
        Relationships: []
      }
      patient_documents: {
        Row: {
          category: string | null
          created_at: string
          current_version: number
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
          current_version?: number
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
          current_version?: number
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
      patient_medications: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          dose: string | null
          end_date: string | null
          frequency: string | null
          id: string
          instructions: string | null
          name: string
          patient_id: string
          prescriber: string | null
          prn: boolean
          prn_indication: string | null
          route: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          dose?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          name: string
          patient_id: string
          prescriber?: string | null
          prn?: boolean
          prn_indication?: string | null
          route?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          dose?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          name?: string
          patient_id?: string
          prescriber?: string | null
          prn?: boolean
          prn_indication?: string | null
          route?: string | null
          start_date?: string | null
          updated_at?: string
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
          insurance_carrier: string | null
          insurance_group: string | null
          insurance_plan_type: string | null
          insurance_policy: string | null
          insurance_subscriber: string | null
          last_name: string
          mrn: string | null
          notes: string | null
          phone: string | null
          photo_url: string | null
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
          insurance_carrier?: string | null
          insurance_group?: string | null
          insurance_plan_type?: string | null
          insurance_policy?: string | null
          insurance_subscriber?: string | null
          last_name: string
          mrn?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
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
          insurance_carrier?: string | null
          insurance_group?: string | null
          insurance_plan_type?: string | null
          insurance_policy?: string | null
          insurance_subscriber?: string | null
          last_name?: string
          mrn?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
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
          address: string | null
          availability: Json | null
          city: string | null
          counties_willing: string[] | null
          created_at: string
          department: string | null
          dob: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          full_name: string | null
          hire_date: string | null
          hr_notes: string | null
          id: string
          license_no: string | null
          notification_prefs: Json
          pay_rate: number | null
          pay_type: string | null
          phone: string | null
          position: string | null
          ssn_last4: string | null
          state: string | null
          termination_date: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          availability?: Json | null
          city?: string | null
          counties_willing?: string[] | null
          created_at?: string
          department?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          full_name?: string | null
          hire_date?: string | null
          hr_notes?: string | null
          id: string
          license_no?: string | null
          notification_prefs?: Json
          pay_rate?: number | null
          pay_type?: string | null
          phone?: string | null
          position?: string | null
          ssn_last4?: string | null
          state?: string | null
          termination_date?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          availability?: Json | null
          city?: string | null
          counties_willing?: string[] | null
          created_at?: string
          department?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          full_name?: string | null
          hire_date?: string | null
          hr_notes?: string | null
          id?: string
          license_no?: string | null
          notification_prefs?: Json
          pay_rate?: number | null
          pay_type?: string | null
          phone?: string | null
          position?: string | null
          ssn_last4?: string | null
          state?: string | null
          termination_date?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: []
      }
      rn_assessments: {
        Row: {
          assessment_date: string
          created_at: string
          general_notes: string | null
          id: string
          nurse_id: string | null
          nurse_name: string | null
          nurse_signature_typed: string | null
          nurse_signature_url: string | null
          patient_id: string
          patient_name: string | null
          patient_signature_typed: string | null
          patient_signature_url: string | null
          signed_at: string | null
          tasks: Json
          updated_at: string
        }
        Insert: {
          assessment_date?: string
          created_at?: string
          general_notes?: string | null
          id?: string
          nurse_id?: string | null
          nurse_name?: string | null
          nurse_signature_typed?: string | null
          nurse_signature_url?: string | null
          patient_id: string
          patient_name?: string | null
          patient_signature_typed?: string | null
          patient_signature_url?: string | null
          signed_at?: string | null
          tasks?: Json
          updated_at?: string
        }
        Update: {
          assessment_date?: string
          created_at?: string
          general_notes?: string | null
          id?: string
          nurse_id?: string | null
          nurse_name?: string | null
          nurse_signature_typed?: string | null
          nurse_signature_url?: string | null
          patient_id?: string
          patient_name?: string | null
          patient_signature_typed?: string | null
          patient_signature_url?: string | null
          signed_at?: string | null
          tasks?: Json
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permissions: Json
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          permissions?: Json
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          permissions?: Json
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      skin_assessment_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          noted_at: string
          patient_id: string
          remarks: string
          skin_assessment_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          noted_at?: string
          patient_id: string
          remarks: string
          skin_assessment_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          noted_at?: string
          patient_id?: string
          remarks?: string
          skin_assessment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skin_assessment_notes_skin_assessment_id_fkey"
            columns: ["skin_assessment_id"]
            isOneToOne: false
            referencedRelation: "skin_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      skin_assessments: {
        Row: {
          assessment_date: string
          clinician_id: string | null
          clinician_signature_typed: string | null
          clinician_signature_url: string | null
          created_at: string
          general_notes: string | null
          id: string
          markings: Json
          patient_id: string
          pressure_areas: Json
          signed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assessment_date?: string
          clinician_id?: string | null
          clinician_signature_typed?: string | null
          clinician_signature_url?: string | null
          created_at?: string
          general_notes?: string | null
          id?: string
          markings?: Json
          patient_id: string
          pressure_areas?: Json
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assessment_date?: string
          clinician_id?: string | null
          clinician_signature_typed?: string | null
          clinician_signature_url?: string | null
          created_at?: string
          general_notes?: string | null
          id?: string
          markings?: Json
          patient_id?: string
          pressure_areas?: Json
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_credentials: {
        Row: {
          created_at: string
          created_by: string | null
          expires_on: string | null
          file_path: string | null
          id: string
          issued_on: string | null
          kind: string
          name: string
          notes: string | null
          number: string | null
          staff_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_on?: string | null
          file_path?: string | null
          id?: string
          issued_on?: string | null
          kind: string
          name: string
          notes?: string | null
          number?: string | null
          staff_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_on?: string | null
          file_path?: string | null
          id?: string
          issued_on?: string | null
          kind?: string
          name?: string
          notes?: string | null
          number?: string | null
          staff_id?: string
          status?: string
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
          token: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          token?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string | null
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
      timesheet_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          notes: string | null
          timesheet_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          timesheet_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          timesheet_id?: string
        }
        Relationships: []
      }
      timesheets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          availability: Json
          client_name: string | null
          client_signature_typed: string | null
          client_signature_url: string | null
          client_signed_at: string | null
          comments: string | null
          created_at: string
          days: Json
          employee_name: string | null
          employee_signature_typed: string | null
          employee_signature_url: string | null
          employee_signed_at: string | null
          hours: number
          id: string
          notes: string | null
          patient_id: string | null
          rejection_reason: string | null
          staff_id: string
          status: string
          submitted_at: string | null
          tasks: Json
          updated_at: string
          week_start: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          availability?: Json
          client_name?: string | null
          client_signature_typed?: string | null
          client_signature_url?: string | null
          client_signed_at?: string | null
          comments?: string | null
          created_at?: string
          days?: Json
          employee_name?: string | null
          employee_signature_typed?: string | null
          employee_signature_url?: string | null
          employee_signed_at?: string | null
          hours?: number
          id?: string
          notes?: string | null
          patient_id?: string | null
          rejection_reason?: string | null
          staff_id: string
          status?: string
          submitted_at?: string | null
          tasks?: Json
          updated_at?: string
          week_start: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          availability?: Json
          client_name?: string | null
          client_signature_typed?: string | null
          client_signature_url?: string | null
          client_signed_at?: string | null
          comments?: string | null
          created_at?: string
          days?: Json
          employee_name?: string | null
          employee_signature_typed?: string | null
          employee_signature_url?: string | null
          employee_signed_at?: string | null
          hours?: number
          id?: string
          notes?: string | null
          patient_id?: string | null
          rejection_reason?: string | null
          staff_id?: string
          status?: string
          submitted_at?: string | null
          tasks?: Json
          updated_at?: string
          week_start?: string
        }
        Relationships: []
      }
      user_alert_states: {
        Row: {
          alert_key: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_key: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_key?: string
          status?: string
          updated_at?: string
          user_id?: string
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
      user_view_preferences: {
        Row: {
          entity_id: string
          prefs: Json
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          entity_id: string
          prefs?: Json
          scope: string
          updated_at?: string
          user_id: string
        }
        Update: {
          entity_id?: string
          prefs?: Json
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          caregiver_signature_typed: string | null
          caregiver_signature_url: string | null
          check_in_at: string | null
          check_out_at: string | null
          created_at: string
          end_miles: number | null
          id: string
          notes: string | null
          patient_id: string
          patient_signature_typed: string | null
          patient_signature_url: string | null
          scheduled_date: string
          scheduled_time: string | null
          staff_id: string | null
          start_miles: number | null
          status: string
          updated_at: string
          verified_at: string | null
          visit_type: string
        }
        Insert: {
          caregiver_signature_typed?: string | null
          caregiver_signature_url?: string | null
          check_in_at?: string | null
          check_out_at?: string | null
          created_at?: string
          end_miles?: number | null
          id?: string
          notes?: string | null
          patient_id: string
          patient_signature_typed?: string | null
          patient_signature_url?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          staff_id?: string | null
          start_miles?: number | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          visit_type?: string
        }
        Update: {
          caregiver_signature_typed?: string | null
          caregiver_signature_url?: string | null
          check_in_at?: string | null
          check_out_at?: string | null
          created_at?: string
          end_miles?: number | null
          id?: string
          notes?: string | null
          patient_id?: string
          patient_signature_typed?: string | null
          patient_signature_url?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          staff_id?: string | null
          start_miles?: number | null
          status?: string
          updated_at?: string
          verified_at?: string | null
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
      get_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          accepted_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
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

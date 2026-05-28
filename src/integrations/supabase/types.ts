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
      agents: {
        Row: {
          active: boolean
          bank_details: string | null
          code: string
          created_at: string
          discount_pct: number
          email: string | null
          id: string
          name: string
          notes: string | null
          split_pct: number
          website: string | null
        }
        Insert: {
          active?: boolean
          bank_details?: string | null
          code: string
          created_at?: string
          discount_pct?: number
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          split_pct?: number
          website?: string | null
        }
        Update: {
          active?: boolean
          bank_details?: string | null
          code?: string
          created_at?: string
          discount_pct?: number
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          split_pct?: number
          website?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          industry: string | null
          name: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          industry?: string | null
          name?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          industry?: string | null
          name?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      featured_images: {
        Row: {
          created_at: string
          filename: string
          id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: []
      }
      images: {
        Row: {
          admin_notes: string | null
          availability: string
          caption: string | null
          category: string | null
          created_at: string
          featured: boolean
          filename: string
          id: string
          image_number: number
          keyworded_at: string | null
          keywords: string[]
          model_release: boolean
          model_release_pdf_path: string | null
          preview_path: string | null
          pricing_tier: string | null
          processing_attempts: number
          processing_error: string | null
          processing_started_at: string | null
          public: boolean
          storage_path: string
          title: string | null
        }
        Insert: {
          admin_notes?: string | null
          availability?: string
          caption?: string | null
          category?: string | null
          created_at?: string
          featured?: boolean
          filename: string
          id?: string
          image_number: number
          keyworded_at?: string | null
          keywords?: string[]
          model_release?: boolean
          model_release_pdf_path?: string | null
          preview_path?: string | null
          pricing_tier?: string | null
          processing_attempts?: number
          processing_error?: string | null
          processing_started_at?: string | null
          public?: boolean
          storage_path: string
          title?: string | null
        }
        Update: {
          admin_notes?: string | null
          availability?: string
          caption?: string | null
          category?: string | null
          created_at?: string
          featured?: boolean
          filename?: string
          id?: string
          image_number?: number
          keyworded_at?: string | null
          keywords?: string[]
          model_release?: boolean
          model_release_pdf_path?: string | null
          preview_path?: string | null
          pricing_tier?: string | null
          processing_attempts?: number
          processing_error?: string | null
          processing_started_at?: string | null
          public?: boolean
          storage_path?: string
          title?: string | null
        }
        Relationships: []
      }
      page_views: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          id: string
          ip: string
          path: string | null
          referer: string | null
          session_id: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          ip: string
          path?: string | null
          referer?: string | null
          session_id?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          ip?: string
          path?: string | null
          referer?: string | null
          session_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          agent_code: string | null
          agent_id: string | null
          amount: number | null
          created_at: string
          currency: string
          customer_id: string | null
          discount_amount: number | null
          download_count: number
          download_tier: string | null
          duration_months: number | null
          exclusivity: string | null
          id: string
          image_id: string | null
          last_downloaded_at: string | null
          license_ends: string | null
          license_starts: string | null
          status: string
          stripe_payment_id: string | null
          stripe_session_id: string | null
          territory: string | null
          usage_type: string | null
          user_id: string | null
        }
        Insert: {
          agent_code?: string | null
          agent_id?: string | null
          amount?: number | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount_amount?: number | null
          download_count?: number
          download_tier?: string | null
          duration_months?: number | null
          exclusivity?: string | null
          id?: string
          image_id?: string | null
          last_downloaded_at?: string | null
          license_ends?: string | null
          license_starts?: string | null
          status?: string
          stripe_payment_id?: string | null
          stripe_session_id?: string | null
          territory?: string | null
          usage_type?: string | null
          user_id?: string | null
        }
        Update: {
          agent_code?: string | null
          agent_id?: string | null
          amount?: number | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount_amount?: number | null
          download_count?: number
          download_tier?: string | null
          duration_months?: number | null
          exclusivity?: string | null
          id?: string
          image_id?: string | null
          last_downloaded_at?: string | null
          license_ends?: string | null
          license_starts?: string | null
          status?: string
          stripe_payment_id?: string | null
          stripe_session_id?: string | null
          territory?: string | null
          usage_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          value: Json | null
        }
        Insert: {
          key: string
          value?: Json | null
        }
        Update: {
          key?: string
          value?: Json | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      upload_errors: {
        Row: {
          created_at: string
          detected_image_number: number | null
          error_message: string
          filename: string
          id: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          detected_image_number?: number | null
          error_message: string
          filename: string
          id?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          detected_image_number?: number | null
          error_message?: string
          filename?: string
          id?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      visitors: {
        Row: {
          city: string | null
          country: string | null
          first_seen_at: string
          id: string
          ip: string
          last_seen_at: string
          path: string | null
          referer: string | null
          region: string | null
          user_agent: string | null
          visit_count: number
          visit_date: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          first_seen_at?: string
          id?: string
          ip: string
          last_seen_at?: string
          path?: string | null
          referer?: string | null
          region?: string | null
          user_agent?: string | null
          visit_count?: number
          visit_date?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          first_seen_at?: string
          id?: string
          ip?: string
          last_seen_at?: string
          path?: string | null
          referer?: string | null
          region?: string | null
          user_agent?: string | null
          visit_count?: number
          visit_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

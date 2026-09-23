// Gerado a partir do banco Supabase (mercado_facil1010). Não edite manualmente:
// após cada migração, gere novamente com o gerador de tipos do Supabase.
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
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          actor_role: string | null
          after: Json | null
          before: Json | null
          changed_fields: string[] | null
          company_id: string | null
          context: Json
          entity: string
          entity_id: string | null
          id: number
          market_id: string | null
          market_timezone: string | null
          occurred_at: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          changed_fields?: string[] | null
          company_id?: string | null
          context?: Json
          entity: string
          entity_id?: string | null
          id?: never
          market_id?: string | null
          market_timezone?: string | null
          occurred_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          changed_fields?: string[] | null
          company_id?: string | null
          context?: Json
          entity?: string
          entity_id?: string | null
          id?: never
          market_id?: string | null
          market_timezone?: string | null
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          city: string | null
          cnpj: string
          complement: string | null
          created_at: string
          created_by: string | null
          district: string | null
          email: string | null
          has_pos: boolean
          id: string
          legal_name: string
          number: string | null
          phone: string | null
          pos_name: string | null
          product_range: string | null
          segment: string | null
          state: string | null
          state_registration: string | null
          street: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          trade_name: string
          trial_ends_at: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          city?: string | null
          cnpj: string
          complement?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          email?: string | null
          has_pos?: boolean
          id?: string
          legal_name: string
          number?: string | null
          phone?: string | null
          pos_name?: string | null
          product_range?: string | null
          segment?: string | null
          state?: string | null
          state_registration?: string | null
          street?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trade_name: string
          trial_ends_at?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          city?: string | null
          cnpj?: string
          complement?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          email?: string | null
          has_pos?: boolean
          id?: string
          legal_name?: string
          number?: string | null
          phone?: string | null
          pos_name?: string | null
          product_range?: string | null
          segment?: string | null
          state?: string | null
          state_registration?: string | null
          street?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trade_name?: string
          trial_ends_at?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempted_at: string
          email: string
          id: number
          success: boolean
        }
        Insert: {
          attempted_at?: string
          email: string
          id?: never
          success: boolean
        }
        Update: {
          attempted_at?: string
          email?: string
          id?: never
          success?: boolean
        }
        Relationships: []
      }
      markets: {
        Row: {
          area_m2: number | null
          checkouts: number | null
          city: string | null
          cnpj: string | null
          company_id: string
          complement: string | null
          created_at: string
          district: string | null
          email: string | null
          employees: number | null
          has_barcode_readers: boolean
          has_label_printer: boolean
          id: string
          internal_code: string | null
          is_open: boolean
          legal_name: string | null
          name: string
          number: string | null
          opening_hours: string | null
          phone: string | null
          pos_system: string | null
          reference: string | null
          state: string | null
          status: Database["public"]["Enums"]["market_status"]
          street: string | null
          timezone: string
          updated_at: string
          uses_parent_cnpj: boolean
          warehouses: number | null
          zip_code: string | null
        }
        Insert: {
          area_m2?: number | null
          checkouts?: number | null
          city?: string | null
          cnpj?: string | null
          company_id: string
          complement?: string | null
          created_at?: string
          district?: string | null
          email?: string | null
          employees?: number | null
          has_barcode_readers?: boolean
          has_label_printer?: boolean
          id?: string
          internal_code?: string | null
          is_open?: boolean
          legal_name?: string | null
          name: string
          number?: string | null
          opening_hours?: string | null
          phone?: string | null
          pos_system?: string | null
          reference?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["market_status"]
          street?: string | null
          timezone?: string
          updated_at?: string
          uses_parent_cnpj?: boolean
          warehouses?: number | null
          zip_code?: string | null
        }
        Update: {
          area_m2?: number | null
          checkouts?: number | null
          city?: string | null
          cnpj?: string | null
          company_id?: string
          complement?: string | null
          created_at?: string
          district?: string | null
          email?: string | null
          employees?: number | null
          has_barcode_readers?: boolean
          has_label_printer?: boolean
          id?: string
          internal_code?: string | null
          is_open?: boolean
          legal_name?: string | null
          name?: string
          number?: string | null
          opening_hours?: string | null
          phone?: string | null
          pos_system?: string | null
          reference?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["market_status"]
          street?: string | null
          timezone?: string
          updated_at?: string
          uses_parent_cnpj?: boolean
          warehouses?: number | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "markets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      member_markets: {
        Row: {
          created_at: string
          market_id: string
          member_id: string
        }
        Insert: {
          created_at?: string
          market_id: string
          member_id: string
        }
        Update: {
          created_at?: string
          market_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_markets_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_markets_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          birth_date: string | null
          cpf: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_login_lock: { Args: { p_email: string }; Returns: Json }
      create_company: {
        Args: {
          p_city?: string
          p_cnpj: string
          p_complement?: string
          p_district?: string
          p_email?: string
          p_has_pos?: boolean
          p_legal_name: string
          p_number?: string
          p_phone?: string
          p_pos_name?: string
          p_product_range?: string
          p_segment?: string
          p_start_trial?: boolean
          p_state?: string
          p_state_registration?: string
          p_street?: string
          p_trade_name: string
          p_zip_code?: string
        }
        Returns: string
      }
      is_valid_cnpj: { Args: { value: string }; Returns: boolean }
      is_valid_cpf: { Args: { value: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          p_company_id?: string
          p_details?: Json
          p_entity: string
          p_entity_id?: string
          p_market_id?: string
        }
        Returns: number
      }
      log_security_event: {
        Args: { p_details?: Json; p_entity: string }
        Returns: number
      }
      register_login_attempt: {
        Args: { p_email: string; p_success: boolean }
        Returns: undefined
      }
    }
    Enums: {
      account_status: "pending" | "active" | "blocked" | "cancelled"
      audit_action: "insert" | "update" | "delete" | "event"
      market_status:
        | "draft"
        | "awaiting_billing"
        | "active"
        | "suspended"
        | "inactive"
      member_role: "owner" | "manager" | "receiver" | "stocker"
      member_status: "active" | "invited" | "disabled"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "suspended"
        | "cancelled"
        | "expired"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_status: ["pending", "active", "blocked", "cancelled"],
      audit_action: ["insert", "update", "delete", "event"],
      market_status: [
        "draft",
        "awaiting_billing",
        "active",
        "suspended",
        "inactive",
      ],
      member_role: ["owner", "manager", "receiver", "stocker"],
      member_status: ["active", "invited", "disabled"],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "suspended",
        "cancelled",
        "expired",
      ],
    },
  },
} as const

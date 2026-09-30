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
      alerts: {
        Row: {
          alert_type: Database["public"]["Enums"]["alert_type"]
          created_at: string
          discard_note: string | null
          discarded_at: string | null
          discarded_by: string | null
          description: string
          gondola_position_id: string | null
          id: string
          market_id: string
          product_id: string | null
          reference_incident_id: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["alert_status"]
          warehouse_address_id: string | null
        }
        Insert: {
          alert_type: Database["public"]["Enums"]["alert_type"]
          created_at?: string
          discard_note?: string | null
          discarded_at?: string | null
          discarded_by?: string | null
          description: string
          gondola_position_id?: string | null
          id?: string
          market_id: string
          product_id?: string | null
          reference_incident_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          warehouse_address_id?: string | null
        }
        Update: {
          alert_type?: Database["public"]["Enums"]["alert_type"]
          created_at?: string
          discard_note?: string | null
          discarded_at?: string | null
          discarded_by?: string | null
          description?: string
          gondola_position_id?: string | null
          id?: string
          market_id?: string
          product_id?: string | null
          reference_incident_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          warehouse_address_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_warehouse_address_id_fkey"
            columns: ["warehouse_address_id"]
            isOneToOne: false
            referencedRelation: "warehouse_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_gondola_position_id_fkey"
            columns: ["gondola_position_id"]
            isOneToOne: false
            referencedRelation: "gondola_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_reference_incident_id_fkey"
            columns: ["reference_incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
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
      brands: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["support_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["support_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["support_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["support_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["support_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["support_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          billing_cycle_anchor_day: number
          city: string | null
          cnpj: string
          complement: string | null
          coupon_id: string | null
          created_at: string
          created_by: string | null
          district: string | null
          email: string | null
          has_pos: boolean
          id: string
          legal_name: string
          locked_base_price: number | null
          locked_price_per_market: number | null
          loss_adjustment_approval_threshold: number
          near_expiry_priority_days: number
          number: string | null
          phone: string | null
          plan_id: string | null
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
          billing_cycle_anchor_day?: number
          city?: string | null
          cnpj: string
          complement?: string | null
          coupon_id?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          email?: string | null
          has_pos?: boolean
          id?: string
          legal_name: string
          locked_base_price?: number | null
          locked_price_per_market?: number | null
          loss_adjustment_approval_threshold?: number
          near_expiry_priority_days?: number
          number?: string | null
          phone?: string | null
          plan_id?: string | null
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
          billing_cycle_anchor_day?: number
          city?: string | null
          cnpj?: string
          complement?: string | null
          coupon_id?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          email?: string | null
          has_pos?: boolean
          id?: string
          legal_name?: string
          locked_base_price?: number | null
          locked_price_per_market?: number | null
          loss_adjustment_approval_threshold?: number
          near_expiry_priority_days?: number
          number?: string | null
          phone?: string | null
          plan_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "companies_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
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
      coupons: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          eligibility_note: string | null
          id: string
          status: Database["public"]["Enums"]["support_status"]
          times_used: number
          usage_limit: number | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          eligibility_note?: string | null
          id?: string
          status?: Database["public"]["Enums"]["support_status"]
          times_used?: number
          usage_limit?: number | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          discount_type?: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value?: number
          eligibility_note?: string | null
          id?: string
          status?: Database["public"]["Enums"]["support_status"]
          times_used?: number
          usage_limit?: number | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      gondola_positions: {
        Row: {
          aisle: string
          balance_updated_at: string | null
          balance_updated_by: string | null
          capacity: number
          code: string
          created_at: string
          current_balance: number
          gondola_number: string
          id: string
          ideal_quantity: number
          market_id: string
          max_quantity: number
          min_quantity: number
          module_number: number
          position_number: number
          product_id: string | null
          sector: string
          shelf_number: number
          side: string
          status: Database["public"]["Enums"]["support_status"]
          updated_at: string
        }
        Insert: {
          aisle: string
          balance_updated_at?: string | null
          balance_updated_by?: string | null
          capacity: number
          code: string
          created_at?: string
          current_balance?: number
          gondola_number: string
          id?: string
          ideal_quantity?: number
          market_id: string
          max_quantity?: number
          min_quantity?: number
          module_number: number
          position_number: number
          product_id?: string | null
          sector: string
          shelf_number: number
          side: string
          status?: Database["public"]["Enums"]["support_status"]
          updated_at?: string
        }
        Update: {
          aisle?: string
          balance_updated_at?: string | null
          balance_updated_by?: string | null
          capacity?: number
          code?: string
          created_at?: string
          current_balance?: number
          gondola_number?: string
          id?: string
          ideal_quantity?: number
          market_id?: string
          max_quantity?: number
          min_quantity?: number
          module_number?: number
          position_number?: number
          product_id?: string | null
          sector?: string
          shelf_number?: number
          side?: string
          status?: Database["public"]["Enums"]["support_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gondola_positions_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gondola_positions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          assigned_to: string | null
          correction_movement_id: string | null
          counted_quantity: number | null
          created_at: string
          description: string
          difference: number | null
          due_date: string | null
          expected_quantity: number | null
          id: string
          investigation_started_at: string | null
          is_recurring: boolean
          market_id: string
          product_id: string | null
          reference_inventory_count_id: string | null
          reference_lot_id: string | null
          reference_receiving_id: string | null
          reference_sale_event_id: string | null
          reference_task_id: string | null
          reopened_count: number
          resolution: Database["public"]["Enums"]["incident_resolution"] | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          source: Database["public"]["Enums"]["incident_source"]
          status: Database["public"]["Enums"]["incident_status"]
          warehouse_address_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_to?: string | null
          correction_movement_id?: string | null
          counted_quantity?: number | null
          created_at?: string
          description: string
          difference?: number | null
          due_date?: string | null
          expected_quantity?: number | null
          id?: string
          investigation_started_at?: string | null
          is_recurring?: boolean
          market_id: string
          product_id?: string | null
          reference_inventory_count_id?: string | null
          reference_lot_id?: string | null
          reference_receiving_id?: string | null
          reference_sale_event_id?: string | null
          reference_task_id?: string | null
          reopened_count?: number
          resolution?: Database["public"]["Enums"]["incident_resolution"] | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          source: Database["public"]["Enums"]["incident_source"]
          status?: Database["public"]["Enums"]["incident_status"]
          warehouse_address_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_to?: string | null
          correction_movement_id?: string | null
          counted_quantity?: number | null
          created_at?: string
          description?: string
          difference?: number | null
          due_date?: string | null
          expected_quantity?: number | null
          id?: string
          investigation_started_at?: string | null
          is_recurring?: boolean
          market_id?: string
          product_id?: string | null
          reference_inventory_count_id?: string | null
          reference_lot_id?: string | null
          reference_receiving_id?: string | null
          reference_sale_event_id?: string | null
          reference_task_id?: string | null
          reopened_count?: number
          resolution?: Database["public"]["Enums"]["incident_resolution"] | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          source?: Database["public"]["Enums"]["incident_source"]
          status?: Database["public"]["Enums"]["incident_status"]
          warehouse_address_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_warehouse_address_id_fkey"
            columns: ["warehouse_address_id"]
            isOneToOne: false
            referencedRelation: "warehouse_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reference_receiving_id_fkey"
            columns: ["reference_receiving_id"]
            isOneToOne: false
            referencedRelation: "receivings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reference_sale_event_id_fkey"
            columns: ["reference_sale_event_id"]
            isOneToOne: false
            referencedRelation: "sale_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reference_task_id_fkey"
            columns: ["reference_task_id"]
            isOneToOne: false
            referencedRelation: "replenishment_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reference_inventory_count_id_fkey"
            columns: ["reference_inventory_count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reference_lot_id_fkey"
            columns: ["reference_lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_correction_movement_id_fkey"
            columns: ["correction_movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_count_items: {
        Row: {
          counted_quantity: number
          created_at: string
          difference: number | null
          id: string
          inventory_count_id: string
          product_id: string
          resulting_movement_status: string | null
          theoretical_balance: number | null
          updated_at: string
        }
        Insert: {
          counted_quantity: number
          created_at?: string
          difference?: number | null
          id?: string
          inventory_count_id: string
          product_id: string
          resulting_movement_status?: string | null
          theoretical_balance?: number | null
          updated_at?: string
        }
        Update: {
          counted_quantity?: number
          created_at?: string
          difference?: number | null
          id?: string
          inventory_count_id?: string
          product_id?: string
          resulting_movement_status?: string | null
          theoretical_balance?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_items_inventory_count_id_fkey"
            columns: ["inventory_count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          created_at: string
          created_by: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          status: Database["public"]["Enums"]["inventory_count_status"]
          warehouse_address_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["inventory_count_status"]
          warehouse_address_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["inventory_count_status"]
          warehouse_address_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_warehouse_address_id_fkey"
            columns: ["warehouse_address_id"]
            isOneToOne: false
            referencedRelation: "warehouse_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_markets: {
        Row: {
          invite_id: string
          market_id: string
        }
        Insert: {
          invite_id: string
          market_id: string
        }
        Update: {
          invite_id?: string
          market_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_markets_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_markets_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["invite_status"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_company_id_fkey"
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
      lots: {
        Row: {
          batch_number: string
          created_at: string
          expires_at: string | null
          id: string
          product_id: string
          status: Database["public"]["Enums"]["lot_status"]
          updated_at: string
          warehouse_address_id: string
        }
        Insert: {
          batch_number: string
          created_at?: string
          expires_at?: string | null
          id?: string
          product_id: string
          status?: Database["public"]["Enums"]["lot_status"]
          updated_at?: string
          warehouse_address_id: string
        }
        Update: {
          batch_number?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          product_id?: string
          status?: Database["public"]["Enums"]["lot_status"]
          updated_at?: string
          warehouse_address_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_warehouse_address_id_fkey"
            columns: ["warehouse_address_id"]
            isOneToOne: false
            referencedRelation: "warehouse_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      market_products: {
        Row: {
          created_at: string
          id: string
          ideal_quantity: number
          market_id: string
          max_quantity: number
          min_quantity: number
          product_id: string
          reorder_point: number
          status: Database["public"]["Enums"]["market_product_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ideal_quantity: number
          market_id: string
          max_quantity: number
          min_quantity?: number
          product_id: string
          reorder_point?: number
          status?: Database["public"]["Enums"]["market_product_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ideal_quantity?: number
          market_id?: string
          max_quantity?: number
          min_quantity?: number
          product_id?: string
          reorder_point?: number
          status?: Database["public"]["Enums"]["market_product_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_products_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
          pending_billing_amount: number | null
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
          pending_billing_amount?: number | null
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
          pending_billing_amount?: number | null
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
      offline_sync_conflicts: {
        Row: {
          action_type: string
          created_at: string
          error_message: string
          id: string
          market_id: string
          payload: Json
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          submitted_by: string
        }
        Insert: {
          action_type: string
          created_at?: string
          error_message: string
          id?: string
          market_id: string
          payload: Json
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          submitted_by: string
        }
        Update: {
          action_type?: string
          created_at?: string
          error_message?: string
          id?: string
          market_id?: string
          payload?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "offline_sync_conflicts_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      pdv_product_mappings: {
        Row: {
          created_at: string
          created_by: string
          external_product_code: string
          id: string
          market_id: string
          packaging_id: string
          product_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          external_product_code: string
          id?: string
          market_id: string
          packaging_id: string
          product_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          external_product_code?: string
          id?: string
          market_id?: string
          packaging_id?: string
          product_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdv_product_mappings_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdv_product_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdv_product_mappings_packaging_id_fkey"
            columns: ["packaging_id"]
            isOneToOne: false
            referencedRelation: "product_packagings"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_stock_adjustments: {
        Row: {
          created_at: string
          id: string
          lot_id: string | null
          photo_path: string | null
          product_id: string
          quantity: number
          reason: string
          reference: string | null
          requested_by: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          resulting_movement_id: string | null
          status: Database["public"]["Enums"]["pending_adjustment_status"]
          type: Database["public"]["Enums"]["stock_movement_type"]
          warehouse_address_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lot_id?: string | null
          photo_path?: string | null
          product_id: string
          quantity: number
          reason: string
          reference?: string | null
          requested_by: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resulting_movement_id?: string | null
          status?: Database["public"]["Enums"]["pending_adjustment_status"]
          type: Database["public"]["Enums"]["stock_movement_type"]
          warehouse_address_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lot_id?: string | null
          photo_path?: string | null
          product_id?: string
          quantity?: number
          reason?: string
          reference?: string | null
          requested_by?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resulting_movement_id?: string | null
          status?: Database["public"]["Enums"]["pending_adjustment_status"]
          type?: Database["public"]["Enums"]["stock_movement_type"]
          warehouse_address_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_stock_adjustments_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_stock_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_stock_adjustments_resulting_movement_id_fkey"
            columns: ["resulting_movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_stock_adjustments_warehouse_address_id_fkey"
            columns: ["warehouse_address_id"]
            isOneToOne: false
            referencedRelation: "warehouse_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          base_price: number | null
          created_at: string
          created_by: string | null
          description: string | null
          features: string[]
          id: string
          is_default: boolean
          max_markets: number | null
          name: string
          price_per_market: number | null
          requires_payment_method_for_trial: boolean
          status: Database["public"]["Enums"]["support_status"]
          trial_days: number
          updated_at: string
        }
        Insert: {
          base_price?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          features?: string[]
          id?: string
          is_default?: boolean
          max_markets?: number | null
          name: string
          price_per_market?: number | null
          requires_payment_method_for_trial?: boolean
          status?: Database["public"]["Enums"]["support_status"]
          trial_days?: number
          updated_at?: string
        }
        Update: {
          base_price?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          features?: string[]
          id?: string
          is_default?: boolean
          max_markets?: number | null
          name?: string
          price_per_market?: number | null
          requires_payment_method_for_trial?: boolean
          status?: Database["public"]["Enums"]["support_status"]
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
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
      product_packagings: {
        Row: {
          barcode: string | null
          conversion_factor: number
          created_at: string
          id: string
          is_base: boolean
          name: string
          product_id: string
          status: Database["public"]["Enums"]["support_status"]
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          conversion_factor: number
          created_at?: string
          id?: string
          is_base?: boolean
          name: string
          product_id: string
          status?: Database["public"]["Enums"]["support_status"]
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          conversion_factor?: number
          created_at?: string
          id?: string
          is_base?: boolean
          name?: string
          product_id?: string
          status?: Database["public"]["Enums"]["support_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_packagings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          base_unit: string
          brand_id: string | null
          category_id: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_weighable: boolean
          name: string
          sale_price: number | null
          sku: string | null
          status: Database["public"]["Enums"]["support_status"]
          tracks_batch_expiry: boolean
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          base_unit: string
          brand_id?: string | null
          category_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_weighable?: boolean
          name: string
          sale_price?: number | null
          sku?: string | null
          status?: Database["public"]["Enums"]["support_status"]
          tracks_batch_expiry?: boolean
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          base_unit?: string
          brand_id?: string | null
          category_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_weighable?: boolean
          name?: string
          sale_price?: number | null
          sku?: string | null
          status?: Database["public"]["Enums"]["support_status"]
          tracks_batch_expiry?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      receiving_counted_items: {
        Row: {
          attempt: number
          base_quantity: number
          batch_number: string | null
          condition: Database["public"]["Enums"]["receiving_item_condition"]
          counted_quantity: number
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          manufactured_at: string | null
          note: string | null
          packaging_id: string
          photo_path: string | null
          product_id: string
          receiving_id: string
          rejected: boolean
          rejected_at: string | null
          rejected_by: string | null
          rejection_photo_path: string | null
          rejection_reason: string | null
        }
        Insert: {
          attempt?: number
          base_quantity: number
          batch_number?: string | null
          condition?: Database["public"]["Enums"]["receiving_item_condition"]
          counted_quantity: number
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          manufactured_at?: string | null
          note?: string | null
          packaging_id: string
          photo_path?: string | null
          product_id: string
          receiving_id: string
          rejected?: boolean
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_photo_path?: string | null
          rejection_reason?: string | null
        }
        Update: {
          attempt?: number
          base_quantity?: number
          batch_number?: string | null
          condition?: Database["public"]["Enums"]["receiving_item_condition"]
          counted_quantity?: number
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          manufactured_at?: string | null
          note?: string | null
          packaging_id?: string
          photo_path?: string | null
          product_id?: string
          receiving_id?: string
          rejected?: boolean
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_photo_path?: string | null
          rejection_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receiving_counted_items_packaging_id_fkey"
            columns: ["packaging_id"]
            isOneToOne: false
            referencedRelation: "product_packagings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_counted_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_counted_items_receiving_id_fkey"
            columns: ["receiving_id"]
            isOneToOne: false
            referencedRelation: "receivings"
            referencedColumns: ["id"]
          },
        ]
      }
      receiving_items: {
        Row: {
          created_at: string
          expected_quantity: number
          id: string
          product_id: string
          receiving_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expected_quantity: number
          id?: string
          product_id: string
          receiving_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expected_quantity?: number
          id?: string
          product_id?: string
          receiving_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receiving_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_items_receiving_id_fkey"
            columns: ["receiving_id"]
            isOneToOne: false
            referencedRelation: "receivings"
            referencedColumns: ["id"]
          },
        ]
      }
      receivings: {
        Row: {
          active_attempt: number
          conference_started_at: string | null
          conference_started_by: string | null
          created_at: string
          created_by: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          invoice_number: string | null
          market_id: string
          no_invoice_reason: string | null
          order_reference: string | null
          recount_count: number
          rejected_at: string | null
          rejected_by: string | null
          rejection_photo_path: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["receiving_status"]
          supplier_id: string | null
        }
        Insert: {
          active_attempt?: number
          conference_started_at?: string | null
          conference_started_by?: string | null
          created_at?: string
          created_by: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          invoice_number?: string | null
          market_id: string
          no_invoice_reason?: string | null
          order_reference?: string | null
          recount_count?: number
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_photo_path?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["receiving_status"]
          supplier_id?: string | null
        }
        Update: {
          active_attempt?: number
          conference_started_at?: string | null
          conference_started_by?: string | null
          created_at?: string
          created_by?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          invoice_number?: string | null
          market_id?: string
          no_invoice_reason?: string | null
          order_reference?: string | null
          recount_count?: number
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_photo_path?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["receiving_status"]
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receivings_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      receiving_recount_requests: {
        Row: {
          attempt: number
          id: string
          product_ids: string[]
          reason: string
          receiving_id: string
          requested_at: string
          requested_by: string
        }
        Insert: {
          attempt: number
          id?: string
          product_ids: string[]
          reason: string
          receiving_id: string
          requested_at?: string
          requested_by: string
        }
        Update: {
          attempt?: number
          id?: string
          product_ids?: string[]
          reason?: string
          receiving_id?: string
          requested_at?: string
          requested_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "receiving_recount_requests_receiving_id_fkey"
            columns: ["receiving_id"]
            isOneToOne: false
            referencedRelation: "receivings"
            referencedColumns: ["id"]
          },
        ]
      }
      replenishment_task_counts: {
        Row: {
          attempt: number
          counted_at: string
          counted_by: string
          counted_quantity: number
          id: string
          matches: boolean
          task_id: string
        }
        Insert: {
          attempt: number
          counted_at?: string
          counted_by: string
          counted_quantity: number
          id?: string
          matches: boolean
          task_id: string
        }
        Update: {
          attempt?: number
          counted_at?: string
          counted_by?: string
          counted_quantity?: number
          id?: string
          matches?: boolean
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replenishment_task_counts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "replenishment_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      replenishment_tasks: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          balance_before: number | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          gondola_position_id: string
          id: string
          is_near_expiry: boolean
          is_ruptura: boolean
          last_impediment_at: string | null
          last_impediment_photo_path: string | null
          last_impediment_reason: string | null
          market_id: string
          product_id: string
          quantity_needed: number
          quantity_placed: number | null
          quantity_returned: number | null
          quantity_withdrawn: number | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          return_warehouse_address_id: string | null
          source_warehouse_address_id: string | null
          status: Database["public"]["Enums"]["replenishment_task_status"]
          withdrawal_lot_id: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          balance_before?: number | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          gondola_position_id: string
          id?: string
          is_near_expiry?: boolean
          is_ruptura?: boolean
          last_impediment_at?: string | null
          last_impediment_photo_path?: string | null
          last_impediment_reason?: string | null
          market_id: string
          product_id: string
          quantity_needed: number
          quantity_placed?: number | null
          quantity_returned?: number | null
          quantity_withdrawn?: number | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          return_warehouse_address_id?: string | null
          source_warehouse_address_id?: string | null
          status?: Database["public"]["Enums"]["replenishment_task_status"]
          withdrawal_lot_id?: string | null
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          balance_before?: number | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          gondola_position_id?: string
          id?: string
          is_near_expiry?: boolean
          is_ruptura?: boolean
          last_impediment_at?: string | null
          last_impediment_photo_path?: string | null
          last_impediment_reason?: string | null
          market_id?: string
          product_id?: string
          quantity_needed?: number
          quantity_placed?: number | null
          quantity_returned?: number | null
          quantity_withdrawn?: number | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          return_warehouse_address_id?: string | null
          source_warehouse_address_id?: string | null
          status?: Database["public"]["Enums"]["replenishment_task_status"]
          withdrawal_lot_id?: string | null
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "replenishment_tasks_gondola_position_id_fkey"
            columns: ["gondola_position_id"]
            isOneToOne: false
            referencedRelation: "gondola_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replenishment_tasks_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replenishment_tasks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_event_items: {
        Row: {
          base_quantity: number | null
          external_product_code: string
          gondola_position_id: string | null
          id: string
          packaging_id: string | null
          product_id: string | null
          quantity: number
          sale_event_id: string
          unit_price: number | null
        }
        Insert: {
          base_quantity?: number | null
          external_product_code: string
          gondola_position_id?: string | null
          id?: string
          packaging_id?: string | null
          product_id?: string | null
          quantity: number
          sale_event_id: string
          unit_price?: number | null
        }
        Update: {
          base_quantity?: number | null
          external_product_code?: string
          gondola_position_id?: string | null
          id?: string
          packaging_id?: string | null
          product_id?: string | null
          quantity?: number
          sale_event_id?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_event_items_sale_event_id_fkey"
            columns: ["sale_event_id"]
            isOneToOne: false
            referencedRelation: "sale_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_event_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_event_items_packaging_id_fkey"
            columns: ["packaging_id"]
            isOneToOne: false
            referencedRelation: "product_packagings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_event_items_gondola_position_id_fkey"
            columns: ["gondola_position_id"]
            isOneToOne: false
            referencedRelation: "gondola_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_events: {
        Row: {
          error_message: string | null
          event_type: Database["public"]["Enums"]["sale_event_type"]
          external_event_id: string
          id: string
          market_id: string
          occurred_at: string
          processed_at: string | null
          raw_payload: Json
          received_at: string
          received_by: string
          reference_external_event_id: string | null
          register_code: string
          status: Database["public"]["Enums"]["sale_event_status"]
        }
        Insert: {
          error_message?: string | null
          event_type: Database["public"]["Enums"]["sale_event_type"]
          external_event_id: string
          id?: string
          market_id: string
          occurred_at: string
          processed_at?: string | null
          raw_payload: Json
          received_at?: string
          received_by: string
          reference_external_event_id?: string | null
          register_code: string
          status?: Database["public"]["Enums"]["sale_event_status"]
        }
        Update: {
          error_message?: string | null
          event_type?: Database["public"]["Enums"]["sale_event_type"]
          external_event_id?: string
          id?: string
          market_id?: string
          occurred_at?: string
          processed_at?: string | null
          raw_payload?: Json
          received_at?: string
          received_by?: string
          reference_external_event_id?: string | null
          register_code?: string
          status?: Database["public"]["Enums"]["sale_event_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sale_events_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string
          id: string
          lot_id: string | null
          product_id: string
          quantity: number
          reference: string | null
          reversal_of: string | null
          transfer_id: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
          warehouse_address_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          lot_id?: string | null
          product_id: string
          quantity: number
          reference?: string | null
          reversal_of?: string | null
          transfer_id?: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
          warehouse_address_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          lot_id?: string | null
          product_id?: string
          quantity?: number
          reference?: string | null
          reversal_of?: string | null
          transfer_id?: string | null
          type?: Database["public"]["Enums"]["stock_movement_type"]
          warehouse_address_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "expiring_lots"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "stock_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_address_id_fkey"
            columns: ["warehouse_address_id"]
            isOneToOne: false
            referencedRelation: "warehouse_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          cnpj: string | null
          company_id: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          lead_time_days: number | null
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["support_status"]
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          company_id: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_time_days?: number | null
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["support_status"]
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          company_id?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_time_days?: number | null
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["support_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_addresses: {
        Row: {
          aisle: string
          capacity: number
          code: string
          created_at: string
          id: string
          level: string
          market_id: string
          position: string
          sector: string
          shelf: string
          status: Database["public"]["Enums"]["support_status"]
          street: string
          updated_at: string
          warehouse_name: string
        }
        Insert: {
          aisle: string
          capacity: number
          code: string
          created_at?: string
          id?: string
          level: string
          market_id: string
          position: string
          sector: string
          shelf: string
          status?: Database["public"]["Enums"]["support_status"]
          street: string
          updated_at?: string
          warehouse_name: string
        }
        Update: {
          aisle?: string
          capacity?: number
          code?: string
          created_at?: string
          id?: string
          level?: string
          market_id?: string
          position?: string
          sector?: string
          shelf?: string
          status?: Database["public"]["Enums"]["support_status"]
          street?: string
          updated_at?: string
          warehouse_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_addresses_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      expiring_lots: {
        Row: {
          balance: number | null
          batch_number: string | null
          days_until_expiry: number | null
          expires_at: string | null
          lot_id: string | null
          product_id: string | null
          status: Database["public"]["Enums"]["lot_status"] | null
          warehouse_address_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_warehouse_address_id_fkey"
            columns: ["warehouse_address_id"]
            isOneToOne: false
            referencedRelation: "warehouse_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_balances: {
        Row: {
          balance: number | null
          lot_id: string | null
          product_id: string | null
          warehouse_address_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "expiring_lots"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "stock_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_address_id_fkey"
            columns: ["warehouse_address_id"]
            isOneToOne: false
            referencedRelation: "warehouse_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      market_product_balances: {
        Row: {
          balance: number | null
          market_id: string | null
          product_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_addresses_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_balances: {
        Row: {
          balance: number | null
          product_id: string | null
          warehouse_address_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_address_id_fkey"
            columns: ["warehouse_address_id"]
            isOneToOne: false
            referencedRelation: "warehouse_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: string }
      accept_market_billing: {
        Args: { p_market_id: string }
        Returns: Database["public"]["Tables"]["markets"]["Row"]
      }
      accept_replenishment_task: {
        Args: { p_task_id: string }
        Returns: Database["public"]["Tables"]["replenishment_tasks"]["Row"]
      }
      acknowledge_incident: {
        Args: { p_id: string }
        Returns: Database["public"]["Tables"]["incidents"]["Row"]
      }
      add_receiving_count: {
        Args: {
          p_batch_number?: string
          p_condition?: Database["public"]["Enums"]["receiving_item_condition"]
          p_expires_at?: string
          p_manufactured_at?: string
          p_note?: string
          p_packaging_id: string
          p_photo_path?: string
          p_product_id: string
          p_quantity: number
          p_receiving_id: string
        }
        Returns: Database["public"]["Tables"]["receiving_counted_items"]["Row"]
      }
      add_receiving_item: {
        Args: { p_expected_quantity: number; p_product_id: string; p_receiving_id: string }
        Returns: Database["public"]["Tables"]["receiving_items"]["Row"]
      }
      admin_adjust_trial: {
        Args: { p_company_id: string; p_new_trial_ends_at: string; p_reason: string }
        Returns: undefined
      }
      admin_list_company_audit: {
        Args: { p_company_id: string; p_limit?: number }
        Returns: Database["public"]["Tables"]["audit_log"]["Row"][]
      }
      admin_update_company_plan: {
        Args: { p_company_id: string; p_plan_id: string; p_reason: string }
        Returns: Database["public"]["Tables"]["companies"]["Row"]
      }
      approve_pending_stock_adjustment: {
        Args: { p_id: string; p_note?: string }
        Returns: Database["public"]["Tables"]["stock_movements"]["Row"]
      }
      assign_incident: {
        Args: { p_assignee_user_id: string; p_due_date?: string; p_id: string }
        Returns: Database["public"]["Tables"]["incidents"]["Row"]
      }
      assign_replenishment_task: {
        Args: { p_stocker_user_id: string; p_task_id: string }
        Returns: Database["public"]["Tables"]["replenishment_tasks"]["Row"]
      }
      calculate_market_addition_cost: {
        Args: { p_company_id: string }
        Returns: number
      }
      calculate_subscription_amount: {
        Args: { p_company_id: string }
        Returns: Json
      }
      check_login_lock: { Args: { p_email: string }; Returns: Json }
      create_company: {
        Args: {
          p_city?: string
          p_cnpj: string
          p_complement?: string
          p_coupon_code?: string
          p_district?: string
          p_email?: string
          p_has_pos?: boolean
          p_legal_name: string
          p_number?: string
          p_phone?: string
          p_plan_id?: string
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
      create_coupon: {
        Args: {
          p_code: string
          p_discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          p_discount_value: number
          p_eligibility_note?: string
          p_usage_limit?: number
          p_valid_from?: string
          p_valid_until?: string
        }
        Returns: Database["public"]["Tables"]["coupons"]["Row"]
      }
      create_invite: {
        Args: {
          p_company_id: string
          p_email: string
          p_market_ids: string[]
          p_role: Database["public"]["Enums"]["member_role"]
        }
        Returns: string
      }
      create_pdv_product_mapping: {
        Args: {
          p_external_product_code: string
          p_market_id: string
          p_packaging_id: string
          p_product_id: string
        }
        Returns: Database["public"]["Tables"]["pdv_product_mappings"]["Row"]
      }
      create_plan: {
        Args: {
          p_base_price?: number
          p_description?: string
          p_features?: string[]
          p_max_markets?: number
          p_name: string
          p_price_per_market?: number
          p_requires_payment_method_for_trial?: boolean
          p_trial_days?: number
        }
        Returns: Database["public"]["Tables"]["plans"]["Row"]
      }
      create_receiving: {
        Args: {
          p_invoice_number?: string
          p_market_id: string
          p_no_invoice_reason?: string
          p_order_reference?: string
          p_supplier_id?: string
        }
        Returns: Database["public"]["Tables"]["receivings"]["Row"]
      }
      deactivate_coupon: { Args: { p_id: string }; Returns: undefined }
      decline_market_billing: { Args: { p_market_id: string }; Returns: undefined }
      discard_alert: {
        Args: { p_id: string; p_note?: string }
        Returns: Database["public"]["Tables"]["alerts"]["Row"]
      }
      evaluate_market_billing: {
        Args: { p_market_id: string }
        Returns: Database["public"]["Tables"]["markets"]["Row"]
      }
      finalize_inventory_count: {
        Args: { p_inventory_count_id: string }
        Returns: Database["public"]["Tables"]["inventory_count_items"]["Row"][]
      }
      finalize_receiving: {
        Args: {
          p_destination_warehouse_address_id: string
          p_justification?: string
          p_receiving_id: string
        }
        Returns: Json
      }
      get_company_dashboard: {
        Args: { p_company_id: string; p_days?: number }
        Returns: Json
      }
      get_invite_preview: {
        Args: { p_token: string }
        Returns: {
          company_name: string
          email: string
          expires_at: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["invite_status"]
        }[]
      }
      get_market_dashboard: {
        Args: { p_days?: number; p_market_id: string }
        Returns: Json
      }
      get_or_create_lot: {
        Args: {
          p_batch_number: string
          p_expires_at?: string
          p_product_id: string
          p_warehouse_address_id: string
        }
        Returns: Database["public"]["Tables"]["lots"]["Row"]
      }
      get_platform_indicators: { Args: Record<PropertyKey, never>; Returns: Json }
      get_receiving_comparison: {
        Args: { p_receiving_id: string }
        Returns: {
          counted_quantity: number
          difference: number
          expected_quantity: number
          product_id: string
          product_name: string
        }[]
      }
      get_report: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_market_id: string
          p_product_id?: string
          p_report: string
        }
        Returns: Json
      }
      inactivate_plan: { Args: { p_id: string }; Returns: undefined }
      is_valid_cnpj: { Args: { value: string }; Returns: boolean }
      is_valid_cpf: { Args: { value: string }; Returns: boolean }
      list_alerts: {
        Args: { p_market_id: string }
        Returns: {
          alert_type: Database["public"]["Enums"]["alert_type"]
          created_at: string
          description: string
          discard_note: string | null
          gondola_position_code: string | null
          id: string
          product_id: string | null
          product_name: string | null
          reference_incident_id: string | null
          status: Database["public"]["Enums"]["alert_status"]
          warehouse_address_code: string | null
        }[]
      }
      list_coupons: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Tables"]["coupons"]["Row"][]
      }
      list_incidents: {
        Args: { p_market_id: string }
        Returns: {
          assigned_to: string | null
          counted_quantity: number | null
          created_at: string
          description: string
          difference: number | null
          due_date: string | null
          expected_quantity: number | null
          id: string
          is_recurring: boolean
          product_id: string | null
          product_name: string | null
          reopened_count: number
          resolution: Database["public"]["Enums"]["incident_resolution"] | null
          resolution_note: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          source: Database["public"]["Enums"]["incident_source"]
          status: Database["public"]["Enums"]["incident_status"]
          warehouse_address_code: string | null
        }[]
      }
      list_market_feed: {
        Args: { p_limit?: number; p_market_id: string }
        Returns: {
          detail: string
          kind: string
          occurred_at: string
          title: string
        }[]
      }
      list_pdv_product_mappings: {
        Args: { p_market_id: string }
        Returns: {
          created_at: string
          external_product_code: string
          id: string
          packaging_id: string
          packaging_name: string
          product_id: string
          product_name: string
        }[]
      }
      list_product_sales_ranking: {
        Args: {
          p_days?: number
          p_direction?: string
          p_limit?: number
          p_market_id: string
        }
        Returns: {
          product_id: string
          product_name: string
          quantity_sold: number
        }[]
      }
      list_replenishment_tasks: {
        Args: { p_market_id: string }
        Returns: {
          accepted_by: string | null
          created_at: string
          gondola_position_code: string
          gondola_position_id: string
          id: string
          is_near_expiry: boolean
          is_ruptura: boolean
          last_impediment_reason: string | null
          priority_score: number
          product_barcode: string | null
          product_id: string
          product_name: string
          quantity_needed: number
          quantity_withdrawn: number | null
          status: Database["public"]["Enums"]["replenishment_task_status"]
          waiting_hours: number
        }[]
      }
      list_sale_events: {
        Args: {
          p_market_id: string
          p_status?: Database["public"]["Enums"]["sale_event_status"]
        }
        Returns: {
          error_message: string | null
          event_type: Database["public"]["Enums"]["sale_event_type"]
          external_event_id: string
          id: string
          item_count: number
          occurred_at: string
          received_at: string
          reference_external_event_id: string | null
          register_code: string
          status: Database["public"]["Enums"]["sale_event_status"]
          unmapped_codes: string[] | null
          unpositioned_codes: string[] | null
        }[]
      }
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
      receive_sale_event: {
        Args: {
          p_event_type: Database["public"]["Enums"]["sale_event_type"]
          p_external_event_id: string
          p_items: Json
          p_market_id: string
          p_occurred_at: string
          p_reference_external_event_id?: string
          p_register_code: string
        }
        Returns: Json
      }
      record_gondola_balance: {
        Args: { p_balance: number; p_position_id: string }
        Returns: Json
      }
      record_sync_conflict: {
        Args: {
          p_action_type: string
          p_error_message: string
          p_market_id: string
          p_payload: Json
        }
        Returns: Database["public"]["Tables"]["offline_sync_conflicts"]["Row"]
      }
      register_login_attempt: {
        Args: { p_email: string; p_success: boolean }
        Returns: undefined
      }
      register_replenishment_impediment: {
        Args: { p_photo_path?: string; p_reason: string; p_task_id: string }
        Returns: Database["public"]["Tables"]["replenishment_tasks"]["Row"]
      }
      register_replenishment_return: {
        Args: {
          p_quantity_returned?: number
          p_return_warehouse_address_id?: string
          p_task_id: string
        }
        Returns: Database["public"]["Tables"]["replenishment_tasks"]["Row"]
      }
      register_replenishment_withdrawal: {
        Args: { p_quantity: number; p_source_warehouse_address_id: string; p_task_id: string }
        Returns: Database["public"]["Tables"]["replenishment_tasks"]["Row"]
      }
      register_stock_movement: {
        Args: {
          p_lot_id?: string
          p_photo_path?: string
          p_product_id: string
          p_quantity: number
          p_reason?: string
          p_reference?: string
          p_transfer_id?: string
          p_type: Database["public"]["Enums"]["stock_movement_type"]
          p_warehouse_address_id: string
        }
        Returns: Json
      }
      register_stock_transfer: {
        Args: {
          p_destination_warehouse_address_id: string
          p_product_id: string
          p_quantity: number
          p_reason?: string
          p_reference?: string
          p_source_lot_id?: string
          p_source_warehouse_address_id: string
        }
        Returns: Json
      }
      reject_pending_stock_adjustment: {
        Args: { p_id: string; p_note: string }
        Returns: Database["public"]["Tables"]["pending_stock_adjustments"]["Row"]
      }
      reject_receiving: {
        Args: { p_photo_path?: string; p_reason: string; p_receiving_id: string }
        Returns: Database["public"]["Tables"]["receivings"]["Row"]
      }
      reject_receiving_count: {
        Args: { p_id: string; p_photo_path?: string; p_reason: string }
        Returns: Database["public"]["Tables"]["receiving_counted_items"]["Row"]
      }
      remove_receiving_count: { Args: { p_id: string }; Returns: undefined }
      remove_receiving_item: { Args: { p_id: string }; Returns: undefined }
      reopen_incident: {
        Args: { p_id: string; p_note: string }
        Returns: Database["public"]["Tables"]["incidents"]["Row"]
      }
      reprocess_sale_event: {
        Args: { p_id: string }
        Returns: Database["public"]["Tables"]["sale_events"]["Row"]
      }
      request_receiving_recount: {
        Args: { p_product_ids: string[]; p_reason: string; p_receiving_id: string }
        Returns: Database["public"]["Tables"]["receivings"]["Row"]
      }
      resend_invite: { Args: { p_invite_id: string }; Returns: undefined }
      resolve_incident: {
        Args: {
          p_correction_movement_id?: string
          p_id: string
          p_note: string
          p_resolution: Database["public"]["Enums"]["incident_resolution"]
        }
        Returns: Database["public"]["Tables"]["incidents"]["Row"]
      }
      resolve_replenishment_inconsistency: {
        Args: { p_note: string; p_task_id: string }
        Returns: Database["public"]["Tables"]["replenishment_tasks"]["Row"]
      }
      resolve_sync_conflict: {
        Args: { p_id: string; p_note: string }
        Returns: Database["public"]["Tables"]["offline_sync_conflicts"]["Row"]
      }
      reverse_stock_movement: {
        Args: { p_movement_id: string; p_reason: string }
        Returns: Database["public"]["Tables"]["stock_movements"]["Row"]
      }
      revoke_invite: { Args: { p_invite_id: string }; Returns: undefined }
      set_default_plan: { Args: { p_id: string }; Returns: undefined }
      set_inventory_count_item: {
        Args: { p_inventory_count_id: string; p_product_id: string; p_quantity: number }
        Returns: Database["public"]["Tables"]["inventory_count_items"]["Row"]
      }
      start_incident_investigation: {
        Args: { p_id: string }
        Returns: Database["public"]["Tables"]["incidents"]["Row"]
      }
      start_inventory_count: {
        Args: { p_warehouse_address_id: string }
        Returns: Database["public"]["Tables"]["inventory_counts"]["Row"]
      }
      start_receiving_conference: {
        Args: { p_receiving_id: string }
        Returns: Database["public"]["Tables"]["receivings"]["Row"]
      }
      submit_replenishment_count: {
        Args: { p_counted_quantity: number; p_task_id: string }
        Returns: Json
      }
      sync_alerts: {
        Args: { p_market_id: string }
        Returns: number
      }
      sync_expiry_incidents: {
        Args: { p_market_id: string }
        Returns: number
      }
      update_gondola_position_limits: {
        Args: {
          p_capacity: number
          p_id: string
          p_ideal: number
          p_max: number
          p_min: number
          p_reason: string
        }
        Returns: Database["public"]["Tables"]["gondola_positions"]["Row"]
      }
      update_lot_expiry: {
        Args: { p_expires_at: string; p_id: string; p_reason: string }
        Returns: Database["public"]["Tables"]["lots"]["Row"]
      }
      update_plan: {
        Args: {
          p_base_price?: number
          p_description?: string
          p_features?: string[]
          p_id: string
          p_max_markets?: number
          p_name: string
          p_price_per_market?: number
          p_requires_payment_method_for_trial?: boolean
          p_trial_days?: number
        }
        Returns: Database["public"]["Tables"]["plans"]["Row"]
      }
      update_warehouse_address_capacity: {
        Args: { p_capacity: number; p_id: string; p_reason: string }
        Returns: Database["public"]["Tables"]["warehouse_addresses"]["Row"]
      }
    }
    Enums: {
      account_status: "pending" | "active" | "blocked" | "cancelled"
      alert_status: "aberto" | "resolvido" | "descartado"
      alert_type: "incidente_aberto" | "saldo_negativo" | "gondola_no_minimo"
      audit_action: "insert" | "update" | "delete" | "event"
      coupon_discount_type: "percentual" | "valor_fixo"
      incident_resolution: "corrigida" | "descartada"
      incident_severity: "baixa" | "media" | "alta"
      incident_source: "recebimento" | "reposicao" | "inventario" | "validade" | "venda"
      incident_status: "aberta" | "reconhecida" | "em_investigacao" | "encerrada"
      inventory_count_status: "aberta" | "finalizada"
      invite_status: "pending" | "accepted" | "revoked"
      lot_status: "available" | "blocked"
      market_product_status: "active" | "blocked" | "inactive"
      market_status:
        | "draft"
        | "awaiting_billing"
        | "active"
        | "suspended"
        | "inactive"
      member_role: "owner" | "manager" | "receiver" | "stocker"
      member_status: "active" | "invited" | "disabled"
      pending_adjustment_status: "pending" | "approved" | "rejected"
      receiving_item_condition: "bom_estado" | "avariado" | "embalagem_violada" | "vencido"
      receiving_status:
        | "aguardando_recebimento"
        | "em_conferencia"
        | "com_divergencia"
        | "aguardando_aprovacao"
        | "finalizado"
        | "recusado"
        | "em_recontagem"
      replenishment_task_status:
        | "pendente"
        | "aceita"
        | "em_transito"
        | "com_inconsistencia"
        | "concluida"
      sale_event_status:
        | "recebido"
        | "pendente_mapeamento"
        | "processado"
        | "erro"
        | "pendente_posicao"
      sale_event_type: "venda" | "cancelamento" | "devolucao"
      stock_movement_type:
        | "entrada"
        | "saida"
        | "ajuste"
        | "perda"
        | "devolucao_fornecedor"
        | "transferencia"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "suspended"
        | "cancelled"
        | "expired"
      support_status: "active" | "inactive"
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
      alert_status: ["aberto", "resolvido", "descartado"],
      alert_type: ["incidente_aberto", "saldo_negativo", "gondola_no_minimo"],
      audit_action: ["insert", "update", "delete", "event"],
      coupon_discount_type: ["percentual", "valor_fixo"],
      incident_resolution: ["corrigida", "descartada"],
      incident_severity: ["baixa", "media", "alta"],
      incident_source: ["recebimento", "reposicao", "inventario", "validade", "venda"],
      incident_status: ["aberta", "reconhecida", "em_investigacao", "encerrada"],
      inventory_count_status: ["aberta", "finalizada"],
      invite_status: ["pending", "accepted", "revoked"],
      lot_status: ["available", "blocked"],
      market_product_status: ["active", "blocked", "inactive"],
      market_status: [
        "draft",
        "awaiting_billing",
        "active",
        "suspended",
        "inactive",
      ],
      member_role: ["owner", "manager", "receiver", "stocker"],
      member_status: ["active", "invited", "disabled"],
      pending_adjustment_status: ["pending", "approved", "rejected"],
      receiving_item_condition: ["bom_estado", "avariado", "embalagem_violada", "vencido"],
      receiving_status: [
        "aguardando_recebimento",
        "em_conferencia",
        "com_divergencia",
        "aguardando_aprovacao",
        "finalizado",
        "recusado",
        "em_recontagem",
      ],
      replenishment_task_status: [
        "pendente",
        "aceita",
        "em_transito",
        "com_inconsistencia",
        "concluida",
      ],
      sale_event_status: [
        "recebido",
        "pendente_mapeamento",
        "processado",
        "erro",
        "pendente_posicao",
      ],
      sale_event_type: ["venda", "cancelamento", "devolucao"],
      stock_movement_type: [
        "entrada",
        "saida",
        "ajuste",
        "perda",
        "devolucao_fornecedor",
        "transferencia",
      ],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "suspended",
        "cancelled",
        "expired",
      ],
      support_status: ["active", "inactive"],
    },
  },
} as const

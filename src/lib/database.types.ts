// Generado desde Supabase (proyecto rio-pass). No editar a mano:
// regenerar con `npm run db:types` después de cada migración.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      access_scans: {
        Row: {
          card_id: string | null
          created_at: string
          event_id: string
          id: number
          method: Database["public"]["Enums"]["scan_method"]
          raw_value: string | null
          reason: string | null
          result: Database["public"]["Enums"]["scan_result"]
          scanned_by: string | null
          ticket_id: string | null
          user_id: string | null
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          event_id: string
          id?: never
          method: Database["public"]["Enums"]["scan_method"]
          raw_value?: string | null
          reason?: string | null
          result: Database["public"]["Enums"]["scan_result"]
          scanned_by?: string | null
          ticket_id?: string | null
          user_id?: string | null
        }
        Update: {
          card_id?: string | null
          created_at?: string
          event_id?: string
          id?: never
          method?: Database["public"]["Enums"]["scan_method"]
          raw_value?: string | null
          reason?: string | null
          result?: Database["public"]["Enums"]["scan_result"]
          scanned_by?: string | null
          ticket_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_scans_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "nfc_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_scans_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_scans_scanned_by_fkey"
            columns: ["scanned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_scans_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_scans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendances: {
        Row: {
          created_at: string
          event_id: string
          first_scan_id: number | null
          method: Database["public"]["Enums"]["scan_method"]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          first_scan_id?: number | null
          method: Database["public"]["Enums"]["scan_method"]
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          first_scan_id?: number | null
          method?: Database["public"]["Enums"]["scan_method"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendances_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_first_scan_id_fkey"
            columns: ["first_scan_id"]
            isOneToOne: false
            referencedRelation: "access_scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          rrpp_total_cap: number | null
          attendance_points: number
          capacity: number | null
          created_at: string
          created_by: string | null
          description: string
          ends_at: string | null
          flyer_path: string | null
          id: string
          name: string
          published_at: string | null
          rrpp_invite_quota: number
          season_id: string | null
          slug: string
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
          venue: string
        }
        Insert: {
          rrpp_total_cap?: number | null
          attendance_points?: number
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string | null
          flyer_path?: string | null
          id?: string
          name: string
          published_at?: string | null
          rrpp_invite_quota?: number
          season_id?: string | null
          slug: string
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          venue?: string
        }
        Update: {
          rrpp_total_cap?: number | null
          attendance_points?: number
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string | null
          flyer_path?: string | null
          id?: string
          name?: string
          published_at?: string | null
          rrpp_invite_quota?: number
          season_id?: string | null
          slug?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      nfc_cards: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          blocked_at: string | null
          blocked_reason: string | null
          card_type: Database["public"]["Enums"]["nfc_card_type"]
          created_at: string
          id: string
          key_version: number
          label: string | null
          last_counter: number
          last_tap_at: string | null
          status: Database["public"]["Enums"]["nfc_card_status"]
          uid: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          card_type?: Database["public"]["Enums"]["nfc_card_type"]
          created_at?: string
          id?: string
          key_version?: number
          label?: string | null
          last_counter?: number
          last_tap_at?: string | null
          status?: Database["public"]["Enums"]["nfc_card_status"]
          uid: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          card_type?: Database["public"]["Enums"]["nfc_card_type"]
          created_at?: string
          id?: string
          key_version?: number
          label?: string | null
          last_counter?: number
          last_tap_at?: string | null
          status?: Database["public"]["Enums"]["nfc_card_status"]
          uid?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfc_cards_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfc_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: number
          name: string
          order_id: string
          product_id: string | null
          quantity: number
          ticket_type_id: string | null
          unit_price: number
        }
        Insert: {
          id?: never
          name: string
          order_id: string
          product_id?: string | null
          quantity: number
          ticket_type_id?: string | null
          unit_price: number
        }
        Update: {
          id?: never
          name?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          ticket_type_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          mp_preference_id: string | null
          expires_at: string | null
          attention: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          delivered_by: string | null
          event_id: string | null
          id: string
          kind: Database["public"]["Enums"]["order_kind"]
          paid_at: string | null
          pickup_code: string | null
          status: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          mp_preference_id?: string | null
          expires_at?: string | null
          attention?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          delivered_by?: string | null
          event_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["order_kind"]
          paid_at?: string | null
          pickup_code?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          mp_preference_id?: string | null
          expires_at?: string | null
          attention?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          delivered_by?: string | null
          event_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["order_kind"]
          paid_at?: string | null
          pickup_code?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_delivered_by_fkey"
            columns: ["delivered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          status_detail: string | null
          amount: number
          created_at: string
          currency: string
          id: string
          order_id: string
          provider: string
          provider_payment_id: string | null
          provider_preference_id: string | null
          raw: Json | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          status_detail?: string | null
          amount: number
          created_at?: string
          currency?: string
          id?: string
          order_id: string
          provider?: string
          provider_payment_id?: string | null
          provider_preference_id?: string | null
          raw?: Json | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          status_detail?: string | null
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          provider?: string
          provider_payment_id?: string | null
          provider_preference_id?: string | null
          raw?: Json | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string | null
          id: number
          note: string | null
          order_id: string | null
          points: number
          reason: Database["public"]["Enums"]["points_reason"]
          season_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: never
          note?: string | null
          order_id?: string | null
          points: number
          reason: Database["public"]["Enums"]["points_reason"]
          season_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: never
          note?: string | null
          order_id?: string | null
          points?: number
          reason?: Database["public"]["Enums"]["points_reason"]
          season_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          points_reward: number
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name: string
          points_reward?: number
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          points_reward?: number
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          manager_id: string | null
          avatar_path: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          manager_id?: string | null
          avatar_path?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          manager_id?: string | null
          avatar_path?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rrpp_event_access: {
        Row: {
          enabled: boolean
          event_id: string
          extra: number
          rrpp_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          event_id: string
          extra?: number
          rrpp_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          event_id?: string
          extra?: number
          rrpp_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      seasons: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          is_current: boolean
          name: string
          starts_on: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          is_current?: boolean
          name: string
          starts_on: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          is_current?: boolean
          name?: string
          starts_on?: string
        }
        Relationships: []
      }
      ticket_types: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          event_id: string
          id: string
          is_active: boolean
          name: string
          price: number
          quantity: number | null
          sales_end_at: string | null
          sales_start_at: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          event_id: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          quantity?: number | null
          sales_end_at?: string | null
          sales_start_at?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          event_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          quantity?: number | null
          sales_end_at?: string | null
          sales_start_at?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          transferred_at: string | null
          rrpp_id: string | null
          code: string
          created_at: string
          event_id: string
          holder_email: string | null
          holder_name: string | null
          holder_phone: string | null
          id: string
          issued_by: string | null
          kind: Database["public"]["Enums"]["ticket_kind"]
          order_id: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_type_id: string | null
          updated_at: string
          used_at: string | null
          used_by: string | null
          user_id: string | null
        }
        Insert: {
          transferred_at?: string | null
          rrpp_id?: string | null
          code?: string
          created_at?: string
          event_id: string
          holder_email?: string | null
          holder_name?: string | null
          holder_phone?: string | null
          id?: string
          issued_by?: string | null
          kind: Database["public"]["Enums"]["ticket_kind"]
          order_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_type_id?: string | null
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
          user_id?: string | null
        }
        Update: {
          transferred_at?: string | null
          rrpp_id?: string | null
          code?: string
          created_at?: string
          event_id?: string
          holder_email?: string | null
          holder_name?: string | null
          holder_phone?: string | null
          id?: string
          issued_by?: string | null
          kind?: Database["public"]["Enums"]["ticket_kind"]
          order_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_type_id?: string | null
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_rrpp_id_fkey"
            columns: ["rrpp_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_season_ranking: {
        Args: { _league?: string; _season_id: string }
        Returns: {
          attendances: number
          email: string | null
          full_name: string
          phone: string | null
          points: number
          pos: number
          user_id: string
        }[]
      }
      door_stats: { Args: { _event_id: string }; Returns: Json }
      event_going_counts: {
        Args: { _event_ids: string[] }
        Returns: { event_id: string; going: number }[]
      }
      event_sales_summary: {
        Args: { _event_id: string }
        Returns: {
          name: string
          on_sale: boolean
          price: number
          quantity: number | null
          reserved: number
          revenue: number
          sold: number
          ticket_type_id: string
        }[]
      }
      event_ticket_offer: {
        Args: { _event_id: string }
        Returns: {
          available: number | null
          name: string
          on_sale: boolean
          price: number
          ticket_type_id: string
        }[]
      }
      event_rrpp_board: {
        Args: { _event_id: string }
        Returns: {
          email: string | null
          enabled: boolean
          extra: number
          full_name: string
          issued: number
          manager_id: string | null
          manager_name: string | null
          phone: string | null
          rrpp_id: string
          used: number
        }[]
      }
      my_ranking: { Args: { _season_id?: string }; Returns: Json }
      rrpp_event_status: {
        Args: never
        Returns: {
          cap: number | null
          cap_used: number
          enabled: boolean
          event_id: string
          manager_name: string | null
          pass_code: string | null
          quota: number
          used: number
        }[]
      }
      search_door_guests: {
        Args: { _event_id: string; _query: string }
        Returns: {
          code: string
          holder: string | null
          issuer: string | null
          kind: Database["public"]["Enums"]["ticket_kind"]
          sector: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          used_at: string | null
        }[]
      }
      season_ranking: {
        Args: { _league?: string; _limit?: number; _season_id?: string }
        Returns: {
          attendances: number
          is_me: boolean
          name: string
          points: number
          pos: number
        }[]
      }
      set_rrpp_access: {
        Args: { _enabled: boolean; _event_id: string; _extra?: number; _rrpp_ids: string[] }
        Returns: number
      }
      set_rrpp_manager: {
        Args: { _manager_id: string | null; _rrpp_ids: string[] }
        Returns: number
      }
      set_user_profile: {
        Args: { _profile: Database["public"]["Enums"]["app_role"]; _user_id: string }
        Returns: undefined
      }
      validate_access: {
        Args: {
          _event_id: string
          _method: Database["public"]["Enums"]["scan_method"]
          _value: string
        }
        Returns: Json
      }
      get_ticket_by_code: {
        Args: { _code: string }
        Returns: {
          event_flyer_path: string
          event_name: string
          event_slug: string
          event_starts_at: string
          event_venue: string
          holder_name: string
          kind: Database["public"]["Enums"]["ticket_kind"]
          sector: string
          status: Database["public"]["Enums"]["ticket_status"]
          used_at: string
        }[]
      }
      issue_invitation: {
        Args: {
          _event_id: string
          _holder_email?: string
          _holder_name: string
          _holder_phone?: string
          _ticket_type_id?: string
        }
        Returns: {
          code: string
          created_at: string
          event_id: string
          holder_email: string | null
          holder_name: string | null
          holder_phone: string | null
          id: string
          issued_by: string | null
          kind: Database["public"]["Enums"]["ticket_kind"]
          order_id: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_type_id: string | null
          updated_at: string
          used_at: string | null
          used_by: string | null
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_ticket: { Args: { _ticket_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "cliente" | "rrpp" | "organizador" | "acreditador" | "barra"
      event_status: "borrador" | "publicado" | "cancelado"
      nfc_card_status: "activa" | "bloqueada"
      nfc_card_type: "ntag424_dna" | "generica"
      order_kind: "entradas" | "bebidas"
      order_status:
        | "pendiente"
        | "pagado"
        | "entregado"
        | "cancelado"
        | "reembolsado"
      payment_status:
        | "pendiente"
        | "aprobado"
        | "rechazado"
        | "reembolsado"
        | "cancelado"
      points_reason: "asistencia" | "compra" | "ajuste" | "premio"
      scan_method: "qr" | "nfc" | "manual"
      scan_result: "permitido" | "rechazado"
      ticket_kind: "entrada" | "invitacion" | "rrpp"
      ticket_status: "valido" | "usado" | "anulado"
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
      app_role: ["cliente", "rrpp", "organizador", "acreditador", "barra"],
      event_status: ["borrador", "publicado", "cancelado"],
      nfc_card_status: ["activa", "bloqueada"],
      nfc_card_type: ["ntag424_dna", "generica"],
      order_kind: ["entradas", "bebidas"],
      order_status: [
        "pendiente",
        "pagado",
        "entregado",
        "cancelado",
        "reembolsado",
      ],
      payment_status: [
        "pendiente",
        "aprobado",
        "rechazado",
        "reembolsado",
        "cancelado",
      ],
      points_reason: ["asistencia", "compra", "ajuste", "premio"],
      scan_method: ["qr", "nfc", "manual"],
      scan_result: ["permitido", "rechazado"],
      ticket_kind: ["entrada", "invitacion", "rrpp"],
      ticket_status: ["valido", "usado", "anulado"],
    },
  },
} as const

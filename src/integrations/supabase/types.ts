export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      availability_rules: {
        Row: {
          created_at: string
          day_of_week: number[]
          duration: number | null
          end_time: string
          id: string
          is_active: boolean
          name: string
          start_time: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          day_of_week: number[]
          duration?: number | null
          end_time: string
          id?: string
          is_active?: boolean
          name: string
          start_time: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          day_of_week?: number[]
          duration?: number | null
          end_time?: string
          id?: string
          is_active?: boolean
          name?: string
          start_time?: string
          user_id?: string | null
        }
        Relationships: []
      }
      calendar_connections: {
        Row: {
          access_token: string | null
          calendar_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          last_sync_at: string | null
          provider: string
          refresh_token: string | null
          sync_enabled: boolean | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token?: string | null
          calendar_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          provider: string
          refresh_token?: string | null
          sync_enabled?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token?: string | null
          calendar_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          provider?: string
          refresh_token?: string | null
          sync_enabled?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      google_calendar_events: {
        Row: {
          calendar_id: string
          created_at: string
          end_time: string
          event_id: string
          id: string
          start_time: string
          summary: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          calendar_id: string
          created_at?: string
          end_time: string
          event_id: string
          id?: string
          start_time: string
          summary?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          calendar_id?: string
          created_at?: string
          end_time?: string
          event_id?: string
          id?: string
          start_time?: string
          summary?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          estimated_hours: number
          id: string
          name: string
          priority: number
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_hours: number
          id?: string
          name: string
          priority?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_hours?: number
          id?: string
          name?: string
          priority?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      scheduled_sessions: {
        Row: {
          color: string | null
          created_at: string
          duration: number
          end_time: string
          google_event_id: string | null
          id: string
          priority: number
          project_id: string | null
          project_name: string
          start_time: string
          status: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          duration: number
          end_time: string
          google_event_id?: string | null
          id?: string
          priority: number
          project_id?: string | null
          project_name: string
          start_time: string
          status?: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          duration?: number
          end_time?: string
          google_event_id?: string | null
          id?: string
          priority?: number
          project_id?: string | null
          project_name?: string
          start_time?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

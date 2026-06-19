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
      agenda: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          horario: string | null
          id: string
          local: string | null
          observacoes: string | null
          organization_id: string
          responsavel: string | null
          tipo: Database["public"]["Enums"]["tipo_reuniao"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          horario?: string | null
          id?: string
          local?: string | null
          observacoes?: string | null
          organization_id?: string
          responsavel?: string | null
          tipo?: Database["public"]["Enums"]["tipo_reuniao"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          horario?: string | null
          id?: string
          local?: string | null
          observacoes?: string | null
          organization_id?: string
          responsavel?: string | null
          tipo?: Database["public"]["Enums"]["tipo_reuniao"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimentos: {
        Row: {
          cargo: string | null
          cidade: string | null
          congregacao_origem: string | null
          created_at: string
          culto_id: string
          id: string
          nome: string
          observacoes: string | null
          organization_id: string
        }
        Insert: {
          cargo?: string | null
          cidade?: string | null
          congregacao_origem?: string | null
          created_at?: string
          culto_id: string
          id?: string
          nome: string
          observacoes?: string | null
          organization_id?: string
        }
        Update: {
          cargo?: string | null
          cidade?: string | null
          congregacao_origem?: string | null
          created_at?: string
          culto_id?: string
          id?: string
          nome?: string
          observacoes?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "cultos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      congregacoes: {
        Row: {
          cidade: string | null
          created_at: string
          created_by: string | null
          endereco: string | null
          estado: string | null
          foto_url: string | null
          id: string
          nome: string
          observacoes: string | null
          organization_id: string
          regiao: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          endereco?: string | null
          estado?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          organization_id?: string
          regiao?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          endereco?: string | null
          estado?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          organization_id?: string
          regiao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "congregacoes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      congregacoes_ccb: {
        Row: {
          address: string | null
          cep: string | null
          city: string | null
          code: string
          created_at: string
          cultos: string | null
          id: number
          lat: number
          lng: number
          name: string
          neighborhood: string | null
          rjm: string | null
          uf: string | null
        }
        Insert: {
          address?: string | null
          cep?: string | null
          city?: string | null
          code: string
          created_at?: string
          cultos?: string | null
          id?: number
          lat: number
          lng: number
          name: string
          neighborhood?: string | null
          rjm?: string | null
          uf?: string | null
        }
        Update: {
          address?: string | null
          cep?: string | null
          city?: string | null
          code?: string
          created_at?: string
          cultos?: string | null
          id?: number
          lat?: number
          lng?: number
          name?: string
          neighborhood?: string | null
          rjm?: string | null
          uf?: string | null
        }
        Relationships: []
      }
      cultos: {
        Row: {
          cidade: string | null
          congregacao_id: string | null
          created_at: string
          created_by: string | null
          data: string
          horario: string | null
          id: string
          observacoes: string | null
          organization_id: string
          participantes: number | null
          tipo: Database["public"]["Enums"]["tipo_reuniao"]
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          congregacao_id?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          horario?: string | null
          id?: string
          observacoes?: string | null
          organization_id?: string
          participantes?: number | null
          tipo?: Database["public"]["Enums"]["tipo_reuniao"]
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          congregacao_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          horario?: string | null
          id?: string
          observacoes?: string | null
          organization_id?: string
          participantes?: number | null
          tipo?: Database["public"]["Enums"]["tipo_reuniao"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cultos_congregacao_id_fkey"
            columns: ["congregacao_id"]
            isOneToOne: false
            referencedRelation: "congregacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cultos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cultos_audit: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          changes: Json
          culto_id: string
          id: string
          new_data: Json | null
          old_data: Json | null
          organization_id: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          changes?: Json
          culto_id: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          changes?: Json
          culto_id?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
        }
        Relationships: []
      }
      cultos_inteligentes: {
        Row: {
          audio_mime: string | null
          audio_path: string | null
          audio_size_bytes: number | null
          cidade_detectada: string | null
          congregacao_id: string | null
          created_at: string
          culto_id: string | null
          duracao_segundos: number | null
          encerrado_em: string | null
          erro_mensagem: string | null
          extracao_json: Json | null
          id: string
          iniciado_em: string
          latitude: number | null
          longitude: number | null
          organization_id: string
          status: string
          transcricao_json: Json | null
          transcricao_texto: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_mime?: string | null
          audio_path?: string | null
          audio_size_bytes?: number | null
          cidade_detectada?: string | null
          congregacao_id?: string | null
          created_at?: string
          culto_id?: string | null
          duracao_segundos?: number | null
          encerrado_em?: string | null
          erro_mensagem?: string | null
          extracao_json?: Json | null
          id?: string
          iniciado_em?: string
          latitude?: number | null
          longitude?: number | null
          organization_id?: string
          status?: string
          transcricao_json?: Json | null
          transcricao_texto?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_mime?: string | null
          audio_path?: string | null
          audio_size_bytes?: number | null
          cidade_detectada?: string | null
          congregacao_id?: string | null
          created_at?: string
          culto_id?: string | null
          duracao_segundos?: number | null
          encerrado_em?: string | null
          erro_mensagem?: string | null
          extracao_json?: Json | null
          id?: string
          iniciado_em?: string
          latitude?: number | null
          longitude?: number | null
          organization_id?: string
          status?: string
          transcricao_json?: Json | null
          transcricao_texto?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cultos_inteligentes_congregacao_id_fkey"
            columns: ["congregacao_id"]
            isOneToOne: false
            referencedRelation: "congregacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cultos_inteligentes_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "cultos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cultos_inteligentes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      escalas: {
        Row: {
          created_at: string
          culto_id: string | null
          data: string
          id: string
          musico_id: string
          observacoes: string | null
          organization_id: string
        }
        Insert: {
          created_at?: string
          culto_id?: string | null
          data: string
          id?: string
          musico_id: string
          observacoes?: string | null
          organization_id?: string
        }
        Update: {
          created_at?: string
          culto_id?: string | null
          data?: string
          id?: string
          musico_id?: string
          observacoes?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalas_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "cultos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_musico_id_fkey"
            columns: ["musico_id"]
            isOneToOne: false
            referencedRelation: "musicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hinos: {
        Row: {
          created_at: string
          culto_id: string
          id: string
          momento: Database["public"]["Enums"]["momento_hino"]
          numero: number
          organization_id: string
          titulo: string | null
        }
        Insert: {
          created_at?: string
          culto_id: string
          id?: string
          momento?: Database["public"]["Enums"]["momento_hino"]
          numero: number
          organization_id?: string
          titulo?: string | null
        }
        Update: {
          created_at?: string
          culto_id?: string
          id?: string
          momento?: Database["public"]["Enums"]["momento_hino"]
          numero?: number
          organization_id?: string
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hinos_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "cultos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hinos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      musicos: {
        Row: {
          ativo: boolean
          congregacao_id: string | null
          created_at: string
          id: string
          instrumento: string | null
          nome: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          congregacao_id?: string | null
          created_at?: string
          id?: string
          instrumento?: string | null
          nome: string
          organization_id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          congregacao_id?: string | null
          created_at?: string
          id?: string
          instrumento?: string | null
          nome?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "musicos_congregacao_id_fkey"
            columns: ["congregacao_id"]
            isOneToOne: false
            referencedRelation: "congregacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "musicos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          cidade: string | null
          created_at: string
          estado: string | null
          id: string
          name: string
          plan: Database["public"]["Enums"]["org_plan"]
          plan_status: Database["public"]["Enums"]["org_plan_status"]
          slug: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          timezone: string | null
          trial_ends_at: string
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          estado?: string | null
          id?: string
          name: string
          plan?: Database["public"]["Enums"]["org_plan"]
          plan_status?: Database["public"]["Enums"]["org_plan_status"]
          slug?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          timezone?: string | null
          trial_ends_at?: string
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          created_at?: string
          estado?: string | null
          id?: string
          name?: string
          plan?: Database["public"]["Enums"]["org_plan"]
          plan_status?: Database["public"]["Enums"]["org_plan_status"]
          slug?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          timezone?: string | null
          trial_ends_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      palavras: {
        Row: {
          cargo: string | null
          cidade_origem: string | null
          congregacao_origem: string | null
          created_at: string
          culto_id: string
          id: string
          nome_irmao: string
          observacoes: string | null
          organization_id: string
          resumo: string | null
          tema: string | null
          texto_biblico: string | null
        }
        Insert: {
          cargo?: string | null
          cidade_origem?: string | null
          congregacao_origem?: string | null
          created_at?: string
          culto_id: string
          id?: string
          nome_irmao: string
          observacoes?: string | null
          organization_id?: string
          resumo?: string | null
          tema?: string | null
          texto_biblico?: string | null
        }
        Update: {
          cargo?: string | null
          cidade_origem?: string | null
          congregacao_origem?: string | null
          created_at?: string
          culto_id?: string
          id?: string
          nome_irmao?: string
          observacoes?: string | null
          organization_id?: string
          resumo?: string | null
          tema?: string | null
          texto_biblico?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "palavras_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "cultos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "palavras_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_configs: {
        Row: {
          created_at: string
          cta_label: string
          description: string
          features: Json
          highlight: boolean
          label: string
          period_label: string
          plan: string
          price_label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string
          description?: string
          features?: Json
          highlight?: boolean
          label: string
          period_label?: string
          plan: string
          price_label?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string
          description?: string
          features?: Json
          highlight?: boolean
          label?: string
          period_label?: string
          plan?: string
          price_label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cargo: string | null
          congregacao: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          onboarding_completed: boolean
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          congregacao?: string | null
          created_at?: string
          email?: string | null
          id: string
          nome: string
          onboarding_completed?: boolean
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          congregacao?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          onboarding_completed?: boolean
          updated_at?: string
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
      visitantes: {
        Row: {
          cidade: string | null
          congregacao_origem: string | null
          created_at: string
          culto_id: string | null
          funcao: Database["public"]["Enums"]["funcao_visitante"]
          id: string
          nome: string
          organization_id: string
        }
        Insert: {
          cidade?: string | null
          congregacao_origem?: string | null
          created_at?: string
          culto_id?: string | null
          funcao?: Database["public"]["Enums"]["funcao_visitante"]
          id?: string
          nome: string
          organization_id?: string
        }
        Update: {
          cidade?: string | null
          congregacao_origem?: string | null
          created_at?: string
          culto_id?: string | null
          funcao?: Database["public"]["Enums"]["funcao_visitante"]
          id?: string
          nome?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitantes_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "cultos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitantes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_org:
        | { Args: { _user_id: string }; Returns: boolean }
        | { Args: { _org_id: string; _user_id: string }; Returns: boolean }
      can_manage_org:
        | { Args: { _user_id: string }; Returns: boolean }
        | { Args: { _org_id: string; _user_id: string }; Returns: boolean }
      current_user_org_id: { Args: never; Returns: string }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      has_org_role: {
        Args: {
          _org_id: string
          _roles: Database["public"]["Enums"]["org_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_editor: { Args: { _user_id: string }; Returns: boolean }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "encarregado" | "cooperador" | "usuario"
      funcao_visitante:
        | "irmao"
        | "cooperador"
        | "diacono"
        | "anciao"
        | "encarregado"
        | "cooperador_jovens"
        | "organista"
        | "musico"
        | "outro"
      momento_hino:
        | "entrada"
        | "antes_palavra"
        | "apos_palavra"
        | "encerramento"
        | "outro"
      org_plan: "free" | "pro" | "church"
      org_plan_status:
        | "trialing"
        | "active"
        | "past_due"
        | "cancelled"
        | "expired"
      org_role: "owner" | "admin" | "editor" | "viewer"
      tipo_reuniao:
        | "culto_oficial"
        | "ensaio"
        | "jovens_menores"
        | "santa_ceia"
        | "ministerial"
        | "evangelizacao"
        | "especial"
        | "outro"
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
      app_role: ["admin", "encarregado", "cooperador", "usuario"],
      funcao_visitante: [
        "irmao",
        "cooperador",
        "diacono",
        "anciao",
        "encarregado",
        "cooperador_jovens",
        "organista",
        "musico",
        "outro",
      ],
      momento_hino: [
        "entrada",
        "antes_palavra",
        "apos_palavra",
        "encerramento",
        "outro",
      ],
      org_plan: ["free", "pro", "church"],
      org_plan_status: [
        "trialing",
        "active",
        "past_due",
        "cancelled",
        "expired",
      ],
      org_role: ["owner", "admin", "editor", "viewer"],
      tipo_reuniao: [
        "culto_oficial",
        "ensaio",
        "jovens_menores",
        "santa_ceia",
        "ministerial",
        "evangelizacao",
        "especial",
        "outro",
      ],
    },
  },
} as const

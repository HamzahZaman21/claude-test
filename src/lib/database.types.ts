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
      card_identities: {
        Row: {
          card_id: string
          game_id: string
          identity: Database["public"]["Enums"]["card_identity"]
        }
        Insert: {
          card_id: string
          game_id: string
          identity: Database["public"]["Enums"]["card_identity"]
        }
        Update: {
          card_id?: string
          game_id?: string
          identity?: Database["public"]["Enums"]["card_identity"]
        }
        Relationships: [
          {
            foreignKeyName: "card_identities_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: true
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_identities_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          game_id: string
          id: string
          position: number
          revealed: boolean
          revealed_at: string | null
          revealed_by_team: Database["public"]["Enums"]["team_color"] | null
          revealed_identity: Database["public"]["Enums"]["card_identity"] | null
          word: string
        }
        Insert: {
          game_id: string
          id?: string
          position: number
          revealed?: boolean
          revealed_at?: string | null
          revealed_by_team?: Database["public"]["Enums"]["team_color"] | null
          revealed_identity?:
            | Database["public"]["Enums"]["card_identity"]
            | null
          word: string
        }
        Update: {
          game_id?: string
          id?: string
          position?: number
          revealed?: boolean
          revealed_at?: string | null
          revealed_by_team?: Database["public"]["Enums"]["team_color"] | null
          revealed_identity?:
            | Database["public"]["Enums"]["card_identity"]
            | null
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      clues: {
        Row: {
          created_at: string
          game_id: string
          id: string
          number: number
          team: Database["public"]["Enums"]["team_color"]
          word: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          number: number
          team: Database["public"]["Enums"]["team_color"]
          word: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          number?: number
          team?: Database["public"]["Enums"]["team_color"]
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "clues_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          amber_remaining: number
          created_at: string
          current_clue_id: string | null
          current_team: Database["public"]["Enums"]["team_color"]
          cyan_remaining: number
          guesses_remaining: number
          id: string
          phase: Database["public"]["Enums"]["game_phase"]
          room_id: string
          starting_team: Database["public"]["Enums"]["team_color"]
          turn_deadline: string
          winner: Database["public"]["Enums"]["team_color"] | null
        }
        Insert: {
          amber_remaining: number
          created_at?: string
          current_clue_id?: string | null
          current_team: Database["public"]["Enums"]["team_color"]
          cyan_remaining: number
          guesses_remaining?: number
          id?: string
          phase?: Database["public"]["Enums"]["game_phase"]
          room_id: string
          starting_team: Database["public"]["Enums"]["team_color"]
          turn_deadline: string
          winner?: Database["public"]["Enums"]["team_color"] | null
        }
        Update: {
          amber_remaining?: number
          created_at?: string
          current_clue_id?: string | null
          current_team?: Database["public"]["Enums"]["team_color"]
          cyan_remaining?: number
          guesses_remaining?: number
          id?: string
          phase?: Database["public"]["Enums"]["game_phase"]
          room_id?: string
          starting_team?: Database["public"]["Enums"]["team_color"]
          turn_deadline?: string
          winner?: Database["public"]["Enums"]["team_color"] | null
        }
        Relationships: [
          {
            foreignKeyName: "games_current_clue_fk"
            columns: ["current_clue_id"]
            isOneToOne: false
            referencedRelation: "clues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          auth_user_id: string
          created_at: string
          display_name: string
          id: string
          is_host: boolean
          last_seen_at: string
          role: Database["public"]["Enums"]["player_role"]
          room_id: string
          team: Database["public"]["Enums"]["team_color"]
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          display_name: string
          id?: string
          is_host?: boolean
          last_seen_at?: string
          role?: Database["public"]["Enums"]["player_role"]
          room_id: string
          team?: Database["public"]["Enums"]["team_color"]
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          display_name?: string
          id?: string
          is_host?: boolean
          last_seen_at?: string
          role?: Database["public"]["Enums"]["player_role"]
          room_id?: string
          team?: Database["public"]["Enums"]["team_color"]
        }
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          host_player_id: string | null
          id: string
          status: Database["public"]["Enums"]["room_status"]
        }
        Insert: {
          code: string
          created_at?: string
          host_player_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["room_status"]
        }
        Update: {
          code?: string
          created_at?: string
          host_player_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["room_status"]
        }
        Relationships: [
          {
            foreignKeyName: "rooms_host_player_fk"
            columns: ["host_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      word_pool: {
        Row: {
          word: string
        }
        Insert: {
          word: string
        }
        Update: {
          word?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_room: { Args: { p_display_name: string }; Returns: Json }
      is_game_member: { Args: { p_game: string }; Returns: boolean }
      is_game_spymaster: { Args: { p_game: string }; Returns: boolean }
      is_room_member: { Args: { p_room: string }; Returns: boolean }
      join_room: {
        Args: { p_code: string; p_display_name: string }
        Returns: Json
      }
      rpc_end_turn: { Args: { p_game: string; p_uid: string }; Returns: Json }
      rpc_expire_turn: {
        Args: { p_game: string; p_uid: string }
        Returns: Json
      }
      rpc_rematch: { Args: { p_room: string; p_uid: string }; Returns: Json }
      rpc_reveal_card: {
        Args: { p_card: string; p_game: string; p_uid: string }
        Returns: Json
      }
      rpc_start_game: { Args: { p_room: string; p_uid: string }; Returns: Json }
      rpc_submit_clue: {
        Args: {
          p_game: string
          p_number: number
          p_uid: string
          p_word: string
        }
        Returns: Json
      }
    }
    Enums: {
      card_identity: "cyan" | "amber" | "neutral" | "assassin"
      game_phase: "clue" | "guess" | "finished"
      player_role: "spymaster" | "operative" | "none"
      room_status: "lobby" | "in_game" | "finished"
      team_color: "cyan" | "amber" | "none"
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
      card_identity: ["cyan", "amber", "neutral", "assassin"],
      game_phase: ["clue", "guess", "finished"],
      player_role: ["spymaster", "operative", "none"],
      room_status: ["lobby", "in_game", "finished"],
      team_color: ["cyan", "amber", "none"],
    },
  },
} as const

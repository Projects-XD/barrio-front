/**
 * Tipos de Base de Datos para el proyecto Barrio
 * Mapeo 1:1 estricto con PostgreSQL/Supabase (Migración 0001_initial_schema.sql)
 * Totalmente libre de tipos `any`.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserStatus = 'active' | 'suspended' | 'deleted';
export type OficioCategory =
  | 'gasfiteria'
  | 'carpinteria'
  | 'electricidad'
  | 'cerrajeria'
  | 'clases'
  | 'paseador_mascotas'
  | 'otro';
export type FavorType =
  | 'herramienta'
  | 'ayuda_temporal'
  | 'donacion_materiales'
  | 'intercambio_habilidades'
  | 'movilidad_solidaria'
  | 'otros';
export type FavorStatus = 'abierta' | 'en_curso' | 'cerrada' | 'cancelada';
export type SyncStatus = 'pendiente' | 'enviado' | 'error';
export type EmergencyStatus = 'inactiva' | 'activa';
export type ServiceType =
  | 'salud'
  | 'bomberos'
  | 'policia'
  | 'grupo_apoyo'
  | 'refugio'
  | 'otro';
export type ResourceType =
  | 'agua'
  | 'medicinas'
  | 'generador'
  | 'transporte'
  | 'alimentos'
  | 'otro';
export type ResourceKind = 'pedido' | 'oferta';
export type ReportStatus = 'activo' | 'resuelto' | 'oculto';
export type ReportReason =
  | 'spam'
  | 'contenido_inapropiado'
  | 'datos_falsos'
  | 'acoso'
  | 'otro';
export type NotificationType =
  | 'visto_bueno_recibido'
  | 'interes_en_favor'
  | 'reporte_actualizado'
  | 'emergencia_activada'
  | 'sistema';

export interface Database {
  public: {
    Tables: {
      zones: {
        Row: {
          id: string;
          name: string;
          city: string;
          center_lat: number | null;
          center_lng: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          city: string;
          center_lat?: number | null;
          center_lng?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          city?: string;
          center_lat?: number | null;
          center_lng?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      users: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          zone_id: string | null;
          status: UserStatus;
          is_anonymous_by_default: boolean;
          emergency_role: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          avatar_url?: string | null;
          zone_id?: string | null;
          status?: UserStatus;
          is_anonymous_by_default?: boolean;
          emergency_role?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          avatar_url?: string | null;
          zone_id?: string | null;
          status?: UserStatus;
          is_anonymous_by_default?: boolean;
          emergency_role?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'users_zone_id_fkey';
            columns: ['zone_id'];
            isOneToOne: false;
            referencedRelation: 'zones';
            referencedColumns: ['id'];
          },
        ];
      };

      user_phones: {
        Row: {
          id: string;
          user_id: string;
          phone: string;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          phone: string;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          phone?: string;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_phones_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      oficios: {
        Row: {
          id: string;
          category: OficioCategory;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category: OficioCategory;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category?: OficioCategory;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      professional_profiles: {
        Row: {
          id: string;
          user_id: string;
          oficio_id: string;
          zone_id: string | null;
          description: string | null;
          years_experience: number | null;
          location_lat: number | null;
          location_lng: number | null;
          is_visible: boolean;
          validated_count: number;
          is_validated: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          oficio_id: string;
          zone_id?: string | null;
          description?: string | null;
          years_experience?: number | null;
          location_lat?: number | null;
          location_lng?: number | null;
          is_visible?: boolean;
          validated_count?: number;
          is_validated?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          oficio_id?: string;
          zone_id?: string | null;
          description?: string | null;
          years_experience?: number | null;
          location_lat?: number | null;
          location_lng?: number | null;
          is_visible?: boolean;
          validated_count?: number;
          is_validated?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'professional_profiles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'professional_profiles_oficio_id_fkey';
            columns: ['oficio_id'];
            isOneToOne: false;
            referencedRelation: 'oficios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'professional_profiles_zone_id_fkey';
            columns: ['zone_id'];
            isOneToOne: false;
            referencedRelation: 'zones';
            referencedColumns: ['id'];
          },
        ];
      };

      vouches: {
        Row: {
          id: string;
          profile_id: string;
          voucher_user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          voucher_user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          voucher_user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vouches_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'professional_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vouches_voucher_user_id_fkey';
            columns: ['voucher_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      favors: {
        Row: {
          id: string;
          author_id: string;
          zone_id: string | null;
          type: FavorType;
          title: string;
          description: string | null;
          status: FavorStatus;
          location_lat: number | null;
          location_lng: number | null;
          assigned_to_user_id: string | null;
          client_id: string;
          sync_status: SyncStatus;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          zone_id?: string | null;
          type: FavorType;
          title: string;
          description?: string | null;
          status?: FavorStatus;
          location_lat?: number | null;
          location_lng?: number | null;
          assigned_to_user_id?: string | null;
          client_id: string;
          sync_status?: SyncStatus;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          zone_id?: string | null;
          type?: FavorType;
          title?: string;
          description?: string | null;
          status?: FavorStatus;
          location_lat?: number | null;
          location_lng?: number | null;
          assigned_to_user_id?: string | null;
          client_id?: string;
          sync_status?: SyncStatus;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'favors_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favors_zone_id_fkey';
            columns: ['zone_id'];
            isOneToOne: false;
            referencedRelation: 'zones';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favors_assigned_to_user_id_fkey';
            columns: ['assigned_to_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      favor_interests: {
        Row: {
          id: string;
          favor_id: string;
          user_id: string;
          message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          favor_id: string;
          user_id: string;
          message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          favor_id?: string;
          user_id?: string;
          message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'favor_interests_favor_id_fkey';
            columns: ['favor_id'];
            isOneToOne: false;
            referencedRelation: 'favors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favor_interests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      favor_events: {
        Row: {
          id: string;
          favor_id: string;
          actor_user_id: string | null;
          from_status: FavorStatus | null;
          to_status: FavorStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          favor_id: string;
          actor_user_id?: string | null;
          from_status?: FavorStatus | null;
          to_status: FavorStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          favor_id?: string;
          actor_user_id?: string | null;
          from_status?: FavorStatus | null;
          to_status?: FavorStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'favor_events_favor_id_fkey';
            columns: ['favor_id'];
            isOneToOne: false;
            referencedRelation: 'favors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favor_events_actor_user_id_fkey';
            columns: ['actor_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      emergency_states: {
        Row: {
          id: string;
          zone_id: string;
          status: EmergencyStatus;
          activated_by_user_id: string | null;
          reason: string | null;
          activated_at: string;
          deactivated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          zone_id: string;
          status?: EmergencyStatus;
          activated_by_user_id?: string | null;
          reason?: string | null;
          activated_at?: string;
          deactivated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          zone_id?: string;
          status?: EmergencyStatus;
          activated_by_user_id?: string | null;
          reason?: string | null;
          activated_at?: string;
          deactivated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'emergency_states_zone_id_fkey';
            columns: ['zone_id'];
            isOneToOne: false;
            referencedRelation: 'zones';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'emergency_states_activated_by_user_id_fkey';
            columns: ['activated_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      support_services: {
        Row: {
          id: string;
          zone_id: string | null;
          name: string;
          type: ServiceType;
          phone: string | null;
          address_summary: string | null;
          location_lat: number | null;
          location_lng: number | null;
          hours: string | null;
          is_verified: boolean;
          created_by_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          zone_id?: string | null;
          name: string;
          type: ServiceType;
          phone?: string | null;
          address_summary?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          hours?: string | null;
          is_verified?: boolean;
          created_by_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          zone_id?: string | null;
          name?: string;
          type?: ServiceType;
          phone?: string | null;
          address_summary?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          hours?: string | null;
          is_verified?: boolean;
          created_by_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'support_services_zone_id_fkey';
            columns: ['zone_id'];
            isOneToOne: false;
            referencedRelation: 'zones';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'support_services_created_by_user_id_fkey';
            columns: ['created_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      vulnerability_reports: {
        Row: {
          id: string;
          reporter_user_id: string | null;
          zone_id: string | null;
          approx_lat: number | null;
          approx_lng: number | null;
          description: string;
          needs: string[];
          status: ReportStatus;
          is_anonymous: boolean;
          resolved_by_user_id: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reporter_user_id?: string | null;
          zone_id?: string | null;
          approx_lat?: number | null;
          approx_lng?: number | null;
          description: string;
          needs?: string[];
          status?: ReportStatus;
          is_anonymous?: boolean;
          resolved_by_user_id?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reporter_user_id?: string | null;
          zone_id?: string | null;
          approx_lat?: number | null;
          approx_lng?: number | null;
          description?: string;
          needs?: string[];
          status?: ReportStatus;
          is_anonymous?: boolean;
          resolved_by_user_id?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vulnerability_reports_reporter_user_id_fkey';
            columns: ['reporter_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vulnerability_reports_zone_id_fkey';
            columns: ['zone_id'];
            isOneToOne: false;
            referencedRelation: 'zones';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vulnerability_reports_resolved_by_user_id_fkey';
            columns: ['resolved_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      critical_resources: {
        Row: {
          id: string;
          user_id: string;
          zone_id: string | null;
          kind: ResourceKind;
          resource: ResourceType;
          quantity: number | null;
          notes: string | null;
          status: 'abierto' | 'cubierto' | 'cancelado';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          zone_id?: string | null;
          kind: ResourceKind;
          resource: ResourceType;
          quantity?: number | null;
          notes?: string | null;
          status?: 'abierto' | 'cubierto' | 'cancelado';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          zone_id?: string | null;
          kind?: ResourceKind;
          resource?: ResourceType;
          quantity?: number | null;
          notes?: string | null;
          status?: 'abierto' | 'cubierto' | 'cancelado';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'critical_resources_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'critical_resources_zone_id_fkey';
            columns: ['zone_id'];
            isOneToOne: false;
            referencedRelation: 'zones';
            referencedColumns: ['id'];
          },
        ];
      };

      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          payload: Json;
          read_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          payload?: Json;
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: NotificationType;
          payload?: Json;
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      user_reports: {
        Row: {
          id: string;
          reporter_user_id: string;
          target_type: string;
          target_id: string;
          reason: ReportReason;
          details: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reporter_user_id: string;
          target_type: string;
          target_id: string;
          reason: ReportReason;
          details?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reporter_user_id?: string;
          target_type?: string;
          target_id?: string;
          reason?: ReportReason;
          details?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_reports_reporter_user_id_fkey';
            columns: ['reporter_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: string;
          last_seen_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token?: string;
          platform?: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      sync_operations: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          operation: string;
          payload: Json;
          status: SyncStatus;
          error_message: string | null;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;
          operation: string;
          payload?: Json;
          status?: SyncStatus;
          error_message?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_id?: string;
          operation?: string;
          payload?: Json;
          status?: SyncStatus;
          error_message?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sync_operations_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      audit_logs: {
        Row: {
          id: number;
          actor_user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          actor_user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          actor_user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_actor_user_id_fkey';
            columns: ['actor_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };

      app_settings: {
        Row: {
          key: string;
          value: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      fn_is_voucher_not_profile_owner: {
        Args: {
          p_profile_id: string;
          p_voucher_user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      user_status: UserStatus;
      oficio_category: OficioCategory;
      favor_type: FavorType;
      favor_status: FavorStatus;
      sync_status: SyncStatus;
      emergency_status: EmergencyStatus;
      service_type: ServiceType;
      resource_type: ResourceType;
      resource_kind: ResourceKind;
      report_status: ReportStatus;
      report_reason: ReportReason;
      notification_type: NotificationType;
    };
  };
}

// Helpers de conveniencia para inferencia de tipos
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      candidatures: {
        Row: {
          id: string;
          user_id: string;
          business_name: string;
          siret: string;
          siret_data: Json | null;
          address: string;
          city: string;
          postal_code: string;
          product_category: string;
          product_description: string;
          website_url: string | null;
          instagram_url: string | null;
          stand_size: string | null;
          electricity_needed: boolean;
          previous_participant: boolean;
          status: 'pending' | 'reviewing' | 'accepted' | 'rejected';
          admin_notes: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['candidatures']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['candidatures']['Insert']>;
      };
      documents: {
        Row: {
          id: string;
          candidature_id: string;
          uploaded_by: string;
          file_name: string;
          file_url: string;
          file_type: string;
          doc_category: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['documents']['Insert']>;
      };
      messages: {
        Row: {
          id: string;
          candidature_id: string;
          sender_id: string;
          content: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
      };
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Candidature = Database['public']['Tables']['candidatures']['Row'];
export type Document = Database['public']['Tables']['documents']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];

export type CandidatureStatus = 'pending' | 'reviewing' | 'accepted' | 'rejected';

export interface CandidatureWithProfile extends Candidature {
  profiles: Profile;
  documents: Document[];
  messages: Message[];
}

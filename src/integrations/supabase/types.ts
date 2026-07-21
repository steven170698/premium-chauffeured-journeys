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
      admin_settings: {
        Row: {
          airport_surcharge: number
          allow_off_session_charges: boolean
          approval_deadline_minutes: number
          auto_confirm_future_bookings: boolean
          auto_decline_on_timeout: boolean
          base_fare: number
          booking_fee: number
          child_seat_fee: number
          deposit_percentage: number
          free_pickup_waiting_minutes: number
          free_stop_waiting_minutes: number
          google_calendar_id: string | null
          hold_during_approval: boolean
          holiday_surcharge_pct: number
          hourly_rate: number
          id: number
          loyalty_10_discount: number
          loyalty_20_vip: boolean
          loyalty_5_discount: number
          loyalty_combines_with_coupons: boolean
          max_automatic_fare_increase: number
          max_waiting_charge: number
          meet_greet_fee: number
          minimum_advance_notice_minutes: number
          minimum_booking_block_minutes: number
          minimum_fare: number
          minimum_hourly_hours: number
          night_end_hour: number
          night_start_hour: number
          night_surcharge_pct: number
          payment_window_minutes: number
          per_mile_rate: number
          per_minute_rate: number
          pickup_waiting_rate: number
          preparation_buffer_minutes: number
          referral_combines_with_coupons: boolean
          referral_minimum_ride_value: number
          referral_new_customer_discount: number
          referral_referrer_reward: number
          referral_reward_expiration_days: number
          require_approval: boolean
          sms_enabled: Json
          stop_fee: number
          stop_waiting_rate: number
          surcharge_stacking: string
          updated_at: string
          waiting_enabled: boolean
          weekend_surcharge_pct: number
        }
        Insert: {
          airport_surcharge?: number
          allow_off_session_charges?: boolean
          approval_deadline_minutes?: number
          auto_confirm_future_bookings?: boolean
          auto_decline_on_timeout?: boolean
          base_fare?: number
          booking_fee?: number
          child_seat_fee?: number
          deposit_percentage?: number
          free_pickup_waiting_minutes?: number
          free_stop_waiting_minutes?: number
          google_calendar_id?: string | null
          hold_during_approval?: boolean
          holiday_surcharge_pct?: number
          hourly_rate?: number
          id?: number
          loyalty_10_discount?: number
          loyalty_20_vip?: boolean
          loyalty_5_discount?: number
          loyalty_combines_with_coupons?: boolean
          max_automatic_fare_increase?: number
          max_waiting_charge?: number
          meet_greet_fee?: number
          minimum_advance_notice_minutes?: number
          minimum_booking_block_minutes?: number
          minimum_fare?: number
          minimum_hourly_hours?: number
          night_end_hour?: number
          night_start_hour?: number
          night_surcharge_pct?: number
          payment_window_minutes?: number
          per_mile_rate?: number
          per_minute_rate?: number
          pickup_waiting_rate?: number
          preparation_buffer_minutes?: number
          referral_combines_with_coupons?: boolean
          referral_minimum_ride_value?: number
          referral_new_customer_discount?: number
          referral_referrer_reward?: number
          referral_reward_expiration_days?: number
          require_approval?: boolean
          sms_enabled?: Json
          stop_fee?: number
          stop_waiting_rate?: number
          surcharge_stacking?: string
          updated_at?: string
          waiting_enabled?: boolean
          weekend_surcharge_pct?: number
        }
        Update: {
          airport_surcharge?: number
          allow_off_session_charges?: boolean
          approval_deadline_minutes?: number
          auto_confirm_future_bookings?: boolean
          auto_decline_on_timeout?: boolean
          base_fare?: number
          booking_fee?: number
          child_seat_fee?: number
          deposit_percentage?: number
          free_pickup_waiting_minutes?: number
          free_stop_waiting_minutes?: number
          google_calendar_id?: string | null
          hold_during_approval?: boolean
          holiday_surcharge_pct?: number
          hourly_rate?: number
          id?: number
          loyalty_10_discount?: number
          loyalty_20_vip?: boolean
          loyalty_5_discount?: number
          loyalty_combines_with_coupons?: boolean
          max_automatic_fare_increase?: number
          max_waiting_charge?: number
          meet_greet_fee?: number
          minimum_advance_notice_minutes?: number
          minimum_booking_block_minutes?: number
          minimum_fare?: number
          minimum_hourly_hours?: number
          night_end_hour?: number
          night_start_hour?: number
          night_surcharge_pct?: number
          payment_window_minutes?: number
          per_mile_rate?: number
          per_minute_rate?: number
          pickup_waiting_rate?: number
          preparation_buffer_minutes?: number
          referral_combines_with_coupons?: boolean
          referral_minimum_ride_value?: number
          referral_new_customer_discount?: number
          referral_referrer_reward?: number
          referral_reward_expiration_days?: number
          require_approval?: boolean
          sms_enabled?: Json
          stop_fee?: number
          stop_waiting_rate?: number
          surcharge_stacking?: string
          updated_at?: string
          waiting_enabled?: boolean
          weekend_surcharge_pct?: number
        }
        Relationships: []
      }
      availability_status: {
        Row: {
          created_at: string
          customer_message: string | null
          ends_at: string | null
          id: string
          is_current: boolean
          starts_at: string | null
          status: Database["public"]["Enums"]["driver_status"]
        }
        Insert: {
          created_at?: string
          customer_message?: string | null
          ends_at?: string | null
          id?: string
          is_current?: boolean
          starts_at?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
        }
        Update: {
          created_at?: string
          customer_message?: string | null
          ends_at?: string | null
          id?: string
          is_current?: boolean
          starts_at?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
        }
        Relationships: []
      }
      booking_audit_log: {
        Row: {
          booking_id: string
          changed_by: string | null
          created_at: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          reason: string | null
        }
        Insert: {
          booking_id: string
          changed_by?: string | null
          created_at?: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Update: {
          booking_id?: string
          changed_by?: string | null
          created_at?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_audit_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_holds: {
        Row: {
          created_at: string
          ends_at: string
          expires_at: string
          id: string
          pickup_at: string
          stripe_session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          ends_at: string
          expires_at: string
          id?: string
          pickup_at: string
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          ends_at?: string
          expires_at?: string
          id?: string
          pickup_at?: string
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      booking_stops: {
        Row: {
          address: string
          booking_id: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          place_id: string | null
          position: number
        }
        Insert: {
          address: string
          booking_id: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          place_id?: string | null
          position?: number
        }
        Update: {
          address?: string
          booking_id?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          place_id?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_stops_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          accessibility_request: string | null
          actual_distance_miles: number | null
          actual_duration_minutes: number | null
          airline: string | null
          airport_stop_fees: number
          airport_terminal: string | null
          amount_paid: number
          approval_deadline_at: string | null
          approved_at: string | null
          approved_by: string | null
          bags: number
          balance_due: number
          base_fare: number
          billable_waiting_minutes: number
          booking_fee: number
          booking_source: string
          child_seat: boolean
          coupon_id: string | null
          created_at: string
          customer_fare_policy_accepted_at: string | null
          decline_reason: string | null
          declined_at: string | null
          declined_by: string | null
          destination_address: string
          destination_lat: number | null
          destination_lng: number | null
          destination_place_id: string | null
          discount_amount: number
          distance_miles: number | null
          driver_delay_minutes: number
          driver_notes: string | null
          duration_minutes: number | null
          email: string
          estimated_distance_miles: number | null
          estimated_duration_minutes: number | null
          estimated_end_at: string | null
          estimated_fare: number | null
          extra_stops: string | null
          fare_adjustment_percentage: number | null
          final_charge_status: string | null
          final_fare: number | null
          first_name: string | null
          flight_number: string | null
          free_waiting_minutes: number
          full_name: string
          google_calendar_event_id: string | null
          gps_tracking_status: string | null
          hourly_hours: number | null
          id: string
          idempotency_key: string | null
          is_round_trip: boolean
          last_name: string | null
          loyalty_discount_applied: number
          meet_and_greet: boolean
          mileage_charge: number
          parking_amount: number
          passengers: number
          payment_deadline_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string
          pickup_address: string
          pickup_at: string
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_place_id: string | null
          pickup_waiting_minutes: number
          referred_by_code: string | null
          remaining_balance: number | null
          reservation_number: string
          return_at: string | null
          special_instructions: string | null
          stop_waiting_minutes: number
          stripe_customer_id: string | null
          stripe_payment_intent: string | null
          stripe_payment_method_id: string | null
          stripe_session_id: string | null
          subtotal: number
          surcharge_amount: number
          time_charge: number
          toll_amount: number
          toll_estimate: number
          total: number
          trip_ended_at: string | null
          trip_started_at: string | null
          trip_status: Database["public"]["Enums"]["trip_status"]
          trip_type: string
          updated_at: string
          user_id: string | null
          waiting_ended_at: string | null
          waiting_started_at: string | null
        }
        Insert: {
          accessibility_request?: string | null
          actual_distance_miles?: number | null
          actual_duration_minutes?: number | null
          airline?: string | null
          airport_stop_fees?: number
          airport_terminal?: string | null
          amount_paid?: number
          approval_deadline_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bags?: number
          balance_due?: number
          base_fare?: number
          billable_waiting_minutes?: number
          booking_fee?: number
          booking_source?: string
          child_seat?: boolean
          coupon_id?: string | null
          created_at?: string
          customer_fare_policy_accepted_at?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          declined_by?: string | null
          destination_address: string
          destination_lat?: number | null
          destination_lng?: number | null
          destination_place_id?: string | null
          discount_amount?: number
          distance_miles?: number | null
          driver_delay_minutes?: number
          driver_notes?: string | null
          duration_minutes?: number | null
          email: string
          estimated_distance_miles?: number | null
          estimated_duration_minutes?: number | null
          estimated_end_at?: string | null
          estimated_fare?: number | null
          extra_stops?: string | null
          fare_adjustment_percentage?: number | null
          final_charge_status?: string | null
          final_fare?: number | null
          first_name?: string | null
          flight_number?: string | null
          free_waiting_minutes?: number
          full_name: string
          google_calendar_event_id?: string | null
          gps_tracking_status?: string | null
          hourly_hours?: number | null
          id?: string
          idempotency_key?: string | null
          is_round_trip?: boolean
          last_name?: string | null
          loyalty_discount_applied?: number
          meet_and_greet?: boolean
          mileage_charge?: number
          parking_amount?: number
          passengers?: number
          payment_deadline_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone: string
          pickup_address: string
          pickup_at: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_place_id?: string | null
          pickup_waiting_minutes?: number
          referred_by_code?: string | null
          remaining_balance?: number | null
          reservation_number?: string
          return_at?: string | null
          special_instructions?: string | null
          stop_waiting_minutes?: number
          stripe_customer_id?: string | null
          stripe_payment_intent?: string | null
          stripe_payment_method_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          surcharge_amount?: number
          time_charge?: number
          toll_amount?: number
          toll_estimate?: number
          total?: number
          trip_ended_at?: string | null
          trip_started_at?: string | null
          trip_status?: Database["public"]["Enums"]["trip_status"]
          trip_type?: string
          updated_at?: string
          user_id?: string | null
          waiting_ended_at?: string | null
          waiting_started_at?: string | null
        }
        Update: {
          accessibility_request?: string | null
          actual_distance_miles?: number | null
          actual_duration_minutes?: number | null
          airline?: string | null
          airport_stop_fees?: number
          airport_terminal?: string | null
          amount_paid?: number
          approval_deadline_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bags?: number
          balance_due?: number
          base_fare?: number
          billable_waiting_minutes?: number
          booking_fee?: number
          booking_source?: string
          child_seat?: boolean
          coupon_id?: string | null
          created_at?: string
          customer_fare_policy_accepted_at?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          declined_by?: string | null
          destination_address?: string
          destination_lat?: number | null
          destination_lng?: number | null
          destination_place_id?: string | null
          discount_amount?: number
          distance_miles?: number | null
          driver_delay_minutes?: number
          driver_notes?: string | null
          duration_minutes?: number | null
          email?: string
          estimated_distance_miles?: number | null
          estimated_duration_minutes?: number | null
          estimated_end_at?: string | null
          estimated_fare?: number | null
          extra_stops?: string | null
          fare_adjustment_percentage?: number | null
          final_charge_status?: string | null
          final_fare?: number | null
          first_name?: string | null
          flight_number?: string | null
          free_waiting_minutes?: number
          full_name?: string
          google_calendar_event_id?: string | null
          gps_tracking_status?: string | null
          hourly_hours?: number | null
          id?: string
          idempotency_key?: string | null
          is_round_trip?: boolean
          last_name?: string | null
          loyalty_discount_applied?: number
          meet_and_greet?: boolean
          mileage_charge?: number
          parking_amount?: number
          passengers?: number
          payment_deadline_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string
          pickup_address?: string
          pickup_at?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_place_id?: string | null
          pickup_waiting_minutes?: number
          referred_by_code?: string | null
          remaining_balance?: number | null
          reservation_number?: string
          return_at?: string | null
          special_instructions?: string | null
          stop_waiting_minutes?: number
          stripe_customer_id?: string | null
          stripe_payment_intent?: string | null
          stripe_payment_method_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          surcharge_amount?: number
          time_charge?: number
          toll_amount?: number
          toll_estimate?: number
          total?: number
          trip_ended_at?: string | null
          trip_started_at?: string | null
          trip_status?: Database["public"]["Enums"]["trip_status"]
          trip_type?: string
          updated_at?: string
          user_id?: string | null
          waiting_ended_at?: string | null
          waiting_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_connections: {
        Row: {
          calendar_id: string | null
          connection_key_ciphertext: string
          created_at: string
          id: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_id?: string | null
          connection_key_ciphertext: string
          created_at?: string
          id?: string
          provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_id?: string | null
          connection_key_ciphertext?: string
          created_at?: string
          id?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coupon_usage: {
        Row: {
          booking_id: string | null
          coupon_id: string
          created_at: string
          discount_amount: number
          id: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          coupon_id: string
          created_at?: string
          discount_amount: number
          id?: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          coupon_id?: string
          created_at?: string
          discount_amount?: number
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_total_uses: number | null
          max_uses_per_customer: number
          maximum_discount: number | null
          minimum_purchase: number
          service_restrictions: Json | null
          starts_at: string | null
          total_used: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_total_uses?: number | null
          max_uses_per_customer?: number
          maximum_discount?: number | null
          minimum_purchase?: number
          service_restrictions?: Json | null
          starts_at?: string | null
          total_used?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_total_uses?: number | null
          max_uses_per_customer?: number
          maximum_discount?: number | null
          minimum_purchase?: number
          service_restrictions?: Json | null
          starts_at?: string | null
          total_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      customer_favorites: {
        Row: {
          address: string
          created_at: string
          id: string
          label: string
          lat: number | null
          lng: number | null
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          label: string
          lat?: number | null
          lng?: number | null
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          label?: string
          lat?: number | null
          lng?: number | null
          user_id?: string
        }
        Relationships: []
      }
      customer_reviews: {
        Row: {
          admin_response: string | null
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          is_approved: boolean
          is_featured: boolean
          rating: number
          service_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          is_featured?: boolean
          rating: number
          service_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          is_featured?: boolean
          rating?: number
          service_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          booking_id: string | null
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          provider_id: string | null
          recipient: string
          status: string
          subject: string | null
          user_id: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          provider_id?: string | null
          recipient: string
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          provider_id?: string | null
          recipient?: string
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_accounts: {
        Row: {
          available_discount_percent: number
          completed_rides: number
          is_vip: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          available_discount_percent?: number
          completed_rides?: number
          is_vip?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          available_discount_percent?: number
          completed_rides?: number
          is_vip?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          booking_id: string | null
          created_at: string
          detail: string | null
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          detail?: string | null
          event_type: string
          id?: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          detail?: string | null
          event_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email_enabled: boolean
          sms_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          audience: string
          body: string | null
          booking_id: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          audience?: string
          body?: string | null
          booking_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          audience?: string
          body?: string | null
          booking_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          surcharge_pct: number
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          surcharge_pct?: number
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          surcharge_pct?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          loyalty_tier: Database["public"]["Enums"]["loyalty_tier"]
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          loyalty_tier?: Database["public"]["Enums"]["loyalty_tier"]
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          loyalty_tier?: Database["public"]["Enums"]["loyalty_tier"]
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          booking_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          referred_user_id: string | null
          referrer_id: string
          reward_amount: number
          status: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          referred_user_id?: string | null
          referrer_id: string
          reward_amount: number
          status?: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          referred_user_id?: string | null
          referrer_id?: string
          reward_amount?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referral_code: string
          successful_referrals: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          successful_referrals?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          successful_referrals?: number
          user_id?: string
        }
        Relationships: []
      }
      revenue_records: {
        Row: {
          amount: number
          booking_id: string
          id: string
          payment_type: string
          recorded_at: string
        }
        Insert: {
          amount: number
          booking_id: string
          id?: string
          payment_type: string
          recorded_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          id?: string
          payment_type?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          booking_id: string | null
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          message: string
          phone: string
          provider_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          message: string
          phone: string
          provider_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          message?: string
          phone?: string
          provider_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          admin_notes: string | null
          assigned_to: string | null
          booking_id: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          source: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          assigned_to?: string | null
          booking_id?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          assigned_to?: string | null
          booking_id?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_location_points: {
        Row: {
          accuracy: number | null
          booking_id: string
          created_at: string
          id: string
          latitude: number
          longitude: number
          recorded_at: string
          trip_status: string | null
        }
        Insert: {
          accuracy?: number | null
          booking_id: string
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
          trip_status?: string | null
        }
        Update: {
          accuracy?: number | null
          booking_id?: string
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          trip_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_location_points_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_status_history: {
        Row: {
          booking_id: string
          changed_by: string | null
          created_at: string
          id: string
          note: string | null
          status: Database["public"]["Enums"]["trip_status"]
        }
        Insert: {
          booking_id: string
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          status: Database["public"]["Enums"]["trip_status"]
        }
        Update: {
          booking_id?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
        }
        Relationships: [
          {
            foreignKeyName: "trip_status_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      public_pricing: {
        Row: {
          airport_surcharge: number | null
          base_fare: number | null
          booking_fee: number | null
          child_seat_fee: number | null
          holiday_surcharge_pct: number | null
          hourly_rate: number | null
          meet_greet_fee: number | null
          minimum_fare: number | null
          minimum_hourly_hours: number | null
          night_end_hour: number | null
          night_start_hour: number | null
          night_surcharge_pct: number | null
          per_mile_rate: number | null
          per_minute_rate: number | null
          stop_fee: number | null
          surcharge_stacking: string | null
          weekend_surcharge_pct: number | null
        }
        Insert: {
          airport_surcharge?: number | null
          base_fare?: number | null
          booking_fee?: number | null
          child_seat_fee?: number | null
          holiday_surcharge_pct?: number | null
          hourly_rate?: number | null
          meet_greet_fee?: number | null
          minimum_fare?: number | null
          minimum_hourly_hours?: number | null
          night_end_hour?: number | null
          night_start_hour?: number | null
          night_surcharge_pct?: number | null
          per_mile_rate?: number | null
          per_minute_rate?: number | null
          stop_fee?: number | null
          surcharge_stacking?: string | null
          weekend_surcharge_pct?: number | null
        }
        Update: {
          airport_surcharge?: number | null
          base_fare?: number | null
          booking_fee?: number | null
          child_seat_fee?: number | null
          holiday_surcharge_pct?: number | null
          hourly_rate?: number | null
          meet_greet_fee?: number | null
          minimum_fare?: number | null
          minimum_hourly_hours?: number | null
          night_end_hour?: number | null
          night_start_hour?: number | null
          night_surcharge_pct?: number | null
          per_mile_rate?: number | null
          per_minute_rate?: number | null
          stop_fee?: number | null
          surcharge_stacking?: string | null
          weekend_surcharge_pct?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      mark_abandoned_bookings: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "customer"
      discount_type: "percentage" | "fixed"
      driver_status:
        | "available"
        | "offline"
        | "vacation"
        | "busy"
        | "not_accepting"
      loyalty_tier: "standard" | "bronze" | "silver" | "vip"
      payment_status:
        | "unpaid"
        | "deposit_paid"
        | "paid"
        | "refunded"
        | "partially_refunded"
      trip_status:
        | "pending_approval"
        | "confirmed"
        | "driver_preparing"
        | "driver_en_route"
        | "driver_arrived"
        | "picked_up"
        | "completed"
        | "canceled"
        | "awaiting_payment"
        | "declined"
        | "payment_expired"
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
      app_role: ["admin", "customer"],
      discount_type: ["percentage", "fixed"],
      driver_status: [
        "available",
        "offline",
        "vacation",
        "busy",
        "not_accepting",
      ],
      loyalty_tier: ["standard", "bronze", "silver", "vip"],
      payment_status: [
        "unpaid",
        "deposit_paid",
        "paid",
        "refunded",
        "partially_refunded",
      ],
      trip_status: [
        "pending_approval",
        "confirmed",
        "driver_preparing",
        "driver_en_route",
        "driver_arrived",
        "picked_up",
        "completed",
        "canceled",
        "awaiting_payment",
        "declined",
        "payment_expired",
      ],
    },
  },
} as const

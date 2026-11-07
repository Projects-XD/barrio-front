import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../types/database.types';
import { AppError } from '../middlewares/errorHandler';

export class VouchService {
  /**
   * Otorga un visto bueno (vouch) a un perfil profesional.
   * La base de datos recalcula automáticamente validated_count e is_validated mediante triggers.
   */
  public async giveVouch(
    supabase: SupabaseClient<Database>,
    voucherUserId: string,
    profileId: string
  ): Promise<{ profile: Tables<'professional_profiles'>; vouch: Tables<'vouches'> }> {
    // 1. Insertar el visto bueno
    const { data: vouch, error: vouchError } = await supabase
      .from('vouches')
      .insert({
        profile_id: profileId,
        voucher_user_id: voucherUserId,
      })
      .select()
      .single();

    if (vouchError) {
      if (vouchError.code === '23505') {
        throw new AppError('Ya has otorgado un visto bueno a este perfil profesional', 409);
      }
      if (vouchError.code === '23514') {
        throw new AppError('No puedes otorgarte un visto bueno a ti mismo', 400);
      }
      throw new AppError(`Error al otorgar visto bueno: ${vouchError.message}`, 400);
    }

    // 2. Obtener el perfil actualizado tras la ejecución del trigger
    const { data: profile, error: profileError } = await supabase
      .from('professional_profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (profileError || !profile) {
      throw new AppError('Error al recuperar el perfil actualizado', 500);
    }

    return { profile, vouch };
  }

  /**
   * Remueve un visto bueno previamente otorgado.
   */
  public async removeVouch(
    supabase: SupabaseClient<Database>,
    voucherUserId: string,
    profileId: string
  ): Promise<{ profile: Tables<'professional_profiles'> }> {
    const { error: deleteError } = await supabase
      .from('vouches')
      .delete()
      .eq('profile_id', profileId)
      .eq('voucher_user_id', voucherUserId);

    if (deleteError) {
      throw new AppError(`Error al remover visto bueno: ${deleteError.message}`, 400);
    }

    const { data: profile, error: profileError } = await supabase
      .from('professional_profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (profileError || !profile) {
      throw new AppError('Error al consultar el perfil actualizado', 500);
    }

    return { profile };
  }

  /**
   * Verifica si el usuario actual ha otorgado visto bueno al perfil.
   */
  public async hasVouched(
    supabase: SupabaseClient<Database>,
    voucherUserId: string,
    profileId: string
  ): Promise<boolean> {
    const { count, error } = await supabase
      .from('vouches')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .eq('voucher_user_id', voucherUserId);

    if (error) {
      return false;
    }

    return (count ?? 0) > 0;
  }
}

export const vouchService = new VouchService();

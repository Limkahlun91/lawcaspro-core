
import { supabase } from '../supabaseClient';

export const validateStageTransition = async (fromStageId: string, toStageId: string, userId: string) => {
  const { data, error } = await supabase
    .rpc('validate_stage_transition', {
      p_from_stage: fromStageId,
      p_to_stage: toStageId,
      p_user_id: userId
    });

  if (error) throw error;
  return data;
};

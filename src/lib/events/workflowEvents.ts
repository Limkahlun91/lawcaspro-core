
import { supabase } from '../supabaseClient';

export const handleStageChange = async (caseId: string, newStageId: string, userId: string) => {
  // Call the database function
  const { data, error } = await supabase
    .rpc('handle_stage_change', {
      p_case_id: caseId,
      p_new_stage_id: newStageId,
      p_user_id: userId
    });

  if (error) throw error;
  return data;
};

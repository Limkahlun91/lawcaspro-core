import React, { useEffect, useState } from 'react';
import { FormProvider, useFormStore } from "@/components/form-engine-v2/store";
import { FormEngine } from "@/components/form-engine-v2/FormEngine"; // Re-importing FormInner logic by extracting it? No, let's use FormEngine as controlled or composed.
// Actually, FormEngine exports FormProvider. I can just use FormProvider and then a child component that uses useFormStore.
// But FormEngine component itself renders FormInner.
// I need to use FormInner but it's not exported.
// Let's modify FormEngine to export FormInner or just copy the render logic since it's simple.
// Wait, FormEngine is simple wrapper. I can just replicate it here for maximum control.

import { caseSchemaV2 } from "./caseSchemaV2"; 
import { supabase } from "@/lib/supabaseClient";
import { FieldSchema, FormSchema } from "@/components/form-engine-v2/types";

// We need to import the internal components of FormEngine to render them.
// But they are not exported.
// Better approach:
// Use FormEngine as is.
// Use 'onChange' to detect changes.
// But 'onChange' gives us values. It doesn't give us 'setFieldValue'.
// We need 'setFieldValue' to update 'project_type' hidden field.

// Solution:
// Modify FormEngine.tsx to export FormInner.
// Then I can import FormInner here.

import { FormInner } from "@/components/form-engine-v2/FormEngine"; 

import { AuditLogViewer } from "./components/AuditLogViewer";

export default function CaseFormV2({ caseId }: { caseId?: string }) {
  return (
    <FormProvider initialValues={{}}>
      <CaseFormContent caseId={caseId} />
    </FormProvider>
  );
}

function CaseFormContent({ caseId }: { caseId?: string }) {
  const { state, setFieldValue } = useFormStore();
  const [schema, setSchema] = useState<FormSchema>(caseSchemaV2);
  const [loading, setLoading] = useState(true);

  // 1. Load Projects on Mount
  useEffect(() => {
    const loadProjects = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.user_metadata?.firm_id) return;

      const { data, error } = await supabase 
        .from("projects") 
        .select("id, name, project_type") // Fetch project_type too for local cache if needed
        .eq("firm_id", user.user_metadata.firm_id); 

      if (error) {
        console.error("Error loading projects:", error);
        return;
      }

      const projectOptions = data?.map(p => ({ 
        label: p.name, 
        value: p.id 
      })) || [];

      // Update Schema (Basic Info -> project_id)
      setSchema(prev => ({
        ...prev,
        sections: prev.sections.map(section => {
          if (section.id === 'basic-info') {
            return {
              ...section,
              fields: section.fields.map(field => 
                field.id === 'project_id' 
                  ? { ...field, options: projectOptions }
                  : field
              )
            };
          }
          return section;
        })
      }));
      setLoading(false);
    };

    loadProjects();
  }, []);

  // 2. Watch 'project_id' changes to update 'project_type'
  useEffect(() => {
    const projectId = state.values.project_id;
    if (projectId) {
      // Fetch project details to get project_type
      // Optimization: We could have cached this in the first query, but separate fetch is safer for now.
      // Or we can assume we loaded it in step 1?
      // Let's fetch it to be sure.
      const fetchProjectDetails = async () => {
        const { data } = await supabase
          .from('projects')
          .select('project_type')
          .eq('id', projectId)
          .single();
        
        if (data) {
          console.log("Project Type detected:", data.project_type);
          // Set hidden field for Condition Engine
          if (state.values.project_type !== data.project_type) {
             setFieldValue('project_type', data.project_type);
          }
        }
      };
      fetchProjectDetails();
    }
  }, [state.values.project_id]); // Dependency on project_id value

  const handleSubmit = async (values: any) => { 
    console.log("Submitting Enterprise Case:", values);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert("Not authenticated"); return; }
    const firm_id = user.user_metadata?.firm_id;
    if (!firm_id) { alert("Critical Error: No Firm ID"); return; }

    // Enterprise Payload
    const payload = { 
      ...values, 
      firm_id, 
      stage_status: "Opening",
      status: "Active", 
      created_by: user.id,
      // project_type is hidden field, we don't need to save it to cases table (it's in projects table)
      // Supabase will ignore extra fields if not in table? No, it might throw error if strict.
      // We should sanitize payload.
    };

    // Remove temp fields
    delete payload.project_type; 

    const { error } = await supabase 
      .from("cases") 
      .insert([payload]); 

    if (error) { 
      console.error("Supabase Error:", error);
      alert("Error creating case: " + error.message); 
      return; 
    } 

    alert("Case created successfully"); 
  }; 

  if (loading) return <div>Loading Enterprise Core...</div>;

  return (
    <>
      <FormInner 
        schema={schema} 
        onSubmit={handleSubmit} 
      />
      {caseId && <AuditLogViewer caseId={caseId} />}
    </>
  );
}

import { FormSchema } from "@/components/form-engine-v2/types"; 

export const caseSchema: FormSchema = { 
  id: "case-form", 
  title: "New Case", 
  sections: [ 
    { 
      id: "basic-info", 
      title: "Basic Information", 
      fields: [ 
        { 
            id: "project_id", 
            label: "Project", 
            type: "select", 
            validation: [ 
                { type: "required", message: "Project is required" } 
            ], 
            gridCols: 6 
        },
        { 
          id: "file_no", 
          label: "File No", 
          type: "text", 
          validation: [ 
            { type: "required", message: "File No is required" } 
          ], 
          gridCols: 6 
        }, 
        { 
          id: "client_name", 
          label: "Client Name", 
          type: "text", 
          validation: [ 
            { type: "required", message: "Client Name is required" } 
          ], 
          gridCols: 6 
        },
        { 
          id: "unit_no", 
          label: "Unit No", 
          type: "text", 
          gridCols: 6 
        }, 
        { 
          id: "spa_price", 
          label: "SPA Price", 
          type: "number", 
          gridCols: 6 
        } 
      ] 
    } 
  ] 
};
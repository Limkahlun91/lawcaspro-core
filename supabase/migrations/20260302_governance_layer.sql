-- Governance Layer Migration
-- 1. Update Template Status Enum to support Approval Workflow
ALTER TABLE firm_templates DROP CONSTRAINT IF EXISTS firm_templates_status_check;

ALTER TABLE firm_templates 
ADD CONSTRAINT firm_templates_status_check 
CHECK (status IN (
    'draft', 
    'designing', 
    'mapping', 
    'submitted', -- Pending Review
    'approved',  -- Approved by Partner/Admin
    'rejected',  -- Sent back to mapping
    'ready',     -- Published for production
    'invalid', 
    'archived'
));

-- 2. Create Template Approval Logs (Audit Trail)
CREATE TABLE IF NOT EXISTS template_approval_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID REFERENCES firms(id) NOT NULL,
    template_id UUID REFERENCES firm_templates(id) NOT NULL,
    version INTEGER NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('submit', 'approve', 'reject', 'publish', 'revert')),
    actor_id UUID REFERENCES auth.users(id) NOT NULL,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enhance Variable Dictionary for Governance
-- Add created_by to track who added the variable
ALTER TABLE variable_dictionary 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Add status to variable dictionary (for Module 3: Variable Governance)
ALTER TABLE variable_dictionary 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected'));

-- 4. Create Index for Dashboard Performance
CREATE INDEX IF NOT EXISTS idx_generated_documents_created_at ON generated_documents(generated_at);
CREATE INDEX IF NOT EXISTS idx_generated_documents_status ON generated_documents(status);
CREATE INDEX IF NOT EXISTS idx_template_approval_logs_template_id ON template_approval_logs(template_id);

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { Button } from '../../../components/ui/button';
import { Loader2, Save, ArrowLeft, Type, FileText, Play, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { documentService, SystemVariable } from '../../../services/documentService';
import DOMPurify from 'dompurify';

export default function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(id ? true : false);
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState('New Template');
  const [category, setCategory] = useState('General');
  const [content, setContent] = useState('');
  const [variables, setVariables] = useState<SystemVariable[]>([]);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  
  // Mock Case Data for Preview
  const [mockData, setMockData] = useState<any>({
    PURCHASER_NAME: 'John Doe',
    IC_NO: '800101-14-1234',
    SPA_PRICE: '500,000.00',
    FILE_REF: 'LC/2026/001',
    UNIT_NO: 'A-10-05',
    CURRENT_DATE: new Date().toLocaleDateString()
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      // Load Variables
      const vars = await documentService.getVariables();
      setVariables(vars);

      // Load Template if ID exists
      if (id) {
        const template = await documentService.getTemplate(id);
        if (template) {
          setName(template.name);
          setCategory(template.category || 'General');
          setContent(template.content_html || '');
        }
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Name is required');
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('firm_id').eq('id', user?.id).single();
      
      if (!profile?.firm_id) throw new Error('Firm ID not found');

      const payload = {
        id: id, // if undefined, upsert might create new with generated ID? No, upsert needs ID usually or match constraint
        name,
        category,
        type: 'editor' as const,
        content_html: content,
        version: 1, // TODO: Increment version
        is_active: true
      };

      // Handle ID generation if new
      if (!id) delete payload.id;

      await documentService.saveTemplate(payload, profile.firm_id, user!.id);
      toast.success('Template saved');
      if (!id) navigate('/admin/templates'); // Or redirect to edit page with new ID
    } catch (error) {
      console.error(error);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, key: string) => {
    e.dataTransfer.setData('text/plain', `{{${key}}}`);
  };

  const getPreviewContent = () => {
    let preview = content;
    // Simple replacement for preview
    // In real app, use Handlebars.compile()
    for (const [key, value] of Object.entries(mockData)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      preview = preview.replace(regex, value as string);
    }
    // Also replace system variables from the list with placeholders if not in mockData
    variables.forEach(v => {
      if (!mockData[v.variable_key]) {
        const regex = new RegExp(`{{${v.variable_key}}}`, 'g');
        preview = preview.replace(regex, `<span class="bg-yellow-100 text-yellow-800 px-1 rounded">{{${v.variable_key}}}</span>`);
      }
    });
    return preview;
  };

  const sanitize = (html: string) => {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['div','p','strong','h1','h2','h3','span','br','ul','li','b','i','u','table','tr','td','th','tbody','thead','img'],
        ALLOWED_ATTR: ['class','style','src','border','width','height']
    });
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-100">
      {/* Sidebar - Variables */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full shadow-lg z-10">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
           <Button variant="ghost" size="sm" onClick={() => navigate('/admin/templates')} className="mb-2 -ml-2 text-gray-500">
             <ArrowLeft className="h-4 w-4 mr-1" /> Back
           </Button>
           <h2 className="text-lg font-bold text-gray-900">Variables</h2>
           <p className="text-xs text-gray-500">Drag & Drop into editor</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Group by Category */}
          {Array.from(new Set(variables.map(v => v.category))).map(cat => (
            <div key={cat}>
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">{cat}</h3>
              <div className="space-y-2">
                {variables.filter(v => v.category === cat).map(v => (
                  <div 
                    key={v.variable_key}
                    draggable
                    onDragStart={(e) => handleDragStart(e, v.variable_key)}
                    className="p-2 bg-white border rounded shadow-sm cursor-move hover:border-indigo-400 hover:shadow-md flex items-center gap-2"
                  >
                    <Type className="h-4 w-4 text-indigo-500" />
                    <div>
                      <div className="text-sm font-medium">{v.label}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{`{{${v.variable_key}}}`}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col h-full">
        {/* Toolbar */}
        <div className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-4 flex-1">
            <input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xl font-bold text-gray-900 outline-none border-b border-transparent focus:border-indigo-500 bg-transparent"
              placeholder="Template Name"
            />
            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="General">General</option>
              <option value="SPA">SPA</option>
              <option value="Loan">Loan</option>
              <option value="Correspondence">Correspondence</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
             <div className="bg-gray-100 rounded-lg p-1 mr-4 flex">
                <button 
                  onClick={() => setMode('edit')}
                  className={`px-3 py-1 rounded text-sm font-medium ${mode === 'edit' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'}`}
                >
                  Editor
                </button>
                <button 
                  onClick={() => setMode('preview')}
                  className={`px-3 py-1 rounded text-sm font-medium ${mode === 'preview' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'}`}
                >
                  Preview
                </button>
             </div>
             <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
               {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4 mr-2" />}
               Save
             </Button>
          </div>
        </div>

        {/* Editor / Preview */}
        <div className="flex-1 bg-gray-100 p-8 overflow-auto flex justify-center">
          <div 
            className="bg-white shadow-xl w-[210mm] min-h-[297mm] p-[20mm] relative"
            onDrop={(e) => {
              e.preventDefault();
              const key = e.dataTransfer.getData('text/plain');
              if (key && mode === 'edit') {
                 // Insert text at cursor or drop point?
                 // Simple append for now if dropped anywhere, or use selection if focused
                 // Better: use document.execCommand if supported
                 document.execCommand('insertText', false, key);
              }
            }}
            onDragOver={(e) => e.preventDefault()}
          >
             {mode === 'edit' ? (
               <div 
                 className="w-full h-full outline-none min-h-[500px]"
                 contentEditable
                 onInput={(e) => setContent(e.currentTarget.innerHTML)}
                 dangerouslySetInnerHTML={{ __html: content }} // Initial load
               />
             ) : (
               <div 
                 className="w-full h-full"
                 dangerouslySetInnerHTML={{ __html: sanitize(getPreviewContent()) }}
               />
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

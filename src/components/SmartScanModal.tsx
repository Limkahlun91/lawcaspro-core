import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle, Loader, ArrowRight, Eye } from 'lucide-react';
import { documentAiService, ExtractedData } from '../services/documentAiService';

interface SmartScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: ExtractedData) => void;
}

export default function SmartScanModal({ isOpen, onClose, onApply }: SmartScanModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setFileUrl(URL.createObjectURL(selectedFile));
      setExtractedData(null);
      
      // Auto-start analysis
      await runAnalysis(selectedFile);
    }
  };

  const runAnalysis = async (fileToAnalyze: File) => {
    setIsAnalyzing(true);
    try {
      const data = await documentAiService.analyzeDocument(fileToAnalyze);
      setExtractedData(data);
    } catch (error) {
      console.error("AI Analysis Failed", error);
      alert("AI Analysis Failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const droppedFile = e.dataTransfer.files[0];
        setFile(droppedFile);
        setFileUrl(URL.createObjectURL(droppedFile));
        setExtractedData(null);
        await runAnalysis(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleApply = () => {
    if (extractedData) {
      onApply(extractedData);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        
        {/* Background Overlay */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        {/* Modal Panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full h-[80vh] flex flex-col">
          
          {/* Header */}
          <div className="bg-[#003366] px-4 py-3 sm:px-6 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-white flex items-center gap-2">
              <Eye className="h-5 w-5" /> Smart AI Document Scan
            </h3>
            <button
              onClick={onClose}
              className="bg-transparent rounded-md text-gray-200 hover:text-white focus:outline-none"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Body - Split View */}
          <div className="flex-1 flex overflow-hidden bg-gray-100">
            
            {/* Left: Document Preview / Upload */}
            <div 
                className="w-1/2 p-4 border-r border-gray-200 flex flex-col bg-gray-200/50"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
              {!file ? (
                <div 
                    className="flex-1 border-2 border-dashed border-gray-400 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors bg-white"
                    onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-16 w-16 text-gray-400 mb-4" />
                  <p className="text-lg font-medium text-gray-600">Click to Upload or Drag & Drop File</p>
                  <p className="text-sm text-gray-400 mt-2">Supports PDF, JPG, PNG</p>
                  <input 
                    ref={fileInputRef} 
                    type="file" 
                    className="hidden" 
                    onChange={handleFileChange} 
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                </div>
              ) : (
                <div className="flex-1 bg-white rounded-lg shadow overflow-hidden relative flex flex-col">
                    <div className="p-2 bg-gray-800 text-white text-xs flex justify-between items-center">
                        <span className="truncate max-w-[200px]">{file.name}</span>
                        <button onClick={() => setFile(null)} className="text-red-300 hover:text-white">Change</button>
                    </div>
                    <div className="flex-1 overflow-auto bg-gray-500 flex items-center justify-center">
                        {file.type.includes('image') ? (
                            <img src={fileUrl!} alt="Preview" className="max-w-full h-auto object-contain" />
                        ) : (
                            <div className="text-white text-center">
                                <FileText className="h-20 w-20 mx-auto mb-2" />
                                <p>PDF Preview Not Available in Demo</p>
                            </div>
                        )}
                    </div>
                </div>
              )}
            </div>

            {/* Right: Extraction Results */}
            <div className="w-1/2 p-6 overflow-y-auto bg-white">
              {isAnalyzing ? (
                <div className="h-full flex flex-col items-center justify-center">
                    <Loader className="h-12 w-12 text-[#003366] animate-spin mb-4" />
                    <h4 className="text-xl font-bold text-gray-800">AI Analysis in Progress...</h4>
                    <p className="text-gray-500 mt-2">Extracting key entities from document</p>
                    <div className="w-64 bg-gray-200 rounded-full h-2.5 mt-6">
                        <div className="bg-[#003366] h-2.5 rounded-full animate-pulse w-2/3"></div>
                    </div>
                </div>
              ) : extractedData ? (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex items-center gap-2 text-green-600 mb-6 bg-green-50 p-3 rounded-lg border border-green-200">
                        <CheckCircle size={24} />
                        <div>
                            <p className="font-bold">Extraction Complete</p>
                            <p className="text-xs text-green-800">Confidence Score: 98.5%</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b pb-1">Extracted Information</h4>
                        
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Purchaser Name</label>
                                <input 
                                    value={extractedData.purchaser_name || ''} 
                                    onChange={e => setExtractedData({...extractedData, purchaser_name: e.target.value})}
                                    className="w-full border-b-2 border-indigo-100 focus:border-[#003366] px-2 py-1 outline-none font-medium text-gray-900 bg-indigo-50/30" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">IC No</label>
                                <input 
                                    value={extractedData.ic_no || ''} 
                                    onChange={e => setExtractedData({...extractedData, ic_no: e.target.value})}
                                    className="w-full border-b-2 border-indigo-100 focus:border-[#003366] px-2 py-1 outline-none font-medium text-gray-900 bg-indigo-50/30" 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">SPA Price (RM)</label>
                                    <input 
                                        value={extractedData.spa_price || ''} 
                                        onChange={e => setExtractedData({...extractedData, spa_price: parseFloat(e.target.value)})}
                                        className="w-full border-b-2 border-indigo-100 focus:border-[#003366] px-2 py-1 outline-none font-medium text-gray-900 bg-indigo-50/30 font-mono" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Unit No</label>
                                    <input 
                                        value={extractedData.unit_no || ''} 
                                        onChange={e => setExtractedData({...extractedData, unit_no: e.target.value})}
                                        className="w-full border-b-2 border-indigo-100 focus:border-[#003366] px-2 py-1 outline-none font-medium text-gray-900 bg-indigo-50/30" 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Property Address</label>
                                <textarea 
                                    value={extractedData.property_address || ''} 
                                    onChange={e => setExtractedData({...extractedData, property_address: e.target.value})}
                                    rows={2}
                                    className="w-full border-b-2 border-indigo-100 focus:border-[#003366] px-2 py-1 outline-none font-medium text-gray-900 bg-indigo-50/30 resize-none" 
                                />
                            </div>
                        </div>
                    </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <ArrowRight className="h-12 w-12 mb-4 opacity-20" />
                    <p>Upload a document to see extraction results here</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end gap-3 border-t border-gray-200">
            <button
              type="button"
              className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!extractedData}
              className={`inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:text-sm ${
                extractedData ? 'bg-[#003366] hover:bg-[#002855]' : 'bg-gray-300 cursor-not-allowed'
              }`}
              onClick={handleApply}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Apply to Case
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

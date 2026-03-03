import React from 'react';
import { useParams } from 'react-router-dom';
import CaseFormV2 from "@/modules/cases/CaseFormV2"; 

export default function NewCasePage() { 
  const { id } = useParams();
  return ( 
    <div className="p-6"> 
      <CaseFormV2 caseId={id} /> 
    </div> 
  ); 
}
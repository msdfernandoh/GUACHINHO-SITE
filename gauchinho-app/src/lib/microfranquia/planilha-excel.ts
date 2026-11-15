import * as XLSX from "xlsx";
import { interpretarLinhasPlanilha } from "./planilha-indicacoes";
export function lerPlanilhaIndicacoes(buffer:ArrayBuffer){
 const wb=XLSX.read(buffer,{type:"array",sheetRows:503,cellFormula:true});const sheet=wb.Sheets[wb.SheetNames[0]];if(!sheet)throw new Error("A planilha está vazia.");
 for(const [endereco,celula] of Object.entries(sheet)){if(endereco.startsWith("!"))continue;if(celula&&typeof celula==="object"&&"f" in celula)throw new Error("Remova as fórmulas da planilha e importe somente os valores.");}
 const ref=sheet["!fullref"]??sheet["!ref"];if(ref&&XLSX.utils.decode_range(ref).e.r>501)throw new Error("Use até 500 linhas de contatos por arquivo.");
 return interpretarLinhasPlanilha(XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:"",raw:true}));
}

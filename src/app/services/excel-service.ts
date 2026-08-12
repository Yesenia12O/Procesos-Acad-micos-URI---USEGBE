import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

@Injectable({
  providedIn: 'root'
})
export class ExcelService {

  constructor() { }

  /**
   *Lee un archivo Excel de manera optimizada
   */
  async readExcel(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, {
            type: 'array',
            cellDates: false,
            cellNF: false,
            cellStyles: false
          });

          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            defval: '',
            raw: true
          });

          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Detecta la columna de nombres de carrera
   * Prioriza: NombreCarrera, nombre_carrera, Carrera, etc.
   */
  detectCareerColumn(data: any[]): string | null {
    if (!data || data.length === 0) return null;

    const columns = Object.keys(data[0]);

    //PRIORIDAD: buscar primero estas columnas (orden de preferencia)
    const priorityColumns = [
      'NombreCarrera',      // Exacto
      'nombre_carrera',     // Con guión bajo
      'nom_carrera',        // Abreviado
      'Carrera',            // Simple
      'carrera',            // Minuscula
      'Nombre',             // Solo nombre
      'nombre',             // Solo nombre minuscula
      'Programa',           // Alternativa
      'programa'            // Alternativa minucula
    ];

    //1. Buscar coincidencia exacta con las prioridades
    for (const priority of priorityColumns) {
      if (columns.includes(priority)) {
        return priority;
      }
    }

    //2. Buscar cualquier columna que contenga "carrera" o "programa"
    for (const col of columns) {
      const lowerCol = col.toLowerCase().trim();
      if (lowerCol.includes('carrera') ||
          lowerCol.includes('programa') ||
          lowerCol.includes('facultad') ||
          lowerCol.includes('especialidad')) {
        return col;
      }
    }

    //3. Si no encuentra, buscar columnas con "nombre" o "nom"
    for (const col of columns) {
      const lowerCol = col.toLowerCase().trim();
      if (lowerCol.includes('nombre') || lowerCol.includes('nom')) {
        return col;
      }
    }

    return null;
  }

  /**
   *Obtiene las carreras unicas de los datos
   */
  getUniqueCareers(data: any[], careerColumn: string): string[] {
    if (!data || !careerColumn) return [];

    const careers = new Set<string>();
    data.forEach(row => {
      const value = row[careerColumn];
      if (value !== undefined && value !== null && value !== '') {
        careers.add(String(value).trim());
      }
    });

    return Array.from(careers).sort();
  }

  /**
   * Filtra los datos por carrera
   */
  filterByCareer(data: any[], careerColumn: string, career: string): any[] {
    if (!data || !careerColumn || !career) return data;

    return data.filter(row => {
      const value = row[careerColumn];
      if (value === undefined || value === null) return false;
      return String(value).trim() === career;
    });
  }

  /**
   *Obtiene estadisticas basicas de los datos
   */
  getStatistics(data: any[]): any {
    return {
      totalRecords: data.length,
      totalColumns: data.length > 0 ? Object.keys(data[0]).length : 0,
      columns: data.length > 0 ? Object.keys(data[0]) : []
    };
  }

  /**
   *Obtiene informacion detallada de las columnas
   */
  getColumnInfo(data: any[]): any {
    if (!data || data.length === 0) return { columns: [], sample: {} };

    const columns = Object.keys(data[0]);
    const sample = data[0];

    return {
      columns: columns,
      sample: sample,
      columnTypes: columns.map(col => ({
        name: col,
        type: typeof sample[col],
        sampleValue: sample[col]
      }))
    };
  }
}

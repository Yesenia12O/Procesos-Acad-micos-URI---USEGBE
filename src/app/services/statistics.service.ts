import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StatisticsService {

  /**
   *Detecta columnas categoricas (para graficos de dona)
   *Version mejorada para detectar columnas con "CUMPLE"/"NO CUMPLE"
   */
  getCategoricalColumns(data: any[]): string[] {
    if (!data || data.length === 0) {
      console.warn('⚠️ No hay datos para analizar');
      return [];
    }
    
    const columns = Object.keys(data[0]);
    const categoricalColumns: string[] = [];
    
    //PALABRAS CLAVE para detectar columnas de encuestas/requisitos
    const surveyKeywords = [
      //Requisitos/Estado
      'cumple', 'no_cumple', 'no cumple', 'estado', 'situacion', 'situación',
      'requisito', 'requisitos', 'condicion', 'condiciones',
      //Encuestas generales
      'pregunta', 'respuesta', 'opinion', 'opinión',
      'satisfaccion', 'satisfacción', 'nivel', 'grado',
      'calificacion', 'calificación', 'puntaje', 'puntuacion',
      'evaluacion', 'evaluación', 'categoria', 'categoría',
      //Academico
      'academico', 'académico', 'documentacion', 'documentación',
      'financiero', 'titulacion', 'titulación', 'practicas', 'prácticas',
      'vinculacion', 'vinculación', 'seguimiento', 'ingles', 'inglés',
      'actualizacion', 'actualización', 'horario', 'jornada',
      //Demograficos
      'genero', 'género', 'sexo', 'edad', 'rango',
      'modalidad', 'presencial', 'virtual', 'hibrido', 'híbrido',
      'interes', 'motivacion', 'motivación', 'expectativa',
      'conocimiento', 'experiencia', 'tiempo', 'dedicacion',
      'dedicación', 'nivel_estudio', 'nivel_educativo'
    ];
    
    //Lista negra: columnas que NO deben graficarse
    const blacklist = [
      'id', 'cedula', 'cédula', 'identificacion', 'identificación',
      'codigo', 'código', 'numero', 'número', 'correo', 'email',
      'telefono', 'teléfono', 'direccion', 'dirección',
      'fecha_nacimiento', 'fecha_creacion', 'fecha_actualizacion',
      'nombre_completo', 'apellidos', 'nombres', 'usuario',
      'carrera', 'carreras', 'programa', 'facultad' //Excluir carreras (ya tenemos filtro)
    ];
    
    for (const col of columns) {
      const lowerCol = col.toLowerCase().trim();
      
      //Saltar columnas de la lista negra
      if (blacklist.some(keyword => lowerCol.includes(keyword))) {
        console.log(`⏭️ Columna ignorada (blacklist): ${col}`);
        continue;
      }
      
      //1. SIEMPRE incluir columnas que contengan palabras clave
      if (surveyKeywords.some(keyword => lowerCol.includes(keyword))) {
        categoricalColumns.push(col);
        console.log(`✅ Columna por keyword: ${col}`);
        continue;
      }
      
      //2. Analizar valores unicos
      const uniqueValues = new Set<string>();
      let totalValues = 0;
      
      for (const row of data) {
        const value = row[col];
        if (value !== undefined && value !== null && value !== '') {
          const strValue = String(value).trim();
          uniqueValues.add(strValue);
          totalValues++;
        }
        // Si ya tenemos suficientes valores, salir
        if (uniqueValues.size > 20) break;
      }
      
      const uniqueCount = uniqueValues.size;
      
      //3. Si tiene entre 2 y 20 valores unicos, ES CATEGORICA
      if (uniqueCount >= 2 && uniqueCount <= 20) {
        categoricalColumns.push(col);
        console.log(`📊 Columna categórica (${uniqueCount} valores): ${col}`);
        console.log(`   Valores: ${Array.from(uniqueValues).join(', ')}`);
        continue;
      }
      
      //4. Si tiene exactamente 2 valores (CUMPLE/NO CUMPLE), FORZAR
      if (uniqueCount === 2) {
        categoricalColumns.push(col);
        console.log(`✅ Columna binaria (${uniqueCount} valores): ${col}`);
        console.log(`   Valores: ${Array.from(uniqueValues).join(', ')}`);
        continue;
      }
      
      //5. Si tiene entre 21 y 50 valores, pero es texto, incluir igual
      if (uniqueCount > 20 && uniqueCount <= 50) {
        // Verificar si es texto (no numérico)
        const sample = data.slice(0, 10);
        const isText = sample.some(row => {
          const val = row[col];
          return val !== undefined && val !== null && val !== '' && isNaN(Number(val));
        });
        
        if (isText) {
          categoricalColumns.push(col);
          console.log(`📝 Columna de texto (${uniqueCount} valores): ${col}`);
        }
      }
    }
    
    console.log(`📊 Total columnas detectadas: ${categoricalColumns.length}`);
    console.log('📊 Columnas:', categoricalColumns);
    
    return categoricalColumns;
  }

  /**
   *Calcula distribucion con porcentajes
   */
  getDistribution(data: any[], column: string): any {
    if (!column || !data || data.length === 0) {
      return { labels: ['Sin datos'], data: [0], percentages: ['0%'], total: 0 };
    }
    
    const dist: Record<string, number> = {};
    data.forEach(row => {
      const value = String(row[column] || 'Sin especificar').trim();
      dist[value] = (dist[value] || 0) + 1;
    });
    
    const total = data.length;
    const sorted = Object.entries(dist).sort((a, b) => b[1] - a[1]);
    
    return {
      labels: sorted.map(i => i[0]),
      data: sorted.map(i => i[1]),
      percentages: sorted.map(i => ((i[1] / total) * 100).toFixed(1) + '%'),
      total: total
    };
  }

  /**
   * Genera datos para grafico circular
   */
  getPieData(data: any[], column: string, maxItems: number = 6): any {
    if (!column || !data || data.length === 0) {
      return { 
        labels: ['Sin datos'], 
        data: [0], 
        percentages: ['0%'], 
        total: 0,
        datasets: [{
          data: [0],
          backgroundColor: ['#e5e7eb'],
          borderColor: ['#9ca3af'],
          borderWidth: 2
        }]
      };
    }
    
    const dist = this.getDistribution(data, column);
    let labels = dist.labels.slice(0, maxItems);
    let values = dist.data.slice(0, maxItems);
    let percentages = dist.percentages.slice(0, maxItems);
    
    //Agrupar "Otros" si hay mas de maxItems
    if (dist.labels.length > maxItems) {
      const otherCount = dist.data.slice(maxItems).reduce((a: any, b: any) => a + b, 0);
      const otherPercent = ((otherCount / dist.total) * 100).toFixed(1) + '%';
      labels.push('Otros');
      values.push(otherCount);
      percentages.push(otherPercent);
    }
    
    const colors = [
      'rgba(251,146,60,0.8)', 'rgba(59,130,246,0.8)', 'rgba(52,211,153,0.8)',
      'rgba(251,191,36,0.8)', 'rgba(244,63,94,0.8)', 'rgba(139,92,246,0.8)',
      'rgba(236,72,153,0.8)', 'rgba(16,185,129,0.8)', 'rgba(245,158,11,0.8)',
      'rgba(99,102,241,0.8)'
    ];
    
    return {
      labels: labels,
      data: values,
      percentages: percentages,
      total: dist.total,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, labels.length),
        borderColor: colors.slice(0, labels.length).map(c => c.replace('0.8', '1')),
        borderWidth: 2
      }]
    };
  }

  getNumericColumns(data: any[]): string[] {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]).filter(col => {
      const sample = data.slice(0, 10);
      return sample.every(row => {
        const val = row[col];
        return val === undefined || val === null || !isNaN(Number(val));
      });
    });
  }
}
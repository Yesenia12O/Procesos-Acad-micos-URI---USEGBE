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
      'nombre_completo', 'apellidos', 'nombres', 'nombre', 'apellido', 'usuario',
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

    // Paleta de colores vibrantes y variados con intercalación óptima (50+ colores)
    const colors = [
      'rgba(59,130,246,0.85)',    // Azul brillante
      'rgba(239,68,68,0.85)',     // Rojo coral
      'rgba(212,175,55,0.85)',    // Dorado ITSQMET
      'rgba(139,92,246,0.85)',    // Púrpura
      'rgba(16,185,129,0.85)',    // Esmeralda
      'rgba(236,72,153,0.85)',    // Rosa vibrante
      'rgba(249,115,22,0.85)',    // Naranja
      'rgba(20,184,166,0.85)',    // Turquesa
      'rgba(168,85,247,0.85)',    // Violeta
      'rgba(34,197,94,0.85)',     // Verde lima brillante
      'rgba(14,165,233,0.85)',    // Cyan cielo
      'rgba(251,146,60,0.85)',    // Naranja suave
      'rgba(244,63,94,0.85)',     // Rosa fuerte
      'rgba(251,191,36,0.85)',    // Ámbar
      'rgba(99,102,241,0.85)',    // Índigo
      'rgba(45,212,191,0.85)',    // Teal brillante
      'rgba(245,158,11,0.85)',    // Amarillo dorado
      'rgba(219,39,119,0.85)',    // Magenta
      'rgba(6,182,212,0.85)',     // Cyan vibrante
      'rgba(132,204,22,0.85)',    // Verde lima claro
      'rgba(192,38,211,0.85)',    // Fucsia
      'rgba(234,179,8,0.85)',     // Amarillo brillante
      'rgba(37,99,235,0.85)',     // Azul rey
      'rgba(220,38,38,0.85)',     // Rojo intenso
      'rgba(126,34,206,0.85)',    // Morado oscuro
      'rgba(5,150,105,0.85)',     // Verde esmeralda oscuro
      'rgba(217,70,239,0.85)',    // Púrpura neón
      'rgba(234,88,12,0.85)',     // Naranja quemado
      'rgba(8,145,178,0.85)',     // Azul petróleo
      'rgba(190,18,60,0.85)',     // Rosa oscuro
      'rgba(120,53,15,0.85)',     // Marrón chocolate
      'rgba(13,148,136,0.85)',    // Verde azulado
      'rgba(237,137,54,0.85)',    // Naranja terracota
      'rgba(88,28,135,0.85)',     // Púrpura oscuro
      'rgba(21,128,61,0.85)',     // Verde bosque
      'rgba(225,29,72,0.85)',     // Rojo cereza
      'rgba(67,56,202,0.85)',     // Azul índigo profundo
      'rgba(202,138,4,0.85)',     // Dorado oscuro
      'rgba(180,83,9,0.85)',      // Naranja óxido
      'rgba(109,40,217,0.85)',    // Violeta real
      'rgba(4,120,87,0.85)',      // Verde jade
      'rgba(244,114,182,0.85)',   // Rosa chicle
      'rgba(30,58,138,0.85)',     // Azul marino
      'rgba(153,27,27,0.85)',     // Rojo granate
      'rgba(91,33,182,0.85)',     // Púrpura imperial
      'rgba(22,163,74,0.85)',     // Verde césped
      'rgba(190,24,93,0.85)',     // Rosa fucsia oscuro
      'rgba(217,119,6,0.85)',     // Naranja otoño
      'rgba(30,64,175,0.85)',     // Azul cobalto
      'rgba(101,163,13,0.85)',    // Verde oliva brillante
      'rgba(157,23,77,0.85)',     // Magenta vino
      'rgba(194,65,12,0.85)',     // Rojo ladrillo
      'rgba(79,70,229,0.85)',     // Azul periwinkle
      'rgba(4,108,78,0.85)',      // Verde pino
      'rgba(225,83,112,0.85)',    // Rosa salmón
      'rgba(161,98,7,0.85)',      // Dorado bronce
      'rgba(55,48,163,0.85)',     // Azul medianoche
      'rgba(124,45,18,0.85)',     // Marrón caoba
      'rgba(17,94,89,0.85)',      // Verde azulado profundo
      'rgba(159,18,57,0.85)'      // Rojo borgoña
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

  /**
   * Detecta columnas numéricas para histogramas
   */
  getNumericColumns(data: any[]): string[] {
    if (!data || data.length === 0) return [];

    const blacklist = [
      'id', 'cedula', 'cédula', 'identificacion', 'codigo', 'código',
      'celular', 'telefono', 'teléfono', 'movil', 'móvil', 'phone',
      'correo', 'email', 'mail'
    ];

    return Object.keys(data[0]).filter(col => {
      const lowerCol = col.toLowerCase();

      // Saltar columnas de la blacklist
      if (blacklist.some(keyword => lowerCol.includes(keyword))) {
        return false;
      }

      // Verificar que al menos el 80% de los valores sean numéricos
      let numericCount = 0;
      let totalCount = 0;

      for (const row of data) {
        const val = row[col];
        if (val !== undefined && val !== null && val !== '') {
          totalCount++;
          if (!isNaN(Number(val)) && String(val).trim() !== '') {
            numericCount++;
          }
        }
      }

      // Si más del 80% son numéricos y tiene valores variados
      if (totalCount > 0 && (numericCount / totalCount) >= 0.8) {
        // Verificar que tenga al menos 5 valores diferentes
        const uniqueValues = new Set<number>();
        for (const row of data) {
          const val = row[col];
          if (!isNaN(Number(val)) && val !== null && val !== undefined && val !== '') {
            uniqueValues.add(Number(val));
          }
        }
        return uniqueValues.size >= 5;
      }

      return false;
    });
  }

  /**
   * Genera datos para histograma (columnas numéricas)
   */
  getHistogramData(data: any[], column: string, bins: number = 10): any {
    if (!data || data.length === 0 || !column) {
      return null;
    }

    // Extraer valores numéricos
    const values: number[] = [];
    data.forEach(row => {
      const val = Number(row[column]);
      if (!isNaN(val) && val !== null && val !== undefined) {
        values.push(val);
      }
    });

    if (values.length === 0) return null;

    // Calcular rango
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const binSize = range / bins;

    // Crear bins
    const histogram: Record<string, number> = {};
    const labels: string[] = [];

    for (let i = 0; i < bins; i++) {
      const binStart = min + (i * binSize);
      const binEnd = binStart + binSize;
      const label = `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`;
      labels.push(label);
      histogram[label] = 0;
    }

    // Contar valores en cada bin
    values.forEach(val => {
      const binIndex = Math.min(Math.floor((val - min) / binSize), bins - 1);
      const label = labels[binIndex];
      histogram[label]++;
    });

    return {
      labels: labels,
      data: Object.values(histogram),
      min: min.toFixed(2),
      max: max.toFixed(2),
      avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
      total: values.length
    };
  }
}

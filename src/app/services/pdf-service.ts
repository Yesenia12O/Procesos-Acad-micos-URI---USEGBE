import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  constructor() { }

  /**
   * Genera un PDF con los gráficos y estadísticas del dashboard
   */
  async generateDashboardPDF(
    chartContainer: HTMLElement,
    statistics: any,
    selectedCareer: string,
    filteredDataLength: number,
    totalDataLength: number,
    filteredData: any[] // Datos para análisis
  ): Promise<void> {
    try {
      console.log('🚀 Iniciando generación de PDF...');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // ========== CARGAR LOGO ==========
      // Usar el logo oficial de ITSQMET (escudo + texto + sello categoría universitaria)
      const logoImg = await this.loadImage('/images/itsqmet.jpg');

      // ========== ENCABEZADO ESTILO TABLA ==========
      const headerHeight = 40; // Aumentado para mejor espaciado
      const logoWidth = 65; // Ajustado para logo horizontal
      const codeWidth = 50;
      const centerWidth = pageWidth - 2 * margin - logoWidth - codeWidth;

      // Borde exterior del encabezado
      pdf.setDrawColor(80, 80, 80);
      pdf.setLineWidth(0.5);
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, headerHeight);

      // Línea vertical 1 (después del logo)
      pdf.line(margin + logoWidth, yPosition, margin + logoWidth, yPosition + headerHeight);

      // Línea vertical 2 (antes del código)
      pdf.line(pageWidth - margin - codeWidth, yPosition, pageWidth - margin - codeWidth, yPosition + headerHeight);

      // Línea horizontal central
      const midHeight = yPosition + headerHeight / 2;
      pdf.line(margin + logoWidth, midHeight, pageWidth - margin, midHeight);

      // === COLUMNA 1: LOGO ===
      if (logoImg) {
        // Logo horizontal completo
        const logoMaxHeight = 32;
        const logoMaxWidth = logoWidth - 6; // Margen interno
        const logoAspect = logoImg.width / logoImg.height;

        // Calcular dimensiones manteniendo proporción
        let logoDisplayWidth = logoMaxHeight * logoAspect;
        let logoDisplayHeight = logoMaxHeight;

        if (logoDisplayWidth > logoMaxWidth) {
          logoDisplayWidth = logoMaxWidth;
          logoDisplayHeight = logoDisplayWidth / logoAspect;
        }

        const logoX = margin + (logoWidth - logoDisplayWidth) / 2;
        const logoY = yPosition + (headerHeight - logoDisplayHeight) / 2;

        pdf.addImage(logoImg, 'JPEG', logoX, logoY, logoDisplayWidth, logoDisplayHeight);
      } else {
        // Fallback si no se carga el logo
        pdf.setFontSize(7);
        pdf.setTextColor(26, 61, 61);
        const logoCenterX = margin + logoWidth / 2;
        pdf.text('ITSQMET', logoCenterX, yPosition + 16, { align: 'center' });
        pdf.setFontSize(5);
        pdf.text('Instituto Superior', logoCenterX, yPosition + 20, { align: 'center' });
        pdf.text('Universitario', logoCenterX, yPosition + 23, { align: 'center' });
      }

      // === COLUMNA 2: INFORMACIÓN CENTRAL ===
      const centerX = margin + logoWidth + centerWidth / 2;

      // Parte superior - Unidad de Seguimiento
      pdf.setFontSize(7.5);
      pdf.setTextColor(60, 60, 60);
      const unidad1 = 'Unidad de Seguimiento a Egresados,';
      const unidad2 = 'Graduados, y Bolsa de Empleo';
      pdf.text(unidad1, centerX, yPosition + 9, { align: 'center' });
      pdf.text(unidad2, centerX, yPosition + 14, { align: 'center' });

      // Parte inferior - Título del dashboard
      pdf.setFontSize(7.5);
      pdf.setTextColor(40, 40, 40);
      const titulo = selectedCareer === 'Todas'
        ? 'Dashboard de Análisis - Todas las Carreras'
        : `Dashboard de Análisis - ${selectedCareer}`;

      // Dividir título en líneas si es muy largo
      const maxWidth = centerWidth - 6;
      const titleLines = pdf.splitTextToSize(titulo, maxWidth);
      const titleStartY = midHeight + 7;

      titleLines.forEach((line: string, index: number) => {
        pdf.text(line, centerX, titleStartY + (index * 4), { align: 'center' });
      });

      // === COLUMNA 3: CÓDIGO Y FECHA ===
      const codeX = pageWidth - margin - codeWidth / 2;

      // Título "Código:" - centrado en la parte superior
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 100, 100);
      pdf.text('Código:', codeX, yPosition + 11, { align: 'center' });

      // Fecha de generación - centrado en la parte inferior
      pdf.setFontSize(6.5);
      pdf.setTextColor(80, 80, 80);
      const fecha = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      pdf.text(`Fecha: ${fecha}`, codeX, midHeight + 11, { align: 'center' });

      yPosition += headerHeight + 10;

      // ========== TÍTULO PRINCIPAL ==========
      pdf.setFontSize(9);
      pdf.setTextColor(60, 60, 60);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Análisis de Datos', pageWidth / 2, yPosition, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      yPosition += 6;

      // ========== GRÁFICOS CON TÍTULOS ==========
      const charts = Array.from(chartContainer.children) as HTMLElement[];
      console.log(`📊 Total de gráficos a capturar: ${charts.length}`);

      if (charts.length === 0) {
        pdf.setFontSize(10);
        pdf.setTextColor(150, 150, 150);
        pdf.text('No hay gráficos para mostrar', pageWidth / 2, yPosition + 20, { align: 'center' });
      } else {
        const chartsPerRow = 1; // 1 gráfico por fila (uno debajo del otro)
        const spacing = 8;
        const chartWidth = pageWidth - 2 * margin; // Ancho completo
        const chartHeight = 60; // Altura compacta para que quepan 2 por página
        const titleHeight = 10;
        const interpretationLabelHeight = 6;
        const analysisHeight = 30; // MÁS ESPACIO para interpretación detallada

        for (let i = 0; i < charts.length; i++) {
          const col = i % chartsPerRow;

          // Verificar espacio para el gráfico completo
          const totalHeight = titleHeight + chartHeight + interpretationLabelHeight + analysisHeight + spacing;
          if (yPosition + totalHeight > pageHeight - margin - 15) {
            pdf.addPage();
            yPosition = margin + 5;
            console.log('📄 Nueva página agregada');
          }

          const chart = charts[i];
          const xPos = margin; // Siempre desde el margen izquierdo

          // Extraer el título del gráfico desde el elemento del DOM
          const titleElement = chart.querySelector('span[title]');
          let chartTitle = 'Gráfico';

          if (titleElement) {
            chartTitle = titleElement.getAttribute('title') || titleElement.textContent?.trim() || `Gráfico ${i + 1}`;
          }

          // ========== 1. TÍTULO DEL GRÁFICO (arriba, centrado, negrita) ==========
          pdf.setFontSize(10);
          pdf.setTextColor(30, 30, 30);
          pdf.setFont('helvetica', 'bold');

          const maxTitleLength = 60; // Mayor longitud para títulos completos
          const displayTitle = chartTitle.length > maxTitleLength
            ? chartTitle.substring(0, maxTitleLength) + '...'
            : chartTitle;

          // Título con numeración
          const chartNumber = i + 1;
          pdf.text(`${chartNumber}. ${displayTitle}`, pageWidth / 2, yPosition + 6, { align: 'center' });
          pdf.setFont('helvetica', 'normal');

          const chartYPos = yPosition + titleHeight;

          try {
            console.log(`📸 Capturando gráfico ${i + 1}/${charts.length}: ${chartTitle}...`);

            // Encontrar el canvas del gráfico (Chart.js)
            const canvasElement = chart.querySelector('canvas');

            if (canvasElement) {
              console.log('✅ Canvas encontrado, capturando con máxima calidad...');

              // Crear un canvas temporal con resolución 4K
              const tempCanvas = document.createElement('canvas');
              const scale = 4; // Cuadruplicar resolución para calidad 4K
              tempCanvas.width = canvasElement.width * scale;
              tempCanvas.height = canvasElement.height * scale;

              const tempCtx = tempCanvas.getContext('2d');
              if (tempCtx) {
                // Habilitar suavizado de máxima calidad
                tempCtx.imageSmoothingEnabled = true;
                tempCtx.imageSmoothingQuality = 'high';

                // Escalar y dibujar
                tempCtx.scale(scale, scale);
                tempCtx.drawImage(canvasElement, 0, 0);
              }

              const imgData = tempCanvas.toDataURL('image/png', 1.0);

              // Marco más elegante
              pdf.setDrawColor(180, 180, 180);
              pdf.setLineWidth(0.4);
              pdf.rect(xPos, chartYPos, chartWidth, chartHeight);

              // Usar compresión 'SLOW' para mejor calidad
              pdf.addImage(imgData, 'PNG', xPos + 2, chartYPos + 2, chartWidth - 4, chartHeight - 4, undefined, 'SLOW');

              console.log(`✅ Gráfico ${i + 1} agregado con calidad 4K`);
            } else {
              console.log('⚠️ No se encontró canvas, usando html2canvas con máxima resolución...');

              const canvas = await html2canvas(chart, {
                scale: 4, // Cuadruplicar escala para calidad 4K
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
                allowTaint: true,
                foreignObjectRendering: false,
                imageTimeout: 15000
              });

              const imgData = canvas.toDataURL('image/png', 1.0);

              pdf.setDrawColor(180, 180, 180);
              pdf.setLineWidth(0.4);
              pdf.rect(xPos, chartYPos, chartWidth, chartHeight);

              pdf.addImage(imgData, 'PNG', xPos + 2, chartYPos + 2, chartWidth - 4, chartHeight - 4, undefined, 'SLOW');

              console.log(`✅ Gráfico ${i + 1} agregado con html2canvas en calidad 4K`);
            }

            // ========== 3. INTERPRETACIÓN (título en negrita) ==========
            const interpretationYPos = chartYPos + chartHeight + 4;

            pdf.setFontSize(10);
            pdf.setTextColor(20, 20, 20);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Interpretación:', xPos + 3, interpretationYPos);
            pdf.setFont('helvetica', 'normal');

            // ========== 4. ANÁLISIS DESCRIPTIVO (viñetas debajo) ==========
            const analysisYPos = interpretationYPos + 5.5;

            // Calcular distribución de datos para este gráfico
            const distribution = this.calculateDistribution(filteredData, chartTitle);

            if (distribution && distribution.length > 0) {
              pdf.setFontSize(9);
              pdf.setTextColor(40, 40, 40);

              // Generar texto de análisis narrativo profesional y DETALLADO
              const analysisLines: string[] = [];
              const total = distribution.reduce((sum, item) => sum + item.count, 0);

              // Ordenar por cantidad descendente
              const sortedDist = distribution.sort((a, b) => b.count - a.count);

              // ANÁLISIS DETALLADO: Mostrar hasta 5 categorías principales
              const topCategories = sortedDist.slice(0, Math.min(5, sortedDist.length));

              topCategories.forEach((item, index) => {
                const percentage = ((item.count / total) * 100).toFixed(2);
                let line = '';

                if (index === 0) {
                  // Primera categoría (predominante) - MÁS DETALLE
                  if (sortedDist.length === 1) {
                    line = `El 100% de los participantes (${item.count} personas de un total de ${total}) corresponde a "${item.label}". No existen otras respuestas registradas en esta categoría.`;
                  } else if (sortedDist.length === 2) {
                    line = `El ${percentage}% de los participantes (${item.count} personas de un total de ${total}) indicó que ${item.label.toLowerCase()}, constituyendo la opción mayoritaria en esta pregunta.`;
                  } else {
                    const diff = item.count - sortedDist[1].count;
                    line = `El ${percentage}% de los participantes (${item.count} personas de un total de ${total}) indicó que ${item.label.toLowerCase()}, posicionándose como la respuesta predominante con una diferencia de ${diff} respuesta(s) sobre la segunda opción más seleccionada.`;
                  }
                } else if (index === 1) {
                  // Segunda categoría - CON COMPARACIÓN
                  const percentDiff = ((item.count / total) * 100).toFixed(2);
                  line = `El ${percentDiff}% de los encuestados (${item.count} personas) señaló que ${item.label.toLowerCase()}, representando la segunda opción más frecuente.`;
                } else if (index === 2) {
                  // Tercera categoría - CON CONTEXTO
                  line = `El ${percentage}% (${item.count} respuestas) corresponde a "${item.label}", ocupando la tercera posición en frecuencia.`;
                } else if (index === 3) {
                  // Cuarta categoría
                  line = `Un ${percentage}% adicional (${item.count} personas) seleccionó "${item.label}" como respuesta.`;
                } else if (index === 4) {
                  // Quinta categoría
                  line = `El ${percentage}% restante de las principales respuestas (${item.count} personas) corresponde a "${item.label}".`;
                }

                analysisLines.push(line);
              });

              // Si hay más de 5 categorías, agregar resumen de "Otros" con detalle
              if (sortedDist.length > 5) {
                const othersData = sortedDist.slice(5);
                const othersCount = othersData.reduce((sum, item) => sum + item.count, 0);
                const othersPercentage = ((othersCount / total) * 100).toFixed(2);
                const othersCategories = othersData.length;

                const othersLine = `El ${othersPercentage}% restante (${othersCount} respuestas) se distribuye entre ${othersCategories} categoría(s) adicional(es) con menor frecuencia: ${othersData.slice(0, 3).map(d => d.label).join(', ')}${othersCategories > 3 ? ', entre otras' : ''}.`;
                analysisLines.push(othersLine);
              }

              // AGREGAR RESUMEN ESTADÍSTICO FINAL
              if (sortedDist.length > 2) {
                const topThreeCount = sortedDist.slice(0, 3).reduce((sum, item) => sum + item.count, 0);
                const topThreePercent = ((topThreeCount / total) * 100).toFixed(2);
                const topThreePercentNum = parseFloat(topThreePercent);
                analysisLines.push(`En resumen, las tres opciones principales concentran el ${topThreePercent}% del total de respuestas (${topThreeCount} de ${total} personas), evidenciando ${topThreePercentNum > 75 ? 'una clara tendencia' : 'una distribución relativamente equilibrada'} en las preferencias.`);
              }

              // Dibujar el análisis con viñetas
              let analysisY = analysisYPos;
              analysisLines.forEach(line => {
                // Agregar viñeta
                pdf.setFont('helvetica', 'bold');
                pdf.text('•', xPos + 5, analysisY);
                pdf.setFont('helvetica', 'normal');

                // Texto con indentación para la viñeta
                const wrappedLines = pdf.splitTextToSize(line, chartWidth - 14);
                wrappedLines.forEach((wrappedLine: string, lineIndex: number) => {
                  if (analysisY < pageHeight - margin - 5) {
                    pdf.text(wrappedLine, xPos + 10, analysisY, { align: 'left', maxWidth: chartWidth - 14 });
                    analysisY += 4;
                  }
                });
                analysisY += 0.5; // Espacio extra entre viñetas
              });
            }

          } catch (error) {
            console.error(`❌ Error capturando gráfico ${i + 1}:`, error);

            pdf.setFillColor(255, 240, 240);
            pdf.rect(xPos, chartYPos, chartWidth, chartHeight, 'F');
            pdf.setDrawColor(220, 38, 38);
            pdf.rect(xPos, chartYPos, chartWidth, chartHeight, 'S');
            pdf.setFontSize(8);
            pdf.setTextColor(220, 38, 38);
            pdf.text('Error al capturar gráfico', pageWidth / 2, chartYPos + chartHeight / 2, { align: 'center' });
          }

          // Avanzar a la siguiente posición (cada gráfico en su propia fila)
          yPosition += titleHeight + chartHeight + interpretationLabelHeight + analysisHeight + spacing;
        }
      }

      // ========== FOOTER EN CADA PÁGINA ==========
      const totalPages = pdf.getNumberOfPages();
      console.log(`📄 Total de páginas: ${totalPages}`);

      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);

        // Línea superior del footer
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.3);
        pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

        // Texto del footer
        pdf.setFontSize(6.5);
        pdf.setTextColor(120, 120, 120);
        pdf.text(
          `USEGBE - Instituto Tecnológico Superior Quito Metropolitano`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );

        pdf.setFontSize(6);
        pdf.text(
          `Página ${i} de ${totalPages}`,
          pageWidth - margin,
          pageHeight - 8,
          { align: 'right' }
        );
      }

      // Guardar el PDF
      const fileName = `USEGBE_Dashboard_${selectedCareer}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      console.log('✅ PDF guardado exitosamente:', fileName);

      return Promise.resolve();
    } catch (error) {
      console.error('❌ Error generando PDF:', error);
      return Promise.reject(error);
    }
  }

  /**
   * Carga una imagen como base64 para usar en el PDF
   */
  private async loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.warn(`⚠️ No se pudo cargar el logo: ${url}`);
        resolve(null);
      };
      img.src = url;
    });
  }

  /**
   * Calcula la distribución de valores para una columna específica
   */
  private calculateDistribution(data: any[], columnName: string): Array<{label: string, count: number}> | null {
    if (!data || data.length === 0 || !columnName) {
      return null;
    }

    const distribution: Record<string, number> = {};

    data.forEach(row => {
      const value = String(row[columnName] || 'Sin especificar').trim();
      distribution[value] = (distribution[value] || 0) + 1;
    });

    return Object.entries(distribution).map(([label, count]) => ({
      label,
      count
    }));
  }

  /**
   * Genera un PDF simple con solo las estadísticas (sin gráficos)
   */
  async generateStatisticsPDF(
    statistics: any,
    selectedCareer: string,
    data: any[]
  ): Promise<void> {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      let yPosition = margin;

      // Header
      pdf.setFontSize(18);
      pdf.setTextColor(26, 61, 61); // Verde oscuro ITSQMET
      pdf.text('Reporte Estadistico USEGBE', pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 8;
      pdf.setFontSize(10);
      pdf.setTextColor(212, 175, 55); // Dorado ITSQMET
      pdf.text('Instituto Tecnologico Universitario Quito Metropolitano', pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 10;
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generado: ${new Date().toLocaleString('es-ES')}`, pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 15;

      // Estadísticas
      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Resumen de Datos', margin, yPosition);

      yPosition += 8;
      pdf.setFontSize(10);
      pdf.text(`Total de Registros: ${statistics.totalRecords || 0}`, margin + 5, yPosition);
      yPosition += 7;
      pdf.text(`Total de Columnas: ${statistics.totalColumns || 0}`, margin + 5, yPosition);
      yPosition += 7;
      pdf.text(`Carrera Seleccionada: ${selectedCareer}`, margin + 5, yPosition);
      yPosition += 7;
      pdf.text(`Registros Filtrados: ${data.length}`, margin + 5, yPosition);

      // Guardar
      const fileName = `USEGBE_Estadisticas_${selectedCareer}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      return Promise.resolve();
    } catch (error) {
      console.error('Error generando PDF de estadísticas:', error);
      return Promise.reject(error);
    }
  }
}

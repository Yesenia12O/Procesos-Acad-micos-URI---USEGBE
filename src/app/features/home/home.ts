import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import * as XLSX from 'xlsx';
import { ExcelService } from '../../services/excel-service';
import { StatisticsService } from '../../services/statistics.service';

Chart.register(...registerables, ChartDataLabels);

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit, AfterViewInit {
  @ViewChild('chartContainer') chartContainer!: ElementRef;

  //Datos
  excelData: any[] = [];
  filteredData: any[] = [];
  columns: string[] = [];
  categoricalColumns: string[] = [];
  processedData: any[] = []; //Datos procesados para mostrar

  //Filtros
  careerColumn: string | null = null;
  careers: string[] = [];
  selectedCareer: string = 'Todas';
  hasCareerColumn: boolean = false;

  //Graficos
  chartInstances: Chart[] = [];
  chartConfigs: any[] = [];
  visibleCharts: number = 6;
  chartsPerPage: number = 6;
  chartsGenerated: boolean = false; //Controlar generación

  //Estados
  isLoading: boolean = false;
  isProcessing: boolean = false;
  errorMessage: string = '';
  fileName: string = '';
  hasData: boolean = false;

  //Estadisticas
  statistics: any = {};
  columnDebugInfo: any = {};

  //Optimizació¿on
  visibleRows: number = 50;
  private readonly ROWS_PER_LOAD = 50;
  private readonly CHUNK_SIZE = 1000;

  constructor(
    private excelService: ExcelService,
    private statisticsService: StatisticsService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void { }
  ngAfterViewInit(): void { }

  //========== SELECCION DE ARCHIVO ==========
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(fileExtension)) {
      this.errorMessage = 'Por favor, selecciona un archivo Excel válido (.xlsx, .xls, .csv)';
      return;
    }

    this.fileName = file.name;
    this.errorMessage = '';
    this.chartsGenerated = false; //Resetear estado

    //Guardar archivo para procesar despues
    this.pendingFile = file;

    //Mostrar mensaje de archivo cargado
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }, 500);
  }

  private pendingFile: File | null = null;

  //========== BOTON GENERAR ==========
  async generateDashboard(): Promise<void> {
    if (!this.pendingFile) {
      this.errorMessage = 'Por favor, selecciona un archivo primero';
      return;
    }

    this.isProcessing = true;
    this.errorMessage = '';
    this.chartsGenerated = false;

    try {
      console.log('📊 Generando dashboard con:', this.pendingFile.name);
      const data = await this.excelService.readExcel(this.pendingFile);

      if (!data || data.length === 0) {
        this.errorMessage = 'El archivo está vacío o no tiene datos válidos';
        this.isProcessing = false;
        return;
      }

      console.log('📊 Datos cargados:', data.length, 'registros');

      //Procesar datos
      await this.processData(data);

      //Generar gráficos
      this.generateCharts();

      this.chartsGenerated = true;
      this.isProcessing = false;
      this.cdr.detectChanges();

      console.log('✅ Dashboard generado correctamente');
    } catch (error) {
      console.error('❌ Error:', error);
      this.errorMessage = 'Error al procesar el archivo. Verifica que sea un Excel válido.';
      this.isProcessing = false;
    }
  }
  //En home.ts
forceAllCharts(): void {
  //Forzar TODAS las columnas como categoricas
  const blacklist = ['id', 'cedula', 'cédula', 'identificacion', 'correo', 'email'];
  this.categoricalColumns = this.columns.filter(col => {
    const lowerCol = col.toLowerCase();
    return !blacklist.some(keyword => lowerCol.includes(keyword));
  });
  
  //Regenerar graficos
  this.destroyAllCharts();
  this.generateCharts();
  this.cdr.detectChanges();
}

  //========== PROCESAR DATOS ==========
  private async processData(data: any[]): Promise<void> {
    return new Promise((resolve) => {
      this.excelData = data;
      this.hasData = true;

      //Detectar columnas
      this.columns = Object.keys(data[0]);
      console.log('📋 Columnas:', this.columns);
      //Debug: Mostrar columnas detectadas
      console.log('📋 TODAS LAS COLUMNAS:', this.columns);
      console.log('📊 COLUMNAS CATEGÓRICAS DETECTADAS:', this.categoricalColumns);
      //Forzar deteccion de columnas
      this.categoricalColumns = this.statisticsService.getCategoricalColumns(this.excelData);

      //Si hay pocas columnas detectadas, forzar todas las columnas excepto las de ID
      if (this.categoricalColumns.length < 5 && this.columns.length > 5) {
        console.log('⚠️ Pocas columnas detectadas, forzando todas...');
        const blacklist = ['id', 'cedula', 'cédula', 'identificacion', 'correo', 'email'];
        this.categoricalColumns = this.columns.filter(col => {
          const lowerCol = col.toLowerCase();
          return !blacklist.some(keyword => lowerCol.includes(keyword));
        });
      }

      console.log('📊 Columnas categóricas FINALES:', this.categoricalColumns);

      //Mostrar en pantalla para depuracion
      this.columnDebugInfo = {
        total: this.columns.length,
        categorical: this.categoricalColumns.length,
        missing: this.columns.filter(c => !this.categoricalColumns.includes(c))
      };
      console.log('⚠️ Columnas NO graficadas:', this.columnDebugInfo.missing);

      //Detectar columna de carreras
      this.careerColumn = this.excelService.detectCareerColumn(this.excelData);
      this.hasCareerColumn = this.careerColumn !== null;
      console.log('🎓 Carrera columna:', this.careerColumn);

      if (this.careerColumn) {
        this.careers = this.excelService.getUniqueCareers(this.excelData, this.careerColumn);
        this.selectedCareer = 'Todas';
        this.filteredData = this.excelData;
      } else {
        this.filteredData = this.excelData;
      }

      //Detectar columnas categoricas
      const allCategorical = this.statisticsService.getCategoricalColumns(this.excelData);
      console.log('📊 Categóricas:', allCategorical);

      this.categoricalColumns = allCategorical.slice(0, 15); // Limitar a 15

      if (this.careerColumn && !this.categoricalColumns.includes(this.careerColumn)) {
        this.categoricalColumns.unshift(this.careerColumn);
      }

      this.statistics = this.excelService.getStatistics(this.excelData);
      this.visibleRows = Math.min(50, this.filteredData.length);
      this.visibleCharts = Math.min(6, this.categoricalColumns.length);


      resolve();
    });
  }

  //========== GENERAR GRAFICOS ==========
  private generateCharts(): void {
    console.log('🔄 Generando gráficos...');
    this.destroyAllCharts();
    this.chartConfigs = [];

    if (this.categoricalColumns.length === 0) {
      console.warn('⚠️ No hay columnas categóricas');
      return;
    }

    //Crear graficos poco a poco
    const chartsToShow = this.categoricalColumns.slice(0, this.visibleCharts);

    //Usar setTimeout para no bloquear la UI
    setTimeout(() => {
      for (const col of chartsToShow) {
        this.createPieChart(col);
      }
      this.cdr.detectChanges();
      console.log('✅ Gráficos generados:', this.chartConfigs.length);
    }, 100);
  }

  //==========FILTRO POR CARRERA==========
  filterByCareer(): void {
    if (!this.careerColumn) {
      this.filteredData = this.excelData;
    } else {
      this.filteredData = this.selectedCareer === 'Todas'
        ? this.excelData
        : this.excelService.filterByCareer(this.excelData, this.careerColumn, this.selectedCareer);
    }

    this.visibleRows = Math.min(50, this.filteredData.length);

    //Regenerar graficos con filtro
    if (this.chartsGenerated) {
      setTimeout(() => {
        this.generateCharts();
        this.cdr.detectChanges();
      }, 200);
    }
  }

  //==========CARGAR MAS GRAFICOS==========
  loadMoreCharts(): void {
    const currentCount = this.chartConfigs.length;
    const newCount = Math.min(
      currentCount + this.chartsPerPage,
      this.categoricalColumns.length
    );

    const newColumns = this.categoricalColumns.slice(currentCount, newCount);
    for (const col of newColumns) {
      this.createPieChart(col);
    }

    this.visibleCharts = newCount;
    this.cdr.detectChanges();
  }

  //==========CREAR GRAFICO CIRCULAR COMPACTO==========
  createPieChart(column: string): void {
    //Crear contenedor
    const container = document.createElement('div');
    container.className = 'chart-item bg-white rounded-lg shadow-sm border border-gray-200 p-2';
    container.style.height = '200px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    //Titulo
    const title = document.createElement('div');
    title.className = 'flex items-center gap-1 mb-1 flex-shrink-0';
    title.innerHTML = `
      <span class="material-icons text-blue-500 text-sm">pie_chart</span>
      <span class="text-[10px] font-medium text-gray-700 truncate" title="${column}">${this.truncateText(column, 20)}</span>
    `;
    container.appendChild(title);

    //Canvas
    const canvasWrapper = document.createElement('div');
    canvasWrapper.style.flex = '1';
    canvasWrapper.style.minHeight = '0';
    canvasWrapper.style.position = 'relative';

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvasWrapper.appendChild(canvas);
    container.appendChild(canvasWrapper);

    //Agregar al contenedor
    if (this.chartContainer) {
      this.chartContainer.nativeElement.appendChild(container);
    }

    //Crear grafico
    const ctx = canvas.getContext('2d');
    const data = this.statisticsService.getPieData(this.filteredData, column, 5);

    const chart = new Chart(ctx!, {
      type: 'doughnut',
      data: {
        labels: data.labels,
        datasets: data.datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { size: 7 },
              padding: 2,
              boxWidth: 8,
              generateLabels: function (chart: any) {
                const data = chart.data;
                return data.labels.map((label: string, i: number) => ({
                  text: `${label} (${data.datasets[0].data[i]})`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  strokeStyle: data.datasets[0].borderColor[i],
                  hidden: false,
                  index: i
                }));
              }
            }
          },
          datalabels: {
            color: '#fff',
            font: {
              weight: 'bold',
              size: 8
            },
            formatter: (value: number, context: any) => {
              const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
              if (total === 0) return '0%';
              return ((value / total) * 100).toFixed(1) + '%';
            },
            anchor: 'center',
            align: 'center',
            offset: 0
          }
        }
      },
      plugins: [ChartDataLabels]
    });

    this.chartInstances.push(chart);
    this.chartConfigs.push({ column, chart });
  }

  //========== TRUNCAR TEXTO ==========
  private truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  //========== DESTRUIR GRAFICOS ==========
  destroyAllCharts(): void {
    this.chartInstances.forEach(chart => chart.destroy());
    this.chartInstances = [];
    this.chartConfigs = [];

    if (this.chartContainer) {
      this.chartContainer.nativeElement.innerHTML = '';
    }
  }

  //========== LIMPIAR TODO ==========
  clearAll(): void {
    this.destroyAllCharts();
    this.excelData = [];
    this.filteredData = [];
    this.columns = [];
    this.categoricalColumns = [];
    this.careers = [];
    this.selectedCareer = 'Todas';
    this.hasData = false;
    this.hasCareerColumn = false;
    this.fileName = '';
    this.statistics = {};
    this.visibleRows = 50;
    this.visibleCharts = 6;
    this.chartsGenerated = false;
    this.pendingFile = null;
    this.errorMessage = '';
    this.cdr.detectChanges();
  }

  //========== DESCARGAR ==========
  downloadFilteredData(): void {
    if (!this.filteredData || this.filteredData.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(this.filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');
    const fileName = `USEGBE_${this.selectedCareer}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }

  //========== CARGA PROGRESIVA DE FILAS ==========
  loadMoreRows(): void {
    this.visibleRows = Math.min(
      this.visibleRows + this.ROWS_PER_LOAD,
      this.filteredData.length
    );
  }
}
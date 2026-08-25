import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { ExcelService } from '../../services/excel-service';
import { StatisticsService } from '../../services/statistics.service';
import { PdfService } from '../../services/pdf-service';

Chart.register(...registerables, ChartDataLabels);

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css', './home-effects.css'],
})
export class Home implements OnInit, AfterViewInit {
  @ViewChild('chartContainer') chartContainer!: ElementRef;

  //Datos
  excelData: any[] = [];
  filteredData: any[] = [];
  columns: string[] = [];
  categoricalColumns: string[] = [];
  numericColumns: string[] = []; // Nueva: columnas numéricas
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

  //Editor de gráficos
  selectedCharts: Set<number> = new Set(); // Gráficos seleccionados para exportar
  editMode: boolean = false; // Modo de edición activado
  showChartEditor: boolean = false; // Mostrar panel de edición

  //🆕 PANEL DE FILTROS AVANZADO
  showFilterPanel: boolean = false; // Mostrar/ocultar panel
  availableFilters: { column: string; values: string[]; selectedValues: Set<string> }[] = []; // Filtros disponibles

  //Estados
  isLoading: boolean = false;
  isProcessing: boolean = false;
  errorMessage: string = '';
  fileName: string = '';
  hasData: boolean = false;
  isDragging: boolean = false;

  //Búsqueda
  searchTerm: string = '';

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
    private pdfService: PdfService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
  }
  ngAfterViewInit(): void { }

  //========== SELECCION DE ARCHIVO ==========
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    this.validateAndLoadFile(file);
  }

  //========== DRAG & DROP ==========
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.validateAndLoadFile(files[0]);
    }
  }

  //========== VALIDAR Y CARGAR ARCHIVO ==========
  private validateAndLoadFile(file: File): void {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
      this.errorMessage = 'Por favor, selecciona un archivo Excel válido (.xlsx, .xls, .csv)';
      return;
    }

    // Validar tamaño (máximo 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      this.errorMessage = 'El archivo es demasiado grande. Máximo 10MB permitido.';
      return;
    }

    this.fileName = file.name;
    this.errorMessage = '';
    this.chartsGenerated = false;
    this.pendingFile = file;

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
  const blacklist = ['id', 'cedula', 'cédula', 'identificacion', 'correo', 'email', 'nombres', 'nombre', 'apellidos', 'apellido', 'nombre_completo', 'telefono', 'teléfono', 'direccion', 'dirección'];
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
        const blacklist = ['id', 'cedula', 'cédula', 'identificacion', 'correo', 'email', 'nombres', 'nombre', 'apellidos', 'apellido', 'nombre_completo', 'telefono', 'teléfono', 'direccion', 'dirección'];
        this.categoricalColumns = this.columns.filter(col => {
          const lowerCol = col.toLowerCase();
          return !blacklist.some(keyword => lowerCol.includes(keyword));
        });
      }

      console.log('📊 Columnas categóricas FINALES:', this.categoricalColumns);

      //Detectar columnas numéricas para histogramas
      this.numericColumns = this.statisticsService.getNumericColumns(this.excelData);
      console.log('📈 Columnas numéricas detectadas:', this.numericColumns);

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

      // Inicializar panel de filtros
      this.initializeFilterPanel();

      resolve();
    });
  }

  //========== GENERAR GRAFICOS ==========
  private generateCharts(): void {
    console.log('🔄 Generando gráficos...');
    this.destroyAllCharts();
    this.chartConfigs = [];

    if (this.categoricalColumns.length === 0 && this.numericColumns.length === 0) {
      console.warn('⚠️ No hay columnas para graficar');
      return;
    }

    //Crear graficos categoricos
    const chartsToShow = this.categoricalColumns.slice(0, this.visibleCharts);

    //Usar setTimeout para no bloquear la UI
    setTimeout(() => {
      // Gráficos categóricos
      for (const col of chartsToShow) {
        this.createChart(col);
      }

      // Gráficos numéricos (histogramas) - máximo 3
      const numericToShow = this.numericColumns.slice(0, 3);
      for (const col of numericToShow) {
        this.createHistogram(col);
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
      this.createChart(col);
    }

    this.visibleCharts = newCount;
    this.cdr.detectChanges();
  }

  //========== CREAR GRÁFICO (PIE, DOUGHNUT O BAR) ==========
  createChart(column: string): void {
    const dist = this.statisticsService.getDistribution(this.filteredData, column);
    const uniqueCount = dist.labels.length;

    // Decidir tipo de gráfico según cantidad de categorías
    if (uniqueCount === 2) {
      // 2 categorías: Gráfico de pastel completo (ideal para binarios como Sí/No, Cumple/No Cumple)
      this.createFullPieChart(column);
    } else if (uniqueCount <= 5) {
      // 3-5 categorías: Gráfico de dona
      this.createPieChart(column);
    } else {
      // Más de 5 categorías: Gráfico de barras
      this.createBarChart(column);
    }
  }

  //========== CREAR GRÁFICO DE BARRAS ==========
  createBarChart(column: string): void {
    const container = document.createElement('div');
    const chartIndex = this.chartConfigs.length; // Índice antes de agregar

    container.className = 'chart-item bg-white rounded-lg shadow-sm border border-gray-200 p-2 relative';
    container.style.height = '200px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.setAttribute('data-chart-index', chartIndex.toString());

    // Agregar evento de click para modo edición
    container.addEventListener('click', () => {
      if (this.editMode) {
        this.toggleChartSelection(chartIndex);
        this.updateChartSelectionUI(container, chartIndex);
      }
    });

    const title = document.createElement('div');
    title.className = 'flex items-center gap-1 mb-1 flex-shrink-0';
    title.innerHTML = `
      <span class="material-icons text-green-500 text-sm">bar_chart</span>
      <span class="text-[10px] font-medium text-gray-700 truncate" title="${column}">${this.truncateText(column, 20)}</span>
    `;
    container.appendChild(title);

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

    if (this.chartContainer) {
      this.chartContainer.nativeElement.appendChild(container);
    }

    const ctx = canvas.getContext('2d');
    const data = this.statisticsService.getPieData(this.filteredData, column, 10);

    // Generar colores dinámicos intercalados para cada barra
    const barColors = this.generateBarColors(data.labels.length);

    const chart = new Chart(ctx!, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Cantidad',
          data: data.data,
          backgroundColor: barColors.background,
          borderColor: barColors.border,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: {
            display: false
          },
          datalabels: {
            color: '#fff',
            font: {
              weight: 'bold',
              size: 8
            },
            anchor: 'end',
            align: 'start',
            formatter: (value: number) => value
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              font: { size: 8 }
            }
          },
          y: {
            ticks: {
              font: { size: 7 }
            }
          }
        }
      },
      plugins: [ChartDataLabels]
    });

    this.chartInstances.push(chart);
    this.chartConfigs.push({ column, chart });
  }

  //==========CREAR GRAFICO DE PASTEL COMPLETO (PIE)==========
  createFullPieChart(column: string): void {
    //Crear contenedor
    const container = document.createElement('div');
    const chartIndex = this.chartConfigs.length;

    container.className = 'chart-item bg-white rounded-lg shadow-sm border border-gray-200 p-2 relative';
    container.style.height = '200px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.setAttribute('data-chart-index', chartIndex.toString());

    // Agregar evento de click para modo edición
    container.addEventListener('click', () => {
      if (this.editMode) {
        this.toggleChartSelection(chartIndex);
        this.updateChartSelectionUI(container, chartIndex);
      }
    });

    //Titulo
    const title = document.createElement('div');
    title.className = 'flex items-center gap-1 mb-1 flex-shrink-0';
    title.innerHTML = `
      <span class="material-icons text-purple-500 text-sm">pie_chart</span>
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
      type: 'pie',  // Tipo PIE (pastel completo sin agujero)
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
              size: 10
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

  //==========CREAR GRAFICO CIRCULAR COMPACTO (DOUGHNUT)==========
  createPieChart(column: string): void {
    //Crear contenedor
    const container = document.createElement('div');
    const chartIndex = this.chartConfigs.length;

    container.className = 'chart-item bg-white rounded-lg shadow-sm border border-gray-200 p-2 relative';
    container.style.height = '200px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.setAttribute('data-chart-index', chartIndex.toString());

    // Agregar evento de click para modo edición
    container.addEventListener('click', () => {
      if (this.editMode) {
        this.toggleChartSelection(chartIndex);
        this.updateChartSelectionUI(container, chartIndex);
      }
    });

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

  //========== GENERAR COLORES DINÁMICOS PARA BARRAS ==========
  private generateBarColors(count: number): { background: string[], border: string[] } {
    const colorPalette = [
      { bg: 'rgba(59,130,246,0.85)', border: 'rgba(59,130,246,1)' },     // Azul brillante
      { bg: 'rgba(239,68,68,0.85)', border: 'rgba(239,68,68,1)' },       // Rojo coral
      { bg: 'rgba(212,175,55,0.85)', border: 'rgba(212,175,55,1)' },     // Dorado ITSQMET
      { bg: 'rgba(139,92,246,0.85)', border: 'rgba(139,92,246,1)' },     // Púrpura
      { bg: 'rgba(16,185,129,0.85)', border: 'rgba(16,185,129,1)' },     // Esmeralda
      { bg: 'rgba(236,72,153,0.85)', border: 'rgba(236,72,153,1)' },     // Rosa vibrante
      { bg: 'rgba(249,115,22,0.85)', border: 'rgba(249,115,22,1)' },     // Naranja
      { bg: 'rgba(20,184,166,0.85)', border: 'rgba(20,184,166,1)' },     // Turquesa
      { bg: 'rgba(168,85,247,0.85)', border: 'rgba(168,85,247,1)' },     // Violeta
      { bg: 'rgba(34,197,94,0.85)', border: 'rgba(34,197,94,1)' },       // Verde lima brillante
      { bg: 'rgba(14,165,233,0.85)', border: 'rgba(14,165,233,1)' },     // Cyan cielo
      { bg: 'rgba(251,146,60,0.85)', border: 'rgba(251,146,60,1)' },     // Naranja suave
      { bg: 'rgba(244,63,94,0.85)', border: 'rgba(244,63,94,1)' },       // Rosa fuerte
      { bg: 'rgba(251,191,36,0.85)', border: 'rgba(251,191,36,1)' },     // Ámbar
      { bg: 'rgba(99,102,241,0.85)', border: 'rgba(99,102,241,1)' },     // Índigo
      { bg: 'rgba(45,212,191,0.85)', border: 'rgba(45,212,191,1)' },     // Teal brillante
      { bg: 'rgba(245,158,11,0.85)', border: 'rgba(245,158,11,1)' },     // Amarillo dorado
      { bg: 'rgba(219,39,119,0.85)', border: 'rgba(219,39,119,1)' },     // Magenta
      { bg: 'rgba(6,182,212,0.85)', border: 'rgba(6,182,212,1)' },       // Cyan vibrante
      { bg: 'rgba(132,204,22,0.85)', border: 'rgba(132,204,22,1)' },     // Verde lima claro
      { bg: 'rgba(192,38,211,0.85)', border: 'rgba(192,38,211,1)' },     // Fucsia
      { bg: 'rgba(234,179,8,0.85)', border: 'rgba(234,179,8,1)' },       // Amarillo brillante
      { bg: 'rgba(37,99,235,0.85)', border: 'rgba(37,99,235,1)' },       // Azul rey
      { bg: 'rgba(220,38,38,0.85)', border: 'rgba(220,38,38,1)' },       // Rojo intenso
      { bg: 'rgba(126,34,206,0.85)', border: 'rgba(126,34,206,1)' },     // Morado oscuro
      { bg: 'rgba(5,150,105,0.85)', border: 'rgba(5,150,105,1)' },       // Verde esmeralda oscuro
      { bg: 'rgba(217,70,239,0.85)', border: 'rgba(217,70,239,1)' },     // Púrpura neón
      { bg: 'rgba(234,88,12,0.85)', border: 'rgba(234,88,12,1)' },       // Naranja quemado
      { bg: 'rgba(8,145,178,0.85)', border: 'rgba(8,145,178,1)' },       // Azul petróleo
      { bg: 'rgba(190,18,60,0.85)', border: 'rgba(190,18,60,1)' }        // Rosa oscuro
    ];

    const background: string[] = [];
    const border: string[] = [];

    for (let i = 0; i < count; i++) {
      const color = colorPalette[i % colorPalette.length];
      background.push(color.bg);
      border.push(color.border);
    }

    return { background, border };
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

  //========== DESCARGAR PDF ==========
  isDownloadingPdf: boolean = false;
  pdfProgress: string = '';

  async downloadPDF(): Promise<void> {
    if (!this.chartContainer || !this.hasData || !this.chartsGenerated) {
      this.errorMessage = 'No hay gráficos para exportar. Genera el dashboard primero.';
      return;
    }

    this.isDownloadingPdf = true;
    this.errorMessage = '';
    this.pdfProgress = 'Preparando gráficos...';
    this.cdr.detectChanges();

    try {
      console.log('📊 Iniciando descarga de PDF con gráficos...');

      // Pequeño delay para asegurar que los gráficos estén completamente renderizados
      await new Promise(resolve => setTimeout(resolve, 500));

      this.pdfProgress = 'Capturando gráficos...';
      this.cdr.detectChanges();

      await this.pdfService.generateDashboardPDF(
        this.chartContainer.nativeElement,
        this.statistics,
        this.selectedCareer,
        this.filteredData.length,
        this.excelData.length,
        this.filteredData // Pasar los datos filtrados para análisis
      );

      this.pdfProgress = 'PDF generado exitosamente';
      console.log('✅ PDF generado correctamente');

      // Limpiar mensaje de éxito después de 2 segundos
      setTimeout(() => {
        this.pdfProgress = '';
        this.cdr.detectChanges();
      }, 2000);

    } catch (error) {
      console.error('❌ Error generando PDF:', error);
      this.errorMessage = 'Error al generar el PDF. Intenta nuevamente.';
      this.pdfProgress = '';
    } finally {
      this.isDownloadingPdf = false;
      this.cdr.detectChanges();
    }
  }

  //========== CARGA PROGRESIVA DE FILAS ==========
  loadMoreRows(): void {
    this.visibleRows = Math.min(
      this.visibleRows + this.ROWS_PER_LOAD,
      this.getFilteredTableData().length
    );
  }

  //========== BÚSQUEDA EN TABLA ==========
  getFilteredTableData(): any[] {
    if (!this.searchTerm || this.searchTerm.trim() === '') {
      return this.filteredData;
    }

    const term = this.searchTerm.toLowerCase().trim();

    return this.filteredData.filter(row => {
      return this.columns.some(col => {
        const value = row[col];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(term);
      });
    });
  }

  onSearchChange(): void {
    this.visibleRows = Math.min(50, this.getFilteredTableData().length);
    this.cdr.detectChanges();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.onSearchChange();
  }

  //========== CREAR HISTOGRAMA (COLUMNAS NUMÉRICAS) ==========
  createHistogram(column: string): void {
    const container = document.createElement('div');
    const chartIndex = this.chartConfigs.length;

    container.className = 'chart-item bg-white rounded-lg shadow-sm border border-gray-200 p-2 relative';
    container.style.height = '200px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.setAttribute('data-chart-index', chartIndex.toString());

    // Agregar evento de click para modo edición
    container.addEventListener('click', () => {
      if (this.editMode) {
        this.toggleChartSelection(chartIndex);
        this.updateChartSelectionUI(container, chartIndex);
      }
    });

    const title = document.createElement('div');
    title.className = 'flex items-center gap-1 mb-1 flex-shrink-0';
    title.innerHTML = `
      <span class="material-icons text-amber-500 text-sm">bar_chart</span>
      <span class="text-[10px] font-medium text-gray-700 truncate" title="${column}">${this.truncateText(column, 20)}</span>
    `;
    container.appendChild(title);

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

    if (this.chartContainer) {
      this.chartContainer.nativeElement.appendChild(container);
    }

    const ctx = canvas.getContext('2d');
    const histData = this.statisticsService.getHistogramData(this.filteredData, column, 8);

    if (!histData) {
      console.warn(`No se pudo generar histograma para ${column}`);
      return;
    }

    const barColors = this.generateBarColors(histData.labels.length);

    const chart = new Chart(ctx!, {
      type: 'bar',
      data: {
        labels: histData.labels,
        datasets: [{
          label: 'Frecuencia',
          data: histData.data,
          backgroundColor: barColors.background,
          borderColor: barColors.border,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          datalabels: {
            color: '#fff',
            font: {
              weight: 'bold',
              size: 8
            },
            anchor: 'end',
            align: 'start',
            formatter: (value: number) => value
          },
          tooltip: {
            callbacks: {
              afterLabel: (context) => {
                return `Min: ${histData.min}, Max: ${histData.max}, Promedio: ${histData.avg}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              font: { size: 7 },
              maxRotation: 45,
              minRotation: 45
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              font: { size: 8 }
            }
          }
        }
      },
      plugins: [ChartDataLabels]
    });

    this.chartInstances.push(chart);
    this.chartConfigs.push({ column, chart, type: 'histogram' });
  }

  //========== MODO EDICIÓN DE GRÁFICOS ==========
  toggleEditMode(): void {
    this.editMode = !this.editMode;
    if (!this.editMode) {
      this.selectedCharts.clear();
    }
    this.updateAllChartsUI();
    this.cdr.detectChanges();
  }

  toggleChartSelection(index: number): void {
    if (this.selectedCharts.has(index)) {
      this.selectedCharts.delete(index);
    } else {
      this.selectedCharts.add(index);
    }
    this.cdr.detectChanges();
  }

  isChartSelected(index: number): boolean {
    return this.selectedCharts.has(index);
  }

  updateChartSelectionUI(container: HTMLElement, index: number): void {
    const isSelected = this.isChartSelected(index);

    if (this.editMode) {
      container.style.cursor = 'pointer';

      if (isSelected) {
        container.style.outline = '2px solid #3b82f6';
        container.style.backgroundColor = '#eff6ff';
      } else {
        container.style.outline = 'none';
        container.style.backgroundColor = '#ffffff';
      }

      // Agregar/actualizar checkbox
      let checkbox = container.querySelector('.selection-checkbox') as HTMLElement;
      if (!checkbox) {
        checkbox = document.createElement('div');
        checkbox.className = 'selection-checkbox';
        checkbox.style.position = 'absolute';
        checkbox.style.top = '8px';
        checkbox.style.right = '8px';
        checkbox.style.width = '20px';
        checkbox.style.height = '20px';
        checkbox.style.borderRadius = '50%';
        checkbox.style.border = '2px solid #3b82f6';
        checkbox.style.display = 'flex';
        checkbox.style.alignItems = 'center';
        checkbox.style.justifyContent = 'center';
        checkbox.style.zIndex = '10';
        checkbox.style.backgroundColor = isSelected ? '#3b82f6' : '#ffffff';
        checkbox.innerHTML = isSelected ? '<span style="color: white; font-size: 14px;">✓</span>' : '';
        container.insertBefore(checkbox, container.firstChild);
      } else {
        checkbox.style.backgroundColor = isSelected ? '#3b82f6' : '#ffffff';
        checkbox.innerHTML = isSelected ? '<span style="color: white; font-size: 14px;">✓</span>' : '';
      }
    } else {
      container.style.cursor = 'default';
      container.style.outline = 'none';
      container.style.backgroundColor = '#ffffff';

      // Remover checkbox
      const checkbox = container.querySelector('.selection-checkbox');
      if (checkbox) {
        checkbox.remove();
      }
    }
  }

  updateAllChartsUI(): void {
    const containers = this.chartContainer?.nativeElement.querySelectorAll('.chart-item');
    if (!containers) return;

    containers.forEach((container: HTMLElement, index: number) => {
      this.updateChartSelectionUI(container, index);
    });
  }

  selectAllCharts(): void {
    for (let i = 0; i < this.chartConfigs.length; i++) {
      this.selectedCharts.add(i);
    }
    this.updateAllChartsUI();
    this.cdr.detectChanges();
  }

  deselectAllCharts(): void {
    this.selectedCharts.clear();
    this.updateAllChartsUI();
    this.cdr.detectChanges();
  }

  removeSelectedCharts(): void {
    const indicesToRemove = Array.from(this.selectedCharts).sort((a, b) => b - a);

    indicesToRemove.forEach(index => {
      if (this.chartInstances[index]) {
        this.chartInstances[index].destroy();
      }
      this.chartInstances.splice(index, 1);
      this.chartConfigs.splice(index, 1);
    });

    this.selectedCharts.clear();
    this.updateChartContainer();
    this.cdr.detectChanges();
  }

  private updateChartContainer(): void {
    if (this.chartContainer) {
      this.chartContainer.nativeElement.innerHTML = '';

      this.chartConfigs.forEach(config => {
        const canvas = config.chart.canvas;
        if (canvas && canvas.parentElement) {
          this.chartContainer.nativeElement.appendChild(canvas.parentElement.parentElement);
        }
      });
    }
  }

  //========== EXPORTAR A WORD CON GRÁFICOS ==========
  async exportToWord(): Promise<void> {
    if (!this.chartContainer || !this.hasData || !this.chartsGenerated) {
      this.errorMessage = 'No hay gráficos para exportar. Genera el dashboard primero.';
      return;
    }

    try {
      console.log('📄 Iniciando exportación a Word con gráficos...');

      // Pequeño delay para asegurar que los gráficos estén renderizados
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capturar todos los gráficos como imágenes
      const chartElements = this.chartContainer.nativeElement.querySelectorAll('.chart-item');
      const chartImages: string[] = [];

      for (const chartEl of Array.from(chartElements)) {
        try {
          const canvas = await html2canvas(chartEl as HTMLElement, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false
          });
          chartImages.push(canvas.toDataURL('image/png'));
        } catch (error) {
          console.warn('⚠️ Error capturando gráfico:', error);
        }
      }

      // Crear contenido HTML para Word con los gráficos como imágenes
      let htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office'
              xmlns:w='urn:schemas-microsoft-com:office:word'
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>Informe USEGBE</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 40px;
              line-height: 1.6;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 3px solid #d4af37;
            }
            h1 {
              color: #1e40af;
              font-size: 24pt;
              margin-bottom: 10px;
            }
            .metadata {
              background-color: #eff6ff;
              padding: 15px;
              margin: 20px 0;
              border-left: 4px solid #3b82f6;
            }
            .metadata p {
              margin: 5px 0;
              font-size: 11pt;
            }
            h2 {
              color: #374151;
              margin-top: 40px;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 2px solid #e5e7eb;
              font-size: 18pt;
            }
            .chart-container {
              page-break-inside: avoid;
              margin-bottom: 30px;
              text-align: center;
            }
            .chart-container img {
              max-width: 45%;
              height: auto;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 10px;
              background: white;
              margin: 10px;
            }
            .stats-summary {
              background-color: #f9fafb;
              padding: 20px;
              margin: 20px 0;
              border-radius: 8px;
              border: 1px solid #e5e7eb;
              text-align: center;
            }
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
              color: #6b7280;
              font-size: 10pt;
              text-align: center;
            }
            @page {
              margin: 2cm;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📊 Informe de Seguimiento a Egresados</h1>
            <p style="font-size: 14pt; color: #6b7280;">Unidad de Seguimiento a Egresados y Bolsa de Empleo (USEGBE)</p>
          </div>

          <div class="metadata">
            <p><strong>📅 Fecha de generación:</strong> ${new Date().toLocaleDateString('es-EC', {
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })}</p>
            <p><strong>🎓 Carrera seleccionada:</strong> ${this.selectedCareer}</p>
            <p><strong>📊 Total de registros analizados:</strong> ${this.filteredData.length} de ${this.excelData.length}</p>
          </div>

          <div class="stats-summary">
            <p><strong>Gráficos Generados:</strong> ${this.chartConfigs.length} |
            <strong>Variables Analizadas:</strong> ${this.categoricalColumns.length} |
            <strong>Encuestas Procesadas:</strong> ${this.filteredData.length}</p>
          </div>

          <h2>📈 Análisis Gráfico de Resultados</h2>
          <p style="margin-bottom: 30px;">A continuación se presentan los gráficos estadísticos generados a partir del análisis de las encuestas de seguimiento a egresados:</p>

          <div class="chart-container">
      `;

      // Agregar cada gráfico como imagen (2 por fila)
      chartImages.forEach((imageData, index) => {
        htmlContent += `<img src="${imageData}" alt="Gráfico ${index + 1}" />`;
        // Salto de línea cada 2 gráficos
        if ((index + 1) % 2 === 0 && index < chartImages.length - 1) {
          htmlContent += `<br/>`;
        }
      });

      htmlContent += `
          </div>

          <h2>📋 Observaciones y Análisis</h2>
          <p>Este informe presenta un análisis visual de las respuestas obtenidas en las encuestas de seguimiento a egresados.
          Los gráficos muestran la distribución de respuestas para cada una de las variables analizadas,
          permitiendo identificar patrones y tendencias en los datos recopilados.</p>

          <div class="footer">
            <p><strong>Instituto Tecnológico Superior Quito Metropolitano (ITSQMET)</strong></p>
            <p>Unidad de Seguimiento a Egresados y Bolsa de Empleo (USEGBE)</p>
            <p style="margin-top: 10px; font-size: 9pt;">Documento generado automáticamente por el Sistema de Análisis de Encuestas</p>
          </div>
        </body>
        </html>
      `;

      // Crear blob y descargar como .doc
      const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword'
      });

      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const fileName = `USEGBE_Informe_${this.selectedCareer}_${new Date().toISOString().split('T')[0]}.doc`;

      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('✅ Documento Word con gráficos exportado:', fileName);
    } catch (error) {
      console.error('❌ Error exportando Word:', error);
      this.errorMessage = 'Error al exportar a Word. Intenta nuevamente.';
    }
  }

  //========== 🆕 PANEL DE FILTROS AVANZADO ==========

  /**
   * Inicializar filtros disponibles después de cargar datos
   */
  initializeFilterPanel(): void {
    this.availableFilters = [];

    // Crear filtros para cada columna categórica
    this.categoricalColumns.forEach(column => {
      const uniqueValues = [...new Set(this.excelData.map(row => row[column]))]
        .filter(val => val !== null && val !== undefined && String(val).trim() !== '')
        .map(val => String(val))
        .sort();

      if (uniqueValues.length > 0 && uniqueValues.length <= 50) { // Máximo 50 valores por filtro
        this.availableFilters.push({
          column,
          values: uniqueValues,
          selectedValues: new Set<string>()
        });
      }
    });

    console.log('🔧 Filtros inicializados:', this.availableFilters.length);
  }

  /**
   * Toggle panel de filtros
   */
  toggleFilterPanel(): void {
    this.showFilterPanel = !this.showFilterPanel;
    if (this.showFilterPanel && this.availableFilters.length === 0) {
      this.initializeFilterPanel();
    }
  }

  /**
   * Toggle selección de un valor en un filtro
   */
  toggleFilterValue(filter: any, value: string): void {
    if (filter.selectedValues.has(value)) {
      filter.selectedValues.delete(value);
    } else {
      filter.selectedValues.add(value);
    }
  }

  /**
   * Seleccionar todos los valores de un filtro
   */
  selectAllFilterValues(filter: any): void {
    filter.selectedValues.clear();
    filter.values.forEach((v: string) => filter.selectedValues.add(v));
  }

  /**
   * Deseleccionar todos los valores de un filtro
   */
  clearFilterValues(filter: any): void {
    filter.selectedValues.clear();
  }

  /**
   * Aplicar todos los filtros seleccionados
   */
  applyFilters(): void {
    let dataToFilter = this.excelData;

    // Aplicar filtro de carrera si existe
    if (this.careerColumn && this.selectedCareer !== 'Todas') {
      dataToFilter = dataToFilter.filter(row =>
        row[this.careerColumn!] === this.selectedCareer
      );
    }

    // Aplicar filtros del panel
    this.availableFilters.forEach(filter => {
      if (filter.selectedValues.size > 0) {
        dataToFilter = dataToFilter.filter(row => {
          const rowValue = row[filter.column];
          return rowValue !== null && rowValue !== undefined &&
                 filter.selectedValues.has(String(rowValue));
        });
      }
    });

    this.filteredData = dataToFilter;
    this.visibleRows = Math.min(50, this.filteredData.length);

    // Regenerar gráficos
    this.generateCharts();
    this.cdr.detectChanges();

    console.log(`📊 Filtros aplicados: ${this.filteredData.length} de ${this.excelData.length} registros`);
  }

  /**
   * Limpiar todos los filtros del panel
   */
  clearAllPanelFilters(): void {
    this.availableFilters.forEach(filter => filter.selectedValues.clear());

    // Restaurar datos
    if (this.careerColumn && this.selectedCareer !== 'Todas') {
      this.filteredData = this.excelService.filterByCareer(
        this.excelData,
        this.careerColumn,
        this.selectedCareer
      );
    } else {
      this.filteredData = this.excelData;
    }

    this.visibleRows = Math.min(50, this.filteredData.length);

    // Regenerar gráficos
    this.generateCharts();
    this.cdr.detectChanges();

    console.log('🧹 Filtros del panel limpiados');
  }

  /**
   * Contar filtros activos
   */
  getActiveFiltersCount(): number {
    return this.availableFilters.reduce((count, filter) =>
      count + filter.selectedValues.size, 0
    );
  }

  /**
   * Verificar si hay filtros activos
   */
  hasActiveFilters(): boolean {
    return this.getActiveFiltersCount() > 0;
  }
}

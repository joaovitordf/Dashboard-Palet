import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import Chart, { ChartConfiguration } from 'chart.js/auto';
import jsPDF from 'jspdf';
import Hls from 'hls.js';

@Component({
  selector: 'app-dashboard-palet',
  templateUrl: './dashboard-palet.component.html',
  styleUrls: ['./dashboard-palet.component.css']
})
export class DashboardPaletComponent implements AfterViewInit, OnDestroy {
  @ViewChild('videoElLive') videoElLive?: ElementRef<HTMLVideoElement>;
  @ViewChild('pieCanvasLoads', { static: true }) pieCanvasLoads!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieCanvasTruck', { static: false }) pieCanvasTruck!: ElementRef<HTMLCanvasElement>;
  @ViewChild('stackedBarCanvas') stackedBarCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('palletsHourCanvas') palletsHourCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('truckTimeCanvas', { static: false }) truckTimeCanvas!: ElementRef<HTMLCanvasElement>;

  private hls?: Hls;
  private charts = new Map<string, Chart>();

  cameras = [
    { id: 'video1', name: 'Câmera Entrada', url: 'http://streamserver.sensoreng.com.br:8888/cury/camera01/index.m3u8' },
    { id: 'video2', name: 'Câmera MV/Planta1', url: 'http://streamserver.sensoreng.com.br:8888/cury/camera01/index.m3u8' },
    { id: 'video3', name: 'Câmera Saída', url: 'http://streamserver.sensoreng.com.br:8888/cury/camera01/index.m3u8' }
  ];

  stream = { id: this.cameras[1].id, url: this.cameras[1].url };

  filters = {
    top: { start: '', end: '' },
    truck: { start: '', end: '' },
    pallets: { start: '', end: '' },
    palletsHour: { start: '', end: '' },
    products: { start: '', end: '' },
    time: { start: '', end: '' },
  };

  loadsData: { label: string; value: number; pct: number; color: string }[] = [];
  productLegend: { label: string; color: string; pct: number }[] = [];
  productSegments: { label: string; value: number; color: string; pct: number }[] = [];
  palletsHourLegend: { label: string; color: string }[] = [];

  poster?: string;
  truckPlate: string = 'OK0065';

  ngAfterViewInit(): void {
    this.initHlsVideo();
    this.createPieLoads();
    this.createTruckChart();
    this.createProductSegments();
    this.createPalletsChart();
    this.createPalletsHourChart();
    this.createTruckTimeChart();
  }

  ngOnDestroy(): void {
    this.charts.forEach(c => { try { c.destroy(); } catch (e) { } });
    this.charts.clear();
    if (this.hls) { try { this.hls.destroy(); } catch (e) { } }
  }

  private initHlsVideo() {
    const el = this.videoElLive?.nativeElement;
    if (!el) return;
    el.muted = true;
    if (Hls.isSupported()) {
      this.hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      this.hls.loadSource(this.stream.url);
      this.hls.attachMedia(el);
      this.hls.on(Hls.Events.MANIFEST_PARSED, () => this.safePlay(el));
      this.hls.on(Hls.Events.ERROR, () => { });
    } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = this.stream.url;
      el.addEventListener('loadedmetadata', () => this.safePlay(el));
    } else {
      el.src = 'assets/video/saida_bag_2.mp4';
      el.addEventListener('loadedmetadata', () => this.safePlay(el));
    }
  }

  private safePlay(v: HTMLVideoElement) {
    try {
      const p = v.play();
      (p as any)?.catch?.(() => { });
    } catch { }
  }

  changeCamera(cameraId: string) {
    const cam = this.cameras.find(c => c.id === cameraId);
    if (!cam) return;
    this.stream = { id: cam.id, url: cam.url };
    this.reinitVideo();
  }

  private reinitVideo() {
    const el = this.videoElLive?.nativeElement;
    if (!el) return;
    if (this.hls) { try { this.hls.destroy(); } catch { } this.hls = undefined; }
    try { el.pause(); el.removeAttribute('src'); el.load(); } catch { }
    this.initHlsVideo();
  }

  onVideoError(_evt: Event) { }

  /* -------------------- DATE FILTERS -------------------- */
  onDateFilterChange(section: keyof typeof this.filters) {
    const { start, end } = this.filters[section];
    if (start && end && new Date(start) > new Date(end)) return;

    switch (section) {
      case 'top':
        this.createPieLoads();
        break;
      case 'truck':
        this.createTruckChart();
        break;
      case 'products':
        this.createProductSegments();
        break;
      case 'pallets':
        this.createPalletsChart();
        break;
      case 'palletsHour':
        this.createPalletsHourChart();
        break;
      case 'time':
        this.createTruckTimeChart();
        break;
    }
  }

  private refreshAllCharts() {
    this.createPieLoads();
    this.createTruckChart();
    this.createProductSegments();
    this.createPalletsChart();
    this.createPalletsHourChart();
  }

  /* -------------------- LOADS / TRUCK DONUT -------------------- */
  private createPieLoads() {
    const labels = ['Tempo Real', 'Planejado', 'Outros'];
    const values = [121, 87, 34];
    const colors = ['#54C6FF', '#0B58A6', '#7FC1FF'];
    const total = values.reduce((s, v) => s + v, 0) || 1;

    this.loadsData = labels.map((lab, i) => ({
      label: lab,
      value: values[i],
      pct: Math.round((values[i] / total) * 100),
      color: colors[i]
    }));

    const cfg: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 0,
          hoverOffset: 6
        } as any]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.raw as number;
                const pct = total ? Math.round((v / total) * 100) : 0;
                return `${ctx.label}: ${v} (${pct}%)`;
              }
            }
          }
        }
      }
    };

    const prev = this.charts.get('loads');
    if (prev) { try { prev.destroy(); } catch (e) { } }

    if (this.pieCanvasLoads && this.pieCanvasLoads.nativeElement) {
      const c = new Chart(this.pieCanvasLoads.nativeElement, cfg as any);
      this.charts.set('loads', c);
    }

    this.createTruckChart();
  }

  private createTruckChart() {
    if (!this.pieCanvasTruck || !this.pieCanvasTruck.nativeElement) return;

    const labels = this.loadsData.map(l => l.label);
    const values = this.loadsData.map(l => l.value);
    const colors = this.loadsData.map(l => l.color);
    const total = values.reduce((s, v) => s + v, 0) || 1;

    const cfg: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 0
        } as any]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    };

    const prev = this.charts.get('truck');
    if (prev) { try { prev.destroy(); } catch (e) { } }

    const ctx = this.pieCanvasTruck.nativeElement.getContext('2d')!;
    const c = new Chart(ctx, cfg as any);
    this.charts.set('truck', c);
  }

  private updateLoadsCharts() {
    const values = this.loadsData.map(l => l.value);
    const colors = this.loadsData.map(l => l.color);
    const labels = this.loadsData.map(l => l.label);

    const loads = this.charts.get('loads');
    if (loads) {
      loads.data.labels = labels as any;
      (loads.data.datasets[0].data as number[]) = values;
      (loads.data.datasets[0] as any).backgroundColor = colors;
      loads.update();
    }
    const truck = this.charts.get('truck');
    if (truck) {
      truck.data.labels = labels as any;
      (truck.data.datasets[0].data as number[]) = values;
      (truck.data.datasets[0] as any).backgroundColor = colors;
      truck.update();
    }
  }

  private createProductSegments() {
    const labels = ['Produto1', 'Produto3', 'Produto2', 'Produto4'];
    const values = [45, 15, 25, 15];
    const colors = ['#38bdf8', '#9ca3af', '#a78bfa', '#ccff66'];
    const total = values.reduce((s, v) => s + v, 0) || 1;
    this.productSegments = labels.map((lab, i) => ({
      label: lab,
      value: values[i],
      color: colors[i],
      pct: Math.round((values[i] / total) * 100)
    }));
    this.productLegend = this.productSegments.map(s => ({ label: s.label, color: s.color, pct: s.pct }));
  }

  private createPalletsChart() {
    const paleteLabels = ['Palete LP1', 'Palete LP2', 'Palete LP3', 'Palete LP4'];
    const productLabels = this.productLegend.map(l => l.label);
    const productColors = this.productLegend.map(l => l.color);
    const valuesMatrix: number[][] = [
      [12, 8, 20, 10],
      [18, 5, 10, 7],
      [10, 6, 25, 9],
      [15, 7, 18, 6]
    ];
    const datasets = productLabels.map((pl, idx) => {
      const data = paleteLabels.map((_, p) => valuesMatrix[p][idx] ?? 0);
      return {
        label: pl,
        data,
        backgroundColor: productColors[idx],
        borderWidth: 0
      };
    });
    const cfg: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: paleteLabels,
        datasets: datasets as any
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            stacked: true
          },
          y: {
            stacked: true
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.raw as number;
                return `${ctx.dataset.label}: ${v}`;
              }
            }
          }
        }
      }
    };
    const prev = this.charts.get('pallets');
    if (prev) { try { prev.destroy(); } catch { } }
    if (this.stackedBarCanvas && this.stackedBarCanvas.nativeElement) {
      const c = new Chart(this.stackedBarCanvas.nativeElement, cfg as any);
      this.charts.set('pallets', c);
    }
  }

  private createPalletsHourChart() {
    const labels = ['09hs', '11hs', '12hs', '13hs', '14hs', '16hs'];
    const values = [34, 18, 5, 1, 38, 20];
    const colors = ['#06b6d4', '#3b82f6', '#8b5cf6', '#a78bfa', '#34d399', '#86efac'];
    this.palletsHourLegend = labels.map((l, i) => ({ label: l, color: colors[i] }));
    const cfg: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Paletes',
          data: values,
          backgroundColor: colors,
          borderWidth: 0
        } as any]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.raw as number;
                return `${ctx.dataset.label}: ${v}`;
              }
            }
          }
        }
      }
    };
    const prev = this.charts.get('palletsHour');
    if (prev) { try { prev.destroy(); } catch { } }
    if (this.palletsHourCanvas && this.palletsHourCanvas.nativeElement) {
      const c = new Chart(this.palletsHourCanvas.nativeElement, cfg as any);
      this.charts.set('palletsHour', c);
    }
  }

  private createTruckTimeChart() {
    if (!this.truckTimeCanvas || !this.truckTimeCanvas.nativeElement) return;

    const labels = ['OK7867', 'YT5643', 'YT3498', 'WS2349', 'JP9870'];
    const values = [3, 5, 2.5, 8, 1.8]; // Horas gastas por veículo
    const colors = ['#5ed5f5']; // Cor única (mesma da imagem)

    const cfg: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Horas',
          data: values,
          backgroundColor: colors[0],
          borderRadius: 6,
          borderWidth: 0
        } as any]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // barras horizontais
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Quantidade de horas gastas carregamento'
            },
            ticks: { precision: 0 }
          },
          y: {
            title: {
              display: true,
              text: 'Placa Veículo'
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} h`
            }
          }
        }
      }
    };

    const prev = this.charts.get('truckTime');
    if (prev) { try { prev.destroy(); } catch { } }

    const c = new Chart(this.truckTimeCanvas.nativeElement, cfg as any);
    this.charts.set('truckTime', c);
  }


  /* -------------------- EXPORT / CSV / HELPERS -------------------- */
  exportChartAsPdf(key: string, title = 'Gráfico') {
    if (key === 'products') {
      const canvasW = 900;
      const canvasH = 260;
      const cvs = document.createElement('canvas');
      cvs.width = canvasW;
      cvs.height = canvasH;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.font = '16px Arial';
      ctx.fillStyle = '#111827';
      ctx.fillText(title, 24, 28);
      let x = 24;
      const yLegend = 48;
      const square = 14;
      ctx.font = '14px Arial';
      this.productLegend.forEach(item => {
        ctx.fillStyle = item.color;
        ctx.fillRect(x, yLegend, square, square);
        ctx.fillStyle = '#111827';
        ctx.fillText(`${item.label} (${item.pct}%)`, x + square + 8, yLegend + square - 2);
        x += 160;
      });
      const segY = 100;
      const segH = 88;
      const totalValue = this.productSegments.reduce((s, v) => s + v.value, 0) || 1;
      let segX = 24;
      const segWidth = canvasW - 48;
      this.productSegments.forEach(seg => {
        const w = Math.round((seg.value / totalValue) * segWidth);
        ctx.fillStyle = seg.color;
        ctx.fillRect(segX, segY, w, segH);
        ctx.fillStyle = '#000000';
        ctx.font = '13px Arial';
        segX += w;
      });
      const img = cvs.toDataURL('image/png', 1);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;
      const ratio = cvs.width / cvs.height;
      let w = availW, h = w / ratio;
      if (h > availH) { h = availH; w = h * ratio; }
      const xPdf = margin + (availW - w) / 2;
      const yPdf = margin + (availH - h) / 2;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text(title, margin, margin + 10);
      pdf.addImage(img, 'PNG', xPdf, yPdf, w, h);
      pdf.save(this.slug(`${title}.pdf`));
      return;
    }
    const chart = this.charts.get(key);
    if (!chart) return;
    const canvas = chart.canvas as HTMLCanvasElement;
    const img = canvas.toDataURL('image/png', 1);
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 24;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text(title, margin, margin + 10);
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2 - 20;
    const ratio = canvas.width / canvas.height;
    let w = availW, h = w / ratio;
    if (h > availH) { h = availH; w = h * ratio; }
    const x = margin + (availW - w) / 2;
    const y = margin + 20 + (availH - h) / 2;
    pdf.addImage(img, 'PNG', x, y, w, h);
    pdf.save(this.slug(`${title}.pdf`));
  }

  exportChartAsCsv(key: string, filename = 'dados.csv') {
    if (key === 'products') {
      const header = ['Produto', 'Valor', 'Porcentagem'];
      const rows = this.productSegments.map(s => [s.label, String(s.value), String(s.pct)]);
      const csv = [header, ...rows].map(r => r.map(this.csvEscape).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      this.downloadBlob(blob, filename);
      return;
    }
    const chart = this.charts.get(key);
    if (!chart) return;
    const labels = (chart.data.labels as any[]) ?? [];
    const datasets = chart.data.datasets ?? [];
    const header = ['Label', ...datasets.map(d => d.label || 'Série')];
    const rows: string[][] = [];
    const maxLen = Math.max(labels.length, ...datasets.map(d => (d.data as any).length));
    for (let i = 0; i < maxLen; i++) {
      const row = [String(labels[i] ?? '')];
      datasets.forEach(d => {
        const val = (d.data as any[])[i];
        row.push(val != null ? String(val) : '');
      });
      rows.push(row);
    }
    const csv = [header, ...rows].map(r => r.map(this.csvEscape).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    this.downloadBlob(blob, filename);
  }

  private csvEscape(s: any): string {
    const str = String(s ?? '');
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  }

  private downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

  private slug(s: string) {
    return s.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-\.]+/g, '').replace(/\-+/g, '-');
  }
}

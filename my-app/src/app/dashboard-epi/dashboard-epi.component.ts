import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import Chart, { ChartConfiguration, ChartData } from 'chart.js/auto';
import jsPDF from 'jspdf';
import Hls from 'hls.js'; // npm i hls.js

@Component({
  selector: 'app-dashboard-epi',
  templateUrl: './dashboard-epi.component.html',
  styleUrls: ['./dashboard-epi.component.css']
})
export class DashboardEpiComponent implements AfterViewInit, OnDestroy {
  // Vídeo
  @ViewChild('videoElLive') videoElLive?: ElementRef<HTMLVideoElement>;
  private hls?: Hls;

  // Canvases / wraps
  @ViewChild('canvasDesvios', { static: true }) canvasDesvios!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieCanvasComparativo', { static: true }) pieCanvasComparativo!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartCanvasAlerts', { static: true }) chartCanvasAlerts!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartCanvasDaily', { static: true }) chartCanvasDaily!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartCanvasCompliance', { static: true }) chartCanvasCompliance!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartRanking', { static: true }) chartRanking!: ElementRef<HTMLCanvasElement>;

  // Estado "câmera"
  name = 'Câmera MV/Planta1';
  serial = '234892/2423MV90';
  model = 'AC20HIKVision';
  status: 'ONLINE' | 'OFFLINE' = 'ONLINE';
  poster?: string;
  autoplay = true;

  cameras = [
    { id: 'video1', name: 'Câmera Entrada', url: 'http://streamserver.sensoreng.com.br:8888/cury/camera01/index.m3u8', serial: 'ENT-0001', model: 'AC10', status: 'ONLINE', poster: 'assets/posters/entrada.jpg' },
    { id: 'video2', name: 'Câmera MV/Planta1', url: 'http://streamserver.sensoreng.com.br:8888/cury/camera01/index.m3u8', serial: '234892/2423MV90', model: 'AC20HIKVision', status: 'ONLINE', poster: 'assets/posters/planta1.jpg' },
    { id: 'video3', name: 'Câmera Saída', url: 'http://streamserver.sensoreng.com.br:8888/cury/camera01/index.m3u8', serial: 'SAI-0099', model: 'AC30', status: 'OFFLINE', poster: 'assets/posters/saida.jpg' }
  ];

  stream = { id: this.cameras[1].id, url: this.cameras[1].url };

  // filtros por gráfico
  filters = {
    alerts:    { start: '', end: '' },
    compliance:{ start: '', end: '' },
    daily:     { start: '', end: '' },
    ranking:   { start: '', end: '' },
  };

  private charts = new Map<string, Chart>();

  ngAfterViewInit(): void {
    this.initHlsVideo();

    // Charts
    this.createGaugeDesvios();
    this.createPie();
    this.createAlertsBar();
    this.createDailyBar();
    this.createComplianceStacked();
    this.createRankingBar();
  }

  ngOnDestroy(): void {
    this.charts.forEach(c => { try { c.destroy(); } catch {} });
    this.charts.clear();
    if (this.hls) { try { this.hls.destroy(); } catch {} }
  }

  /* =================== VÍDEO (HLS) =================== */
  private initHlsVideo() {
    const el = this.videoElLive?.nativeElement;
    if (!el) return;

    // Garantir mudo para autoplay
    el.muted = true;

    if (Hls.isSupported()) {
      this.hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      this.hls.loadSource(this.stream.url);
      this.hls.attachMedia(el);
      this.hls.on(Hls.Events.MANIFEST_PARSED, () => { this.safePlay(el); });
      this.hls.on(Hls.Events.ERROR, () => { /* lidar com erros se quiser */ });
    } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = this.stream.url;
      el.addEventListener('loadedmetadata', () => this.safePlay(el));
    } else {
      // Fallback: se tiver mp4/WEBM local
      el.src = 'assets/video/saida_bag_2.mp4';
      el.addEventListener('loadedmetadata', () => this.safePlay(el));
    }
  }

  private safePlay(v: HTMLVideoElement) {
    try {
      const p = v.play();
      (p as any)?.catch?.(()=>{ /* autoplay pode ser bloqueado; usuário clica e toca */ });
    } catch {}
  }

  changeCamera(cameraId: string) {
    const cam = this.cameras.find(c => c.id === cameraId);
    if (!cam) return;
    this.stream = { id: cam.id, url: cam.url };
    // atualiza detalhes exibidos
    this.name = cam.name ?? this.name;
    this.serial = cam.serial ?? this.serial;
    this.model = cam.model ?? this.model;
    this.status = (cam.status === 'OFFLINE' ? 'OFFLINE' : 'ONLINE');
    this.poster = cam.poster;
    this.reinitVideo();
  }


  private reinitVideo() {
    const el = this.videoElLive?.nativeElement;
    if (!el) return;
    if (this.hls) {
      try { this.hls.destroy(); } catch {}
      this.hls = undefined;
    }
    try {
      el.pause();
      el.removeAttribute('src');
      el.load();
    } catch {}
    this.initHlsVideo();
  }

  onVideoError(_evt: Event) {
    // Pode logar/mostrar aviso
  }

  /* =================== AÇÕES/EXPORT =================== */
  exportChartAsPdf(key: string, title = 'Gráfico') {
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
    const chart = this.charts.get(key);
    if (!chart) return;
    const labels = (chart.data.labels as any[]) ?? [];
    const datasets = chart.data.datasets ?? [];
    const header = ['Label', ...datasets.map(d => d.label || 'Série')];
    const rows: string[][] = [];
    const maxLen = Math.max(labels.length, ...datasets.map(d => (d.data as any[]).length));
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

  /* =================== CHARTS =================== */
  private createGaugeDesvios() {
    const max = 500, value = 312;
    const filled = Number(Math.max(0, Math.min(100, (value / max) * 100)).toFixed(1));
    const remaining = Math.max(0, 100 - filled);

    const cfg: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: ['preenchido', 'restante'],
        datasets: [{
          data: [filled, remaining],
          backgroundColor: ['#0b5ea8', 'rgba(0,0,0,0.08)'],
          borderWidth: 0,
          circumference: 180,
          rotation: 270
        } as any]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } }
      }
    };
    const c = new Chart(this.canvasDesvios.nativeElement, cfg);
    this.charts.set('desvios', c);
  }

  private createPie() {
    const data: ChartData<'pie'> = {
      labels: ['Julho', 'Agosto', 'Setembro'],
      datasets: [{ data: [49.7, 14.6, 35.7], backgroundColor: ['#7744cc','#639cff','#ff9966'], borderWidth: 1, borderColor:'#fff' } as any]
    };
    const cfg: ChartConfiguration<'pie'> = {
      type: 'pie',
      data,
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }
    };
    const c = new Chart(this.pieCanvasComparativo.nativeElement, cfg);
    this.charts.set('pie', c);
  }

  private createAlertsBar() {
    const labels = ['Capacete', 'Luva', 'Colete', 'Bota'];
    const dataA = [15, 8, 12, 6], dataB = [10, 12, 18, 7], dataC = [18, 6, 9, 3];
    const cfg: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Obra A', data: dataA, backgroundColor:'rgba(18,183,179,0.95)' },
          { label: 'Obra B', data: dataB, backgroundColor:'rgba(63,125,255,0.95)' },
          { label: 'Obra C', data: dataC, backgroundColor:'rgba(135,206,250,0.95)' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { grid: { display:false } },
          y: { beginAtZero:true, grid: { color:'rgba(0,0,0,.06)' } }
        }
      }
    };
    const c = new Chart(this.chartCanvasAlerts.nativeElement, cfg);
    this.charts.set('alerts', c);
  }

  private createDailyBar() {
    const labels = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2,'0'));
    const cfg: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Dia 01', data: this.randomData(24, 0, 20), backgroundColor: 'rgba(26,188,156,0.95)' },
          { label: 'Dia 02', data: this.randomData(24, 0, 18), backgroundColor: 'rgba(93,173,226,0.95)' },
          { label: 'Dia 03', data: this.randomData(24, 0, 22), backgroundColor: 'rgba(144,202,249,0.95)' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { x: { grid: { display:false } }, y: { beginAtZero:true, grid:{ color:'rgba(0,0,0,.06)' } } }
      }
    };
    const c = new Chart(this.chartCanvasDaily.nativeElement, cfg);
    this.charts.set('daily', c);
  }

  private createComplianceStacked() {
    const labels = ['85%','70%','60%','55%'];
    const cfg: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label:'Obra A', data:[350,0,0,0], backgroundColor:'rgba(18,183,179,0.95)' },
          { label:'Obra B', data:[0,110,0,0], backgroundColor:'rgba(99,156,255,0.95)' },
          { label:'Obra C', data:[0,0,70,0], backgroundColor:'rgba(135,206,250,0.95)' },
          { label:'Obra D', data:[0,0,0,45], backgroundColor:'rgba(147,77,255,0.95)' },
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position:'top' } },
        scales: {
          x: { stacked:true, beginAtZero:true, grid:{ color:'rgba(0,0,0,.06)' } },
          y: { stacked:true, grid:{ display:false } }
        }
      }
    };
    const c = new Chart(this.chartCanvasCompliance.nativeElement, cfg);
    this.charts.set('compliance', c);
  }

  private createRankingBar() {
    const labels = ['Obra B', 'Obra A', 'Obra C', 'Obra D'];
    const total = [430, 520, 320, 160], cap = [120, 140, 90, 40], col = [80, 100, 50, 20], luv = [60, 80, 40, 10], bot = [40, 60, 25, 5];
    const cfg: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label:'Total',    data: total, backgroundColor:'rgba(18,183,179,0.95)' },
          { label:'Capacete', data: cap,   backgroundColor:'rgba(63,125,255,0.95)' },
          { label:'Colete',   data: col,   backgroundColor:'rgba(147,77,255,0.95)' },
          { label:'Luva',     data: luv,   backgroundColor:'rgba(186,120,255,0.9)' },
          { label:'Bota',     data: bot,   backgroundColor:'rgba(255,150,70,0.95)' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { grid: { display:false } },
          y: { beginAtZero:true, grid:{ color:'rgba(0,0,0,.06)' } }
        }
      }
    };
    const c = new Chart(this.chartRanking.nativeElement, cfg);
    this.charts.set('ranking', c);
  }

  /* =================== HELPERS =================== */
  private randomData(count: number, min = 0, max = 20) {
    const out: number[] = [];
    let seed = (Math.floor(Math.random() * 1000) + count) % 997;
    for (let i = 0; i < count; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const rnd = seed / 233280;
      out.push(Math.round(min + rnd * (max - min)));
    }
    return out;
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
    return s.toLowerCase().replace(/\s+/g,'-').replace(/[^\w\-\.]+/g,'').replace(/\-+/g,'-');
  }
}

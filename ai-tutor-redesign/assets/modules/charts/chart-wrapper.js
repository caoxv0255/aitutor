export class ChartWrapper {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = options;
    this.chart = null;
    this.init();
  }

  init() {
    if (!this.container) return;
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js';
    script.onload = () => {
      this.chart = echarts.init(this.container);
      if (this.options.initialData) {
        this.render(this.options.initialData);
      }
    };
    document.head.appendChild(script);
  }

  render(data) {
    if (!this.chart || !data) return;
    
    const option = this.buildOption(data);
    this.chart.setOption(option);
    
    if (window.ResizeObserver) {
      new ResizeObserver(() => this.chart.resize()).observe(this.container);
    }
  }

  buildOption(data) {
    if (data.chartType === 'line') {
      return this.buildLineOption(data);
    } else if (data.chartType === 'bar') {
      return this.buildBarOption(data);
    } else if (data.chartType === 'pie') {
      return this.buildPieOption(data);
    } else if (data.chartType === 'radar') {
      return this.buildRadarOption(data);
    } else if (data.chartType === 'combo') {
      return this.buildComboOption(data);
    }
    return data;
  }

  buildLineOption(data) {
    return {
      title: { text: data.title, left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold', color: '#1a1a2e' } },
      tooltip: { trigger: 'axis' },
      legend: { data: data.series.map(s => s.name), bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: data.xAxisData || [] },
      yAxis: { type: 'value', name: data.yAxisName },
      series: data.series.map(s => ({
        name: s.name,
        type: 'line',
        smooth: true,
        data: s.data,
        lineStyle: { width: 2 },
        itemStyle: { color: this.getColor(s.name) }
      }))
    };
  }

  buildBarOption(data) {
    return {
      title: { text: data.title, left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold', color: '#1a1a2e' } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: data.series.map(s => s.name), bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
      xAxis: { type: 'category', data: data.xAxisData || [] },
      yAxis: { type: 'value', name: data.yAxisName },
      series: data.series.map(s => ({
        name: s.name,
        type: 'bar',
        data: s.data,
        itemStyle: { color: this.getColor(s.name), borderRadius: [4, 4, 0, 0] }
      }))
    };
  }

  buildPieOption(data) {
    return {
      title: { text: data.title, left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold', color: '#1a1a2e' } },
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { orient: 'vertical', right: '5%', top: 'center' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
        labelLine: { show: false },
        data: data.data.map((item, index) => ({
          ...item,
          itemStyle: { color: this.getColor(index) }
        }))
      }]
    };
  }

  buildRadarOption(data) {
    return {
      title: { text: data.title, left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold', color: '#1a1a2e' } },
      tooltip: {},
      legend: { data: data.legendData || [], bottom: 0 },
      radar: {
        indicator: data.indicator || [],
        shape: 'polygon',
        splitNumber: 4,
        axisName: { color: '#666' },
        splitLine: { lineStyle: { color: ['#e0e0e0', '#d0d0d0', '#c0c0c0', '#b0b0b0'] } },
        splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.5)'] } },
        axisLine: { lineStyle: { color: '#d0d0d0' } }
      },
      series: [{
        type: 'radar',
        data: data.series || []
      }]
    };
  }

  buildComboOption(data) {
    return {
      title: { text: data.title, left: 'center', textStyle: { fontSize: 14, fontWeight: 'bold', color: '#1a1a2e' } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross', crossStyle: { color: '#999' } } },
      legend: { data: data.series.map(s => s.name), bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
      xAxis: [
        { type: 'category', data: data.xAxisData || [], axisPointer: { type: 'shadow' } }
      ],
      yAxis: data.yAxis || [{ type: 'value', name: data.yAxisName }],
      series: data.series.map(s => ({
        name: s.name,
        type: s.type || 'bar',
        data: s.data,
        itemStyle: { color: this.getColor(s.name), borderRadius: s.type === 'bar' ? [4, 4, 0, 0] : undefined }
      }))
    };
  }

  getColor(nameOrIndex) {
    const colors = ['#3d5a80', '#e63946', '#2a9d8f', '#e9c46a', '#f4a261', '#9b5de5', '#00bbf9', '#fb5607', '#ff006e', '#8338ec'];
    if (typeof nameOrIndex === 'number') {
      return colors[nameOrIndex % colors.length];
    }
    let hash = 0;
    for (let i = 0; i < nameOrIndex.length; i++) {
      hash = nameOrIndex.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  dispose() {
    if (this.chart) {
      this.chart.dispose();
    }
  }
}

export async function loadChartData(url, params = {}) {
  const response = await fetch('/api' + url + '?' + new URLSearchParams(params).toString(), {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('aitutor_login')?.split('"id":"')[1]?.split('"')[0] }
  });
  const data = await response.json();
  return data.data || data;
}

export function createChart(containerId, data) {
  const wrapper = new ChartWrapper(containerId);
  setTimeout(() => wrapper.render(data), 100);
  return wrapper;
}
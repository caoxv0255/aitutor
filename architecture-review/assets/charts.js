(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();
  var accent3 = style.getPropertyValue('--accent3').trim();
  var accent4 = style.getPropertyValue('--accent4').trim();

  // --- Chart 1: Market Competition Landscape ---
  var chart1 = echarts.init(document.getElementById('chart-market'), null, { renderer: 'svg' });
  chart1.setOption({
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      appendToBody: true,
      textStyle: { fontSize: 12 }
    },
    legend: {
      data: ['教培派', '科技派', '本系统'],
      top: 0,
      right: 0,
      textStyle: { color: ink, fontSize: 12 }
    },
    grid: { left: 130, right: 30, top: 40, bottom: 30 },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: { color: muted, fontSize: 11 },
      splitLine: { lineStyle: { color: rule } }
    },
    yAxis: {
      type: 'category',
      data: ['题库规模', '自研大模型', '硬件生态', 'AI诊断规划', '知识图谱', '间隔复习', '数据飞轮', '价格亲民'],
      axisLabel: { color: ink, fontSize: 12 },
      axisLine: { lineStyle: { color: rule } }
    },
    series: [
      {
        name: '教培派',
        type: 'bar',
        data: [95, 75, 80, 70, 30, 10, 40, 20],
        itemStyle: { color: accent4, borderRadius: [0, 3, 3, 0] },
        barGap: '20%',
        barCategoryGap: '40%'
      },
      {
        name: '科技派',
        type: 'bar',
        data: [60, 85, 90, 55, 20, 10, 30, 25],
        itemStyle: { color: accent3, borderRadius: [0, 3, 3, 0] }
      },
      {
        name: '本系统',
        type: 'bar',
        data: [35, 40, 0, 85, 90, 95, 90, 85],
        itemStyle: { color: accent, borderRadius: [0, 3, 3, 0] }
      }
    ]
  });
  window.addEventListener('resize', function() { chart1.resize(); });

  // --- Chart 2: Optimization Priority Matrix ---
  var chart2 = echarts.init(document.getElementById('chart-priority'), null, { renderer: 'svg' });
  chart2.setOption({
    animation: false,
    tooltip: {
      trigger: 'item',
      appendToBody: true,
      textStyle: { fontSize: 12 },
      formatter: function(params) {
        return '<b>' + params.data.name + '</b><br/>' +
               '影响度: ' + params.data.value[0] + '/10<br/>' +
               '紧急度: ' + params.data.value[1] + '/10<br/>' +
               '工作量: ' + params.data.workload;
      }
    },
    grid: { left: 60, right: 40, top: 50, bottom: 60 },
    xAxis: {
      type: 'value',
      name: '影响度 →',
      nameLocation: 'middle',
      nameGap: 35,
      min: 0, max: 11,
      axisLabel: { color: muted, fontSize: 11 },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } },
      nameTextStyle: { color: muted, fontSize: 12 }
    },
    yAxis: {
      type: 'value',
      name: '紧急度 →',
      nameLocation: 'middle',
      nameGap: 40,
      min: 0, max: 11,
      axisLabel: { color: muted, fontSize: 11 },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } },
      nameTextStyle: { color: muted, fontSize: 12 }
    },
    visualMap: {
      show: false,
      pieces: [
        { min: 0, max: 4, color: accent3 },
        { min: 4, max: 7, color: accent4 },
        { min: 7, max: 11, color: accent2 }
      ],
      dimension: 2
    },
    series: [
      {
        type: 'scatter',
        symbolSize: function(data) {
          return Math.sqrt(data.value[0] * data.value[1]) * 6;
        },
        data: [
          { name: '数据完整性修复', value: [10, 10, 9], workload: '1-2周', itemStyle: { color: accent2 } },
          { name: 'Docker部署完善', value: [7, 9, 7], workload: '3-5天', itemStyle: { color: accent2 } },
          { name: '模型回退机制', value: [6, 8, 5], workload: '2-3天', itemStyle: { color: accent2 } },
          { name: '智能组卷完善', value: [9, 7, 6], workload: '1-2周', itemStyle: { color: accent4 } },
          { name: '拍照搜题闭环', value: [8, 7, 5], workload: '1周', itemStyle: { color: accent4 } },
          { name: '前端组件化', value: [7, 5, 5], workload: '2-3周', itemStyle: { color: accent4 } },
          { name: '首页改版', value: [6, 6, 4], workload: '1周', itemStyle: { color: accent4 } },
          { name: '缓存层引入', value: [6, 8, 5], workload: '2-3天', itemStyle: { color: accent2 } },
          { name: '四向量数据补全', value: [5, 5, 4], workload: '1-2周', itemStyle: { color: accent3 } },
          { name: '知识图谱热力图', value: [5, 4, 3], workload: '1周', itemStyle: { color: accent3 } },
          { name: 'AI诊断报告', value: [8, 3, 7], workload: '2-3周', itemStyle: { color: accent3 } },
          { name: '多模态理解', value: [7, 2, 8], workload: '3-4周', itemStyle: { color: accent3 } },
          { name: 'SRS通知触达', value: [4, 5, 3], workload: '3-5天', itemStyle: { color: accent3 } },
          { name: '模块重组', value: [4, 3, 4], workload: '1周', itemStyle: { color: accent3 } },
          { name: '移动端优化', value: [6, 6, 4], workload: '1-2周', itemStyle: { color: accent4 } }
        ],
        label: {
          show: true,
          formatter: function(params) {
            return params.data.name;
          },
          position: 'top',
          color: ink,
          fontSize: 10,
          fontWeight: 600
        },
        labelLayout: {
          hideOverlap: false,
          moveOverlap: 'shiftY'
        }
      }
    ],
    graphic: [
      {
        type: 'text',
        left: '15%',
        top: 15,
        style: { text: '高影响 + 高紧急\n（立即执行）', fill: accent2, fontSize: 11, fontWeight: 600 }
      },
      {
        type: 'text',
        right: '15%',
        top: 15,
        style: { text: '高影响 + 低紧急\n（计划排期）', fill: accent3, fontSize: 11, fontWeight: 600 }
      },
      {
        type: 'text',
        left: '15%',
        bottom: 40,
        style: { text: '低影响 + 高紧急\n（快速处理）', fill: accent4, fontSize: 11, fontWeight: 600 }
      },
      {
        type: 'text',
        right: '15%',
        bottom: 40,
        style: { text: '低影响 + 低紧急\n（可延后）', fill: muted, fontSize: 11, fontWeight: 600 }
      }
    ]
  });
  window.addEventListener('resize', function() { chart2.resize(); });

})();
